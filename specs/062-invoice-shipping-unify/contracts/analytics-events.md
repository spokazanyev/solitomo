# Contract: Analytics events — новое `shipping_mode_changed`

**Branch**: `062-invoice-shipping-unify` | **Phase**: 1 — Design | **Date**: 2026-05-27

Расширение существующей analytics-инфраструктуры из спеки 058 ([@/lib/analytics/events.ts](../../../apps/web/src/lib/analytics/events.ts)).

---

## 1. Новое событие: `shipping_mode_changed`

### Назначение

Funnel-метрика выбора режима доставки в чекауте юр-лица. Замеряет:

- **Распределение режимов**: сколько пользователей выбирают `pickup` vs `apiship` vs `own_carrier` (приблизительная пропорция B2B-кейсов).
- **Переходы между режимами**: например, `apiship → own_carrier` — индикатор того, что ApiShip-тарифы не подошли (крупный груз, fallback).
- **First-touch mode**: первое срабатывание события показывает default-выбор или явный pre-checkout user-intent.

### Trigger

- При смене режима на radio-группе в `InvoiceCheckoutForm` (явный клик пользователя).
- НЕ стреляет на первоначальный mount формы с дефолтным режимом «Через службу доставки» (FR-062-03) — это passive state, не активное событие.
- НЕ стреляет в физлицовой форме (там нет режимов).

### Schema (DataLayer payload)

```ts
{
  event: "shipping_mode_changed",
  mode: "pickup" | "apiship" | "own_carrier",      // current selection
  checkout_type: "legal",                          // always legal (082 mode-switch не вводится в physical)
  previous_mode?: "pickup" | "apiship" | "own_carrier",  // optional, для measure transitions
}
```

#### Поля

| Поле | Тип | Required | Описание |
|------|-----|----------|----------|
| `event` | string | yes | Constant `"shipping_mode_changed"` |
| `mode` | enum | yes | Текущий выбранный режим |
| `checkout_type` | string | yes | Всегда `"legal"` |
| `previous_mode` | enum | no | Предыдущий режим (если был); отсутствует на первом изменении после mount |

### Маппинг режима UI ↔ analytics ↔ Order.delivery.method

| UI radio | analytics `mode` | `Order.delivery.method` (для ApiShip — конкретный providerKey) |
|----------|------------------|--------------------------------------------------------------|
| «Самовывоз» | `pickup` | `pickup` |
| «Через службу доставки» | `apiship` | `cdek` / `boxberry` / `russian-post` (зависит от выбранного тарифа) |
| «Транспортной компанией покупателя» | `own_carrier` | `own_carrier` |

### Реализация (events.ts)

```ts
// 1) Добавить в AnalyticsEventName union:
export type AnalyticsEventName =
  | "add_to_cart"
  // ... existing
  | "shipping_mode_changed"  // NEW
  // ... existing
  ;

// 2) Typed helper:
export type ShippingMode = "pickup" | "apiship" | "own_carrier";

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
```

### Unit-test (extend `events.test.ts`)

```ts
it("trackShippingModeChanged with previous mode", () => {
  trackShippingModeChanged({ mode: "own_carrier", checkoutType: "legal", previousMode: "apiship" });
  expect(dataLayerSpy).toHaveBeenCalledWith({
    event: "shipping_mode_changed",
    mode: "own_carrier",
    checkout_type: "legal",
    previous_mode: "apiship",
  });
});

it("trackShippingModeChanged without previous mode", () => {
  trackShippingModeChanged({ mode: "pickup", checkoutType: "legal" });
  expect(dataLayerSpy).toHaveBeenCalledWith({
    event: "shipping_mode_changed",
    mode: "pickup",
    checkout_type: "legal",
  });
});
```

---

## 2. Изменения в существующих событиях (058)

### 2.1. `checkout_step_shipping` — расширение payload

Сейчас стреляет с параметрами `{ step_index, checkout_type }`. После 062 — добавляется `shipping_mode` (текущий выбранный режим на момент первого fire).

**Before**:

```ts
pushEvent("checkout_step_shipping", { step_index: 2, checkout_type: "legal" });
```

**After**:

```ts
pushEvent("checkout_step_shipping", {
  step_index: 2,
  checkout_type: "legal",
  shipping_mode: currentMode,   // NEW — pickup/apiship/own_carrier
});
```

**Backward compat**: existing GA4/Метрика-репорты, читающие `checkout_step_shipping`, продолжат работать; новое поле просто игнорируется dashboards, которые его не используют.

### 2.2. `add_shipping_info` — без изменений payload

Срабатывает при финальном выборе ApiShip-тарифа (только в режиме `apiship`). Параметры остаются прежними: `{ checkout_type }`. Для режимов `pickup` и `own_carrier` событие НЕ стреляет (логика «no shipping carrier selected»).

---

## 3. Funnel из спеки 058 — ожидаемое поведение после 062

```
view_cart (FR-122)
  → begin_checkout (на /cart/checkout/...)
  → checkout_step_contact (FR-120)
  → checkout_step_shipping (FR-121) + shipping_mode=apiship (default)
    [shipping_mode_changed events могут стрелять между шагами]
  → add_shipping_info (только если apiship) + shipping_mode_changed (если был переключения)
  → checkout_step_payment_method (FR-122)
  → checkout_cta_pay_clicked (FR-124)
  → invoice_requested (legal) / purchase (physical via payment return)
```

### Доля валидности SC-062-05

Метрика: «≥90% сессий, дошедших до выбора способа доставки, имеют `shipping_mode_changed`».

Важный edge-case: если пользователь принимает default `apiship` и НЕ переключается, событие НЕ стреляет (т.к. trigger — явный клик). Это нормально и **не** ухудшает метрику.

**Definition**: «сессия дошла до выбора» = есть `checkout_step_shipping`. Среди этих сессий те, у кого default отличается от submitted-mode = `shipping_mode_changed`-firing. Если 90% сессий принимают default — метрика всё равно валидна, но фактическое число `shipping_mode_changed` низкое (что само по себе сигнал «дефолт хороший»).

**Actionable insight**: если `shipping_mode_changed` от `apiship → own_carrier` доминирует в Метрике (> 30% сессий) — значит default не подходит большинству B2B, переоценить FR-062-03 в следующей итерации.

---

## 4. PII / Consent compliance

- `shipping_mode_changed` payload — **не содержит PII**. `mode` enum + `checkout_type` enum + `previous_mode` enum.
- `handoverNote` (контакты, реквизиты ТК) — **никогда** не передаётся в analytics.
- Событие проходит через стандартный `scrubPII` filter из 058 — он no-op для enum-only-payload.
- Consent banner (057): событие стреляет только после accepted cookie consent (как все 058 events). До accept — buffered в memory queue.

---

## 5. Метрика-side / GA4-side

### Yandex.Метрика

Регистрируется как `reachGoal('shipping_mode_changed', { mode, previous_mode })`.

Через 058 metrika-config — добавить goal-id в [config/metrika.config.ts](../../../apps/web/config/metrika.config.ts) при следующем `pnpm metrika:apply-config`. Это deferred-step после релиза 062 — записать в quickstart.md.

### GA4

Регистрируется автоматически через `gtag('event', 'shipping_mode_changed', {...})`. Никаких настроек в GA4 admin не требуется (custom events автоматически).

---

## 6. Cross-spec dependencies

- **058**: основной consumer; этот документ — extension contract.
- **057**: consent banner; событие buffered до accept.
- **061**: `OrderSummaryCard` не интегрируется с этим событием; analytics-логика остаётся в `InvoiceCheckoutForm`.
