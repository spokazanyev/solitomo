# Contract: `<OrderSummaryCard />` component

**Type**: React Client Component contract
**File**: `apps/web/src/components/cart/OrderSummaryCard.tsx`
**Status**: Proposed (this feature)

## Покрываемые требования

- **FR-001 — FR-005**: единый компонент, заголовок «Заказ», полный список с lineTotal, разделитель + явное «Итого».
- **FR-006 — FR-009**: структура «Товары / Доставка / Итого» для физ-формы (по флагу).
- **FR-010 — FR-014**: ConsentCheckbox + кнопка + loading + error в фиксированном порядке.
- **FR-015 — FR-016**: ctaHint передаётся снаружи; компонент рендерит его «как есть».
- **FR-017 — FR-020**: не вызывает аналитику сам; sticky-классы стандартные.

## TypeScript-контракт (props)

См. полное определение в [data-model.md → OrderSummaryCardProps](../data-model.md). Здесь — ключевые инварианты, которые компонент **гарантирует**:

### Контрактные инварианты

| # | Инвариант | Покрывается тестом |
|---|---|---|
| **CT-1** | Заголовок секции — всегда строка «Заказ» (`<p>` с classes `uppercase tracking-wide text-slate-500`). | T01 |
| **CT-2** | `items.length` строк рендерится в `<ul>` без обрезки. Для `items.length === 100` рендерится 100 `<li>`. | T07 |
| **CT-3** | Каждая `<li>` показывает `item.name` (truncate), `item.sku · {qty} шт` мелким серым, и `lineTotal` справа (либо `"По запросу"`). | T01, T05 |
| **CT-4** | Если `knownCount === 0` → «Итого» отображается как `"По запросу"` (не `"0 ₽"`). | T06 |
| **CT-5** | Если `showDeliveryLine === false/undefined` → блок «Товары/Доставка» НЕ рендерится, есть только «Итого: {formatPrice(total)}». | T01 |
| **CT-6** | Если `showDeliveryLine === true && deliveryCost === null` → строка «Стоимость доставки уточнится после выбора способа доставки», «Итого» = `formatPrice(total)`. | T03 |
| **CT-7** | Если `showDeliveryLine === true && deliveryCost === 0` → строка «Доставка: Самовывоз — бесплатно», «Итого к оплате» = `formatPrice(total)`. | T04 |
| **CT-8** | Если `showDeliveryLine === true && deliveryCost > 0` → строка `Доставка ({deliveryLabel}): {formatPrice(deliveryCost)}`, «Итого к оплате» = `formatPrice(total + deliveryCost)`. | T02 |
| **CT-9** | Если `unknownCount > 0 && unknownPaymentWarning` передан → блок warning между «Итого» и ConsentCheckbox. | T11 |
| **CT-10** | `ConsentCheckbox` всегда рендерится между warning-блоком (если есть) и кнопкой. Клик прокидывается в `onConsentChange`. | T11 |
| **CT-11** | Кнопка имеет `type="submit"`, `disabled={loading \|\| disabled \|\| !consent}` (объединённое). | T08, T09 |
| **CT-12** | При `loading === true` кнопка показывает `<Loader2 className="animate-spin" />` + `ctaLoadingLabel ?? "Создаём заказ…"`. | T09 |
| **CT-13** | При `loading === false` кнопка показывает `<ctaIcon />` + `ctaLabel` + `<ArrowRight />`. | T01 |
| **CT-14** | `ctaHint` рендерится под кнопкой в `<p className="text-xs text-slate-500">`. | T01 |
| **CT-15** | Если `error` не null → красный блок (`bg-rose-50 text-rose-900`) между «Итого» и warning/consent. | T10 |
| **CT-16** | Компонент НЕ импортирует и НЕ вызывает `pushEvent` / `trackAddToRfq` / любые другие функции аналитики. | T12 (статический grep по исходнику) |
| **CT-17** | Компонент НЕ обращается к `window.localStorage`, `fetch`, `navigator`, никаким side effects вне рендера. | code review |

### Корневой DOM (для регрессионных скриншот-тестов или review)

```html
<aside class="h-fit rounded-2xl border border-slate-200 bg-white p-6 lg:sticky lg:top-4">
  <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">Заказ</p>

  <ul class="mt-3 grid gap-2 text-sm text-slate-700">
    <li><!-- name / sku · qty / lineTotal --></li>
    <!-- ... все позиции, без обрезки ... -->
  </ul>

  <hr class="my-4 border-slate-200" />

  <!-- если showDeliveryLine — три строки: -->
  <div class="grid gap-1 text-sm">
    <div class="flex justify-between">
      <span class="text-slate-600">Товары:</span>
      <span class="font-semibold text-slate-950">{formatPrice(total)}</span>
    </div>
    <!-- ИЛИ подсказка при deliveryCost === null -->
    <div class="flex justify-between">
      <span class="text-slate-600">Доставка ({deliveryLabel}):</span>
      <span class="font-semibold text-slate-950">{...}</span>
    </div>
    <div class="mt-2 flex items-end justify-between border-t border-slate-200 pt-2">
      <span class="text-sm text-slate-500">Итого к оплате:</span>
      <span class="text-2xl font-semibold text-slate-950">{...}</span>
    </div>
  </div>

  <!-- ИЛИ если showDeliveryLine === false — одна строка: -->
  <div class="flex items-end justify-between">
    <span class="text-sm text-slate-500">Итого:</span>
    <span class="text-2xl font-semibold text-slate-950">{formatPrice(total) | "По запросу"}</span>
  </div>

  <!-- если unknownPaymentWarning и unknownCount > 0 -->
  <p class="mt-2 text-xs leading-5 text-rose-700">{unknownPaymentWarning}</p>

  <!-- если error -->
  <p class="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-900">{error}</p>

  <ConsentCheckbox class="mt-4" value={consent} onChange={onConsentChange} />

  <button type="submit" class="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-700 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60" disabled={...}>
    <Icon /> {label} <ArrowRight />
  </button>

  <p class="mt-3 text-xs leading-5 text-slate-500">{ctaHint}</p>
</aside>
```

### Unit-tests scaffold

`apps/web/src/components/cart/__tests__/OrderSummaryCard.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CreditCard, Receipt } from "lucide-react";
import { OrderSummaryCard } from "../OrderSummaryCard";

const baseProps = {
  items: [
    { sku: "S-4", name: "Блок розеток S-4", quantity: "1", price: 4800 },
    { sku: "S-4x2", name: "Блок S-4x2", quantity: "1", price: 5655 },
  ],
  total: 10455,
  knownCount: 2,
  unknownCount: 0,
  ctaIcon: Receipt,
  ctaLabel: "Выписать счёт",
  ctaHint: "После создания заказа вы получите счёт по email.",
  loading: false,
  disabled: false,
  error: null,
  consent: false,
  onConsentChange: vi.fn(),
};

describe("OrderSummaryCard", () => {
  // T01 — юр-режим
  it("renders invoice mode: title 'Заказ', list with lineTotals, single 'Итого:' line", () => { /* ... */ });

  // T02 — физ + платная доставка
  it("renders physical mode with paid delivery: three rows (Товары/Доставка/Итого)", () => { /* ... */ });

  // T03 — физ без доставки
  it("shows delivery hint when deliveryCost === null", () => { /* ... */ });

  // T04 — самовывоз
  it("shows 'Самовывоз — бесплатно' when deliveryCost === 0", () => { /* ... */ });

  // T05 — позиции «по запросу»
  it("shows 'По запросу' for items without price", () => { /* ... */ });

  // T06 — все позиции «по запросу»
  it("shows 'По запросу' as grand total when knownCount === 0", () => { /* ... */ });

  // T07 — полный список (без обрезки)
  it("renders all items without truncation, regardless of count", () => {
    const manyItems = Array.from({ length: 20 }, (_, i) => ({
      sku: `S-${i}`, name: `Item ${i}`, quantity: "1", price: 100,
    }));
    render(<OrderSummaryCard {...baseProps} items={manyItems} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(20);
  });

  // T08 — disabled state
  it("button is disabled when disabled prop or !consent", () => { /* ... */ });

  // T09 — loading state
  it("button shows 'Создаём заказ…' with Loader2 when loading", () => { /* ... */ });

  // T10 — error state
  it("renders error block between Итого and ConsentCheckbox", () => { /* ... */ });

  // T11 — consent toggle
  it("clicking ConsentCheckbox calls onConsentChange", () => { /* ... */ });

  // T12 — изоляция аналитики
  it("does not import or call pushEvent (static check)", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(require.resolve("../OrderSummaryCard"), "utf-8"),
    );
    expect(source).not.toContain("pushEvent");
    expect(source).not.toContain("data-layer");
    expect(source).not.toContain("trackAddToRfq");
  });
});
```

## Backward compatibility

- **Существующие заказы**: компонент не меняет API submit'а — payload `POST /api/orders` идентичен. Существующие заказы не задеваются.
- **Существующие тесты** в `apps/web/`: должны продолжать проходить. Если есть скриншот-тесты на checkout — потребуется обновление эталонов (но скриншот-тестов в проекте сейчас нет).
- **Аналитика**: события `pushEvent` остаются в parent-формах в тех же местах. Никаких изменений в GA events.

## Risk / mitigation

| Риск | Митигация |
|---|---|
| Регрессия в юр-форме (визуально не 1-в-1) | unit-тест T01 + manual smoke (quickstart) |
| Сломали disabled-логику (форма submit'ится без consent) | unit-тест T08; server-side enforcement (FR-019) — второй барьер |
| Сломали аналитику (события не приходят) | CT-16 + smoke в GA Debug View после деплоя |
| Sticky сломался | manual smoke на десктопе (1280px) + mobile (375px) |
| Длинный список ломает sticky / overflow | unit-тест T07 + manual smoke с 20+ позициями |
