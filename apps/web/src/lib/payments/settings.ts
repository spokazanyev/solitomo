import "server-only";

import configPromise from "@payload-config";
import { getPayload } from "payload";

/**
 * PaymentSettings loader с in-memory кешем (055 FR-5560..5563).
 *
 * Кеш инвалидируется через invalidatePaymentSettingsCache() в afterChange-хуке
 * PaymentSettings global. Валидация значений happens at-load (FR-5544a).
 */

export interface PaymentSettingsResolved {
  enabled: boolean;
  captureMode: "one_stage" | "two_stage";
  paymentMethods: Array<"bank_card" | "sbp" | "yoo_money" | "sberbank">;
  paymentRetryWindowMin: number;
  webhookSignatureMode: "off" | "enforce";
  webhookSecret?: string;
  taxSystemCode: number;
  defaultVatCode: number;
  allowedLegacyVatCodes: number[];
  sbpMaxAmount: number;
  senderCompanyInfo: {
    inn: string;
    legalName: string;
    address: string;
    kpp?: string;
  };
}

let cached: PaymentSettingsResolved | null = null;
let cachedAt = 0;
const TTL_MS = 60_000; // 1 минута

/**
 * Загружает PaymentSettings из Payload globals с кешем 1 мин.
 * Throws с описательным сообщением при invalid config (FR-5544a fail-fast).
 */
export async function loadPaymentSettings(): Promise<PaymentSettingsResolved> {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;

  const payload = await getPayload({ config: configPromise });
  const raw = (await payload.findGlobal({
    slug: "payment-settings",
    depth: 0,
  })) as RawPaymentSettings | null;

  if (!raw) {
    throw new Error(
      "paymentSettings global is missing — Payload migration may not have run yet (055 T007).",
    );
  }

  const resolved = validateAndNormalize(raw);
  cached = resolved;
  cachedAt = Date.now();
  return resolved;
}

/** Used by PaymentSettings.afterChange to invalidate cache. */
export function invalidatePaymentSettingsCache(): void {
  cached = null;
  cachedAt = 0;
}

/** Used by tests to inject a known state. */
export function setPaymentSettingsCacheForTesting(value: PaymentSettingsResolved | null): void {
  cached = value;
  cachedAt = value ? Date.now() : 0;
}

interface RawPaymentSettings {
  enabled?: boolean;
  captureMode?: string;
  paymentMethods?: string[];
  paymentRetryWindowMin?: number;
  webhookSignatureMode?: string;
  webhookSecret?: string;
  taxSystemCode?: number;
  defaultVatCode?: number;
  allowedLegacyVatCodes?: Array<{ code?: number } | number>;
  sbpMaxAmount?: number;
  senderCompanyInfo?: {
    inn?: string;
    legalName?: string;
    address?: string;
    kpp?: string;
  };
}

function validateAndNormalize(raw: RawPaymentSettings): PaymentSettingsResolved {
  const captureMode = raw.captureMode === "one_stage" ? "one_stage" : "two_stage";
  const webhookSignatureMode = raw.webhookSignatureMode === "enforce" ? "enforce" : "off";

  const validMethods: Array<"bank_card" | "sbp" | "yoo_money" | "sberbank"> = [];
  for (const m of raw.paymentMethods ?? []) {
    if (m === "bank_card" || m === "sbp" || m === "yoo_money" || m === "sberbank") {
      validMethods.push(m);
    }
  }
  if (validMethods.length === 0) validMethods.push("bank_card", "sbp");

  const taxSystemCode = raw.taxSystemCode ?? 1;
  if (!Number.isInteger(taxSystemCode) || taxSystemCode < 1 || taxSystemCode > 6) {
    throw new Error(
      `paymentSettings.taxSystemCode invalid: ${taxSystemCode}. Must be integer in {1..6} (FR-5544a).`,
    );
  }
  const defaultVatCode = raw.defaultVatCode ?? 12;
  if (!Number.isInteger(defaultVatCode) || defaultVatCode < 1 || defaultVatCode > 12) {
    throw new Error(
      `paymentSettings.defaultVatCode invalid: ${defaultVatCode}. Must be integer in {1..12} (FR-5544a).`,
    );
  }

  const allowedLegacyVatCodes: number[] = [];
  for (const item of raw.allowedLegacyVatCodes ?? []) {
    const code = typeof item === "number" ? item : item?.code;
    if (Number.isInteger(code) && code != null && code >= 1 && code <= 12) {
      allowedLegacyVatCodes.push(code);
    }
  }

  const sender = raw.senderCompanyInfo;
  if (!sender?.inn || !sender?.legalName || !sender?.address) {
    throw new Error(
      "paymentSettings.senderCompanyInfo.{inn,legalName,address} are required (FR-5544a). Fill in admin → Payment Settings.",
    );
  }
  if (!/^\d{10}(\d{2})?$/.test(sender.inn)) {
    throw new Error(`paymentSettings.senderCompanyInfo.inn invalid: must be 10 or 12 digits`);
  }

  return {
    enabled: raw.enabled !== false,
    captureMode,
    paymentMethods: validMethods,
    paymentRetryWindowMin: Math.max(5, Math.min(1440, raw.paymentRetryWindowMin ?? 60)),
    webhookSignatureMode,
    webhookSecret: raw.webhookSecret || undefined,
    taxSystemCode,
    defaultVatCode,
    allowedLegacyVatCodes:
      allowedLegacyVatCodes.length > 0 ? allowedLegacyVatCodes : [4, 6],
    sbpMaxAmount: raw.sbpMaxAmount ?? 1_000_000,
    senderCompanyInfo: {
      inn: sender.inn,
      legalName: sender.legalName,
      address: sender.address,
      kpp: sender.kpp || undefined,
    },
  };
}

/**
 * Возвращает creds для ЮKassa из env. Throws в production если отсутствуют.
 * В dev — возвращает null (вызывающий код переходит в stub mode, как 053).
 */
export function loadYooKassaCredentials(): { shopId: string; secretKey: string } | null {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "YOOKASSA_SHOP_ID/SECRET_KEY missing in production env (FR-5598).",
      );
    }
    return null;
  }
  return { shopId, secretKey };
}
