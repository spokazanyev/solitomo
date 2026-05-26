/**
 * POST /api/customers/magic-request (054 FR-5411, FR-5416).
 *
 * Customer requests a magic-link by email. Anti-enumeration: 200 OK regardless
 * of whether the email exists. On success: customer record created (email-only)
 * if missing, magic-link token issued, customer.created/preferences event
 * triggers email send via 049.
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
// 057 US4: PDPA + offer consent validation + recording
import type { ConsentRecord } from "@/lib/consent/consent-types";
import {
  ConsentPolicyMissingError,
  makeConsentRecord,
} from "@/lib/consent/make-consent-record";
import {
  findByEmail,
  getOrCreateEmailOnlyCustomer,
  issueMagicLink,
  normalizeEmail,
} from "@/lib/customers/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  email: string;
  // 057 US4: explicit PDPA + offer consent (true required)
  consent?: boolean;
}

const GENERIC_RESPONSE = { ok: true, message: "If the email is valid, we sent a magic-link." };

export async function POST(req: NextRequest) {
  const ip = getCustomerClientIp(req);
  if (!customerRateLimit(`customers:magic:${ip}:1m`, 5, 60_000)) {
    return customerError(429, "rate_limited", "Too many requests");
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }

  // 057 US4: PDPA + offer consent gate (FR-5712). Returns 400 explicitly —
  // anti-enum applies only to email existence; missing consent is a client error.
  if (body.consent !== true) {
    return NextResponse.json(
      { error: "CONSENT_REQUIRED", message: "Consent to PDPA and offer is required" },
      { status: 400 },
    );
  }
  let consentRecord: ConsentRecord;
  try {
    consentRecord = await makeConsentRecord(req);
  } catch (e) {
    if (e instanceof ConsentPolicyMissingError) {
      return NextResponse.json(
        {
          error: "POLICY_NOT_READY",
          message: "Policy documents are not yet published. Contact support.",
        },
        { status: 503 },
      );
    }
    throw e;
  }

  const email = body.email ? normalizeEmail(body.email) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }

  // Per-email rate limit (FR-5416)
  if (!customerRateLimit(`customers:magic:email:${email}:15m`, 3, 15 * 60_000)) {
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }

  const payload = await getPayload({ config: configPromise });

  try {
    // Don't issue magic-link to deleted accounts (silent — anti-enum)
    const existing = await findByEmail(payload, email, { includeDeleted: true });
    if (existing?.deletedAt) {
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    // Create-or-get email-only customer.
    // 057 US4: when a NEW customer row is created, persist the consent record.
    // For existing customers we keep the original consent untouched.
    const customer =
      existing ?? (await getOrCreateEmailOnlyCustomer(payload, email, consentRecord));

    // Issue magic-link token
    const { token } = await issueMagicLink(payload, customer.id, ip);

    // Email is sent via customer.created/customer.activated event chain (049 matrix).
    // For now we just log the link in dev.
    if (process.env.NODE_ENV !== "production") {
      const baseUrl = process.env.SITE_URL ?? "http://localhost:3000";
      // eslint-disable-next-line no-console
      console.info(
        `[customers:magic-request] DEV magic-link for ${email.split("@")[0]?.slice(0, 3)}***: ${baseUrl}/account/magic/${token}`,
      );
    }

    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[customers:magic-request] failed:", err);
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }
}
