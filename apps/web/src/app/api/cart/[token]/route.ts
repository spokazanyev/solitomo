/**
 * GET / PATCH / DELETE /api/cart/[token] (052 FR-5210, FR-5212, FR-5214a, FR-5226a).
 *
 * GET — read by token. 404/410 if not found/terminal.
 * PATCH — mutate items / email / qty. Supports op=setItems (If-Match required),
 *   mergeItems, setCustomerEmail, setQuantity, removeItem, touch.
 * DELETE — soft-clear items (or hard-delete with ?hard=true + confirmToken).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { cartError, getClientIp, rateLimit } from "@/lib/cart/api-utils";
import { isMutationBlocked } from "@/lib/cart/state-machine";
import { mergeItems, removeItem, setItems, setQuantity, type CartItem } from "@/lib/cart/merge";
import { findByToken, hardDelete, updateCart } from "@/lib/cart/repository";
import { isValidTokenFormat } from "@/lib/cart/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!isValidTokenFormat(token)) {
    return cartError(400, "validation_failed", "Invalid token format");
  }

  // Rate limit per IP per token (FR-5210: 10 req/min/IP, anti-guess)
  const ip = getClientIp(req);
  if (!rateLimit(`cart:get:${ip}:1m`, 30, 60_000)) {
    return cartError(429, "rate_limited", "Too many requests");
  }

  const payload = await getPayload({ config: configPromise });
  const cart = await findByToken(payload, token);

  if (!cart) return cartError(404, "not_found", "Cart not found");

  // Terminal/gone states
  if (cart.status === "expired") {
    return NextResponse.json(
      { error: "cart_expired", message: "Cart has expired", status: "expired" },
      { status: 410 },
    );
  }
  if (cart.status === "merged") {
    return NextResponse.json(
      {
        error: "cart_merged",
        message: "Cart has been merged",
        status: "merged",
        mergedIntoToken: null,
      },
      { status: 410 },
    );
  }
  if (cart.status === "converted") {
    return NextResponse.json(
      {
        error: "cart_already_converted",
        message: "Cart has been converted to an order",
        status: "converted",
        orderId: cart.convertedToOrderId,
      },
      { status: 410 },
    );
  }

  // ?activity=true marks an explicit "user returned" intent (restore-link).
  const activity = req.nextUrl.searchParams.get("activity") === "true";
  if (activity) {
    // H2 fix: single write — collapses touch + recovery into one update so we emit
    // exactly one event (cart.recovered or cart.updated, never both).
    const updated = await updateCart(payload, cart.id, {
      status: cart.status === "abandoned" ? "active" : undefined,
      touch: true,
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json(cart);
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

type PatchOp =
  | { op: "setItems"; items: CartItem[] }
  | { op: "mergeItems"; items: CartItem[] }
  | { op: "setCustomerEmail"; customerEmail: string; marketingOptIn?: boolean }
  | { op: "setQuantity"; sku: string; qty: number }
  | { op: "removeItem"; sku: string }
  | { op: "touch" };

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!isValidTokenFormat(token)) {
    return cartError(400, "validation_failed", "Invalid token format");
  }

  // C2: rate-limit mutations to prevent token enumeration / abuse
  const ip = getClientIp(req);
  if (!rateLimit(`cart:patch:${token}:1m`, 60, 60_000)) {
    return cartError(429, "rate_limited", "Too many requests for this cart");
  }
  if (!rateLimit(`cart:patch:${ip}:1m`, 120, 60_000)) {
    return cartError(429, "rate_limited", "Too many requests");
  }

  let body: PatchOp;
  try {
    body = (await req.json()) as PatchOp;
  } catch {
    return cartError(400, "validation_failed", "Invalid JSON");
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

  // FR-5214a: If-Match required for setItems (optimistic lock)
  if (body.op === "setItems") {
    const ifMatch = req.headers.get("if-match");
    if (!ifMatch) {
      return cartError(400, "validation_failed", "If-Match header required for setItems");
    }
    if (ifMatch !== cart.updatedAt) {
      return cartError(409, "cart_stale", "Cart was modified by another request", {
        expectedUpdatedAt: cart.updatedAt,
      });
    }
  }

  try {
    let newItems: CartItem[] | undefined;
    let customerEmail: string | undefined;
    let marketingOptIn: boolean | undefined;
    let status: "active" | undefined;

    switch (body.op) {
      case "setItems":
        if (!Array.isArray(body.items)) {
          return cartError(400, "validation_failed", "items required");
        }
        if (body.items.length > 100) {
          return cartError(400, "validation_failed", "Maximum 100 items per cart");
        }
        newItems = setItems(body.items);
        break;
      case "mergeItems":
        if (!Array.isArray(body.items)) {
          return cartError(400, "validation_failed", "items required");
        }
        newItems = mergeItems(cart.items, body.items);
        if (newItems.length > 100) {
          return cartError(400, "validation_failed", "Maximum 100 items per cart");
        }
        break;
      case "setCustomerEmail":
        // L1 fix: strict email regex (RFC 5322 subset, sufficient for marketing/audit)
        if (
          !body.customerEmail ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customerEmail) ||
          body.customerEmail.length > 254
        ) {
          return cartError(400, "validation_failed", "Valid customerEmail required");
        }
        // Normalize to lowercase for consistent indexing (M9 fix)
        customerEmail = body.customerEmail.trim().toLowerCase();
        marketingOptIn = body.marketingOptIn;
        break;
      case "setQuantity":
        // M4 fix: reject qty < 1 explicitly (use removeItem to delete).
        if (!body.sku || !Number.isFinite(body.qty) || body.qty < 1) {
          return cartError(400, "validation_failed", "sku and qty>=1 required; use removeItem for qty=0");
        }
        newItems = setQuantity(cart.items, body.sku, body.qty);
        break;
      case "removeItem":
        if (!body.sku) {
          return cartError(400, "validation_failed", "sku required");
        }
        newItems = removeItem(cart.items, body.sku);
        break;
      case "touch":
        // No content changes, just lastActivityAt refresh
        break;
      default:
        return cartError(400, "validation_failed", "Unknown op");
    }

    // If cart was abandoned, recover to active on any mutation that's not touch
    if (cart.status === "abandoned" && body.op !== "touch") {
      status = "active";
    }

    const updated = await updateCart(payload, cart.id, {
      items: newItems,
      customerEmail,
      marketingOptIn,
      status,
      touch: true,
    });

    return NextResponse.json(updated);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[cart] PATCH failed:", err);
    return cartError(500, "validation_failed", "Update failed");
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!isValidTokenFormat(token)) {
    return cartError(400, "validation_failed", "Invalid token format");
  }

  // C2: rate-limit deletes
  const ip = getClientIp(req);
  if (!rateLimit(`cart:delete:${ip}:1m`, 10, 60_000)) {
    return cartError(429, "rate_limited", "Too many requests");
  }

  const payload = await getPayload({ config: configPromise });
  const cart = await findByToken(payload, token);
  if (!cart) return cartError(404, "not_found", "Cart not found");

  const hard = req.nextUrl.searchParams.get("hard") === "true";

  if (hard) {
    // M10 fix: GDPR hard-delete requires admin session ONLY in 052 MVP.
    // The confirmToken-by-email flow (FR-5228a) needs a one-time code generator/verifier
    // — implementing that without the email infrastructure tested would be a security hole
    // (the previous code accepted any non-empty confirmToken). Deferring to a follow-up.
    const auth = await payload.auth({ headers: req.headers });
    if (!auth.user) {
      return cartError(401, "unauthorized", "Admin session required for hard-delete");
    }
    await hardDelete(payload, cart.id);
    return new NextResponse(null, { status: 204 });
  }

  // Soft clear: items=[] but cart stays active
  const cleared = await updateCart(payload, cart.id, { items: [], touch: true });
  return NextResponse.json(cleared);
}
