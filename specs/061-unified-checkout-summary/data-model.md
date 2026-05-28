# Phase 1 Data Model — Unified Checkout Summary (061)

**Date**: 2026-05-27
**Plan**: [plan.md](./plan.md)
**Research**: [research.md](./research.md)

## Сводка изменений

**Никаких persistent-сущностей не вводится.** Фича чисто UI-уровневая: рендерим существующие данные из корзины (`RfqCartItem[]`) и состояния выбранной доставки в новом визуальном формате. БД-таблицы, Payload-коллекции, API-endpoint'ы не затрагиваются.

Ниже описаны **TypeScript-типы и UI-сущности** компонента — для реализатора и для unit-тестов.

---

## UI Entity: `OrderSummaryCard` (компонент)

**Type**: React Client Component (`"use client"`)
**Path**: `apps/web/src/components/cart/OrderSummaryCard.tsx`

### Props interface

```typescript
import type { LucideIcon } from "lucide-react";
import type { RfqCartItem } from "@/components/rfq/RfqCart";

export interface OrderSummaryCardProps {
  // --- Данные корзины (источник истины — parent через useRfqCartItems) ---
  /** Все позиции корзины. Рендерятся без обрезки. */
  items: RfqCartItem[];
  /** Сумма товаров без доставки. Уже посчитан родителем через getCartTotal(). */
  total: number;
  /** Кол-во позиций с известной ценой. */
  knownCount: number;
  /** Кол-во позиций «по запросу». Влияет на отображение «Итого» и warning. */
  unknownCount: number;

  // --- Блок структуры стоимости (только для физ-формы) ---
  /** true → рендерим секцию «Товары / Доставка / Итого к оплате». false → только «Итого:» одной строкой. */
  showDeliveryLine?: boolean;
  /**
   * Стоимость доставки в рублях:
   *   null      — не выбрана, показываем подсказку
   *   0         — самовывоз, показываем «Самовывоз — бесплатно»
   *   >0        — обычная платная доставка
   * undefined → ведёт себя как null (защита от прокидывания undefined).
   */
  deliveryCost?: number | null;
  /** Метка способа доставки для строки «Доставка (метка): …». Пример: "СДЭК", "Boxberry". */
  deliveryLabel?: string;

  // --- CTA ---
  /** Иконка слева от label. CreditCard для физ, Receipt для юр. */
  ctaIcon: LucideIcon;
  /** Текст кнопки в обычном состоянии. */
  ctaLabel: string;
  /** Текст кнопки в loading-состоянии. Дефолт: "Создаём заказ…". */
  ctaLoadingLabel?: string;
  /** Подпись под кнопкой. Передаётся целиком из parent. */
  ctaHint: string;

  // --- Состояние UI ---
  /** true → кнопка показывает Loader2 + ctaLoadingLabel, не submit'ится. */
  loading: boolean;
  /** Дополнительный disabled-источник из parent (например, isReadyToPay). Объединяется с loading и !consent. */
  disabled: boolean;
  /** Текст ошибки сервера. Рендерится в красном блоке между «Итого» и ConsentCheckbox. */
  error: string | null;
  /**
   * Опциональное предупреждение про unknown count (физ-форма передаёт текст
   * про необходимость КП). Отображается только если unknownCount > 0 и оно передано.
   */
  unknownPaymentWarning?: string;

  // --- Согласие 152-ФЗ ---
  /** Текущее состояние чекбокса. */
  consent: boolean;
  /** Колбэк изменения чекбокса. Прокидывается прямо в ConsentCheckbox. */
  onConsentChange: (next: boolean) => void;
}
```

### Состояния (визуальные режимы)

| Режим | showDeliveryLine | deliveryCost | Поведение |
|---|---|---|---|
| **Юр-форма** | `false` (или omit) | omit | Список → разделитель → «Итого: total ₽» → ConsentCheckbox → CTA «Выписать счёт» |
| **Физ без доставки** | `true` | `null` | Список → разделитель → «Товары: total ₽» + подсказка про выбор → «Итого: total ₽» → ConsentCheckbox → CTA «Перейти к оплате» |
| **Физ + самовывоз** | `true` | `0` | Список → разделитель → «Товары: total ₽» + «Доставка: Самовывоз — бесплатно» → «Итого к оплате: total ₽» |
| **Физ + платная доставка** | `true` | `>0` | Список → разделитель → «Товары: total ₽» + «Доставка ({label}): cost ₽» → «Итого к оплате: (total + cost) ₽» |
| **С unknownCount > 0** | (любое) | (любое) | Под «Итого» — warning-block (если передан unknownPaymentWarning) |
| **Loading** | (любое) | (любое) | Кнопка показывает Loader2 + ctaLoadingLabel, не кликабельна |
| **Error** | (любое) | (любое) | Красный блок с error между «Итого» и ConsentCheckbox |

### Вычисляемое значение «Итого»

```typescript
function computeGrandTotal(props): { display: string; isUnknown: boolean } {
  if (props.knownCount === 0) {
    return { display: "По запросу", isUnknown: true };
  }
  const delivery = props.showDeliveryLine && typeof props.deliveryCost === "number"
    ? props.deliveryCost
    : 0;
  return { display: formatPrice(props.total + delivery), isUnknown: false };
}
```

---

## UI Entity: Line Item (внутренняя структура списка)

**Не отдельный type** — derived из `RfqCartItem`. Описывает что показывается в одной строке списка.

| Поле | Источник | Отображение |
|---|---|---|
| `name` | `item.name` | Первая строка, truncate, `title={name}` для tooltip |
| `sku` | `item.sku` | Вторая строка, серый |
| `qty` | `Number.parseInt(item.quantity, 10) \|\| 1` | Вторая строка, после `· {qty} шт` |
| `lineTotal` | `formatPrice(item.price * qty)` или `"По запросу"` если `price === null/undefined` | Правая колонка, жирный |

### Стилевые токены (Tailwind, для реализатора)

- Контейнер строки: `grid grid-cols-[1fr_auto] items-baseline gap-3`
- Название: `min-w-0`, внутри `<span className="block truncate text-slate-950" title={name}>`
- Метаданные: `text-xs text-slate-500` (sku · qty)
- lineTotal: `whitespace-nowrap font-semibold text-slate-950` или `font-medium text-slate-600` для «По запросу»

---

## Type Imports

Все типы — из существующих модулей, ничего нового не добавляем:

```typescript
import type { LucideIcon } from "lucide-react";
import type { RfqCartItem } from "@/components/rfq/RfqCart";
```

`RfqCartItem` (текущее определение, не меняется):

```typescript
export type RfqCartItem = {
  name: string;
  quantity: string;       // строка (для гибкости input'а), парсится через parseInt
  sku: string;
  price?: number | null;  // null/undefined → «По запросу»
  slug?: string;          // не используется в OrderSummaryCard
  image?: string;         // не используется в OrderSummaryCard
};
```

---

## Не затрагиваемые сущности

| Сущность | Где | Статус |
|---|---|---|
| Payload-коллекция `orders` | `apps/web/src/collections/Orders.js` | **Без изменений** |
| Payload-коллекция `carts` | `apps/web/src/collections/Carts.ts` | **Без изменений** |
| `POST /api/orders` request schema | `apps/web/src/app/api/orders/route.ts` | **Без изменений** — payload идентичен |
| Серверный consent record | `@/lib/consent/makeConsentRecord` | **Без изменений** — продолжает работать |
| `ConsentCheckbox` | `@/components/consent/ConsentCheckbox` | **Без изменений** — переиспользуется внутри нового компонента |
| `useRfqCartItems` / `getCartTotal` | `@/components/rfq/RfqCart` | **Без изменений** — parent-формы продолжают использовать |
| `DeliveryBlock` | `@/components/checkout/DeliveryBlock` | **Без изменений** — живёт в левой колонке физ-формы |
| Аналитические события `pushEvent` | `@/lib/analytics/data-layer` | **Без изменений** — остаются в parent-формах |

---

## Migration

**Нет миграции.** Никаких ALTER TABLE, никаких новых колонок, никаких обновлений payload-types.ts. Чисто UI-рефактор внутри `components/cart/`.

---

## Summary

- **1 новый TypeScript-интерфейс** (`OrderSummaryCardProps`).
- **1 новый React-компонент** (`OrderSummaryCard`).
- **0 новых типов в `RfqCartItem`** / `Order` / `Cart`.
- **0 миграций БД**, **0 серверных изменений**, **0 новых API endpoint'ов**.
- **2 файла редактируются** (Invoice / Physical CheckoutForm) — только замена inline `<aside>` на вызов нового компонента.
