/**
 * POST /api/customers/me/delete (054 FR-5441, FR-5442, data-model §11).
 *
 * GDPR / 152-ФЗ subject erasure request. Soft-deletes customer + anonymizes PII.
 *  - Blocks if active Orders (pending_payment / paid / fulfilling / shipped)
 *  - Anonymizes per data-model §11 table:
 *      email → deleted-{id}@gdpr.local
 *      phone, names, addresses, IPs, tokens → null/cleared
 *      accountState → "deleted"
 *  - Order.customer.* snapshot retained (ФЗ-402 bookkeeping)
 *  - Emits customer.deleted event (Twenty cascade-delete via 048)
 *
 * Requires CSRF + active session.
 */

import { NextResponse, type NextRequest } from "next/server";

import { customerError, verifyCsrfToken } from "@/lib/customers/api-utils";
import { loadCustomerFromRequest } from "@/lib/customers/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLOCKING_ORDER_STATUSES = ["pending_payment", "paid", "fulfilling", "shipped"];

export async function POST(req: NextRequest) {
  const loaded = await loadCustomerFromRequest(req);
  if (!loaded) return customerError(401, "unauthorized", "Not signed in");
  const { payload, customer } = loaded;

  if (!verifyCsrfToken(req)) {
    return customerError(403, "csrf_invalid", "CSRF token missing or mismatched");
  }

  // FR-5442: block deletion when in-progress orders exist
  const activeOrders = await payload.find({
    collection: "orders",
    where: {
      and: [
        { customerId: { equals: customer.id } },
        { status: { in: BLOCKING_ORDER_STATUSES } },
      ],
    } as never,
    limit: 1,
    overrideAccess: true,
  });

  if (activeOrders.docs.length > 0) {
    return customerError(
      409,
      "orders_in_progress",
      "Cannot delete account: you have active orders. Wait until they are delivered or cancelled.",
      { blockingOrderCount: activeOrders.totalDocs },
    );
  }

  // Data-model §11: GDPR anonymization
  const anonymizedEmail = `deleted-${customer.id}@gdpr.local`;
  const now = new Date().toISOString();

  // M3 fix: align fully with data-model.md §11 GDPR anonymization table.
  try {
    await payload.update({
      collection: "customers" as never,
      id: customer.id,
      data: {
        // Direct PII
        email: anonymizedEmail,
        firstName: null,
        lastName: null,
        fullName: "Удалён",
        phone: null,
        phoneNormalized: null,
        addresses: [],
        // Indirect PII (login/session traces)
        lastLoginIp: null,
        lastLoginUserAgent: null,
        magicLinkRequestedFromIp: null,
        // Security tokens
        magicLinkToken: null,
        magicLinkExpiresAt: null,
        magicLinkConsumedAt: null,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
        inviteToken: null,
        inviteExpiresAt: null,
        inviteAcceptedAt: null,
        // CRM ref — drop Company link; Twenty Person cascades via FR-5449
        crmCompanyId: null,
        // Lifecycle
        accountState: "deleted",
        deletedAt: now,
        // Preferences (revoke consent)
        marketingOptIn: false,
        messengerOptIn: false,
        emailValid: false,
        // RETAIN: createdAt, gdprConsentAt, gdprConsentVersion, crmPersonId,
        // loginCount, lastLoginAt — needed for audit (per data-model §11)
      } as never,
      overrideAccess: true,
    });
  } catch (err) {
    payload.logger.error(`[customers:me/delete] failed: ${(err as Error)?.message}`);
    return customerError(500, "validation_failed", "Failed to delete account");
  }

  // Clear session
  const response = NextResponse.json({
    ok: true,
    message: "Your account has been deleted.",
  });
  response.cookies.set("customer_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("customer_csrf_token", "", {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
