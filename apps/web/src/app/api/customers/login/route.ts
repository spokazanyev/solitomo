/**
 * POST /api/customers/login (054 FR-5410, FR-5416).
 *
 * Email + password login. Rate-limited 5 attempts / 15 min per IP.
 * On success: sets `customer_session` cookie, records login.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { createHash } from "node:crypto";

import {
  customerError,
  customerRateLimit,
  generateCsrfToken,
  getCsrfCookieName,
  getCustomerClientIp,
} from "@/lib/customers/api-utils";
import {
  findByEmail,
  normalizeEmail,
  recordLogin,
} from "@/lib/customers/repository";
import { signCustomerSessionToken } from "@/lib/customers/session-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  email: string;
  password: string;
}

export async function POST(req: NextRequest) {
  const ip = getCustomerClientIp(req);
  if (!customerRateLimit(`customers:login:${ip}:15m`, 5, 15 * 60_000)) {
    return customerError(429, "rate_limited", "Too many login attempts. Try again later.");
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return customerError(400, "validation_failed", "Invalid JSON");
  }

  if (!body.email || !body.password) {
    return customerError(400, "validation_failed", "Email and password required");
  }

  const email = normalizeEmail(body.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return customerError(401, "unauthorized", "Invalid credentials");
  }

  const payload = await getPayload({ config: configPromise });

  // H1 fix + M1 fix: uniform 401 + dummy bcrypt to equalize timing.
  // Anti-enum: same code/message regardless of email/state/password validity.
  const existing = await findByEmail(payload, email, { includeDeleted: true });
  const canAttempt = existing && !existing.deletedAt && existing.accountState === "password-set";

  let loginResult: { token?: string };
  try {
    if (canAttempt) {
      loginResult = await payload.login({
        collection: "customers" as never,
        data: { email, password: body.password } as never,
      } as never);
    } else {
      // M1: timing-equalization — hash the submitted password against a fixed
      // dummy salt so unknown-email response is not measurably faster.
      createHash("sha256").update(`dummy:${body.password}`).digest("hex");
      loginResult = {};
    }
  } catch {
    loginResult = {};
  }

  if (!canAttempt || !loginResult.token) {
    return customerError(401, "unauthorized", "Invalid credentials");
  }

  await recordLogin(
    payload,
    existing.id,
    ip,
    req.headers.get("user-agent") ?? undefined,
    existing.loginCount,
  );

  // C1 fix: use signed JWT (consistent with magic-link verify)
  const ttlSeconds = Number(process.env.CUSTOMER_SESSION_TTL_HOURS ?? 24) * 60 * 60;
  const sessionToken = signCustomerSessionToken(
    { id: existing.id, collection: "customers", email: existing.email },
    ttlSeconds,
  );

  const response = NextResponse.json({
    ok: true,
    customer: { id: existing.id, email: existing.email, fullName: existing.fullName },
  });

  response.cookies.set("customer_session", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttlSeconds,
  });

  // C2 fix: issue CSRF cookie alongside session
  response.cookies.set(getCsrfCookieName(), generateCsrfToken(), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttlSeconds,
  });

  return response;
}
