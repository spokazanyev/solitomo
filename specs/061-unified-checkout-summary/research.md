# Phase 0 Research — Unified Checkout Summary (061)

**Date**: 2026-05-27
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

---

## R1. Где должен жить компонент?

**Decision**: `apps/web/src/components/cart/OrderSummaryCard.tsx`.

**Rationale**:
- Обе формы, которые его используют, лежат рядом (`cart/InvoiceCheckoutForm.tsx`, `cart/PhysicalCheckoutForm.tsx`).
- Логически это checkout-cart UI, не shipping и не payment.
- Соответствует существующему code-style проекта (вспомогательные компоненты той же фичи в одной папке).

**Alternatives considered**:
- `components/checkout/` — там лежат AddressForm/DeliveryBlock/PhoneInput/DadataSuggestInput, которые формируют левую колонку. Sidebar — отдельная сущность. Отклонено.
- `components/cart/components/` или `cart/summary/` — лишняя вложенность для одного файла. Отклонено.
- Превратить в shadcn/ui-style общий primitive — overkill для двух usage-сайтов. Отложено.

---

## R2. API компонента: какие props принимать?

**Decision**: единственный объект-проп с понятными flagами для режимов. Полная сигнатура:

```ts
interface OrderSummaryCardProps {
  // данные корзины
  items: RfqCartItem[];
  total: number;          // сумма товаров (без доставки), уже посчитана родителем через getCartTotal()
  knownCount: number;     // позиций с известной ценой
  unknownCount: number;   // позиций "по запросу"

  // опционально: блок структуры стоимости для физ-формы
  showDeliveryLine?: boolean;     // true → секция «Товары / Доставка / Итого»
  deliveryCost?: number | null;   // null → доставка не выбрана; 0 → самовывоз; >0 → платная
  deliveryLabel?: string;         // "СДЭК", "Boxberry" — отображается в "Доставка (метка): X ₽"

  // CTA
  ctaIcon: LucideIcon;            // CreditCard | Receipt
  ctaLabel: string;               // "Перейти к оплате" | "Выписать счёт"
  ctaLoadingLabel?: string;       // дефолт: "Создаём заказ…"
  ctaHint: string;                // подпись под кнопкой

  // состояние
  loading: boolean;
  disabled: boolean;
  error: string | null;
  unknownPaymentWarning?: string; // отображается если unknownCount > 0 (физ-форма передаёт текст про КП)

  // согласие 152-ФЗ
  consent: boolean;
  onConsentChange: (next: boolean) => void;
}
```

**Rationale**:
- Все строковые лейблы (CTA, hint, warning, deliveryLabel) — пропы, не хардкод. Компонент чисто визуальный.
- `disabled` принимается из parent: parent комбинирует `isReadyToPay`/`isLegalReady` с consent — нам не нужно дублировать эту логику.
- `total` уже посчитан родителем (через `getCartTotal`) — компонент не делает арифметику и не вызывает `Intl.NumberFormat` для общих сумм (только для построчного `lineTotal`).
- `ctaIcon` принимается как компонент Lucide, рендерится внутри.
- `showDeliveryLine` — единственный флаг отличающий физ-режим от юр.

**Alternatives considered**:
- Polymorphic component с `mode: "invoice" | "physical"`: меньше пропов, но больше скрытой логики в компоненте. Отклонено — explicit props лучше для maintainability.
- Render-props/composition (`<OrderSummary><Header/><List/><Footer/></OrderSummary>`): overkill для двух use-cases, читается хуже. Отклонено.
- Хранить state согласия внутри компонента: ломает FR-019 (server enforcement видит реальное значение из form submit). Отклонено.

---

## R3. Формат строки позиции

**Decision**: трёхколоночная разметка `grid grid-cols-[1fr_auto]` с двустрочной левой колонкой:

```
┌─────────────────────────────────────────────────────┐
│ Название товара (truncate)         lineTotal (₽)    │
│ SKU · N шт                                          │
└─────────────────────────────────────────────────────┘
```

- Левая колонка: `<span className="min-w-0">` для truncate.
  - Строка 1: `<span className="block truncate" title="полное название">{item.name}</span>`
  - Строка 2: `<span className="text-xs text-slate-500">{item.sku} · {qty} шт</span>`
- Правая колонка: `<span className="whitespace-nowrap font-semibold">{formatPrice(price × qty) | "По запросу"}</span>`

**Rationale**:
- Точное копирование текущего рабочего паттерна из `InvoiceCheckoutForm.tsx:330-345`.
- `grid + min-w-0` — единственный рабочий способ truncate в флекс-контейнере (комментарий в существующем коде ссылается на этот pitfall).
- Двустрочная левая колонка совпадает со скриншотом юр-формы.

**Alternatives considered**:
- Flex с `flex-1` — длинные SKU выталкивают qty. Отклонено (есть комментарий в существующем коде).
- Однострочный вариант с `... · N шт` рядом с названием — теряется визуальная иерархия. Отклонено.

---

## R4. Структура стоимости для физ-формы (Q1=A: три строки)

**Decision**: после списка и разделителя — три явных строки:

```text
Товары:                                 8 955 ₽
Доставка (СДЭК):                        1 500 ₽
───────────────────────────────────────────────
Итого к оплате:                        10 455 ₽   ← крупная цифра
```

- «Товары» = `total` (передан как prop).
- «Доставка (метка)» = `formatPrice(deliveryCost)`, метка из `deliveryLabel` ("СДЭК", "Boxberry" и т.д.). Если `deliveryCost === 0` → текст «Самовывоз — бесплатно» без цифры.
- «Итого к оплате» = `total + (deliveryCost ?? 0)`.

**Если доставка ещё не выбрана** (`deliveryCost === null`) — Q2=yes:

```text
Товары:                                 8 955 ₽
Стоимость доставки уточнится после
выбора способа доставки.
───────────────────────────────────────────────
Итого:                                  8 955 ₽   ← пока без доставки
```

Под «Итого» в обоих случаях — `unknownPaymentWarning` если он передан и `unknownCount > 0`.

**Rationale**:
- Полное закрытие FR-006 + FR-007 + FR-008 спеки.
- Юр-форма передаёт `showDeliveryLine={false}` — секция не рендерится, остаётся только «Итого: …» (текущее поведение эталона).

**Alternatives considered**:
- Одной строкой «Итого: 10 455 ₽ (вкл. доставку 1500 ₽)» — менее наглядно. Уже отвергнуто пользователем (Q1=A).

---

## R5. ConsentCheckbox: интеграция

**Decision**: использовать существующий `@/components/consent/ConsentCheckbox` (из спеки 057) без модификаций. Передавать в компонент через props `consent` + `onConsentChange`.

**Rationale**:
- Готовый общий компонент с правильной разметкой и тестами.
- FR-5735 (server enforcement) уже работает с этим компонентом — менять не нужно.
- Это паттерн, который уже работает в 5 формах (RFQ, register, login, magic, оба checkout).

---

## R6. Sticky-поведение + mobile layout

**Decision**: оборачиваем компонент в `<aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 lg:sticky lg:top-4">`. Это **тот же класс**, что у текущей правой колонки в обеих формах.

**Rationale**:
- Не меняем layout — родительская форма продолжает использовать grid `lg:grid-cols-[1fr_360px]`. Компонент рендерится во втором столбце.
- `lg:sticky lg:top-4` — sticky только на десктопе (`lg:` brakpoint = 1024px). На мобильных естественный flow.
- `h-fit` — sidebar не растягивается до высоты формы.

**Pitfall**: если внутри компонента появится `overflow-hidden` — sticky сломается. Не использовать.

**Alternatives considered**:
- Использовать `position: sticky` без `lg:` префикса (sticky на всех экранах): на мобильных он бесполезен и может закрывать формы. Отклонено.
- Перенести sticky-wrapper наружу компонента (в parent): дублирование между двумя формами. Отклонено.

---

## R7. Аналитика: должен ли компонент знать про события?

**Decision**: **НЕТ**. Все `pushEvent` вызовы остаются в parent-формах. Компонент — pure visual primitive.

**Rationale**:
- FR-018 спеки: «события MUST срабатывать в те же моменты что и раньше». Текущие места:
  - `checkout_cta_pay_clicked` — в `handleSubmit` parent-формы (перед `setSubmitting(true)`).
  - `payment_intent` / `invoice_requested` — после успешного создания заказа.
  - `inn_validation_success/failed` — на blur поля ИНН (в parent).
  - `checkout_step_*` — при изменении state валидности (в parent useEffect).
- Если перенести в компонент — двойные вызовы (компонент рендерится на каждое изменение). Отклонено.

**Implementation note**: компонент тестируется на изоляции событий — unit-тест проверяет что `pushEvent` (mocked) не вызывается из компонента сам по себе.

---

## R8. Тестирование

**Decision**: Vitest unit-тесты на компонент. Покрытие:

1. **Рендер юр-режима** (`showDeliveryLine={false}`): заголовок «Заказ», список из 3 позиций с lineTotal, нет блока доставки, есть «Итого:», ConsentCheckbox, кнопка с правильным label.
2. **Рендер физ-режима с выбранной доставкой**: три строки (Товары/Доставка/Итого), сумма «Итого» = «Товары» + «Доставка».
3. **Физ-режим без выбранной доставки** (`deliveryCost === null`): подсказка про выбор, «Итого» = «Товары».
4. **Физ-режим с самовывозом** (`deliveryCost === 0`): текст «Самовывоз — бесплатно» вместо «Доставка: 0 ₽».
5. **Позиции «по запросу»** (`price === null`): строка показывает «По запросу» вместо цены.
6. **Все позиции «по запросу»**: «Итого» показывает «По запросу».
7. **Длинный список** (10 позиций): все 10 рендерятся, нет обрезки до 5.
8. **Disabled state**: кнопка не submit'ится при `disabled={true}` (отсутствие onSubmit click).
9. **Loading state**: текст «Создаём заказ…» + Loader2, кнопка disabled.
10. **Error state**: блок с текстом ошибки между «Итого» и ConsentCheckbox.
11. **Consent toggle**: клик по checkbox вызывает `onConsentChange(true/false)`.
12. **Аналитика-изоляция**: `pushEvent` не импортируется и не вызывается из файла компонента (статическая проверка через `expect(...).not.toContain('pushEvent')` на исходник).

**Rationale**:
- Vitest уже настроен (`pnpm --filter @soliton/web test`).
- React Testing Library уже используется в проекте.
- Покрытие всех 9 edge cases из спеки.

---

## R9. Что НЕ меняем в parent-формах

**Decision**: исключительно заменить inline `<aside>` блок на `<OrderSummaryCard ... />`. Всё остальное — без изменений:

- State (`useState`, `useRef`) — не трогаем.
- `handleSubmit`, валидация (`isReadyToPay`, `isLegalReady`) — не трогаем.
- `pushEvent`-вызовы — не трогаем.
- Импорты `lucide-react` для иконок — оставляем (передаём в компонент как пропы).
- Левая колонка (контакты, адрес, DeliveryBlock, реквизиты) — не трогаем.
- Grid-layout (`grid grid-cols-[1fr_360px]`) — не трогаем.

**Rationale**: минимизировать диф. Регрессионный риск пропорционален объёму изменений. У нас цель — UI-рефактор с минимальной поверхностью.

---

## R10. Migration strategy / Rollback

**Decision**: Нет миграции БД. Откат тривиальный — `git revert` на коммит фичи.

**Rationale**:
- Никаких изменений в API, БД-схеме, payload, аналитике.
- Если что-то пойдёт не так в продакшене — `git revert <commit> && bash deploy/push.sh` восстановит точно текущее визуальное состояние.

---

## Summary table

| Решение | Кратко |
|---|---|
| R1 | `apps/web/src/components/cart/OrderSummaryCard.tsx` |
| R2 | Один props-объект, explicit flags (`showDeliveryLine`), parent-владеет state |
| R3 | grid `[1fr_auto]` + двустрочная левая колонка с truncate |
| R4 | Три строки Товары/Доставка/Итого для физ; подсказка если доставка не выбрана; «Самовывоз — бесплатно» при cost=0 |
| R5 | Используем существующий ConsentCheckbox, без изменений |
| R6 | `<aside lg:sticky lg:top-4 h-fit>` — те же классы что сейчас |
| R7 | Компонент НЕ знает про аналитику, всё в parent |
| R8 | 12 Vitest unit-тестов |
| R9 | Parent-формы — только замена `<aside>` блока |
| R10 | Никаких миграций; откат через `git revert` |

**All NEEDS CLARIFICATION resolved. Ready for Phase 1 — Design.**
