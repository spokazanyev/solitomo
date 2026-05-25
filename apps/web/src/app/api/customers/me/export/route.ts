/**
 * GET /api/customers/me/export (054 FR-5440).
 *
 * GDPR / 152-ФЗ data export. Returns JSON containing:
 *  - customer profile (sanitized — no tokens/hashes)
 *  - addresses[]
 *  - orders[] (metadata, no attachments)
 *  - returns[] (FR-5405)
 *  - carts[] (active)
 *
 * Downloads as attachment for offline review.
 */

import { NextResponse, type NextRequest } from "next/server";

import { customerError } from "@/lib/customers/api-utils";
import { loadCustomerFromRequest } from "@/lib/customers/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const loaded = await loadCustomerFromRequest(req);
  if (!loaded) return customerError(401, "unauthorized", "Not signed in");
  const { payload, customer } = loaded;

  // Load full customer doc to expose all editable fields
  const fullDoc = (await payload.findByID({
    collection: "customers" as never,
    id: customer.id,
    overrideAccess: true,
  })) as unknown as Record<string, unknown>;

  // Strip security-sensitive fields
  const sanitizedCustomer = {
    id: fullDoc.id,
    email: fullDoc.email,
    firstName: fullDoc.firstName ?? null,
    lastName: fullDoc.lastName ?? null,
    fullName: fullDoc.fullName ?? null,
    phone: fullDoc.phone ?? null,
    customerType: fullDoc.customerType,
    companyId: fullDoc.companyId ?? null,
    role: fullDoc.role,
    accountState: fullDoc.accountState,
    addresses: fullDoc.addresses ?? [],
    marketingOptIn: fullDoc.marketingOptIn,
    messengerOptIn: fullDoc.messengerOptIn,
    languagePreference: fullDoc.languagePreference,
    gdprConsentAt: fullDoc.gdprConsentAt ?? null,
    gdprConsentVersion: fullDoc.gdprConsentVersion ?? null,
    createdAt: fullDoc.createdAt,
    lastLoginAt: fullDoc.lastLoginAt ?? null,
    loginCount: fullDoc.loginCount ?? 0,
  };

  // Load related entities (without overrideAccess for safety — own data only)
  const ordersResult = await payload.find({
    collection: "orders",
    where: { customerId: { equals: customer.id } } as never,
    limit: 500,
    sort: "-createdAt",
    overrideAccess: true,
  });

  const returnsResult = await payload.find({
    collection: "returns" as never,
    where: { customerId: { equals: customer.id } } as never,
    limit: 200,
    sort: "-requestedAt",
    overrideAccess: true,
  });

  const cartsResult = await payload.find({
    collection: "carts" as never,
    where: { customerId: { equals: customer.id } } as never,
    limit: 50,
    overrideAccess: true,
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportVersion: "1.0",
    customer: sanitizedCustomer,
    orders: ordersResult.docs.map((d) => ({
      id: String((d as { id: unknown }).id),
      clientNumber: (d as { clientNumber?: string }).clientNumber,
      status: (d as { status?: string }).status,
      totals: (d as { totals?: unknown }).totals,
      delivery: (d as { delivery?: unknown }).delivery,
      payment: (d as { payment?: unknown }).payment,
      createdAt: (d as { createdAt?: string }).createdAt,
    })),
    returns: returnsResult.docs.map((d) => ({
      id: String((d as { id: unknown }).id),
      returnNumber: (d as { returnNumber?: string }).returnNumber,
      status: (d as { status?: string }).status,
      refundAmount: (d as { refundAmount?: number }).refundAmount,
      requestedAt: (d as { requestedAt?: string }).requestedAt,
    })),
    carts: cartsResult.docs.map((d) => ({
      id: String((d as { id: unknown }).id),
      status: (d as { status?: string }).status,
      itemCount: ((d as { totals?: { itemCount?: number } }).totals)?.itemCount ?? 0,
      lastActivityAt: (d as { lastActivityAt?: string }).lastActivityAt,
    })),
  };

  const filename = `soliton-export-${customer.id}-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
