/**
 * POST /api/customers/forgot-password (054 US2a).
 *
 * Anti-enumeration: 200 OK regardless of whether email exists.
 * On match (password-set account): issue reset token, customer.preferences
 * event (049 will eventually route a T-0xx reset email).
 *
 * Rate-limit: 3/15min per email, 5/min per IP.
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
  findByEmail,
  issueResetToken,
  normalizeEmail,
} from "@/lib/customers/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  email: string;
}

const GENERIC_RESPONSE = {
  ok: true,
  message: "If the account exists and has a password, we sent a reset link.",
};

export async function POST(req: NextRequest) {
  const ip = getCustomerClientIp(req);
  if (!customerRateLimit(`customers:forgot:${ip}:1m`, 5, 60_000)) {
    return customerError(429, "rate_limited", "Too many requests");
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }

  const email = body.email ? normalizeEmail(body.email) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }

  if (!customerRateLimit(`customers:forgot:email:${email}:15m`, 3, 15 * 60_000)) {
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }

  const payload = await getPayload({ config: configPromise });

  try {
    const customer = await findByEmail(payload, email);
    if (!customer || customer.deletedAt) {
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }
    // Only issue reset token for password-set accounts (email-only customers
    // should use magic-link, not reset).
    if (customer.accountState !== "password-set") {
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    const { token } = await issueResetToken(payload, customer.id);

    if (process.env.NODE_ENV !== "production") {
      const baseUrl = process.env.SITE_URL ?? "http://localhost:3000";
      // eslint-disable-next-line no-console
      console.info(
        `[customers:forgot-password] DEV reset-link for ${email.split("@")[0]?.slice(0, 3)}***: ${baseUrl}/account/reset/${token}`,
      );
    }

    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[customers:forgot-password] failed:", err);
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }
}
