/**
 * POST /api/cart/[token]/items — add an item via merge (052 FR-5212).
 *
 * Equivalent to PATCH ?op=mergeItems with a single item, but kept as a separate
 * endpoint for cleaner analytics tracking (add_to_cart).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { cartError, getClientIp, rateLimit } from "@/lib/cart/api-utils";
import { mergeItems, type CartItem } from "@/lib/cart/merge";
import { findByToken, updateCart } from "@/lib/cart/repository";
import { isMutationBlocked } from "@/lib/cart/state-machine";
import { isValidTokenFormat } from "@/lib/cart/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AddItemBody {
  sku: string;
  name?: string;
  qty: number;
  priceAtAdd?: number | null;
  productId?: string;
  slug?: string;
  image?: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!isValidTokenFormat(token)) {
    return cartError(400, "validation_failed", "Invalid token format");
  }

  // C2: rate-limit add-to-cart
  const ip = getClientIp(req);
  if (!rateLimit(`cart:add:${token}:1m`, 30, 60_000)) {
    return cartError(429, "rate_limited", "Too many requests for this cart");
  }
  if (!rateLimit(`cart:add:${ip}:1m`, 60, 60_000)) {
    return cartError(429, "rate_limited", "Too many requests");
  }

  let body: AddItemBody;
  try {
    body = (await req.json()) as AddItemBody;
  } catch {
    return cartError(400, "validation_failed", "Invalid JSON");
  }

  if (!body.sku || !Number.isFinite(body.qty) || body.qty < 1) {
    return cartError(400, "validation_failed", "sku and positive qty required");
  }

  const payload = await getPayload({ config: configPromise });
  const cart = await findByToken(payload, token);
  if (!cart) return cartError(404, "not_found", "Cart not found");

  if (isMutationBlocked(cart.status)) {
    if (cart.status === "expired") return cartError(409, "cart_expired", "Cart expired");
    if (cart.status === "merged") return cartError(409, "cart_merged", "Cart merged");
    if (cart.status === "converted") {
      return cartError(409, "cart_already_converted", "Cart already converted", {
        orderId: cart.convertedToOrderId,
      });
    }
  }

  const newItem: CartItem = {
    sku: String(body.sku).slice(0, 120),
    name: String(body.name ?? body.sku).slice(0, 240),
    qty: Math.min(9999, Math.max(1, Math.floor(body.qty))),
    priceAtAdd:
      typeof body.priceAtAdd === "number" && Number.isFinite(body.priceAtAdd)
        ? body.priceAtAdd
        : null,
    addedAt: new Date().toISOString(),
    productId: body.productId,
    slug: body.slug,
    image: body.image,
    warning: "none",
  };

  const merged = mergeItems(cart.items, [newItem]);
  if (merged.length > 100) {
    return cartError(400, "validation_failed", "Maximum 100 items per cart");
  }

  // Recover from abandoned on user activity
  const status: "active" | undefined = cart.status === "abandoned" ? "active" : undefined;

  const updated = await updateCart(payload, cart.id, {
    items: merged,
    status,
    touch: true,
  });

  return NextResponse.json(updated);
}
