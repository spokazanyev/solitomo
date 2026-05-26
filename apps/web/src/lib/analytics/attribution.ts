/**
 * Attribution: UTM/yclid cookies + referrer classification + acquisition_query.
 *
 * Соответствие спеке 058:
 * - FR-030..035: UTM-whitelist в cookie, first-touch для Cart/Order
 * - FR-240: классификация реферера в acquisition_channel
 * - FR-242: extractSearchQuery из referer'а
 * - FR-241: host-паттерны из AnalyticsSettings (v1 — fallback на seed)
 * - FR-232: isBrandQuery для brand/non-brand split
 *
 * Cookie format: `_solitomo_attribution` (Lax/Secure, TTL 365d), JSON:
 * ```json
 * {
 *   "utmSource": "yandex",
 *   "utmMedium": "cpc",
 *   ...
 *   "yclid": "abc123",
 *   "refererHost": "yandex.ru",
 *   "acquisitionChannel": "paid_yandex_direct",
 *   "acquisitionQuery": "купить PDU",
 *   "capturedAt": "2026-05-26T12:00:00.000Z"
 * }
 * ```
 */
import { scrubPII } from "./pii-filter.ts";

// UTM-whitelist параметров для атрибуции (FR-030)
export const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export const AD_CLICK_IDS = ["yclid", "gclid", "_openstat", "from"] as const;

export const ATTRIBUTION_COOKIE_NAME = "_solitomo_attribution";
export const FIRST_SEEN_COOKIE_NAME = "_solitomo_first_seen";
export const VISIT_COUNT_COOKIE_NAME = "_solitomo_visit_count";
export const LEGAL_ENTITY_FLAG_COOKIE_NAME = "_solitomo_legal_entity_flag";

export const ATTRIBUTION_COOKIE_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 год
export const FIRST_SEEN_COOKIE_TTL_SECONDS = 365 * 24 * 60 * 60;

// ============================================================
// Domain types
// ============================================================

export type AcquisitionChannel =
  | "organic_yandex"
  | "organic_google"
  | "organic_images_yandex"
  | "organic_images_google"
  | "organic_maps_yandex"
  | "organic_maps_google"
  | "organic_marketplace_yandex_market"
  | "organic_ai"
  | "paid_yandex_direct"
  | "paid_google_ads"
  | "social"
  | "marketplace_outbound"
  | "direct"
  | "referral";

export interface AttributionTouchpoint {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  yclid?: string;
  gclid?: string;
  openstat?: string;
  from?: string;
  refererHost?: string;
  acquisitionChannel?: AcquisitionChannel;
  acquisitionQuery?: string;
  capturedAt: string; // ISO8601
}

// ============================================================
// Referrer classification (FR-240)
// ============================================================

interface ReferrerPattern {
  channel: AcquisitionChannel;
  hostPatterns: string[]; // simple glob: *.domain.com or exact 'domain.com'
  priority: number;
}

/**
 * Дефолтные host-паттерны (FR-241). В v1 — seed; в v1.1 будут читаться из
 * AnalyticsSettings.referrerPatterns (Payload Global).
 *
 * Порядок важен: более специфичные паттерны идут с меньшим priority-номером
 * (10 = первый match wins).
 */
const DEFAULT_REFERRER_PATTERNS: ReferrerPattern[] = [
  // AI-поисковики (специфичные хосты, проверяем рано)
  {
    channel: "organic_ai",
    priority: 10,
    hostPatterns: [
      "perplexity.ai",
      "chatgpt.com",
      "chat.openai.com",
      "claude.ai",
      "you.com",
      "phind.com",
      "copilot.microsoft.com",
      "gemini.google.com",
    ],
  },
  // Yandex.Картинки и Я.Карты (path-pattern не поддерживается в простом host-match —
  // для v1 классифицируем как organic_yandex; точная классификация — v1.1).
  {
    channel: "organic_marketplace_yandex_market",
    priority: 20,
    hostPatterns: ["market.yandex.ru", "market.yandex.by"],
  },
  // Социальные
  {
    channel: "social",
    priority: 30,
    hostPatterns: [
      "vk.com",
      "m.vk.com",
      "t.me",
      "telegram.me",
      "web.telegram.org",
      "ok.ru",
      "facebook.com",
      "twitter.com",
      "x.com",
      "linkedin.com",
    ],
  },
  // Маркетплейсы (исходящий трафик; здесь — входящий → редко)
  {
    channel: "marketplace_outbound",
    priority: 40,
    hostPatterns: ["wildberries.ru", "ozon.ru", "avito.ru"],
  },
  // Generic поисковики (после AI/маркетплейсов)
  {
    channel: "organic_yandex",
    priority: 50,
    hostPatterns: ["yandex.ru", "yandex.by", "yandex.kz", "ya.ru"],
  },
  {
    channel: "organic_google",
    priority: 50,
    hostPatterns: ["google.com", "google.ru", "google.by", "google.kz"],
  },
];

function hostMatches(host: string, pattern: string): boolean {
  const h = host.toLowerCase();
  const p = pattern.toLowerCase();
  if (p.startsWith("*.")) {
    const suffix = p.slice(2);
    return h === suffix || h.endsWith("." + suffix);
  }
  return h === p || h.endsWith("." + p);
}

/**
 * Классифицирует host реферера в acquisition_channel.
 * Если paid-click ID (yclid/gclid) присутствует — priority paid-каналу
 * независимо от host'а.
 */
export function classifyReferrer(
  refererHost: string | null,
  paidClickIds: { yclid?: string; gclid?: string } = {},
  patterns: ReferrerPattern[] = DEFAULT_REFERRER_PATTERNS,
): AcquisitionChannel {
  // Paid override
  if (paidClickIds.yclid) return "paid_yandex_direct";
  if (paidClickIds.gclid) return "paid_google_ads";

  if (!refererHost) return "direct";

  // Sort by priority ascending (10 = highest priority)
  const sorted = [...patterns].sort((a, b) => a.priority - b.priority);
  for (const p of sorted) {
    for (const hp of p.hostPatterns) {
      if (hostMatches(refererHost, hp)) return p.channel;
    }
  }
  return "referral";
}

// ============================================================
// extractSearchQuery (FR-242)
// ============================================================

/**
 * Извлекает поисковый запрос из реферера Яндекса/Google и прогоняет через
 * PII-filter (защита от случайных email/phone в запросе).
 *
 * Yandex: ?text=PDU+19+стойка
 * Google: ?q=... (часто redacted в HTTPS-выдаче)
 */
export function extractSearchQuery(refererUrl: string | null): string | null {
  if (!refererUrl) return null;
  let url: URL;
  try {
    url = new URL(refererUrl);
  } catch {
    return null;
  }

  // Yandex
  let query = url.searchParams.get("text");
  // Google
  if (!query) query = url.searchParams.get("q");
  if (!query) return null;

  query = query.trim().slice(0, 200); // truncate
  if (query.length === 0) return null;

  // Прогон через PII-filter (defence in depth)
  const scrubbed = scrubPII({ acquisition_query: query });
  const result = (scrubbed as { acquisition_query?: string }).acquisition_query ?? null;

  // Если scrub удалил всё содержимое или вырезал ПДн целиком — return null
  if (!result || result.includes("[REDACTED")) return null;

  return result;
}

// ============================================================
// Brand-vs-non-brand (FR-232)
// ============================================================

const DEFAULT_BRAND_KEYWORDS = ["soliton", "солитон", "pdumarket"];

export function isBrandQuery(query: string | null | undefined, brandKeywords: string[] = DEFAULT_BRAND_KEYWORDS): boolean {
  if (!query) return false;
  const lc = query.toLowerCase();
  return brandKeywords.some((kw) => lc.includes(kw.toLowerCase()));
}

// ============================================================
// Touchpoint extraction (для use в middleware / server-side)
// ============================================================

/**
 * Извлекает touchpoint из URL (query string) + referer header.
 * Возвращает null если ничего не нашли (нет UTM/yclid/gclid и нет referer).
 */
export function extractTouchpointFromRequest(args: {
  url: URL;
  refererHeader: string | null;
}): AttributionTouchpoint | null {
  const params = args.url.searchParams;
  const tp: AttributionTouchpoint = { capturedAt: new Date().toISOString() };

  // UTM
  for (const utm of UTM_PARAMS) {
    const v = params.get(utm);
    if (v) {
      const key = utm.replace(/_([a-z])/g, (_, c) => (c as string).toUpperCase());
      (tp as unknown as Record<string, string>)[key] = v.slice(0, 200);
    }
  }
  // Ad click IDs
  for (const id of AD_CLICK_IDS) {
    const v = params.get(id);
    if (v) {
      const key = id === "_openstat" ? "openstat" : id;
      (tp as unknown as Record<string, string>)[key] = v.slice(0, 200);
    }
  }

  // Referer host + query
  if (args.refererHeader) {
    try {
      const refUrl = new URL(args.refererHeader);
      // Не считаем own-domain referer как source
      if (refUrl.host !== args.url.host) {
        tp.refererHost = refUrl.host;
        const q = extractSearchQuery(args.refererHeader);
        if (q) tp.acquisitionQuery = q;
      }
    } catch {
      // ignore malformed referer
    }
  }

  // Classification
  tp.acquisitionChannel = classifyReferrer(tp.refererHost ?? null, {
    ...(tp.yclid ? { yclid: tp.yclid } : {}),
    ...(tp.gclid ? { gclid: tp.gclid } : {}),
  });

  // Если ничего значимого не нашли (только direct, без UTM/yclid/refererHost) — null
  const hasUtm = UTM_PARAMS.some(
    (utm) => (tp as unknown as Record<string, string>)[utm.replace(/_([a-z])/g, (_, c) => (c as string).toUpperCase())],
  );
  const hasAdId = Boolean(tp.yclid || tp.gclid);
  if (!hasUtm && !hasAdId && !tp.refererHost) return null;

  return tp;
}

// ============================================================
// Cookie encoding/decoding
// ============================================================

/**
 * Serialize touchpoint → URI-encoded JSON для cookie value.
 * Edge-runtime safe (без Buffer): просто encodeURIComponent.
 */
export function encodeAttributionCookie(tp: AttributionTouchpoint): string {
  return encodeURIComponent(JSON.stringify(tp));
}

export function decodeAttributionCookie(value: string): AttributionTouchpoint | null {
  try {
    const json = decodeURIComponent(value);
    const parsed = JSON.parse(json) as AttributionTouchpoint;
    if (typeof parsed !== "object" || !parsed.capturedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Browser-side helper: read cookie. Returns null если нет в documenсe.cookie.
 * Server-side: используется через `cookies()` API из Next.js — этот helper
 * только для client'а.
 */
export function readAttributionCookieFromBrowser(): AttributionTouchpoint | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${ATTRIBUTION_COOKIE_NAME}=([^;]+)`));
  if (!match || !match[1]) return null;
  return decodeAttributionCookie(match[1]);
}

/**
 * Should we overwrite existing cookie? Правило (FR-031, R2):
 * - cookie отсутствует → write
 * - новый touch имеет yclid ИЛИ gclid (paid override) → write
 * - cookie старше 365 дней → write
 * - иначе → keep (first-touch стабильность)
 */
export function shouldOverwriteAttribution(
  existing: AttributionTouchpoint | null,
  newTouch: AttributionTouchpoint,
): boolean {
  if (!existing) return true;
  if (newTouch.yclid || newTouch.gclid) return true;
  try {
    const age = Date.now() - new Date(existing.capturedAt).getTime();
    if (age > ATTRIBUTION_COOKIE_TTL_SECONDS * 1000) return true;
  } catch {
    return true;
  }
  return false;
}
