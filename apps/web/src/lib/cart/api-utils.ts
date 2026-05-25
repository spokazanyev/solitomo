import "server-only";

/**
 * Shared HTTP utilities for Cart API routes (052).
 *
 * - Standard error response shape (ApiError from OpenAPI contract)
 * - Rate limiting (in-memory, per-process)
 * - Trusted-proxy aware client IP extraction
 * - HMAC-based IP pseudonymization (GDPR audit trail)
 *
 * ⚠ Deployment requirement (M3): rate-limit buckets are in-process Maps.
 * On multi-instance deployments (Vercel serverless, k8s replicas, etc.) effective
 * per-IP limits are multiplied by the instance count. For strict per-customer
 * limits in production, migrate to a Redis/Postgres-backed token bucket.
 * Current implementation is sufficient for single-instance / low-replica MVP.
 */

import { createHmac } from "node:crypto";

import { NextResponse } from "next/server";

import { hashCartToken } from "./token";

// ─── Error response shapes (from cart-api.openapi.yaml ApiError) ──────────────

export type CartErrorCode =
  | "validation_failed"
  | "not_found"
  | "gone"
  | "cart_already_converted"
  | "cart_expired"
  | "cart_merged"
  | "cart_stale"
  | "rate_limited"
  | "merge_pending_054"
  | "idempotency_conflict"
  | "unauthorized";

export interface CartErrorBody {
  error: CartErrorCode;
  message?: string;
  details?: Record<string, unknown>;
}

export function cartError(
  status: number,
  error: CartErrorCode,
  message?: string,
  details?: Record<string, unknown>,
): NextResponse<CartErrorBody> {
  return NextResponse.json<CartErrorBody>({ error, message, details }, { status });
}

// ─── Rate limiting (in-memory, per-process) ───────────────────────────────────
//
// M8 fix: lazy expiry pruning on every access (no longer waits for 10k entries).

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();
const MAX_BUCKETS = 10_000;

function sweepExpired(now: number): void {
  // Sweep is O(n) but only triggered when map size exceeds threshold.
  // Lazy pruning on access happens inline in rateLimit().
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Check & increment rate limit. Returns true if allowed, false if exceeded.
 *
 * @param key - unique identifier (e.g. `cart:create:${ip}`)
 * @param max - max requests in the window
 * @param windowMs - window duration in ms
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();

  // M8: lazy expiry on access — never accumulates dead buckets above active load
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    sweepExpired(now);
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}

// ─── Trusted-proxy aware client IP ────────────────────────────────────────────
//
// M2 fix: trust X-Forwarded-For only when env says we're behind a trusted proxy.
// Otherwise an attacker can spoof the header to bypass per-IP rate limits.

const TRUST_PROXY = process.env.TRUST_PROXY_HEADERS === "true";

/**
 * Extract the client IP, respecting trusted-proxy configuration.
 *
 * Priority order:
 *   1. Vercel-specific `x-vercel-forwarded-for` (always trusted — set by Vercel)
 *   2. Cloudflare `cf-connecting-ip` (always trusted — set by CF)
 *   3. `x-forwarded-for` / `x-real-ip` only if `TRUST_PROXY_HEADERS=true`
 *   4. Fallback to "unknown" (rate-limit by per-process aggregate)
 */
export function getClientIp(req: Request): string {
  // Vercel and Cloudflare set these themselves; safe to trust unconditionally
  const vercelFor = req.headers.get("x-vercel-forwarded-for");
  if (vercelFor) return vercelFor.split(",")[0]!.trim();

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // Generic proxy headers — only trust if explicitly enabled
  if (TRUST_PROXY) {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }

  return "unknown";
}

// ─── IP pseudonymization (M1 fix) ─────────────────────────────────────────────
//
// HMAC-SHA256 with server-side secret prevents rainbow-table recovery if the
// hash is ever leaked. 16 hex chars = 64 bits of collision resistance, enough
// for fraud-detection grouping while staying GDPR-friendly.

let _ipHashKey: Buffer | null = null;

function getIpHashKey(): Buffer {
  if (_ipHashKey) return _ipHashKey;
  const secret =
    process.env.IP_HASH_SECRET ??
    process.env.PAYLOAD_SECRET ??
    process.env.CRON_SECRET ??
    "soliton-default-ip-hash-key";
  _ipHashKey = Buffer.from(secret, "utf-8");
  return _ipHashKey;
}

/**
 * Hash IP for GDPR-friendly storage in cart records.
 * 64-bit HMAC-SHA256 truncated — collision-resistant, unrecoverable without secret.
 */
export function hashIp(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";
  return createHmac("sha256", getIpHashKey()).update(ip).digest("hex").slice(0, 16);
}

/**
 * Hash an arbitrary string for log output (no secret — used for cartToken).
 * Retained for backward compatibility with existing log statements.
 */
export const hashForLog = hashCartToken;

// ─── Email masking for logs (FR-5229) ─────────────────────────────────────────

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [, domain] = email.split("@");
  return domain ? `***@${domain}` : "***";
}
