// 057: Analytics now consent-gated via CookieConsentBanner.
//
// This component is intentionally a no-op stub. GA4 (`NEXT_PUBLIC_GA_MEASUREMENT_ID`)
// and Yandex Metrica (`NEXT_PUBLIC_YANDEX_METRIKA_ID` / legacy
// `NEXT_PUBLIC_YANDEX_METRICA_ID`) are now loaded on-demand by
// `loadAnalyticsFromConsent` (see `@/lib/analytics/analytics-loader`) only
// after the visitor accepts cookies via `<CookieConsentBanner>` mounted in
// `app/(site)/layout.tsx`.
//
// The file is kept so any historical imports continue to compile without a
// crash; remove once no callers remain.
export function AnalyticsScripts() {
  return null;
}

export default AnalyticsScripts;
