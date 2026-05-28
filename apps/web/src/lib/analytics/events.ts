/**
 * Typed event-helpers для всех 058 событий (contracts/analytics-events.md).
 *
 * Все события прогоняются через `dataLayer.push` + `gtag` (GA4) + `ym` (Метрика
 * через reachGoal). Каждый payload идёт через PII-filter (scrubPII).
 *
 * Соответствие FR (058):
 * - FR-001…FR-019: разметка событий
 * - FR-062: PII-filter invariant
 * - FR-280…FR-282: consent banner events (buffered if Metrika не загружена)
 *
 * Для ecommerce dual-push (FR-110-115) — смотри `data-layer.ts:trackPurchase` и др.
 */
import { scrubPII } from "./pii-filter";

// ============================================================
// dataLayer + gtag + ym push wrapper
// ============================================================

export type AnalyticsEventName =
  // Существовавшие из спеки 057
  | "add_to_cart"
  | "begin_checkout"
  | "rfq_open"
  | "rfq_submit"
  // Новые из 058
  | "page_view"
  | "category_view"
  | "view_item_list"
  | "select_item"
  | "view_item"
  | "view_cart"
  | "remove_from_cart"
  | "purchase"
  | "payment_intent"
  | "payment_failed"
  | "payment_retry"
  | "add_payment_info"
  | "add_shipping_info"
  | "shipment_rate_requested"
  | "shipment_selected"
  | "shipping_mode_changed"
  | "checkout_step_contact"
  | "checkout_step_shipping"
  | "checkout_step_payment_method"
  | "checkout_step_review"
  | "checkout_cta_pay_clicked"
  | "search"
  | "search_no_results"
  | "filter_apply"
  | "document_download"
  | "phone_click"
  | "phone_displayed"
  | "email_click"
  | "outbound_click"
  | "price_view"
  | "price_request_click"
  | "stock_status_view"
  | "form_field_error"
  | "inn_validation_success"
  | "inn_validation_failed"
  | "consent_banner_shown"
  | "consent_accepted"
  | "consent_declined"
  | "js_error"
  | "page_404"
  | "error_5xx";

export type AnalyticsEventParams = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (command: "event", eventName: string, params?: Record<string, unknown>) => void;
    ym?: (counterId: number, method: "reachGoal", goal: string, params?: Record<string, unknown>) => void;
  }
}

const yandexMetricaId = Number(
  process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? process.env.NEXT_PUBLIC_YANDEX_METRICA_ID,
);
const analyticsDebug = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true";

/**
 * Базовая функция отправки события (FR-062 PII-filter применяется).
 * Используется всеми wrapper-helpers ниже.
 */
export function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  params: AnalyticsEventParams = {},
): void {
  if (typeof window === "undefined") return;

  const cleanParams = scrubPII(params) as Record<string, unknown>;

  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event: eventName, ...cleanParams });

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, cleanParams);
  }

  if (Number.isFinite(yandexMetricaId) && yandexMetricaId > 0 && typeof window.ym === "function") {
    // Метрика ловит reachGoal по имени = eventName; goal должна существовать в
    // counter'е (см. metrika.config.ts → apply-config).
    window.ym(yandexMetricaId, "reachGoal", eventName, cleanParams);
  }

  if (analyticsDebug) {
    // eslint-disable-next-line no-console
    console.info("[analytics]", eventName, cleanParams);
  }
}

// ============================================================
// Категория 1: Просмотры (FR-001, FR-002, FR-003, FR-320)
// ============================================================

export function trackPageView(params: { pageType: string; path: string; cluster?: string }): void {
  trackAnalyticsEvent("page_view", {
    page_type: params.pageType,
    path: params.path,
    ...(params.cluster ? { cluster: params.cluster } : {}),
  });
}

export function trackCategoryView(params: { categorySlug: string; itemsCount: number }): void {
  trackAnalyticsEvent("category_view", {
    category_slug: params.categorySlug,
    items_count: params.itemsCount,
    page_type: "category",
  });
}

export function trackViewItemList(params: {
  listId: string;
  listName: string;
  items: Array<{ itemId: string; itemName: string; category?: string; position: number; price?: number }>;
}): void {
  trackAnalyticsEvent("view_item_list", {
    list_id: params.listId,
    list_name: params.listName,
    items: params.items.map((i) => ({
      item_id: i.itemId,
      item_name: i.itemName,
      ...(i.category ? { category: i.category } : {}),
      position: i.position,
      ...(typeof i.price === "number" ? { price: i.price } : {}),
    })),
  });
}

export function trackSelectItem(params: {
  listId: string;
  position: number;
  itemId: string;
  itemName: string;
}): void {
  trackAnalyticsEvent("select_item", {
    list_id: params.listId,
    position: params.position,
    item_id: params.itemId,
    item_name: params.itemName,
  });
}

// ============================================================
// Категория 2: Поиск (FR-004, FR-130, FR-131)
// ============================================================

export function trackSearch(params: { searchTerm: string; resultsCount: number }): void {
  trackAnalyticsEvent("search", {
    search_term: params.searchTerm,
    results_count: params.resultsCount,
  });
}

export function trackSearchNoResults(params: { searchTerm: string }): void {
  trackAnalyticsEvent("search_no_results", { search_term: params.searchTerm });
}

export function trackFilterApply(params: {
  filterName: string;
  filterValue: string;
  categorySlug?: string;
}): void {
  trackAnalyticsEvent("filter_apply", {
    filter_name: params.filterName,
    filter_value: params.filterValue,
    ...(params.categorySlug ? { category_slug: params.categorySlug } : {}),
  });
}

// ============================================================
// Категория 3: Контент-интеракции (FR-006, FR-007, FR-009)
// ============================================================

export function trackDocumentDownload(params: {
  documentType: string;
  filename: string;
  sku?: string;
}): void {
  trackAnalyticsEvent("document_download", {
    document_type: params.documentType,
    filename: params.filename,
    ...(params.sku ? { sku: params.sku } : {}),
  });
}

export function trackPhoneClick(params: { sourcePage: string; ctaSlot: string }): void {
  trackAnalyticsEvent("phone_click", {
    source_page: params.sourcePage,
    cta_slot: params.ctaSlot,
  });
}

export function trackPhoneDisplayed(params: {
  displayedNumber: string;
  acquisitionChannel?: string;
  ctaSlot: string;
}): void {
  trackAnalyticsEvent("phone_displayed", {
    displayed_number: params.displayedNumber,
    ...(params.acquisitionChannel ? { acquisition_channel: params.acquisitionChannel } : {}),
    cta_slot: params.ctaSlot,
  });
}

export function trackEmailClick(params: { sourcePage: string; ctaSlot: string }): void {
  trackAnalyticsEvent("email_click", {
    source_page: params.sourcePage,
    cta_slot: params.ctaSlot,
  });
}

export function trackOutboundClick(params: {
  outboundUrl: string;
  outboundHost: string;
  outboundTo?: "marketplace" | "social" | "other";
}): void {
  trackAnalyticsEvent("outbound_click", {
    outbound_url: params.outboundUrl,
    outbound_host: params.outboundHost,
    ...(params.outboundTo ? { outbound_to: params.outboundTo } : {}),
  });
}

// ============================================================
// Категория 4: B2B-сигналы (FR-190, FR-191)
// ============================================================

export function trackPriceView(params: { sku: string; categorySlug?: string }): void {
  trackAnalyticsEvent("price_view", {
    sku: params.sku,
    ...(params.categorySlug ? { category_slug: params.categorySlug } : {}),
  });
}

export function trackPriceRequestClick(params: { sku: string; categorySlug?: string }): void {
  trackAnalyticsEvent("price_request_click", {
    sku: params.sku,
    ...(params.categorySlug ? { category_slug: params.categorySlug } : {}),
  });
}

export function trackStockStatusView(params: {
  sku: string;
  stockStatus: "in_stock" | "on_order" | "out_of_stock" | "unknown";
}): void {
  trackAnalyticsEvent("stock_status_view", {
    sku: params.sku,
    stock_status: params.stockStatus,
  });
}

// ============================================================
// Категория 5: Checkout steps (FR-120-125)
// ============================================================

type CheckoutType = "physical" | "legal" | "quote";

export function trackCheckoutStepContact(checkoutType: CheckoutType): void {
  trackAnalyticsEvent("checkout_step_contact", { step_index: 1, checkout_type: checkoutType });
}

export function trackCheckoutStepShipping(checkoutType: CheckoutType): void {
  trackAnalyticsEvent("checkout_step_shipping", { step_index: 2, checkout_type: checkoutType });
}

export function trackCheckoutStepPaymentMethod(checkoutType: CheckoutType): void {
  trackAnalyticsEvent("checkout_step_payment_method", {
    step_index: 3,
    checkout_type: checkoutType,
  });
}

export function trackCheckoutStepReview(checkoutType: CheckoutType): void {
  trackAnalyticsEvent("checkout_step_review", { step_index: 4, checkout_type: checkoutType });
}

export function trackCheckoutCtaPayClicked(params: {
  checkoutType: CheckoutType;
  value: number;
}): void {
  trackAnalyticsEvent("checkout_cta_pay_clicked", {
    step_index: 5,
    checkout_type: params.checkoutType,
    value: params.value,
    currency: "RUB",
  });
}

// ============================================================
// Категория 6: Платёж и доставка (FR-011, FR-012, FR-016, FR-017)
// ============================================================

export function trackAddShippingInfo(params: {
  provider: string;
  tariffId?: string;
  shippingCost?: number;
}): void {
  trackAnalyticsEvent("add_shipping_info", {
    provider: params.provider,
    ...(params.tariffId ? { tariff_id: params.tariffId } : {}),
    ...(typeof params.shippingCost === "number" ? { shipping_cost: params.shippingCost } : {}),
    currency: "RUB",
  });
}

export function trackAddPaymentInfo(params: {
  paymentMethod: string;
  checkoutType: CheckoutType;
}): void {
  trackAnalyticsEvent("add_payment_info", {
    payment_method: params.paymentMethod,
    checkout_type: params.checkoutType,
  });
}

export function trackShipmentRateRequested(params: {
  provider: string;
  destinationRegion: string;
}): void {
  trackAnalyticsEvent("shipment_rate_requested", {
    provider: params.provider,
    destination_region: params.destinationRegion,
  });
}

export function trackShipmentSelected(params: {
  provider: string;
  tariffId: string;
  shippingCost: number;
}): void {
  trackAnalyticsEvent("shipment_selected", {
    provider: params.provider,
    tariff_id: params.tariffId,
    shipping_cost: params.shippingCost,
    currency: "RUB",
  });
}

type PaymentFailedReason =
  | "expired"
  | "cancelled_by_user"
  | "payment_method_declined"
  | "webhook_timeout"
  | "unknown";

export function trackPaymentFailed(params: {
  transactionId: string;
  reason: PaymentFailedReason;
}): void {
  trackAnalyticsEvent("payment_failed", {
    transaction_id: params.transactionId,
    reason: params.reason,
  });
}

export function trackPaymentRetry(params: { transactionId: string; attemptNumber: number }): void {
  trackAnalyticsEvent("payment_retry", {
    transaction_id: params.transactionId,
    attempt_number: params.attemptNumber,
  });
}

// ============================================================
// Категория 7: Формы (FR-015, FR-192)
// ============================================================

export function trackFormFieldError(params: {
  formType: string;
  fieldName: string;
  errorCode: string;
}): void {
  trackAnalyticsEvent("form_field_error", {
    form_type: params.formType,
    field_name: params.fieldName,
    error_code: params.errorCode,
  });
}

export function trackInnValidationSuccess(params: { formType: string }): void {
  trackAnalyticsEvent("inn_validation_success", { form_type: params.formType });
}

export function trackInnValidationFailed(params: { formType: string; errorCode: string }): void {
  trackAnalyticsEvent("inn_validation_failed", {
    form_type: params.formType,
    error_code: params.errorCode,
  });
}

// 062: Тип режима доставки для unified shipping-mode-selection (юр-checkout).
export type ShippingMode = "pickup" | "apiship" | "own_carrier";

/**
 * 062 FR-062-40: Срабатывает при смене режима доставки в чекауте юрлица.
 * НЕ стреляет при первоначальном mount с дефолтным режимом — только на
 * явный клик пользователя по radio.
 *
 * @param params.mode — текущий выбранный режим
 * @param params.checkoutType — обычно "legal" (для physical mode-switch не вводится)
 * @param params.previousMode — предыдущий mode, если был; отсутствует на первом переключении
 */
export function trackShippingModeChanged(params: {
  mode: ShippingMode;
  checkoutType: "legal" | "physical";
  previousMode?: ShippingMode;
}): void {
  trackAnalyticsEvent("shipping_mode_changed", {
    mode: params.mode,
    checkout_type: params.checkoutType,
    ...(params.previousMode ? { previous_mode: params.previousMode } : {}),
  });
}

// ============================================================
// Категория 8: Системные (FR-170-172, FR-280-282)
// ============================================================

export function trackConsentBannerShown(): void {
  trackAnalyticsEvent("consent_banner_shown", {});
}

export function trackConsentAccepted(): void {
  trackAnalyticsEvent("consent_accepted", { consent_categories: ["analytics"] });
}

export function trackConsentDeclined(): void {
  trackAnalyticsEvent("consent_declined", {});
}

export function trackJsError(params: {
  errorMessage: string;
  sourceFile: string;
  lineNumber: number;
  userAgentClass: "mobile" | "desktop" | "tablet" | "bot";
}): void {
  trackAnalyticsEvent("js_error", {
    error_message: params.errorMessage,
    source_file: params.sourceFile,
    line_number: params.lineNumber,
    user_agent_class: params.userAgentClass,
  });
}

export function trackPage404(params: { requestedPath: string; referrer?: string }): void {
  trackAnalyticsEvent("page_404", {
    requested_path: params.requestedPath,
    ...(params.referrer ? { referrer: params.referrer } : {}),
  });
}

export function trackError5xx(params: { statusCode: number; endpoint: string }): void {
  trackAnalyticsEvent("error_5xx", {
    status_code: params.statusCode,
    endpoint: params.endpoint,
  });
}
