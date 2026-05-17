export type AnalyticsEventName =
  | "add_to_cart"
  | "begin_checkout"
  | "rfq_open"
  | "rfq_submit";

export type AnalyticsEventParams = Record<string, boolean | number | string | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (command: "event", eventName: string, params?: AnalyticsEventParams) => void;
    ym?: (counterId: number, method: "reachGoal", goal: string, params?: AnalyticsEventParams) => void;
  }
}

const yandexMetricaId = Number(process.env.NEXT_PUBLIC_YANDEX_METRICA_ID);
const analyticsDebug = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true";

export function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  params: AnalyticsEventParams = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
  );

  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({
    event: eventName,
    ...cleanParams,
  });

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, cleanParams);
  }

  if (Number.isFinite(yandexMetricaId) && yandexMetricaId > 0 && typeof window.ym === "function") {
    window.ym(yandexMetricaId, "reachGoal", eventName, cleanParams);
  }

  if (analyticsDebug) {
    console.info("[analytics]", eventName, cleanParams);
  }
}
