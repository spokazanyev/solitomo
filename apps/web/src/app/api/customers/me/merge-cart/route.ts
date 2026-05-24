/**
 * POST /api/customers/me/merge-cart (054 US3, FR-5420).
 *
 * Called on login to link a guest cart to the now-authenticated customer.
 * Body: { cartToken: string }
 *
 * Behavior:
 *  - Find cart by token → set customerId = me.id
 *  - If customer already has an active cart with the same status — merge items
 *    using 052's mergeItems (sum qty, latest-addedAt wins for price)
 *  - Returns the resulting cart's token (may be different if guest cart was kept)
 *
 * The full 052 US6 logic (advanced merge rules, conflict resolution) is
 * deferred to a follow-up — MVP just attaches customerId and merges items.
 */

import { NextResponse, type NextRequest } from "next/server";

import { customerError, verifyCsrfToken } from "@/lib/customers/api-utils";
import { getCartTokenFromCookie } from "@/lib/cart/cookie";
import { findByToken, updateCart } from "@/lib/cart/repository";
import { mergeItems, type CartItem } from "@/lib/cart/merge";
import { loadCustomerFromRequest } from "@/lib/customers/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  cartToken: string;
}

export async function POST(req: NextRequest) {
  const loaded = await loadCustomerFromRequest(req);
  if (!loaded) return customerError(401, "unauthorized", "Not signed in");
  const { payload, customer } = loaded;

  if (!verifyCsrfToken(req)) {
    return customerError(403, "csrf_invalid", "CSRF token missing or mismatched");
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return customerError(400, "validation_failed", "Invalid JSON");
  }

  if (!body.cartToken || typeof body.cartToken !== "string") {
    return customerError(400, "validation_failed", "cartToken required");
  }

  // C4 fix: cart must match the caller's cart cookie (proof of possession).
  // Otherwise an authenticated customer could hijack any cart whose token leaked.
  const cookieToken = await getCartTokenFromCookie();
  if (!cookieToken || cookieToken !== body.cartToken) {
    return customerError(
      403,
      "forbidden",
      "cartToken must match your active cart cookie",
    );
  }

  const guestCart = await findByToken(payload, body.cartToken);
  if (!guestCart) {
    return customerError(404, "not_found", "Cart not found");
  }

  if (guestCart.status !== "active" && guestCart.status !== "abandoned") {
    return customerError(409, "validation_failed", `Cart status=${guestCart.status} cannot be merged`);
  }

  // C4 fix: refuse if cart already belongs to a different customer.
  if (
    (guestCart as unknown as { customerId?: string | null }).customerId &&
    String((guestCart as unknown as { customerId?: string | null }).customerId) !==
      String(customer.id)
  ) {
    return customerError(
      403,
      "forbidden",
      "Cart belongs to a different customer",
    );
  }

  // Search for an existing active cart belonging to this customer
  const myActiveCarts = await payload.find({
    collection: "carts" as never,
    where: {
      and: [
        { customerId: { equals: customer.id } },
        { status: { in: ["active", "abandoned"] } },
      ],
    } as never,
    limit: 1,
    sort: "-lastActivityAt",
    overrideAccess: true,
  });
  const myCartDoc = myActiveCarts.docs[0] as unknown as Record<string, unknown> | undefined;

  if (!myCartDoc) {
    // No existing customer cart — just attach guest cart
    const attached = await updateCart(payload, guestCart.id, {
      customerId: customer.id,
      companyId: customer.companyId,
      touch: true,
    });
    return NextResponse.json({
      ok: true,
      merged: false,
      cart: attached,
    });
  }

  // Both exist — merge guest items into customer's cart, then mark guest as merged
  const myCart = await findByToken(payload, String(myCartDoc.cartToken));
  if (!myCart) {
    // Race / inconsistency — fall back to plain attach
    const attached = await updateCart(payload, guestCart.id, {
      customerId: customer.id,
      companyId: customer.companyId,
      touch: true,
    });
    return NextResponse.json({ ok: true, merged: false, cart: attached });
  }

  const merged = mergeItems(myCart.items, guestCart.items as CartItem[]);
  if (merged.length > 100) {
    return customerError(400, "validation_failed", "Combined cart exceeds 100 items");
  }

  // Update customer's cart with merged items + touch
  const updated = await updateCart(payload, myCart.id, {
    items: merged,
    customerId: customer.id,
    companyId: customer.companyId,
    touch: true,
  });

  // Mark guest cart as merged (terminal)
  await updateCart(payload, guestCart.id, {
    status: "merged",
    mergedIntoId: myCart.id,
    touch: false,
  });

  return NextResponse.json({
    ok: true,
    merged: true,
    cart: updated,
    sourceGuestCartId: guestCart.id,
  });
}
