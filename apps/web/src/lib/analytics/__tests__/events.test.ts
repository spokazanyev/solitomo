/**
 * Smoke-test для events.ts — FR-290 slot 1 (jsdom).
 *
 * Каждый event-helper:
 * 1. Push'ит правильный event-name + payload в window.dataLayer.
 * 2. Прогоняет payload через scrubPII (FR-062).
 * 3. Содержит required параметры из contracts/analytics-events.md.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  trackAddPaymentInfo,
  trackAddShippingInfo,
  trackCategoryView,
  trackCheckoutCtaPayClicked,
  trackCheckoutStepContact,
  trackCheckoutStepPaymentMethod,
  trackCheckoutStepReview,
  trackCheckoutStepShipping,
  trackConsentAccepted,
  trackConsentBannerShown,
  trackConsentDeclined,
  trackDocumentDownload,
  trackEmailClick,
  trackError5xx,
  trackFilterApply,
  trackFormFieldError,
  trackInnValidationFailed,
  trackInnValidationSuccess,
  trackJsError,
  trackOutboundClick,
  trackPage404,
  trackPageView,
  trackPaymentFailed,
  trackPaymentRetry,
  trackPhoneClick,
  trackPhoneDisplayed,
  trackPriceRequestClick,
  trackPriceView,
  trackSearch,
  trackSearchNoResults,
  trackSelectItem,
  trackShipmentRateRequested,
  trackShipmentSelected,
  trackStockStatusView,
  trackViewItemList,
} from "../events";

function getDataLayer(): Array<Record<string, unknown>> {
  const win = globalThis as unknown as { window?: { dataLayer?: Array<Record<string, unknown>> } };
  return win.window?.dataLayer ?? [];
}

function getLastEvent(): Record<string, unknown> | undefined {
  const dl = getDataLayer();
  if (dl.length === 0) return undefined;
  return dl[dl.length - 1];
}

function setupDataLayer(): void {
  const g = globalThis as unknown as { window?: { dataLayer?: unknown } };
  if (!g.window) g.window = {};
  g.window.dataLayer = [];
}

beforeEach(() => {
  setupDataLayer();
});

describe("events.ts — Просмотры", () => {
  it("trackPageView with required params", () => {
    trackPageView({ pageType: "home", path: "/", cluster: "home-main" });
    const evt = getLastEvent();
    expect(evt?.event).toBe("page_view");
    expect(evt?.page_type).toBe("home");
    expect(evt?.path).toBe("/");
    expect(evt?.cluster).toBe("home-main");
  });

  it("trackCategoryView", () => {
    trackCategoryView({ categorySlug: "pdu-rack", itemsCount: 12 });
    const evt = getLastEvent();
    expect(evt?.event).toBe("category_view");
    expect(evt?.category_slug).toBe("pdu-rack");
    expect(evt?.items_count).toBe(12);
    expect(evt?.page_type).toBe("category");
  });

  it("trackViewItemList с items[]", () => {
    trackViewItemList({
      listId: "homepage_featured",
      listName: "Featured",
      items: [
        { itemId: "PDU-1", itemName: "PDU 19\"", position: 1, price: 12500 },
        { itemId: "PDU-2", itemName: "PDU 12\"", position: 2 },
      ],
    });
    const evt = getLastEvent();
    expect(evt?.event).toBe("view_item_list");
    expect(evt?.list_id).toBe("homepage_featured");
    const items = evt?.items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items[0]!.position).toBe(1);
    expect(items[0]!.price).toBe(12500);
  });

  it("trackSelectItem", () => {
    trackSelectItem({ listId: "catalog", position: 3, itemId: "X", itemName: "Item X" });
    const evt = getLastEvent();
    expect(evt?.event).toBe("select_item");
    expect(evt?.position).toBe(3);
  });
});

describe("events.ts — Поиск", () => {
  it("trackSearch", () => {
    trackSearch({ searchTerm: "PDU 19", resultsCount: 5 });
    const evt = getLastEvent();
    expect(evt?.event).toBe("search");
    expect(evt?.search_term).toBe("PDU 19");
    expect(evt?.results_count).toBe(5);
  });

  it("trackSearchNoResults", () => {
    trackSearchNoResults({ searchTerm: "unknown-product-xyz" });
    const evt = getLastEvent();
    expect(evt?.event).toBe("search_no_results");
  });

  it("trackSearch — PII-фильтр маскирует ПДн в search_term", () => {
    // Это критичный edge-case: пользователь ищет 'user@email.com' случайно
    trackSearch({ searchTerm: "найти user@example.com", resultsCount: 0 });
    const evt = getLastEvent();
    expect(evt?.search_term).toContain("[REDACTED_EMAIL]");
    expect(evt?.search_term).not.toContain("user@example.com");
  });

  it("trackFilterApply", () => {
    trackFilterApply({ filterName: "mounting", filterValue: "rack_19", categorySlug: "pdu" });
    const evt = getLastEvent();
    expect(evt?.filter_name).toBe("mounting");
    expect(evt?.filter_value).toBe("rack_19");
  });
});

describe("events.ts — Контент-интеракции", () => {
  it("trackDocumentDownload", () => {
    trackDocumentDownload({
      documentType: "datasheet",
      filename: "PDU-1.pdf",
      sku: "PDU-1",
    });
    const evt = getLastEvent();
    expect(evt?.event).toBe("document_download");
    expect(evt?.document_type).toBe("datasheet");
    expect(evt?.filename).toBe("PDU-1.pdf");
  });

  it("trackPhoneClick", () => {
    trackPhoneClick({ sourcePage: "/contacts", ctaSlot: "header" });
    expect(getLastEvent()?.event).toBe("phone_click");
  });

  it("trackPhoneDisplayed", () => {
    trackPhoneDisplayed({
      displayedNumber: "+7 800 123 45 67",
      ctaSlot: "footer",
    });
    expect(getLastEvent()?.event).toBe("phone_displayed");
  });

  it("trackEmailClick", () => {
    trackEmailClick({ sourcePage: "/contacts", ctaSlot: "footer" });
    expect(getLastEvent()?.event).toBe("email_click");
  });

  it("trackOutboundClick", () => {
    trackOutboundClick({
      outboundUrl: "https://wildberries.ru/x",
      outboundHost: "wildberries.ru",
      outboundTo: "marketplace",
    });
    const evt = getLastEvent();
    expect(evt?.outbound_to).toBe("marketplace");
  });
});

describe("events.ts — B2B-сигналы", () => {
  it("trackPriceView", () => {
    trackPriceView({ sku: "PDU-1", categorySlug: "pdu" });
    expect(getLastEvent()?.event).toBe("price_view");
  });

  it("trackPriceRequestClick", () => {
    trackPriceRequestClick({ sku: "CUSTOM-X" });
    expect(getLastEvent()?.event).toBe("price_request_click");
  });

  it("trackStockStatusView со всеми статусами", () => {
    for (const status of ["in_stock", "on_order", "out_of_stock", "unknown"] as const) {
      trackStockStatusView({ sku: "X", stockStatus: status });
      expect(getLastEvent()?.stock_status).toBe(status);
    }
  });
});

describe("events.ts — Checkout steps", () => {
  it("trackCheckoutStepContact с step_index=1", () => {
    trackCheckoutStepContact("physical");
    const evt = getLastEvent();
    expect(evt?.event).toBe("checkout_step_contact");
    expect(evt?.step_index).toBe(1);
    expect(evt?.checkout_type).toBe("physical");
  });

  it("trackCheckoutStepShipping с step_index=2", () => {
    trackCheckoutStepShipping("legal");
    expect(getLastEvent()?.step_index).toBe(2);
  });

  it("trackCheckoutStepPaymentMethod с step_index=3", () => {
    trackCheckoutStepPaymentMethod("physical");
    expect(getLastEvent()?.step_index).toBe(3);
  });

  it("trackCheckoutStepReview с step_index=4", () => {
    trackCheckoutStepReview("physical");
    expect(getLastEvent()?.step_index).toBe(4);
  });

  it("trackCheckoutCtaPayClicked с step_index=5 + value", () => {
    trackCheckoutCtaPayClicked({ checkoutType: "physical", value: 50000 });
    const evt = getLastEvent();
    expect(evt?.step_index).toBe(5);
    expect(evt?.value).toBe(50000);
    expect(evt?.currency).toBe("RUB");
  });
});

describe("events.ts — Платёж и доставка", () => {
  it("trackAddShippingInfo", () => {
    trackAddShippingInfo({ provider: "apiship", tariffId: "cdek-1", shippingCost: 500 });
    expect(getLastEvent()?.event).toBe("add_shipping_info");
  });

  it("trackAddPaymentInfo", () => {
    trackAddPaymentInfo({ paymentMethod: "card", checkoutType: "physical" });
    expect(getLastEvent()?.event).toBe("add_payment_info");
  });

  it("trackPaymentFailed со всеми reasons", () => {
    for (const reason of [
      "expired",
      "cancelled_by_user",
      "payment_method_declined",
      "webhook_timeout",
      "unknown",
    ] as const) {
      trackPaymentFailed({ transactionId: "SO-X", reason });
      expect(getLastEvent()?.reason).toBe(reason);
    }
  });

  it("trackPaymentRetry с attempt_number", () => {
    trackPaymentRetry({ transactionId: "SO-X", attemptNumber: 2 });
    expect(getLastEvent()?.attempt_number).toBe(2);
  });

  it("trackShipmentRateRequested + trackShipmentSelected", () => {
    trackShipmentRateRequested({ provider: "apiship", destinationRegion: "moscow" });
    expect(getLastEvent()?.event).toBe("shipment_rate_requested");
    trackShipmentSelected({ provider: "apiship", tariffId: "cdek-1", shippingCost: 500 });
    expect(getLastEvent()?.event).toBe("shipment_selected");
  });
});

describe("events.ts — Формы", () => {
  it("trackFormFieldError БЕЗ значения поля (только error_code)", () => {
    trackFormFieldError({ formType: "rfq", fieldName: "email", errorCode: "invalid_format" });
    const evt = getLastEvent();
    expect(evt?.event).toBe("form_field_error");
    expect(evt?.field_name).toBe("email");
    expect(evt?.error_code).toBe("invalid_format");
    // По схеме — значение поля НЕ передаётся
    expect(Object.keys(evt!)).not.toContain("field_value");
  });

  it("trackInnValidationSuccess / Failed", () => {
    trackInnValidationSuccess({ formType: "rfq" });
    expect(getLastEvent()?.event).toBe("inn_validation_success");
    trackInnValidationFailed({ formType: "rfq", errorCode: "checksum" });
    const evt = getLastEvent();
    expect(evt?.event).toBe("inn_validation_failed");
    expect(evt?.error_code).toBe("checksum");
  });
});

describe("events.ts — Системные", () => {
  it("trackConsentBannerShown / Accepted / Declined", () => {
    trackConsentBannerShown();
    expect(getLastEvent()?.event).toBe("consent_banner_shown");
    trackConsentAccepted();
    expect(getLastEvent()?.event).toBe("consent_accepted");
    expect((getLastEvent() as { consent_categories?: string[] }).consent_categories).toContain("analytics");
    trackConsentDeclined();
    expect(getLastEvent()?.event).toBe("consent_declined");
  });

  it("trackJsError + scrub PII в error_message", () => {
    trackJsError({
      errorMessage: "TypeError на input user@example.com",
      sourceFile: "checkout.tsx",
      lineNumber: 42,
      userAgentClass: "desktop",
    });
    const evt = getLastEvent();
    expect(evt?.event).toBe("js_error");
    // error_message в whitelist (scrub_value_keys) — должно быть замаскировано
    expect(evt?.error_message).toContain("[REDACTED_EMAIL]");
  });

  it("trackPage404 / trackError5xx", () => {
    trackPage404({ requestedPath: "/missing", referrer: "google.com" });
    expect(getLastEvent()?.event).toBe("page_404");
    trackError5xx({ statusCode: 503, endpoint: "/api/orders" });
    expect(getLastEvent()?.event).toBe("error_5xx");
  });
});

describe("FR-062 PII-filter invariant (применим ко всем events)", () => {
  it("любое попадание email в payload — замаскировано", () => {
    // Hostile scenario: разработчик случайно передал email в comment-like field
    trackJsError({
      errorMessage: "Не могу найти 'user@example.com' в БД",
      sourceFile: "x.tsx",
      lineNumber: 1,
      userAgentClass: "bot",
    });
    const json = JSON.stringify(getLastEvent());
    expect(json).not.toContain("user@example.com");
  });

  it("любое попадание phone — замаскировано", () => {
    trackSearch({ searchTerm: "звоните +7 999 123 45 67 для заказа", resultsCount: 1 });
    const json = JSON.stringify(getLastEvent());
    expect(json).not.toContain("999 123 45 67");
  });
});
