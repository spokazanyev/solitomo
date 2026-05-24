import { NextResponse, type NextRequest } from "next/server";
import configPromise from "@payload-config";
import { getPayload } from "payload";

import { getCartTokenFromCookie } from "@/lib/cart/cookie";
import {
  CartAlreadyConvertedError,
  createCart,
  findByToken,
  markConverted,
} from "@/lib/cart/repository";
import { generateCartToken } from "@/lib/cart/token";

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
  cartToken?: string;
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

    // 052: Resolve cart for funnel linking (FR-5220, FR-5223)
    // Priority: body.cartToken → cookie. If neither → synthetic cart for legacy.
    const cartTokenFromCookie = await getCartTokenFromCookie();
    const cartToken = body.cartToken ?? cartTokenFromCookie ?? null;

    let cartId: string | null = null;
    if (cartToken) {
      const existing = await findByToken(payload, cartToken);
      if (existing) {
        if (existing.status === "converted") {
          // Already converted to a previous order — block double-conversion
          return NextResponse.json(
            {
              error: "cart_already_converted",
              orderId: existing.convertedToOrderId,
              message: "Cart was already converted to an order",
            },
            { status: 409 },
          );
        }
        if (existing.status === "expired" || existing.status === "merged") {
          return NextResponse.json(
            { error: existing.status === "expired" ? "cart_expired" : "cart_merged" },
            { status: 409 },
          );
        }
        cartId = existing.id;
      }
    }

    // FR-5223 + H6: if no cart at all, create synthetic cart marked with `synthetic: true`
    // so funnel analytics can exclude these (createdAt==convertedAt, no add_to_cart events).
    if (!cartId) {
      const synthetic = await createCart(payload, {
        cartToken: generateCartToken(),
        items: items.map((it) => ({
          sku: it.sku,
          name: it.name,
          qty: it.quantity,
          priceAtAdd: it.price ?? null,
          addedAt: new Date().toISOString(),
          slug: it.slug,
          warning: "none",
        })),
        customerEmail: body.customer?.email,
        sourcePage: body.sourcePage,
        synthetic: true,
      });
      cartId = synthetic.id;
    }

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
        // cartId is a relationship; runtime accepts the Payload-internal id (string
        // for UUID-id setups, number for serial). Cast to any here to bypass the
        // generated narrow type while keeping the call site readable.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((cartId ? { cartId } : {}) as any),
      },
    });

    // FR-5220a: Mark cart as converted only on transition to pending_payment.
    // Currently `type === "physical"` lands directly in pending_payment, so we convert here.
    // For "legal" (awaiting_payment) and "quote" (new) — keep cart as active for further edits.
    if (cartId && initialStatus === "pending_payment") {
      try {
        await markConverted(payload, cartId, String(order.id));
      } catch (err) {
        // C3: if cart was concurrently converted by another request, this Order is a duplicate.
        // The unique constraint on Orders.cartId should have prevented this, but as a defense
        // in depth: log the race so it can be reconciled manually.
        if (err instanceof CartAlreadyConvertedError) {
          payload.logger.error(
            `[orders] DUPLICATE conversion race for cart=${cartId}: this order=${order.id}, existing=${err.existingOrderId}`,
          );
        } else {
          payload.logger.error(
            `[orders] markConverted failed for cart=${cartId}: ${(err as Error)?.message ?? String(err)}`,
          );
        }
      }
    }

    return NextResponse.json(
      {
        id: order.id,
        publicToken: order.publicToken,
        status: order.status,
        type: order.type,
        cartId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[orders] create failed:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
