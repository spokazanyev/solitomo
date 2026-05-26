import "server-only";

/**
 * Cart repository — thin wrapper over Payload local API (052 task T010).
 *
 * Provides typed operations that all other code (API routes, cron, hooks) should use,
 * rather than calling payload.find/create/update directly with collection: "carts".
 */

import type { Payload } from "payload";

import type { CartItem } from "./merge";
import { canTransition, type CartStatus, type TransitionContext } from "./state-machine";
import { computeTotals, type CartTotals } from "./totals";
import type { ConsentRecord } from "../consent/consent-types";

import { isValidTokenFormat } from "./token";

export interface CartRecord {
  id: string;
  cartToken: string;
  customerEmail?: string | null;
  customerId?: string | null;
  companyId?: string | null;
  marketingOptIn: boolean;
  /** H6: marks carts created synthetically by /api/orders for legacy flow — excluded from funnel metrics */
  synthetic: boolean;
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
  /** H6: mark as synthetic (created by /api/orders for legacy flow) */
  synthetic?: boolean;
  /** Pre-set status (e.g. "converted" for synthetic carts) */
  status?: CartStatus;
  convertedToOrderId?: string;
  /** 057 US4: embedded PDPA + offer consent record (152-ФЗ Art. 9). Optional — synthetic carts created internally may omit. */
  consent?: ConsentRecord;
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
    synthetic: Boolean(doc.synthetic),
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
 *
 * H7 fix: validates token format via `isValidTokenFormat` to reject whitespace,
 * wrong chars, or invalid lengths before hitting the DB.
 */
export async function findByToken(payload: Payload, token: string): Promise<CartRecord | null> {
  if (!isValidTokenFormat(token)) return null;
  const result = await payload.find({
    collection: "carts" as never,
    where: { cartToken: { equals: token.trim() } },
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
 *
 * Supports H6 `synthetic` flag and pre-set status/convertedToOrderId for the
 * legacy-flow synthetic cart created by `/api/orders` when no real cart exists.
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
      synthetic: input.synthetic ?? false,
      items,
      totals,
      status: input.status ?? "active",
      convertedToOrderId: input.convertedToOrderId,
      convertedAt: input.convertedToOrderId ? now.toISOString() : undefined,
      lastActivityAt: now.toISOString(),
      expiresAt: defaultExpiresAt(now),
      sourcePage: input.sourcePage,
      utm: input.utm,
      ipHash: input.ipHash,
      userAgent: input.userAgent?.slice(0, 200),
      // 057 US4: pass through embedded consent record when provided.
      ...(input.consent ? { consent: input.consent } : {}),
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
  /** State-machine transition context (M5+M6). Required for guarded transitions. */
  transition?: TransitionContext;
}

export class CartInvalidTransitionError extends Error {
  constructor(public cartId: string, public from: CartStatus, public to: CartStatus) {
    super(`Invalid cart transition: ${from} → ${to} (cart=${cartId})`);
    this.name = "CartInvalidTransitionError";
  }
}

/**
 * Update cart fields.
 *
 * M5+M6 fix: when `status` is being changed, validates the transition through
 * `canTransition` and throws `CartInvalidTransitionError` if disallowed.
 * Guarded transitions (converted→active, expired→active) require explicit
 * `input.transition` context flags.
 */
export async function updateCart(
  payload: Payload,
  id: string,
  input: UpdateCartInput,
): Promise<CartRecord> {
  // M5+M6: guard status transitions
  if (input.status !== undefined) {
    const current = await findById(payload, id);
    if (!current) throw new Error(`Cart not found: ${id}`);
    if (current.status !== input.status) {
      if (!canTransition(current.status, input.status, input.transition ?? {})) {
        throw new CartInvalidTransitionError(id, current.status, input.status);
      }
    }
  }

  const data: Record<string, unknown> = {};

  if (input.items !== undefined) {
    data.items = input.items;
    data.totals = computeTotals(input.items);
  }
  // Coerce string-ID relationship values to numbers — Payload v3 + PG adapter
  // mishandles string IDs for serial-id relationships in its validator (issue
  // surfaced as "invalid relationships: N 0" errors).
  const toRelId = (v: string | number | null | undefined): number | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  if (input.customerEmail !== undefined) data.customerEmail = input.customerEmail;
  if (input.customerId !== undefined) data.customerId = toRelId(input.customerId);
  if (input.companyId !== undefined) data.companyId = toRelId(input.companyId);
  if (input.marketingOptIn !== undefined) data.marketingOptIn = input.marketingOptIn;
  if (input.status !== undefined) data.status = input.status;
  if (input.convertedToOrderId !== undefined) data.convertedToOrderId = toRelId(input.convertedToOrderId);
  if (input.mergedIntoId !== undefined) data.mergedIntoId = toRelId(input.mergedIntoId);
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
 *
 * M5+M6: passes the `recoverFromConverted` transition flag so the state machine
 * allows what would otherwise be a forbidden converted → active transition.
 */
export async function recoverFromConverted(payload: Payload, id: string): Promise<CartRecord> {
  return updateCart(payload, id, {
    status: "active",
    convertedToOrderId: null,
    convertedAt: null,
    touch: true,
    transition: { recoverFromConverted: true },
  });
}

/**
 * Admin action: restore an expired cart back to active.
 * Requires explicit admin-initiated context (UI guard upstream).
 */
export async function adminRestoreFromExpired(
  payload: Payload,
  id: string,
): Promise<CartRecord> {
  return updateCart(payload, id, {
    status: "active",
    touch: true,
    transition: { adminRestore: true },
  });
}
