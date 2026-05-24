import "server-only";

/**
 * Cart repository — thin wrapper over Payload local API (052 task T010).
 *
 * Provides typed operations that all other code (API routes, cron, hooks) should use,
 * rather than calling payload.find/create/update directly with collection: "carts".
 */

import type { Payload } from "payload";

import type { CartItem } from "./merge";
import type { CartStatus } from "./state-machine";
import { computeTotals, type CartTotals } from "./totals";

export interface CartRecord {
  id: string;
  cartToken: string;
  customerEmail?: string | null;
  customerId?: string | null;
  companyId?: string | null;
  marketingOptIn: boolean;
  items: CartItem[];
  totals: CartTotals;
  status: CartStatus;
  convertedToOrderId?: string | null;
  mergedIntoId?: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  abandonedAt?: string | null;
  convertedAt?: string | null;
  expiresAt: string;
  sourcePage?: string | null;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}

export interface CreateCartInput {
  cartToken: string;
  items?: CartItem[];
  customerEmail?: string;
  customerId?: string;
  companyId?: string;
  sourcePage?: string;
  utm?: CartRecord["utm"];
  marketingOptIn?: boolean;
  ipHash?: string;
  userAgent?: string;
}

export const CART_EXPIRY_DAYS = Number(process.env.CART_EXPIRY_DAYS ?? 30);

function defaultExpiresAt(lastActivityAt: Date = new Date()): string {
  const ms = lastActivityAt.getTime() + CART_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

/**
 * Normalize a raw Payload doc into a CartRecord.
 * Defensive: handles missing fields, relationships as IDs or objects.
 */
export function toCartRecord(doc: Record<string, unknown>): CartRecord {
  const items = Array.isArray(doc.items) ? (doc.items as CartItem[]) : [];
  const totals = (doc.totals as CartTotals | undefined) ?? computeTotals(items);
  const customerId = doc.customerId;
  const companyId = doc.companyId;
  const convertedToOrderId = doc.convertedToOrderId;
  const mergedIntoId = doc.mergedIntoId;
  const utm = doc.utm as CartRecord["utm"] | undefined;

  return {
    id: String(doc.id),
    cartToken: String(doc.cartToken ?? ""),
    customerEmail: (doc.customerEmail as string | null | undefined) ?? null,
    customerId: typeof customerId === "string" ? customerId : (customerId as { id?: string })?.id ?? null,
    companyId: typeof companyId === "string" ? companyId : (companyId as { id?: string })?.id ?? null,
    marketingOptIn: Boolean(doc.marketingOptIn),
    items,
    totals,
    status: (doc.status as CartStatus) ?? "active",
    convertedToOrderId:
      typeof convertedToOrderId === "string"
        ? convertedToOrderId
        : (convertedToOrderId as { id?: string })?.id ?? null,
    mergedIntoId:
      typeof mergedIntoId === "string" ? mergedIntoId : (mergedIntoId as { id?: string })?.id ?? null,
    createdAt: String(doc.createdAt ?? new Date().toISOString()),
    updatedAt: String(doc.updatedAt ?? new Date().toISOString()),
    lastActivityAt: String(doc.lastActivityAt ?? new Date().toISOString()),
    abandonedAt: (doc.abandonedAt as string | null | undefined) ?? null,
    convertedAt: (doc.convertedAt as string | null | undefined) ?? null,
    expiresAt: String(doc.expiresAt ?? defaultExpiresAt()),
    sourcePage: (doc.sourcePage as string | null | undefined) ?? null,
    utm: utm ?? {},
  };
}

/**
 * Find cart by cartToken. Returns null if not found.
 */
export async function findByToken(payload: Payload, token: string): Promise<CartRecord | null> {
  if (!token) return null;
  const result = await payload.find({
    collection: "carts" as never,
    where: { cartToken: { equals: token } },
    limit: 1,
  });
  const doc = result.docs[0] as Record<string, unknown> | undefined;
  return doc ? toCartRecord(doc) : null;
}

/**
 * Find cart by id.
 */
export async function findById(payload: Payload, id: string): Promise<CartRecord | null> {
  try {
    const doc = (await payload.findByID({
      collection: "carts" as never,
      id,
    })) as unknown as Record<string, unknown>;
    return toCartRecord(doc);
  } catch {
    return null;
  }
}

/**
 * Create a new cart.
 */
export async function createCart(payload: Payload, input: CreateCartInput): Promise<CartRecord> {
  const now = new Date();
  const items = input.items ?? [];
  const totals = computeTotals(items);

  const doc = (await payload.create({
    collection: "carts" as never,
    data: {
      cartToken: input.cartToken,
      customerEmail: input.customerEmail,
      customerId: input.customerId,
      companyId: input.companyId,
      marketingOptIn: input.marketingOptIn ?? false,
      items,
      totals,
      status: "active",
      lastActivityAt: now.toISOString(),
      expiresAt: defaultExpiresAt(now),
      sourcePage: input.sourcePage,
      utm: input.utm,
      ipHash: input.ipHash,
      userAgent: input.userAgent?.slice(0, 200),
    } as never,
  })) as unknown as Record<string, unknown>;

  return toCartRecord(doc);
}

/**
 * Update cart fields. Recomputes totals if items changed.
 * Updates lastActivityAt and expiresAt automatically (touch semantics).
 */
export interface UpdateCartInput {
  items?: CartItem[];
  customerEmail?: string | null;
  customerId?: string;
  companyId?: string;
  marketingOptIn?: boolean;
  status?: CartStatus;
  convertedToOrderId?: string | null;
  mergedIntoId?: string | null;
  abandonedAt?: string | null;
  convertedAt?: string | null;
  /** Set true to refresh lastActivityAt + expiresAt. */
  touch?: boolean;
}

export async function updateCart(
  payload: Payload,
  id: string,
  input: UpdateCartInput,
): Promise<CartRecord> {
  const data: Record<string, unknown> = {};

  if (input.items !== undefined) {
    data.items = input.items;
    data.totals = computeTotals(input.items);
  }
  if (input.customerEmail !== undefined) data.customerEmail = input.customerEmail;
  if (input.customerId !== undefined) data.customerId = input.customerId;
  if (input.companyId !== undefined) data.companyId = input.companyId;
  if (input.marketingOptIn !== undefined) data.marketingOptIn = input.marketingOptIn;
  if (input.status !== undefined) data.status = input.status;
  if (input.convertedToOrderId !== undefined) data.convertedToOrderId = input.convertedToOrderId;
  if (input.mergedIntoId !== undefined) data.mergedIntoId = input.mergedIntoId;
  if (input.abandonedAt !== undefined) data.abandonedAt = input.abandonedAt;
  if (input.convertedAt !== undefined) data.convertedAt = input.convertedAt;

  if (input.touch) {
    const now = new Date();
    data.lastActivityAt = now.toISOString();
    data.expiresAt = defaultExpiresAt(now);
  }

  const doc = (await payload.update({
    collection: "carts" as never,
    id,
    data: data as never,
  })) as unknown as Record<string, unknown>;

  return toCartRecord(doc);
}

/**
 * Hard delete a cart (GDPR / admin action).
 */
export async function hardDelete(payload: Payload, id: string): Promise<void> {
  await payload.delete({
    collection: "carts" as never,
    id,
  });
}

/**
 * Mark cart as abandoned (cron use).
 */
export async function markAbandoned(payload: Payload, id: string): Promise<CartRecord> {
  return updateCart(payload, id, {
    status: "abandoned",
    abandonedAt: new Date().toISOString(),
  });
}

/**
 * Mark cart as expired (cron use).
 */
export async function markExpired(payload: Payload, id: string): Promise<CartRecord> {
  return updateCart(payload, id, { status: "expired" });
}

/**
 * Mark cart as converted, link to Order. Used by checkout conversion.
 *
 * C3 fix: refetch cart and verify status is still `active` or `abandoned`
 * before transitioning. Throws CartAlreadyConvertedError if the cart was
 * already converted by a concurrent request (double-click guard).
 */
export class CartAlreadyConvertedError extends Error {
  constructor(public cartId: string, public existingOrderId: string | null) {
    super(`Cart ${cartId} already converted to order ${existingOrderId}`);
    this.name = "CartAlreadyConvertedError";
  }
}

export async function markConverted(
  payload: Payload,
  id: string,
  orderId: string,
): Promise<CartRecord> {
  // Re-read cart to validate state-machine transition under concurrency
  const current = await findById(payload, id);
  if (!current) throw new Error(`Cart not found: ${id}`);
  if (current.status === "converted") {
    throw new CartAlreadyConvertedError(id, current.convertedToOrderId ?? null);
  }
  if (current.status !== "active" && current.status !== "abandoned") {
    throw new Error(`Cannot convert cart in status=${current.status}`);
  }
  return updateCart(payload, id, {
    status: "converted",
    convertedToOrderId: orderId,
    convertedAt: new Date().toISOString(),
  });
}

/**
 * Recover a cart from converted → active (FR-5223a).
 * Used when Order is cancelled/expired before paid.
 */
export async function recoverFromConverted(payload: Payload, id: string): Promise<CartRecord> {
  return updateCart(payload, id, {
    status: "active",
    convertedToOrderId: null,
    convertedAt: null,
    touch: true,
  });
}
