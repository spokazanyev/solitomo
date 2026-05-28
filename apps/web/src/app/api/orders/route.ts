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
// 057 US4: PDPA + offer consent validation + recording
import type { ConsentRecord } from "@/lib/consent/consent-types";
import {
  ConsentPolicyMissingError,
  makeConsentRecord,
} from "@/lib/consent/make-consent-record";
// 056 FR-5609: customer_session-binding for authenticated checkout
import { loadCustomerFromRequest } from "@/lib/customers/session";
// 064: канал доставки (closed) vs перевозчик (open) — снятие хардкода 3 служб
import {
  normalizeDeliveryChannel,
  resolveProviderName,
} from "@/lib/shipping/delivery-channel";

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
    // 064: закрытый канал доставки (pickup | service | own_carrier)
    channel?: string;
    method?: string;
    address?: string;
    city?: string;
    cost?: number;
    handoverNote?: string;
    // ApiShip-specific (sent for any service carrier)
    provider?: string;
    providerKey?: string;
    providerName?: string;
    tariffId?: number;
    deliveryType?: string;
    pickupType?: string;
    pointId?: string;
    pointAddress?: string;
    etaMinDays?: number;
    etaMaxDays?: number;
    addressNormalized?: Record<string, unknown>;
  };
  sourcePage?: string;
  cartToken?: string;
  // 057 US4: explicit PDPA + offer consent (true required)
  consent?: boolean;
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

  // 057 US4: PDPA + offer consent gate (FR-5712). Must precede side-effects.
  if (body.consent !== true) {
    return NextResponse.json(
      { error: "CONSENT_REQUIRED", message: "Consent to PDPA and offer is required" },
      { status: 400 },
    );
  }
  let consentRecord: ConsentRecord;
  try {
    consentRecord = await makeConsentRecord(request);
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

  const type = body.type === "legal" || body.type === "quote" ? body.type : "physical";
  const items = sanitizeItems(body.items);
  if (items.length === 0) {
    return NextResponse.json({ error: "Empty cart" }, { status: 400 });
  }

  // 064: канал доставки — закрытый набор, единственный драйвер поведения.
  // Снимает хардкод трёх служб: любой перевозчик ApiShip = channel "service".
  const channel = normalizeDeliveryChannel({
    channel: body.delivery?.channel,
    providerKey: body.delivery?.providerKey,
    tariffId: body.delivery?.tariffId,
    method: body.delivery?.method,
  });
  const isService = channel === "service";

  // 062 T014: handoverNote validation (server-side, R7).
  // Required для pickup (≥5 chars) и own_carrier (≥10 chars); ≤1000 chars всегда.
  const note = typeof body.delivery?.handoverNote === "string"
    ? body.delivery.handoverNote.trim()
    : "";

  if (note.length > 1000) {
    return NextResponse.json(
      { error: "HANDOVER_NOTE_TOO_LONG", message: "handoverNote exceeds 1000 chars" },
      { status: 400 },
    );
  }

  if (channel === "own_carrier") {
    if (note.length === 0) {
      return NextResponse.json(
        { error: "MISSING_HANDOVER_NOTE", message: "handoverNote required for own_carrier" },
        { status: 400 },
      );
    }
    if (note.length < 10) {
      return NextResponse.json(
        { error: "HANDOVER_NOTE_TOO_SHORT", message: "handoverNote must be at least 10 chars for own_carrier" },
        { status: 400 },
      );
    }
  }

  if (channel === "pickup") {
    if (note.length === 0) {
      return NextResponse.json(
        { error: "MISSING_HANDOVER_NOTE", message: "handoverNote required for pickup" },
        { status: 400 },
      );
    }
    if (note.length < 5) {
      return NextResponse.json(
        { error: "HANDOVER_NOTE_TOO_SHORT", message: "handoverNote must be at least 5 chars for pickup" },
        { status: 400 },
      );
    }
  }

  // 064 (was 062 T015): стоимость доставки — для любого service-перевозчика
  // (FR-004, не обнуляется вне прежних трёх). pickup/own_carrier — всегда 0.
  const deliveryCost = isService
    ? Math.max(0, Number(body.delivery?.cost) || 0)
    : 0;
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

    // 056 FR-5609: customer_session-binding. If a valid customer_session cookie
    // is present, link Order.customerId so authenticated buyers can see their
    // history in /me/orders. Guest checkout continues to work unchanged.
    let resolvedCustomerId: string | number | undefined;
    try {
      const session = await loadCustomerFromRequest(request);
      const sessionId = session?.customer?.id;
      if (sessionId != null) resolvedCustomerId = sessionId;
    } catch {
      // Session lookup failed — proceed as guest (additive enhancement)
    }

    // Payload v3 + @payloadcms/db-postgres validates relationship IDs differently
    // for string vs number: passing a string for a serial-id relation produced
    // a spurious extra "0" in the validation list (e.g. "3 0"), failing creation.
    // Coerce to number so the PG adapter sees the canonical integer ID.
    // Same coercion applied to customerId below (also a serial-id relationship).
    const cartIdNum = cartId != null ? Number(cartId) : null;
    const customerIdNum =
      resolvedCustomerId != null && Number.isFinite(Number(resolvedCustomerId))
        ? Number(resolvedCustomerId)
        : null;
    const order = await payload.create({
      collection: "orders",
      // 054 H6: mark this as a trusted source so the FR-5421 customerId backfill
      // can proceed. The cart-token resolution above already proved possession.
      // 056: customerSessionVerified flag lets 054 hooks know binding came from
      // a verified JWT session (separate from cart-token-based backfill).
      context: {
        fromCartConversion: true,
        customerSessionVerified: Boolean(resolvedCustomerId),
      } as never,
      data: {
        type,
        status: initialStatus,
        items,
        totals,
        customer: body.customer ?? {},
        delivery: {
          channel,
          method: channel, // транзитный алиас канала (legacy-читатели)
          address: body.delivery?.address,
          city: body.delivery?.city,
          cost: deliveryCost,
          handoverNote: note.length > 0 ? note : undefined,
          ...(isService
            ? {
                provider: body.delivery?.providerKey?.startsWith("fallback_") ? "fallback" : "apiship",
                providerKey: body.delivery?.providerKey,
                providerName: resolveProviderName(
                  body.delivery?.providerName,
                  body.delivery?.providerKey,
                ),
                tariffId: body.delivery?.tariffId,
                deliveryType: body.delivery?.deliveryType,
                pickupType: body.delivery?.pickupType,
                pointId: body.delivery?.pointId,
                pointAddress: body.delivery?.pointAddress,
                etaMinDays: body.delivery?.etaMinDays,
                etaMaxDays: body.delivery?.etaMaxDays,
                addressNormalized: body.delivery?.addressNormalized,
              }
            : {}),
        },
        payment: {
          method: type === "legal" ? "invoice" : "card",
          providerStatus: "none",
        },
        sourcePage: body.sourcePage,
        // 057 US4: persist PDPA + offer consent record (152-ФЗ Art. 9)
        consent: consentRecord,
        // cartId is a relationship; runtime accepts the Payload-internal id (string
        // for UUID-id setups, number for serial). Cast to any here to bypass the
        // generated narrow type while keeping the call site readable.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((cartIdNum && Number.isFinite(cartIdNum) ? { cartId: cartIdNum } : {}) as any),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((customerIdNum != null ? { customerId: customerIdNum } : {}) as any),
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
    const err = error as { data?: { errors?: unknown[] }; message?: string };
    if (err?.data?.errors) {
      // Surface validation details — these point at the field whose value failed
      try {
        console.error("[orders] create failed:", err.message, "errors:", JSON.stringify(err.data.errors));
      } catch {
        console.error("[orders] create failed:", err.message, "errors (raw):", err.data.errors);
      }
    } else {
      console.error("[orders] create failed:", error);
    }
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
