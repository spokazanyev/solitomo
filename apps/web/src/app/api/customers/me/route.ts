/**
 * GET / PATCH /api/customers/me (054 US2, US5).
 *
 * Requires customer session. Returns sanitized profile + accepts profile updates.
 */

import { NextResponse, type NextRequest } from "next/server";

import { customerError, verifyCsrfToken } from "@/lib/customers/api-utils";
import { loadCustomerFromRequest } from "@/lib/customers/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchBody {
  firstName?: string;
  lastName?: string;
  phone?: string;
  marketingOptIn?: boolean;
  messengerOptIn?: boolean;
  languagePreference?: "ru" | "en";
  addresses?: Array<{
    label: string;
    city: string;
    fullAddress: string;
    postalCode?: string;
    isDefault?: boolean;
  }>;
}

function publicView(customer: ReturnType<typeof toJsonable>) {
  return customer;
}

function toJsonable(c: {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  customerType: string;
  companyId?: string;
  role: string;
  accountState: string;
  marketingOptIn: boolean;
  messengerOptIn: boolean;
  emailValid: boolean;
}) {
  return {
    id: c.id,
    email: c.email,
    firstName: c.firstName ?? null,
    lastName: c.lastName ?? null,
    fullName: c.fullName ?? null,
    phone: c.phone ?? null,
    customerType: c.customerType,
    companyId: c.companyId ?? null,
    role: c.role,
    accountState: c.accountState,
    marketingOptIn: c.marketingOptIn,
    messengerOptIn: c.messengerOptIn,
    emailValid: c.emailValid,
  };
}

export async function GET(req: NextRequest) {
  const loaded = await loadCustomerFromRequest(req);
  if (!loaded) return customerError(401, "unauthorized", "Not signed in");
  return NextResponse.json({ customer: publicView(toJsonable(loaded.customer)) });
}

export async function PATCH(req: NextRequest) {
  const loaded = await loadCustomerFromRequest(req);
  if (!loaded) return customerError(401, "unauthorized", "Not signed in");

  // FR-5417: CSRF required for mutating endpoints
  if (!verifyCsrfToken(req)) {
    return customerError(403, "csrf_invalid", "CSRF token missing or mismatched");
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return customerError(400, "validation_failed", "Invalid JSON");
  }

  const data: Record<string, unknown> = {};

  if (body.firstName !== undefined) data.firstName = body.firstName.trim().slice(0, 100);
  if (body.lastName !== undefined) data.lastName = body.lastName.trim().slice(0, 100);
  if (body.phone !== undefined) data.phone = body.phone.trim().slice(0, 32);
  if (typeof body.marketingOptIn === "boolean") data.marketingOptIn = body.marketingOptIn;
  if (typeof body.messengerOptIn === "boolean") data.messengerOptIn = body.messengerOptIn;
  if (body.languagePreference === "ru" || body.languagePreference === "en") {
    data.languagePreference = body.languagePreference;
  }
  if (Array.isArray(body.addresses)) {
    if (body.addresses.length > 10) {
      return customerError(400, "validation_failed", "Maximum 10 addresses");
    }
    data.addresses = body.addresses.map((a) => ({
      label: String(a.label ?? "").slice(0, 50),
      city: String(a.city ?? "").slice(0, 100),
      fullAddress: String(a.fullAddress ?? "").slice(0, 500),
      postalCode: a.postalCode?.slice(0, 12),
      isDefault: Boolean(a.isDefault),
    }));
  }

  try {
    const updated = await loaded.payload.update({
      collection: "customers" as never,
      id: loaded.customer.id,
      data: data as never,
      overrideAccess: true,
    });
    return NextResponse.json({ customer: publicView(toJsonable(updated as never)) });
  } catch (err) {
    loaded.payload.logger.error(
      `[customers:me PATCH] update failed: ${(err as Error)?.message}`,
    );
    return customerError(500, "validation_failed", "Update failed");
  }
}
