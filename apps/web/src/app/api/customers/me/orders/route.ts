/**
 * GET /api/customers/me/orders (054 FR-5435, FR-5445, FR-5445a).
 *
 * Role-based filtering at the API level (not just UI):
 *  - individual / contact / purchaser → only own (customerId = me.id)
 *  - owner (companyId set) → all company orders + own personal, except colleagues' personal
 *  - accountant → company orders (no personal) with sensitive fields stripped
 */

import { NextResponse, type NextRequest } from "next/server";

import { customerError } from "@/lib/customers/api-utils";
import { loadCustomerFromRequest } from "@/lib/customers/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OrderSummary {
  id: string;
  clientNumber?: string;
  status: string;
  type?: string;
  total?: number;
  createdAt?: string;
  customerEmail?: string;
  /** Stripped from accountant view (FR-5445a). */
  items?: Array<{ sku: string; name: string; quantity: number; price?: number | null }>;
  delivery?: { method?: string; city?: string; address?: string };
  shipment?: { trackingNumber?: string };
  isPersonalOrder?: boolean;
}

export async function GET(req: NextRequest) {
  const loaded = await loadCustomerFromRequest(req);
  if (!loaded) return customerError(401, "unauthorized", "Not signed in");
  const { payload, customer } = loaded;

  // Build access where-clause based on role
  let where: Record<string, unknown>;
  const c = customer;

  if (c.role === "owner" && c.companyId) {
    // Own + company (excluding colleagues' personal)
    where = {
      or: [
        { customerId: { equals: c.id } },
        {
          and: [
            { companyId: { equals: c.companyId } },
            { isPersonalOrder: { not_equals: true } },
          ],
        },
      ],
    };
  } else if (c.role === "accountant" && c.companyId) {
    // M7 fix: accountant should see their own personal orders too
    where = {
      or: [
        { customerId: { equals: c.id } },
        {
          and: [
            { companyId: { equals: c.companyId } },
            { isPersonalOrder: { not_equals: true } },
          ],
        },
      ],
    };
  } else {
    // purchaser / contact / individual — only own
    where = { customerId: { equals: c.id } };
  }

  const result = await payload.find({
    collection: "orders",
    where: where as never,
    limit: 100,
    sort: "-createdAt",
    overrideAccess: true,
  });

  // M7 + privacy: accountant strips sensitive fields ONLY from orders that
  // belong to colleagues (not from their own).
  const isAccountant = c.role === "accountant";

  const orders: OrderSummary[] = (
    result.docs as unknown as Array<Record<string, unknown>>
  ).map((doc) => {
    const docCustomerId =
      typeof doc.customerId === "string"
        ? doc.customerId
        : typeof doc.customerId === "number"
          ? String(doc.customerId)
          : (doc.customerId as { id?: string | number } | undefined)?.id !== undefined
            ? String((doc.customerId as { id: string | number }).id)
            : undefined;
    const stripSensitive = isAccountant && docCustomerId !== c.id;
    const customer = (doc.customer ?? {}) as { email?: string };
    const totals = (doc.totals ?? {}) as { total?: number };
    const delivery = (doc.delivery ?? {}) as {
      method?: string;
      city?: string;
      address?: string;
    };
    const shipment = (doc.shipment ?? {}) as { trackingNumber?: string };

    const base: OrderSummary = {
      id: String(doc.id),
      clientNumber: typeof doc.clientNumber === "string" ? doc.clientNumber : undefined,
      status: String(doc.status ?? ""),
      type: typeof doc.type === "string" ? doc.type : undefined,
      total: typeof totals.total === "number" ? totals.total : undefined,
      createdAt: typeof doc.createdAt === "string" ? doc.createdAt : undefined,
      customerEmail: customer.email,
      isPersonalOrder: Boolean(doc.isPersonalOrder),
    };

    if (stripSensitive) {
      // FR-5445a: accountant doesn't get items, address, tracking
      return base;
    }

    base.items = Array.isArray(doc.items)
      ? (doc.items as Array<Record<string, unknown>>).map((it) => ({
          sku: String(it.sku ?? ""),
          name: String(it.name ?? ""),
          quantity: Number(it.quantity ?? 0),
          price: typeof it.price === "number" ? it.price : null,
        }))
      : [];
    base.delivery = {
      method: delivery.method,
      city: delivery.city,
      address: delivery.address,
    };
    base.shipment = { trackingNumber: shipment.trackingNumber };

    return base;
  });

  return NextResponse.json({
    orders,
    count: orders.length,
    role: c.role,
  });
}
