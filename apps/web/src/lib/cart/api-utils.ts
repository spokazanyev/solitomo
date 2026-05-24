import "server-only";

/**
 * Shared HTTP utilities for Cart API routes (052).
 *
 * - Standard error response shape (ApiError from OpenAPI contract)
 * - Rate limiting (in-memory, per-IP) — FR-5212a, FR-5210 rate limit
 */

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

// ─── Rate limiting (simple in-memory, per-process) ────────────────────────────

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

function pruneBuckets() {
  if (buckets.size > 10_000) {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(key);
    }
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
  pruneBuckets();
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}

/**
 * Extract the client IP for rate limiting. Falls back to a constant if unavailable
 * (only used for keying buckets; not for accuracy).
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/**
 * Hash IP for GDPR-friendly storage in cart records.
 */
export function hashIp(ip: string): string {
  return hashCartToken(ip); // reuse SHA-256 → 12-char hex
}

// ─── Email masking for logs (FR-5229) ─────────────────────────────────────────

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [, domain] = email.split("@");
  return domain ? `***@${domain}` : "***";
}
