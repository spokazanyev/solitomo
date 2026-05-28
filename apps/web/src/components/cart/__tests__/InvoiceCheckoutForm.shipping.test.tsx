/**
 * 062 T045: Smoke-тест InvoiceCheckoutForm — shipping-mode-selection UI.
 *
 * Окружение vitest: `environment: "node"` + react-dom/server (без jsdom / testing-library).
 * Поэтому мы ограничиваемся:
 *   1. Static-render через renderToStaticMarkup → проверяем структуру и default-state.
 *   2. Проверкой что 3 radio-input'а рендерятся с правильными value-атрибутами.
 *   3. Тем что по умолчанию выбран "apiship".
 *   4. Empty-cart fallback (items.length === 0 → "Корзина пуста").
 *
 * Интерактивные сценарии (клик по radio, ввод текста, проверка disabled-кнопки)
 * требуют jsdom + @testing-library/react — не установлены в этом репозитории.
 * Они покрываются manual smoke-проверкой согласно spec 062 (см. quickstart.md).
 *
 * Все внешние модули (DadataSuggestInput, PhoneInput, AddressForm, DeliveryBlock,
 * RfqCart, аналитика, next/navigation) замоканы — мы тестируем форму саму по себе.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";

// ─── next/link / next/navigation stubs ──────────────────────────────────────

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", { href, ...rest }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/cart/invoice/",
  useSearchParams: () => new URLSearchParams(),
}));

// ─── RfqCart hook + helpers ─────────────────────────────────────────────────

const mockUseRfqCartItems = vi.fn();
vi.mock("@/components/rfq/RfqCart", () => ({
  __esModule: true,
  useRfqCartItems: () => mockUseRfqCartItems(),
  getCartTotal: (items: Array<{ price?: number | null; quantity: string }>) => {
    let known = 0;
    let knownCount = 0;
    let unknownCount = 0;
    for (const it of items) {
      const qty = Number.parseInt(it.quantity, 10) || 1;
      if (typeof it.price === "number") {
        known += it.price * qty;
        knownCount += 1;
      } else {
        unknownCount += 1;
      }
    }
    return { total: known, knownCount, unknownCount };
  },
  clearCartItems: vi.fn(),
}));

// ─── Analytics stubs (must not run real dataLayer pushes) ───────────────────

vi.mock("@/lib/analytics/data-layer", () => ({
  pushEvent: vi.fn(),
}));
vi.mock("@/lib/analytics/events", async () => {
  // Сохраняем ShippingMode тип-экспорт (он re-exported из events.ts).
  return {
    trackInnValidationSuccess: vi.fn(),
    trackInnValidationFailed: vi.fn(),
    trackShippingModeChanged: vi.fn(),
  };
});

// ─── Children-stubs — заменяем тяжёлые checkout-компоненты простыми div'ами ─

vi.mock("@/components/checkout/AddressForm", () => ({
  AddressForm: () =>
    React.createElement(
      "div",
      { "data-testid": "AddressForm" },
      "AddressFormStub",
    ),
}));
vi.mock("@/components/checkout/DadataSuggestInput", () => ({
  DadataSuggestInput: ({
    label,
    value,
  }: {
    label?: string;
    value?: string;
    onChange?: (v: string) => void;
  }) =>
    React.createElement(
      "label",
      { "data-testid": `Dadata-${label ?? "x"}` },
      label ?? "",
      React.createElement("input", {
        type: "text",
        defaultValue: value ?? "",
        readOnly: true,
      }),
    ),
}));
vi.mock("@/components/checkout/PhoneInput", () => ({
  PhoneInput: ({ label, value }: { label?: string; value?: string }) =>
    React.createElement(
      "label",
      { "data-testid": "PhoneInput" },
      label ?? "Телефон",
      React.createElement("input", {
        type: "tel",
        defaultValue: value ?? "",
        readOnly: true,
      }),
    ),
}));
vi.mock("@/components/checkout/DeliveryBlock", () => ({
  DeliveryBlock: () =>
    React.createElement(
      "div",
      { "data-testid": "DeliveryBlock" },
      "DeliveryBlockStub",
    ),
}));

// ─── Import AFTER mocks ─────────────────────────────────────────────────────

import { InvoiceCheckoutForm } from "../InvoiceCheckoutForm";
import type { RfqCartItem } from "@/components/rfq/RfqCart";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const sampleItems: RfqCartItem[] = [
  { sku: "S-4", name: "Блок розеток 19″ 1U", quantity: "1", price: 4800 },
  { sku: "S-4x2", name: "Блок розеток 19″ 1U 4 Schuko", quantity: "1", price: 5655 },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("InvoiceCheckoutForm — empty cart (062)", () => {
  it("shows empty-cart fallback when items.length === 0", () => {
    mockUseRfqCartItems.mockReturnValue([]);
    const html = renderToStaticMarkup(<InvoiceCheckoutForm />);
    expect(html).toContain("Корзина пуста");
    expect(html).toContain("Открыть каталог");
    // Radio-group НЕ должен рендериться, когда корзина пуста.
    expect(html).not.toMatch(/name="shippingMode"/);
  });
});

describe("InvoiceCheckoutForm — shipping-mode radio-group (062 T022)", () => {
  it("renders 3 radio inputs с правильными values: pickup, apiship, own_carrier", () => {
    mockUseRfqCartItems.mockReturnValue(sampleItems);
    const html = renderToStaticMarkup(<InvoiceCheckoutForm />);

    // Все три radio с name="shippingMode"
    expect(html).toMatch(/name="shippingMode"[^>]*value="pickup"/);
    expect(html).toMatch(/name="shippingMode"[^>]*value="apiship"/);
    expect(html).toMatch(/name="shippingMode"[^>]*value="own_carrier"/);

    // role="radiogroup" + aria-label
    expect(html).toMatch(/role="radiogroup"/);
    expect(html).toMatch(/aria-label="Способ доставки"/);

    // Все три метки видимы (i18n-ru)
    expect(html).toContain("Самовывоз");
    expect(html).toContain("Через службу доставки");
    expect(html).toContain("Транспортной компанией покупателя");
  });

  it("default-checked radio — apiship (FR-062-03)", () => {
    mockUseRfqCartItems.mockReturnValue(sampleItems);
    const html = renderToStaticMarkup(<InvoiceCheckoutForm />);

    // apiship radio помечен checked в SSR (React-static-markup может разместить
    // атрибут checked до или после value — допускаем оба варианта).
    expect(html).toMatch(
      /<input[^>]*\bchecked\b[^>]*value="apiship"|<input[^>]*value="apiship"[^>]*\bchecked\b/,
    );

    // Pickup и own_carrier — БЕЗ атрибута checked
    // (React опускает checked, когда значение false)
    const pickupMatch = html.match(/<input[^>]*value="pickup"[^>]*\/>/);
    expect(pickupMatch).toBeTruthy();
    expect(pickupMatch![0]).not.toMatch(/\bchecked\b/);

    const ownMatch = html.match(/<input[^>]*value="own_carrier"[^>]*\/>/);
    expect(ownMatch).toBeTruthy();
    expect(ownMatch![0]).not.toMatch(/\bchecked\b/);
  });

  it("default-mode рендерит AddressForm + DeliveryBlock (ApiShip-UI)", () => {
    mockUseRfqCartItems.mockReturnValue(sampleItems);
    const html = renderToStaticMarkup(<InvoiceCheckoutForm />);

    // Stub-компоненты ApiShip-flow присутствуют (default mode = apiship)
    expect(html).toContain("AddressFormStub");
    expect(html).toContain("DeliveryBlockStub");

    // Own_carrier / pickup textarea НЕ показываются по умолчанию
    expect(html).not.toContain("Уточнение по отгрузке");
    expect(html).not.toContain("Кто заберёт");
  });

  it("OrderSummaryCard рендерится с CTA «Выписать счёт»", () => {
    mockUseRfqCartItems.mockReturnValue(sampleItems);
    const html = renderToStaticMarkup(<InvoiceCheckoutForm />);

    expect(html).toContain("Выписать счёт");
    // Сводка показывает один из товаров
    expect(html).toContain("Блок розеток 19″ 1U");
  });

  it("submit-кнопка disabled по умолчанию (consent=false, реквизиты пусты)", () => {
    mockUseRfqCartItems.mockReturnValue(sampleItems);
    const html = renderToStaticMarkup(<InvoiceCheckoutForm />);

    // OrderSummaryCard принимает disabled={!isLegalReady} — при пустых полях
    // и unconsent кнопка обязана быть disabled.
    const buttonDisabledRe = /<button[^>]*\sdisabled(?=[\s=>])/;
    expect(html).toMatch(buttonDisabledRe);
  });
});

describe("InvoiceCheckoutForm — module shape (062)", () => {
  it("exports InvoiceCheckoutForm as a function component", () => {
    expect(typeof InvoiceCheckoutForm).toBe("function");
  });
});
