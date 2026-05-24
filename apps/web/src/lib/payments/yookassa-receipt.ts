import "server-only";

/**
 * Builder для receipt-объекта 54-ФЗ (055 T013, FR-5540..5546).
 *
 * ЮKassa в auto-mode формирует чек через подключённую онлайн-кассу.
 * Сервис передаёт receipt → ЮKassa → касса → ОФД.
 *
 * VAT codes (актуально на 2026):
 *   - 1 — без НДС
 *   - 2 — 0%
 *   - 3 — 10/110 расчётная
 *   - 4 — 20/120 расчётная (legacy с 2019-2025)
 *   - 5 — 10% (включаемая)
 *   - 6 — 20% (включаемая, legacy)
 *   - 11 — 22% (включаемая, ФЗ-425 с 2026-01-01)
 *   - 12 — 22/122 расчётная (ФЗ-425, наш MVP-default)
 */

import type { PaymentSettingsResolved } from "./settings";
import type { YooKassaReceiptInput } from "./yookassa-types";

/**
 * Минимальная shape Order, достаточная для построения receipt.
 * Полный тип Order — в payload-types.ts (auto-generated), здесь — duck-typing
 * для устойчивости к расширениям.
 */
export interface ReceiptOrderShape {
  id?: string | number;
  customer?: {
    email?: string | null;
    phone?: string | null;
    fullName?: string | null;
  } | null;
  items?: Array<{
    title?: string | null;
    sku?: string | null;
    quantity?: number | null;
    price?: number | null; // rubles (decimal)
    /** 047 priceSnapshot — точная цена на момент checkout. */
    priceSnapshot?: { price?: number | null } | null;
  }> | null;
  delivery?: {
    cost?: number | null; // rubles
    tariffName?: string | null;
  } | null;
  totals?: {
    total?: number | null;
  } | null;
}

const VAT_CODE_VALUES = new Set<number>([1, 2, 3, 4, 5, 6, 11, 12]);
const TAX_SYSTEM_CODE_VALUES = new Set<number>([1, 2, 3, 4, 5, 6]);

/**
 * Строит receipt-объект для create-payment.
 *
 * Customer: email-приоритет, phone-fallback (FR-5544b, OQ-11).
 * Items: каждая Order.items[i] + delivery item (FR-5541, FR-5542).
 * vat_code: paymentSettings.defaultVatCode (FR-5544).
 *
 * Throws при отсутствии email и phone (FR-5544b).
 */
export function buildReceipt(
  order: ReceiptOrderShape,
  settings: PaymentSettingsResolved,
): YooKassaReceiptInput {
  const customer = buildCustomer(order);
  const taxSystemCode = ensureTaxSystemCode(settings.taxSystemCode);
  const vatCode = ensureVatCode(settings.defaultVatCode);

  const items: YooKassaReceiptInput["items"] = [];
  for (const it of order.items ?? []) {
    const qty = Number(it.quantity ?? 0);
    const price = pickPrice(it);
    if (qty <= 0 || price == null || price <= 0) continue;
    const title = (it.title ?? it.sku ?? "Товар").slice(0, 128);
    items.push({
      description: title,
      quantity: qty.toFixed(2),
      amount: { value: price.toFixed(2), currency: "RUB" },
      vat_code: vatCode,
      payment_subject: "commodity",
      payment_mode: "full_prepayment",
    });
  }

  const deliveryCost = order.delivery?.cost;
  if (typeof deliveryCost === "number" && deliveryCost > 0) {
    const deliveryTitle = (order.delivery?.tariffName
      ? `Доставка: ${order.delivery.tariffName}`
      : "Доставка"
    ).slice(0, 128);
    items.push({
      description: deliveryTitle,
      quantity: "1.00",
      amount: { value: deliveryCost.toFixed(2), currency: "RUB" },
      // FR-5542 / A4: единая ставка vat_code=12 для услуги доставки в MVP
      vat_code: vatCode,
      payment_subject: "service",
      payment_mode: "full_prepayment",
    });
  }

  if (items.length === 0) {
    throw new Error("buildReceipt: order has no items and no delivery — cannot build receipt");
  }

  return {
    customer,
    items,
    tax_system_code: taxSystemCode,
  };
}

/**
 * Строит receipt для refund (чек коррекции).
 * Использует vatCodeApplied snapshot из Order (FR-5544c) для legacy-кейсов.
 */
export function buildRefundReceipt(input: {
  order: ReceiptOrderShape;
  refundItems: Array<{ title: string; quantity: number; refundAmount: number /* rubles */ }>;
  vatCodeApplied?: number;
  settings: PaymentSettingsResolved;
}): YooKassaReceiptInput {
  const { order, refundItems, settings } = input;
  const customer = buildCustomer(order);
  const taxSystemCode = ensureTaxSystemCode(settings.taxSystemCode);
  const vatCode = ensureVatCodeForRefund(input.vatCodeApplied, settings);

  if (refundItems.length === 0) {
    throw new Error("buildRefundReceipt: refundItems is empty");
  }

  const items: YooKassaReceiptInput["items"] = refundItems.map((it) => ({
    description: (it.title || "Товар").slice(0, 128),
    quantity: Number(it.quantity).toFixed(2),
    amount: { value: Number(it.refundAmount).toFixed(2), currency: "RUB" },
    vat_code: vatCode,
    payment_subject: "commodity",
    payment_mode: "full_prepayment",
  }));

  return { customer, items, tax_system_code: taxSystemCode };
}

// --- helpers -----------------------------------------------------------------

function buildCustomer(order: ReceiptOrderShape): YooKassaReceiptInput["customer"] {
  const email = order.customer?.email?.trim();
  const phone = order.customer?.phone?.trim();
  // FR-5544b: email-приоритет, phone-fallback
  if (email) return { email };
  if (phone) return { phone: normalizePhone(phone) };
  throw new Error(
    "buildReceipt: Order.customer must have email or phone (FR-5544b)",
  );
}

function normalizePhone(phone: string): string {
  // ЮKassa требует формат +7XXXXXXXXXX (E.164 для РФ)
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  // Если уже E.164 — возвращаем как есть с +
  return phone.startsWith("+") ? phone : `+${digits}`;
}

interface ReceiptOrderItem {
  title?: string | null;
  sku?: string | null;
  quantity?: number | null;
  price?: number | null;
  priceSnapshot?: { price?: number | null } | null;
}

function pickPrice(item: ReceiptOrderItem): number | null {
  // 047 priceSnapshot имеет приоритет над текущей price
  const snapshot = item?.priceSnapshot?.price;
  if (typeof snapshot === "number" && snapshot > 0) return snapshot;
  if (typeof item?.price === "number" && item.price > 0) return item.price;
  return null;
}

function ensureVatCode(code: number): 1 | 2 | 3 | 4 | 5 | 6 | 11 | 12 {
  if (!VAT_CODE_VALUES.has(code)) {
    throw new Error(`Invalid vat_code: ${code}. Must be in {1,2,3,4,5,6,11,12} (FR-5544a).`);
  }
  return code as 1 | 2 | 3 | 4 | 5 | 6 | 11 | 12;
}

function ensureTaxSystemCode(code: number): 1 | 2 | 3 | 4 | 5 | 6 {
  if (!TAX_SYSTEM_CODE_VALUES.has(code)) {
    throw new Error(`Invalid tax_system_code: ${code}. Must be in {1..6} (FR-5544a).`);
  }
  return code as 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Validate vat_code для refund: legacy codes (4, 6) разрешены если в allowedLegacyVatCodes.
 */
function ensureVatCodeForRefund(
  vatCodeApplied: number | undefined,
  settings: PaymentSettingsResolved,
): 1 | 2 | 3 | 4 | 5 | 6 | 11 | 12 {
  const candidate = vatCodeApplied ?? settings.defaultVatCode;
  if (!VAT_CODE_VALUES.has(candidate)) {
    return ensureVatCode(settings.defaultVatCode);
  }
  // Legacy guard — старые коды (4, 6) можно использовать для refund только если они в allowedLegacyVatCodes
  if (candidate === 4 || candidate === 6) {
    if (!settings.allowedLegacyVatCodes.includes(candidate)) {
      throw new Error(
        `Refund uses legacy vat_code=${candidate}, but it is not in paymentSettings.allowedLegacyVatCodes`,
      );
    }
  }
  return candidate as 1 | 2 | 3 | 4 | 5 | 6 | 11 | 12;
}
