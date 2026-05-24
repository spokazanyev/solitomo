/**
 * POST /api/customers/reset-password?token=X (054 US2a).
 *
 * Body: { newPassword: string (min 8 chars) }
 * Sets new passwordHash via Payload, clears reset token, invalidates other sessions
 * (Payload regenerates the token; old cookies become invalid).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import {
  customerError,
  customerRateLimit,
  getCustomerClientIp,
} from "@/lib/customers/api-utils";
import { findByResetToken } from "@/lib/customers/repository";
import {
  isResetTokenExpired,
  isValidResetTokenFormat,
} from "@/lib/customers/reset-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  newPassword: string;
}

export async function POST(req: NextRequest) {
  const ip = getCustomerClientIp(req);
  if (!customerRateLimit(`customers:reset:${ip}:1m`, 10, 60_000)) {
    return customerError(429, "rate_limited", "Too many requests");
  }

  const token = req.nextUrl.searchParams.get("token");
  if (!isValidTokenFormat(token)) {
    return customerError(400, "reset_token_invalid", "Invalid token format");
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return customerError(400, "validation_failed", "Invalid JSON");
  }

  const newPassword = body.newPassword?.trim();
  if (!newPassword || newPassword.length < 8 || newPassword.length > 256) {
    return customerError(400, "validation_failed", "Password must be 8-256 characters");
  }

  const payload = await getPayload({ config: configPromise });

  // 054 H5: findByResetToken hashes the input and looks up by hash; the
  // plaintext-equality re-check is no longer meaningful (lookup is the proof).
  const customer = await findByResetToken(payload, token);
  if (!customer || !customer.resetPasswordToken) {
    return customerError(404, "reset_token_invalid", "Reset link is invalid");
  }

  if (isResetTokenExpired(customer.resetPasswordExpiresAt)) {
    return customerError(410, "reset_token_expired", "Reset link has expired");
  }

  if (customer.deletedAt) {
    return customerError(403, "account_deleted", "Account has been deleted");
  }

  // Update password via Payload — also clears any cached login attempt counters.
  try {
    await payload.update({
      collection: "customers" as never,
      id: customer.id,
      data: {
        password: newPassword,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
        accountState: "password-set",
      } as never,
      overrideAccess: true,
    });
  } catch (err) {
    payload.logger.error(`[customers:reset-password] update failed: ${(err as Error)?.message}`);
    return customerError(500, "validation_failed", "Failed to reset password");
  }

  return NextResponse.json({ ok: true, message: "Password reset. Please log in." });
}

// Reused helper to avoid duplicate import
function isValidTokenFormat(token: unknown): token is string {
  return isValidResetTokenFormat(token);
}
