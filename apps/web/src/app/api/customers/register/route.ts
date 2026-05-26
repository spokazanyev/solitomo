/**
 * POST /api/customers/register (054 FR-5410, FR-5416a).
 *
 * Anti-enumeration: always returns 200 with a generic "check your email" message,
 * regardless of whether the email is new, existing, or invalid format.
 * Behind the scenes:
 *   - new email → create customers row, set password, send welcome+magic-link email
 *   - existing email → send "you're already registered, log in" email
 *   - invalid email → log + 200 (don't reveal validation rules)
 *
 * Rate-limited: 5/min per IP, 3/15min per email.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import {
  customerError,
  customerRateLimit,
  getCustomerClientIp,
  hashIpForCustomer,
} from "@/lib/customers/api-utils";
// 057 US4: PDPA + offer consent validation + recording
import type { ConsentRecord } from "@/lib/consent/consent-types";
import {
  ConsentPolicyMissingError,
  makeConsentRecord,
} from "@/lib/consent/make-consent-record";
import { findByEmail, normalizeEmail } from "@/lib/customers/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  customerType?: "individual" | "company-contact";
  companyId?: string;
  marketingOptIn?: boolean;
  // 057 US4: explicit PDPA + offer consent (true required)
  consent?: boolean;
}

const GENERIC_RESPONSE = {
  ok: true,
  message: "If the email is valid, we sent you a confirmation. Check your inbox.",
};

export async function POST(req: NextRequest) {
  // Rate limit (FR-5416)
  const ip = getCustomerClientIp(req);
  if (!customerRateLimit(`customers:register:${ip}:1m`, 5, 60_000)) {
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
  const validEmail =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

  if (!validEmail) {
    // Anti-enum: same response shape as success
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }

  // Per-email rate limit
  if (!customerRateLimit(`customers:register:email:${email}:15m`, 3, 15 * 60_000)) {
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }

  const payload = await getPayload({ config: configPromise });

  try {
    const existing = await findByEmail(payload, email);

    if (existing) {
      // FR-5416a: send "already registered" email instead of 409
      // (we just log it for now — actual email sending is 049's job)
      payload.logger.info(
        `[customers:register] existing email ${hashIpForCustomer(email)} — would send "already registered" email`,
      );
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    }

    // New customer: create with password if provided, otherwise email-only
    const password = body.password?.trim();
    const hasPassword = Boolean(password && password.length >= 8);

    await payload.create({
      collection: "customers" as never,
      data: {
        email,
        password: hasPassword ? password : undefined,
        firstName: body.firstName?.trim(),
        lastName: body.lastName?.trim(),
        phone: body.phone?.trim(),
        customerType: body.customerType ?? "individual",
        companyId: body.companyId,
        accountState: hasPassword ? "password-set" : "email-only",
        marketingOptIn: Boolean(body.marketingOptIn),
        gdprConsentAt: new Date().toISOString(),
        // 057 US4: persist PDPA + offer consent record (152-ФЗ Art. 9)
        consent: consentRecord,
      } as never,
      overrideAccess: true,
    });

    // Note: actual welcome + magic-link email is dispatched via customer.created
    // event (049 notification matrix), so no direct send needed here.

    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  } catch (err) {
    // Treat all DB errors as silent success for anti-enum.
    // eslint-disable-next-line no-console
    console.error("[customers:register] failed:", err);
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }
}
