/**
 * Draft Order — временное хранилище данных чекаута между шагами
 * (доставка → review → оплата).
 *
 * Хранится в HTTP-only cookie как JSON, имеет TTL 30 минут.
 * Использует Next.js cookies() API. Только серверная сторона —
 * для записи из клиент-компонента отправь POST через server action.
 *
 * Поля минимальны: всё, что нужно показать на review-странице
 * и прокинуть в POST /api/checkout/finalize-shipping.
 */

import { cookies } from "next/headers";

export const DRAFT_ORDER_COOKIE = "soliton_checkout_draft";
const DRAFT_TTL_SECONDS = 60 * 30; // 30 минут

export interface DraftOrderItem {
  sku: string;
  name: string;
  slug?: string;
  quantity: number;
  price: number | null;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
}

export interface DraftOrderAddress {
  query: string; // нормализованная строка
  postalCode?: string;
  city?: string;
  region?: string;
  street?: string;
  house?: string;
  flat?: string;
  kladrId?: string;
  fiasId?: string;
}

export interface DraftOrderCustomer {
  fullName?: string;
  email?: string;
  phone?: string;
}

export interface DraftOrderRate {
  shippingOptionId: string;
  providerKey: string;
  providerName?: string;
  tariffId?: number;
  tariffName?: string;
  deliveryType: 1 | 2;
  pickupType: 1 | 2;
  cost: number;
  etaMinDays: number;
  etaMaxDays: number;
  pointId?: string;
  pointAddress?: string;
}

export interface DraftOrder {
  cartId: string;
  type: "physical" | "legal";
  items: DraftOrderItem[];
  customer: DraftOrderCustomer;
  address: DraftOrderAddress;
  rate: DraftOrderRate;
  createdAt: string; // ISO
}

function isValidDraft(value: unknown): value is DraftOrder {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.cartId === "string" &&
    (v.type === "physical" || v.type === "legal") &&
    Array.isArray(v.items) &&
    typeof v.customer === "object" &&
    typeof v.address === "object" &&
    typeof v.rate === "object"
  );
}

/** Серверный helper для чтения draft (server component / route handler). */
export async function readDraftOrder(): Promise<DraftOrder | null> {
  const store = await cookies();
  const raw = store.get(DRAFT_ORDER_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!isValidDraft(parsed)) return null;
    // TTL check (cookie expires server-side, but double-check at app level too)
    const createdMs = new Date(parsed.createdAt).getTime();
    if (Number.isNaN(createdMs)) return null;
    if (Date.now() - createdMs > DRAFT_TTL_SECONDS * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Серверный helper для записи draft (только из route handler или server action!). */
export async function writeDraftOrder(draft: DraftOrder): Promise<void> {
  const store = await cookies();
  store.set(DRAFT_ORDER_COOKIE, JSON.stringify(draft), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DRAFT_TTL_SECONDS,
  });
}

/** Серверный helper для очистки draft после успешного создания заказа. */
export async function clearDraftOrder(): Promise<void> {
  const store = await cookies();
  store.delete(DRAFT_ORDER_COOKIE);
}
