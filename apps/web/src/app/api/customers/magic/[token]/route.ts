/**
 * GET /api/customers/magic/[token] (054 FR-5411).
 *
 * Verify a magic-link token:
 *   - validate format + DB lookup
 *   - check expiry
 *   - reject already-consumed (single-use)
 *   - issue Payload-native customer session cookie (`customer_session`)
 *   - mark token consumed
 *   - record login
 *
 * Returns 200 + customer snapshot on success; 410 on expired/consumed; 404 on
 * unknown token.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import {
  customerError,
  customerRateLimit,
  getCustomerClientIp,
} from "@/lib/customers/api-utils";
import {
  isMagicLinkExpired,
  isValidTokenFormat,
} from "@/lib/customers/magic-link";
import {
  consumeMagicLink,
  findByMagicToken,
  recordLogin,
} from "@/lib/customers/repository";
import { signCustomerSessionToken } from "@/lib/customers/session-token";
import { generateCsrfToken, getCsrfCookieName } from "@/lib/customers/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!isValidTokenFormat(token)) {
    return customerError(400, "magic_link_invalid", "Invalid token format");
  }

  // Rate limit per IP — anti-guess (although 256-bit space is brute-resistant)
  const ip = getCustomerClientIp(req);
  if (!customerRateLimit(`customers:magic-verify:${ip}:1m`, 20, 60_000)) {
    return customerError(429, "rate_limited", "Too many requests");
  }

  const payload = await getPayload({ config: configPromise });

  // findByMagicToken now hashes the incoming token + looks up by hash (H5).
  const customer = await findByMagicToken(payload, token);
  if (!customer || !customer.magicLinkToken) {
    return customerError(404, "magic_link_invalid", "Magic-link not found");
  }

  if (isMagicLinkExpired(customer.magicLinkExpiresAt)) {
    return customerError(410, "magic_link_expired", "Magic-link has expired");
  }

  if (customer.magicLinkConsumedAt) {
    return customerError(410, "magic_link_consumed", "Magic-link already used");
  }

  if (customer.deletedAt) {
    return customerError(403, "account_deleted", "Account has been deleted");
  }

  // C1 fix: sign JWT directly with PAYLOAD_SECRET instead of payload.login (which
  // would always fail against the random placeholder password and lock the account
  // after 5 magic-link clicks via the login-attempts counter).
  const ttlSeconds = Number(process.env.CUSTOMER_SESSION_TTL_HOURS ?? 24) * 60 * 60;
  let sessionToken: string;
  try {
    sessionToken = signCustomerSessionToken(
      { id: customer.id, collection: "customers", email: customer.email },
      ttlSeconds,
    );
  } catch (err) {
    payload.logger.error(`[customers:magic] token sign failed: ${(err as Error).message}`);
    return customerError(500, "validation_failed", "Failed to issue session");
  }

  // Consume token + record login
  await consumeMagicLink(payload, customer.id);
  await recordLogin(
    payload,
    customer.id,
    ip,
    req.headers.get("user-agent") ?? undefined,
    customer.loginCount,
  );

  const response = NextResponse.json({
    ok: true,
    customer: {
      id: customer.id,
      email: customer.email,
      fullName: customer.fullName,
      accountState: customer.accountState,
      customerType: customer.customerType,
    },
  });

  response.cookies.set("customer_session", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttlSeconds,
  });

  // C2 fix: also issue CSRF token cookie so mutating /me/* endpoints can work.
  // Not HttpOnly — client JS reads it and echoes into X-CSRF-Token header.
  response.cookies.set(getCsrfCookieName(), generateCsrfToken(), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttlSeconds,
  });

  return response;
}
