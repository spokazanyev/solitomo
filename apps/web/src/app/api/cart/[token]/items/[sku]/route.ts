/**
 * DELETE /api/cart/[token]/items/[sku] — remove item by SKU (052 FR-5212).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { cartError, getClientIp, rateLimit } from "@/lib/cart/api-utils";
import { removeItem } from "@/lib/cart/merge";
import { findByToken, updateCart } from "@/lib/cart/repository";
import { isMutationBlocked } from "@/lib/cart/state-machine";
import { isValidTokenFormat } from "@/lib/cart/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; sku: string }> },
) {
  const { token, sku } = await params;

  if (!isValidTokenFormat(token)) {
    return cartError(400, "validation_failed", "Invalid token format");
  }
  if (!sku) {
    return cartError(400, "validation_failed", "sku required");
  }

  // C2: rate-limit
  const ip = getClientIp(req);
  if (!rateLimit(`cart:remove-item:${token}:1m`, 30, 60_000)) {
    return cartError(429, "rate_limited", "Too many requests for this cart");
  }
  if (!rateLimit(`cart:remove-item:${ip}:1m`, 60, 60_000)) {
    return cartError(429, "rate_limited", "Too many requests");
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

  const newItems = removeItem(cart.items, sku);
  const updated = await updateCart(payload, cart.id, { items: newItems, touch: true });
  return NextResponse.json(updated);
}
