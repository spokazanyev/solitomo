import "server-only";

/**
 * Shared HTTP utilities for Customer API routes (054).
 *
 * - Standard error response shape
 * - Rate limiting (in-memory, per-process — same caveats as 052/053)
 * - Trusted-proxy aware client IP
 * - CSRF helpers (double-submit cookie pattern)
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { hashMagicLinkToken } from "./magic-link";

// ─── Error shape ──────────────────────────────────────────────────────────────

export type CustomerErrorCode =
  | "validation_failed"
  | "not_found"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "magic_link_invalid"
  | "magic_link_expired"
  | "magic_link_consumed"
  | "reset_token_expired"
  | "reset_token_invalid"
  | "orders_in_progress"
  | "csrf_invalid"
  | "account_deleted"
  | "duplicate_email"
  | "account_state_invalid";

export interface CustomerErrorBody {
  code: CustomerErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export function customerError(
  status: number,
  code: CustomerErrorCode,
  message: string,
  details?: Record<string, unknown>,
): NextResponse<CustomerErrorBody> {
  return NextResponse.json<CustomerErrorBody>({ code, message, details }, { status });
}

// ─── Rate limiting ────────────────────────────────────────────────────────────
//
// Same caveats as Cart/Returns: per-process Map. Multi-instance deployments
// multiply effective limits — migrate to Redis-backed bucket for production.

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();
const MAX_BUCKETS = 10_000;

export function customerRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > MAX_BUCKETS) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}

// ─── IP extraction (trusted-proxy aware) ──────────────────────────────────────

const TRUST_PROXY = process.env.TRUST_PROXY_HEADERS === "true";

export function getCustomerClientIp(req: Request): string {
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]!.trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  if (TRUST_PROXY) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }
  return "unknown";
}

// ─── PII-safe hashing for logs ────────────────────────────────────────────────

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

export function hashIpForCustomer(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";
  return createHmac("sha256", getIpHashKey()).update(ip).digest("hex").slice(0, 16);
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [, domain] = email.split("@");
  return domain ? `***@${domain}` : "***";
}

export const tokenHash = hashMagicLinkToken;

// ─── CSRF (double-submit cookie pattern) ──────────────────────────────────────
//
// FR-5417: CSRF protection on all POST/PATCH/DELETE under /api/customers/*.
//
// Pattern: server sets `customer_csrf_token` cookie (NOT HTTP-only — client JS
// must read it) AND client echoes the same value in `X-CSRF-Token` header.
// Both values must match for the request to proceed. Same-origin attackers
// cannot read cookies of other origins → cannot forge the header.

const CSRF_COOKIE_NAME = "customer_csrf_token";

export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Returns the CSRF cookie name. */
export function getCsrfCookieName(): string {
  return CSRF_COOKIE_NAME;
}

/**
 * Verify the double-submit CSRF token from request.
 * Reads cookie + header, returns true iff both present and equal in constant time.
 */
export function verifyCsrfToken(req: Request): boolean {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieMatch = cookieHeader.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]+)`));
  const cookieValue = cookieMatch?.[1];
  const headerValue = req.headers.get("x-csrf-token");
  if (!cookieValue || !headerValue) return false;
  if (cookieValue.length !== headerValue.length) return false;
  try {
    return timingSafeEqual(Buffer.from(cookieValue), Buffer.from(headerValue));
  } catch {
    return false;
  }
}
