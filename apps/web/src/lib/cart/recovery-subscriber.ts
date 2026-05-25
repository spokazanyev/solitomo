import "server-only";

/**
 * Cart recovery subscriber (052 FR-5223a).
 *
 * Listens for order.cancelled / order.expired events.
 * If the order had no payment (wasEverPaid = false) AND has a linked cartId,
 * recovers the cart from converted → active so the customer can retry.
 *
 * Excluded: order.returned (053 — return is post-payment, cart stays converted).
 */

import { getPayload } from "payload";
import configPromise from "@payload-config";

import {
  registerSubscriber,
  type DomainEventPayload,
  type DomainEventSubscriber,
} from "../lifecycle/events";

import { findById, recoverFromConverted } from "./repository";

const CART_RECOVERY_WINDOW_HOURS = 24;

async function handle(event: DomainEventPayload): Promise<void> {
  const order = event.order;
  if (!order) return;

  // Only handle cancellation/expiry before payment
  if (event.kind !== "order.cancelled" && event.kind !== "order.expired") return;

  // Skip if the order was ever paid — payment is the point-of-no-return
  const payment = (order as unknown as { payment?: { paidAt?: string | null } }).payment;
  if (payment?.paidAt) return;

  const cartId = (order as unknown as { cartId?: string | { id?: string } }).cartId;
  const resolvedCartId = typeof cartId === "string" ? cartId : cartId?.id;
  if (!resolvedCartId) return;

  try {
    const payload = await getPayload({ config: configPromise });
    const cart = await findById(payload, resolvedCartId);
    if (!cart) return;

    // Only recover if cart is currently in `converted` state
    if (cart.status !== "converted") return;

    // FR-5223a: only within 24h window after conversion.
    // H5 fix: if convertedAt is null/missing, refuse to recover (data integrity).
    if (!cart.convertedAt) {
      // eslint-disable-next-line no-console
      console.warn(`[cart-recovery] cart=${cart.id} has converted status but no convertedAt — skip`);
      return;
    }
    const ageMs = Date.now() - new Date(cart.convertedAt).getTime();
    if (ageMs > CART_RECOVERY_WINDOW_HOURS * 60 * 60 * 1000) return;

    await recoverFromConverted(payload, cart.id);
    // eslint-disable-next-line no-console
    console.info(
      `[cart-recovery] cart=${cart.id} recovered after ${event.kind} (order=${order.id})`,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[cart-recovery] failed for order=${order.id}:`, err);
  }
}

const subscriber: DomainEventSubscriber = {
  name: "052-cart-recovery",
  kinds: ["order.cancelled", "order.expired"],
  handle,
};

let registered = false;

export function registerCartRecoverySubscriber(): void {
  if (registered) return;
  registerSubscriber(subscriber);
  registered = true;
}
