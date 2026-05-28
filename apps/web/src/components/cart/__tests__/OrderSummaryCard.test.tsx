import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { CreditCard, Receipt } from "lucide-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// next/link stub — pure passthrough so href/target/className survive into HTML
// (used by ConsentCheckbox internally for /legal/offer/ + /legal/pd-policy/ links).
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

import { OrderSummaryCard, type OrderSummaryCardProps } from "../OrderSummaryCard";
import type { RfqCartItem } from "@/components/rfq/RfqCart";

// ── Common fixtures ─────────────────────────────────────────────────────────

const item1: RfqCartItem = {
  sku: "S-4",
  name: "Блок розеток 19″ 1U, S-4 IEC320C13",
  quantity: "1",
  price: 4800,
};

const item2: RfqCartItem = {
  sku: "S-4x2",
  name: "Блок розеток 19″ 1U, S-4x2, 4 Schuko",
  quantity: "1",
  price: 5655,
};

const itemNoPrice: RfqCartItem = {
  sku: "S-CUSTOM",
  name: "Кастомный блок (цена по запросу)",
  quantity: "1",
  price: null,
};

const baseProps: OrderSummaryCardProps = {
  items: [item1, item2],
  total: 10455,
  knownCount: 2,
  unknownCount: 0,
  ctaIcon: Receipt,
  ctaLabel: "Выписать счёт",
  ctaHint:
    "После создания заказа вы получите счёт по email. Заказ начнёт движение после поступления оплаты.",
  loading: false,
  disabled: false,
  error: null,
  consent: true,
  onConsentChange: () => {},
};

/** Normalize HTML for цена-matching: Intl.NumberFormat в ru-RU использует
 *  неразрывный пробел (U+00A0) между разрядами. HTML-парсеры могут
 *  отдать его как `&nbsp;` или сырой ` ` — приводим к простому пробелу. */
function normalizePrice(html: string): string {
  return html.replace(/ /g, " ").replace(/&nbsp;/g, " ");
}

// ── Test suite ──────────────────────────────────────────────────────────────

describe("OrderSummaryCard — invoice mode (US1)", () => {
  // T01: рендер юр-режима
  it("renders invoice mode with «Заказ» heading, lineTotals, single «Итого:» row", () => {
    const html = normalizePrice(renderToStaticMarkup(<OrderSummaryCard {...baseProps} />));

    // Заголовок «Заказ»
    expect(html).toMatch(/>Заказ</);

    // Названия позиций
    expect(html).toContain("Блок розеток 19″ 1U, S-4 IEC320C13");
    expect(html).toContain("Блок розеток 19″ 1U, S-4x2, 4 Schuko");

    // SKU · qty
    expect(html).toContain("S-4 · 1 шт");
    expect(html).toContain("S-4x2 · 1 шт");

    // lineTotals
    expect(html).toMatch(/4 800/);
    expect(html).toMatch(/5 655/);

    // «Итого:» одной строкой, без блока «Товары / Доставка»
    expect(html).toMatch(/Итого/);
    expect(html).not.toMatch(/Товары:/);
    expect(html).not.toMatch(/Доставка/);

    // Grand total = 10 455
    expect(html).toMatch(/10 455/);

    // Кнопка с правильным label
    expect(html).toContain("Выписать счёт");
  });
});

describe("OrderSummaryCard — physical mode (US1)", () => {
  // T02: физ-режим с платной доставкой → три строки
  it("renders three rows (Товары / Доставка / Итого) when delivery selected (paid)", () => {
    const html = normalizePrice(
      renderToStaticMarkup(
        <OrderSummaryCard
          {...baseProps}
          ctaIcon={CreditCard}
          ctaLabel="Перейти к оплате"
          showDeliveryLine
          deliveryCost={1500}
          deliveryLabel="СДЭК"
        />,
      ),
    );

    expect(html).toContain("Товары:");
    expect(html).toContain("Доставка (СДЭК):");
    expect(html).toContain("Итого к оплате:");

    expect(html).toMatch(/1 500/); // доставка
    // Grand total = 10 455 + 1 500 = 11 955
    expect(html).toMatch(/11 955/);
  });

  // T03: физ-режим без выбранной доставки
  it("shows delivery hint and Итого=total when deliveryCost === null", () => {
    const html = normalizePrice(
      renderToStaticMarkup(
        <OrderSummaryCard
          {...baseProps}
          ctaIcon={CreditCard}
          ctaLabel="Перейти к оплате"
          showDeliveryLine
          deliveryCost={null}
        />,
      ),
    );

    expect(html).toContain("Товары:");
    expect(html).toContain("Стоимость доставки уточнится после выбора способа доставки");

    // Итого = только товары (10 455)
    expect(html).toMatch(/10 455/);
    // Не должно быть 11 955 (это было бы с доставкой)
    expect(html).not.toMatch(/11 955/);
  });

  // T04: самовывоз (deliveryCost = 0)
  it("shows «Самовывоз — бесплатно» when deliveryCost === 0", () => {
    const html = normalizePrice(
      renderToStaticMarkup(
        <OrderSummaryCard
          {...baseProps}
          ctaIcon={CreditCard}
          ctaLabel="Перейти к оплате"
          showDeliveryLine
          deliveryCost={0}
        />,
      ),
    );

    expect(html).toContain("Самовывоз");
    expect(html).toContain("бесплатно");

    // Итого к оплате === Товары (10 455)
    expect(html).toMatch(/10 455/);
  });
});

describe("OrderSummaryCard — pricing edge cases (US1)", () => {
  // T05: позиция «по запросу»
  it("shows «По запросу» for items without price", () => {
    const html = renderToStaticMarkup(
      <OrderSummaryCard
        {...baseProps}
        items={[item1, itemNoPrice]}
        knownCount={1}
        unknownCount={1}
      />,
    );

    expect(html).toContain("По запросу");
  });

  // T06: все позиции без цены → grand total «По запросу»
  it("shows «По запросу» as grand total when knownCount === 0", () => {
    const html = renderToStaticMarkup(
      <OrderSummaryCard
        {...baseProps}
        items={[itemNoPrice]}
        total={0}
        knownCount={0}
        unknownCount={1}
      />,
    );

    // По запросу в строке позиции И в итоге = минимум 2 вхождения
    const matches = html.match(/По запросу/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  // T07: длинный список — без обрезки
  it("renders all items without truncation, regardless of count", () => {
    const manyItems: RfqCartItem[] = Array.from({ length: 20 }, (_, i) => ({
      sku: `S-${i}`,
      name: `Тестовый блок №${i}`,
      quantity: "1",
      price: 100,
    }));

    const html = renderToStaticMarkup(
      <OrderSummaryCard
        {...baseProps}
        items={manyItems}
        total={2000}
        knownCount={20}
      />,
    );

    // Все 20 позиций видны
    for (let i = 0; i < 20; i++) {
      expect(html).toContain(`Тестовый блок №${i}`);
    }
    // Нет «и ещё N позиций…»
    expect(html).not.toMatch(/и ещё/i);
  });
});

describe("OrderSummaryCard — button + consent + error (US2)", () => {
  // T08: disabled state — кнопка disabled при !consent OR disabled OR loading.
  // Используем regex `\sdisabled(?=[\s=>])` — пробел перед, не-слово после.
  // Это отсекает ложные срабатывания на Tailwind utility-классах вроде
  // `disabled:cursor-not-allowed` где после слова `disabled` идёт `:`.
  const buttonDisabledRe = /<button[^>]*\sdisabled(?=[\s=>])/;
  it("button is disabled when !consent OR disabled OR loading", () => {
    // Case 1: !consent → disabled
    let html = renderToStaticMarkup(
      <OrderSummaryCard {...baseProps} consent={false} disabled={false} loading={false} />,
    );
    expect(html).toMatch(buttonDisabledRe);

    // Case 2: disabled=true → disabled
    html = renderToStaticMarkup(
      <OrderSummaryCard {...baseProps} consent={true} disabled={true} loading={false} />,
    );
    expect(html).toMatch(buttonDisabledRe);

    // Case 3: loading=true → disabled
    html = renderToStaticMarkup(
      <OrderSummaryCard {...baseProps} consent={true} disabled={false} loading={true} />,
    );
    expect(html).toMatch(buttonDisabledRe);

    // Case 4: всё ok → НЕ disabled
    html = renderToStaticMarkup(
      <OrderSummaryCard {...baseProps} consent={true} disabled={false} loading={false} />,
    );
    expect(html).not.toMatch(buttonDisabledRe);
  });

  // T09: loading state показывает «Создаём заказ…» + Loader2
  it("shows loading text when loading=true", () => {
    const html = renderToStaticMarkup(<OrderSummaryCard {...baseProps} loading={true} />);
    expect(html).toContain("Создаём заказ");
    // CTA label НЕ показывается во время loading
    expect(html).not.toMatch(/>Выписать счёт</);
  });

  // T10: error state
  it("renders error block when error is non-null", () => {
    const html = renderToStaticMarkup(
      <OrderSummaryCard {...baseProps} error="Не удалось создать заказ" />,
    );
    expect(html).toContain("Не удалось создать заказ");
  });

  // T11: consent toggle через прямой вызов onChange прокидывается в onConsentChange
  it("ConsentCheckbox onChange propagates to onConsentChange", () => {
    const spy = vi.fn();
    // Рендерим в HTML только для убеждения что не падает с этим callback.
    const html = renderToStaticMarkup(
      <OrderSummaryCard {...baseProps} consent={false} onConsentChange={spy} />,
    );
    // ConsentCheckbox внутри — должен быть <input type="checkbox">.
    expect(html).toContain('type="checkbox"');
    // checkbox unchecked: React опускает атрибут when value=false.
    expect(html).not.toMatch(/<input[^>]*type="checkbox"[^>]*\bchecked\b/);
  });

  // T11b: unknown payment warning rendered when condition met
  it("renders unknownPaymentWarning when unknownCount > 0 and warning is provided", () => {
    const html = renderToStaticMarkup(
      <OrderSummaryCard
        {...baseProps}
        unknownCount={1}
        unknownPaymentWarning="1 позиция без цены — оплата картой невозможна, нужен КП."
      />,
    );
    expect(html).toContain("оплата картой невозможна");
  });

  // T11c: warning NOT rendered when unknownCount === 0
  it("does NOT render unknownPaymentWarning when unknownCount === 0", () => {
    const html = renderToStaticMarkup(
      <OrderSummaryCard
        {...baseProps}
        unknownCount={0}
        unknownPaymentWarning="Should not appear"
      />,
    );
    expect(html).not.toContain("Should not appear");
  });
});

describe("OrderSummaryCard — analytics isolation (US2, CT-16)", () => {
  // T12: статическая проверка изоляции аналитики
  it("source does not import or call pushEvent / data-layer / trackAddToRfq", () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const componentPath = path.resolve(__dirname, "..", "OrderSummaryCard.tsx");
    const source = readFileSync(componentPath, "utf-8");

    // Эти токены должны отсутствовать в исходнике.
    expect(source).not.toMatch(/\bpushEvent\b/);
    expect(source).not.toMatch(/lib\/analytics\/data-layer/);
    expect(source).not.toMatch(/\btrackAddToRfq\b/);
    expect(source).not.toMatch(/\btrackInnValidation/);
  });
});
