import { NextResponse, type NextRequest } from "next/server";
import configPromise from "@payload-config";
import { getPayload } from "payload";

type IncomingItem = {
  sku?: string;
  name?: string;
  slug?: string;
  quantity?: number | string;
  price?: number | null;
};

type IncomingPayload = {
  type?: "physical" | "legal" | "quote";
  items?: IncomingItem[];
  customer?: {
    fullName?: string;
    email?: string;
    phone?: string;
    companyName?: string;
    inn?: string;
    kpp?: string;
    ogrn?: string;
    legalAddress?: string;
  };
  delivery?: {
    method?: string;
    address?: string;
    city?: string;
    cost?: number;
  };
  sourcePage?: string;
};

const VAT_RATE = 0.2;

function sanitizeItems(items: IncomingItem[] | undefined) {
  const list = Array.isArray(items) ? items : [];
  return list
    .map((raw) => {
      const sku = String(raw?.sku ?? "").trim().slice(0, 120);
      const name = String(raw?.name ?? "").trim().slice(0, 240);
      const qty = Number(raw?.quantity);
      const quantity = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
      const price =
        typeof raw?.price === "number" && Number.isFinite(raw.price) ? raw.price : null;
      return {
        sku,
        name,
        slug: raw?.slug ? String(raw.slug).trim().slice(0, 200) : undefined,
        quantity,
        price,
        lineTotal: price !== null ? price * quantity : null,
      };
    })
    .filter((item) => item.sku || item.name);
}

function computeTotals(items: ReturnType<typeof sanitizeItems>, deliveryCost: number) {
  const subtotal = items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
  const vat = +(subtotal * VAT_RATE).toFixed(2);
  const total = +(subtotal + deliveryCost).toFixed(2);
  return { subtotal, vat, deliveryCost, total };
}

export async function POST(request: NextRequest) {
  let body: IncomingPayload;
  try {
    body = (await request.json()) as IncomingPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = body.type === "legal" || body.type === "quote" ? body.type : "physical";
  const items = sanitizeItems(body.items);
  if (items.length === 0) {
    return NextResponse.json({ error: "Empty cart" }, { status: 400 });
  }

  const deliveryCost = Number(body.delivery?.cost) || 0;
  const totals = computeTotals(items, deliveryCost);

  const initialStatus = type === "physical" ? "pending_payment" : type === "legal" ? "awaiting_payment" : "new";

  try {
    const payload = await getPayload({ config: configPromise });
    const order = await payload.create({
      collection: "orders",
      data: {
        type,
        status: initialStatus,
        items,
        totals,
        customer: body.customer ?? {},
        delivery: {
          method: (["pickup", "cdek", "boxberry", "russian-post", "tc"].includes(
            body.delivery?.method ?? "",
          )
            ? (body.delivery!.method as "pickup" | "cdek" | "boxberry" | "russian-post" | "tc")
            : undefined),
          address: body.delivery?.address,
          city: body.delivery?.city,
          cost: deliveryCost,
        },
        payment: {
          method: type === "legal" ? "invoice" : "card",
          providerStatus: "none",
        },
        sourcePage: body.sourcePage,
      },
    });

    return NextResponse.json(
      {
        id: order.id,
        publicToken: order.publicToken,
        status: order.status,
        type: order.type,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[orders] create failed:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
