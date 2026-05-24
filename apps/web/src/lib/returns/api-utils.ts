import "server-only";

/**
 * Shared HTTP utilities for Returns API (053).
 */

import { NextResponse } from "next/server";

export type ReturnErrorCode =
  | "validation_failed"
  | "not_found"
  | "rate_limited"
  | "order_not_returnable"
  | "qty_exceeds_available"
  | "refund_exceeds_total"
  | "invalid_transition"
  | "missing_reason"
  | "unauthorized"
  | "idempotency_conflict"
  | "yookassa_error";

export interface ReturnErrorBody {
  code: ReturnErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export function returnError(
  status: number,
  code: ReturnErrorCode,
  message: string,
  details?: Record<string, unknown>,
): NextResponse<ReturnErrorBody> {
  return NextResponse.json<ReturnErrorBody>({ code, message, details }, { status });
}

// ─── Simple in-memory rate-limit (per-process, same caveat as carts) ──────────

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

export function returnsRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}

export function getClientIpForReturns(req: Request): string {
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]!.trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  if (process.env.TRUST_PROXY_HEADERS === "true") {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
  }
  return "unknown";
}
