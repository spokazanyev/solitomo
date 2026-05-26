import "server-only";

import { getPayload } from "payload";
import configPromise from "@payload-config";

export interface ApiShipSettings {
  enabled: boolean;
  isTest: boolean;
  token: string;
  webhookSecret?: string;
  baseUrl: string;
  sender: {
    countryCode: string;
    addressString: string;
    contactName: string;
    phone: string;
  };
  defaults: {
    length: number;
    width: number;
    height: number;
    weight: number;
    deliveryCostVat: string;
    isCod: boolean;
  };
  disabledProviders: string[];
  allowedDeliveryTypes: Array<"doortodoor" | "doortopoint" | "pointtodoor" | "pointtopoint">;
  yandexMaps: { apiKey: string; tariffPlan: string };
  dadata: { apiKey: string; secret: string; tariffPlan: string; cacheTtlDays: number };
  lifecycle: {
    closureWindowDays: number;
    paymentRetryWindowMin: number;
    invoiceExpiresDays: number;
    stuckThresholdHours: { paid: number; fulfilling: number; shipped: number; atPoint: number };
    priceMismatchTolerance: { percent: number; absoluteR: number };
  };
}

const FALLBACK_SETTINGS: ApiShipSettings = {
  enabled: false,
  isTest: true,
  token: "",
  webhookSecret: "",
  baseUrl: "http://api.dev.apiship.ru/v1",
  sender: { countryCode: "RU", addressString: "", contactName: "", phone: "" },
  defaults: { length: 30, width: 20, height: 15, weight: 1500, deliveryCostVat: "20", isCod: false },
  disabledProviders: [],
  allowedDeliveryTypes: ["doortodoor", "doortopoint"],
  yandexMaps: { apiKey: "", tariffPlan: "free" },
  dadata: { apiKey: "", secret: "", tariffPlan: "free", cacheTtlDays: 30 },
  lifecycle: {
    closureWindowDays: Number(process.env.ORDER_CLOSURE_WINDOW_DAYS ?? 14),
    paymentRetryWindowMin: Number(process.env.ORDER_PAYMENT_RETRY_WINDOW_MIN ?? 30),
    invoiceExpiresDays: Number(process.env.ORDER_INVOICE_EXPIRES_DAYS ?? 5),
    stuckThresholdHours: { paid: 48, fulfilling: 48, shipped: 72, atPoint: 96 },
    priceMismatchTolerance: { percent: 5, absoluteR: 100 },
  },
};

let cached: ApiShipSettings | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

export async function loadSettings(): Promise<ApiShipSettings> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
  try {
    const payload = await getPayload({ config: configPromise });
    const raw = (await payload.findGlobal({ slug: "apiship-settings" })) as unknown as Record<string, unknown> | null;
    const settings = mergeWithFallback(raw);
    cached = settings;
    cachedAt = Date.now();
    return settings;
  } catch {
    return FALLBACK_SETTINGS;
  }
}

export function invalidateSettingsCache() {
  cached = null;
  cachedAt = 0;
}

function mergeWithFallback(raw: Record<string, unknown> | null): ApiShipSettings {
  if (!raw) return FALLBACK_SETTINGS;
  const merged: ApiShipSettings = JSON.parse(JSON.stringify(FALLBACK_SETTINGS));
  if (typeof raw.enabled === "boolean") merged.enabled = raw.enabled;
  if (typeof raw.isTest === "boolean") merged.isTest = raw.isTest;
  if (typeof raw.token === "string") merged.token = raw.token || process.env.APISHIP_TOKEN || "";
  if (typeof raw.webhookSecret === "string")
    merged.webhookSecret = raw.webhookSecret || process.env.APISHIP_WEBHOOK_SECRET || "";
  merged.baseUrl = merged.isTest
    ? process.env.APISHIP_BASE_URL ?? "http://api.dev.apiship.ru/v1"
    : "https://api.apiship.ru/v1";
  const sender = raw.sender as Record<string, string> | undefined;
  if (sender) Object.assign(merged.sender, sender);
  const defaults = raw.defaults as Record<string, number | string | boolean> | undefined;
  if (defaults) Object.assign(merged.defaults, defaults);
  if (Array.isArray(raw.disabledProviders)) {
    merged.disabledProviders = (raw.disabledProviders as Array<{ providerKey?: string }>)
      .map((p) => String(p.providerKey ?? ""))
      .filter(Boolean);
  }
  if (Array.isArray(raw.allowedDeliveryTypes))
    merged.allowedDeliveryTypes = raw.allowedDeliveryTypes as ApiShipSettings["allowedDeliveryTypes"];
  const yandex = raw.yandexMaps as Record<string, string> | undefined;
  if (yandex) {
    merged.yandexMaps.apiKey = yandex.apiKey || process.env.YANDEX_MAPS_API_KEY || "";
    if (yandex.tariffPlan) merged.yandexMaps.tariffPlan = yandex.tariffPlan;
  } else {
    merged.yandexMaps.apiKey = process.env.YANDEX_MAPS_API_KEY ?? "";
  }
  const dadata = raw.dadata as Record<string, string | number> | undefined;
  if (dadata) {
    merged.dadata.apiKey = String(dadata.apiKey ?? "") || process.env.DADATA_API_KEY || "";
    merged.dadata.secret = String(dadata.secret ?? "") || process.env.DADATA_SECRET || "";
    if (dadata.tariffPlan) merged.dadata.tariffPlan = String(dadata.tariffPlan);
    if (typeof dadata.cacheTtlDays === "number") merged.dadata.cacheTtlDays = dadata.cacheTtlDays;
  } else {
    merged.dadata.apiKey = process.env.DADATA_API_KEY ?? "";
    merged.dadata.secret = process.env.DADATA_SECRET ?? "";
  }
  const lifecycle = raw.lifecycle as unknown as Record<string, unknown> | undefined;
  if (lifecycle) {
    if (typeof lifecycle.closureWindowDays === "number")
      merged.lifecycle.closureWindowDays = lifecycle.closureWindowDays;
    if (typeof lifecycle.paymentRetryWindowMin === "number")
      merged.lifecycle.paymentRetryWindowMin = lifecycle.paymentRetryWindowMin;
    if (typeof lifecycle.invoiceExpiresDays === "number")
      merged.lifecycle.invoiceExpiresDays = lifecycle.invoiceExpiresDays;
    const stuck = lifecycle.stuckThresholdHours as Record<string, number> | undefined;
    if (stuck) Object.assign(merged.lifecycle.stuckThresholdHours, stuck);
    const tol = lifecycle.priceMismatchTolerance as Record<string, number> | undefined;
    if (tol) Object.assign(merged.lifecycle.priceMismatchTolerance, tol);
  }
  return merged;
}
