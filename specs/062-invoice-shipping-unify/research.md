# Research: Унификация выбора доставки в чекауте юрлица

**Branch**: `062-invoice-shipping-unify` | **Phase**: 0 — Outline & Research | **Date**: 2026-05-27

UX-вопросы (дефолтный режим, mode-switch behavior, mutability `handoverNote`, обязательность `pickup`-контакта, терминология `tc`→`own_carrier`) разрешены в [/speckit-clarify](./spec.md#clarifications). Здесь — технические подвопросы, влияющие на план реализации.

---

## R1. Реализация immutability-exception для `delivery.handoverNote`

**Question**: Спека (FR-062-61) требует, чтобы `delivery.handoverNote` оставался редактируемым после перехода Order в `paid` (исключение из 051 immutability-guard). Как технически добавить исключение?

**Investigation**: Прочитан [immutability.ts](../../apps/web/src/lib/lifecycle/immutability.ts) (213 LOC, спека 051):

```ts
const FROZEN_FIELDS: readonly string[] = [
  "items",
  "totals.subtotal", "totals.vat", "totals.total",
  "delivery.priceSnapshot", "delivery.priceSnapshot.*",
  "customer.email",
  "clientNumber",
];
```

Логика guard: **frozen-set approach** — `if (field in FROZEN_FIELDS) block else allow`. То есть всё, что НЕ в списке, разрешено по умолчанию.

**Decision**: `delivery.handoverNote` НЕ нужно добавлять в whitelist — оно автоматически разрешено к редактированию после `paid`. **Никаких изменений в `immutability.ts` не требуется.**

**Rationale**: Frozen-set подход уже даёт нужное поведение без правок. Если в будущем добавится whitelist-approach или новые frozen-fields в этой области (`delivery.*` целиком), потребуется явный whitelist — но сейчас N/A.

**Alternatives considered**:
- (A) Добавить `delivery.handoverNote` в новый whitelist `MUTABLE_AFTER_PAID` — **rejected**: лишняя структура без необходимости.
- (B) Захардкодить переопределение в admin-UI Payload — **rejected**: нарушает принцип VI (single source of truth).

**Impact on plan.md**: Удалить упоминание изменений в `immutability-guard.ts` из «Source Code» секции (см. правку ниже).

---

## R2. Audit-log изменений `handoverNote` после `paid`

**Question**: FR-062-61 требует логирования всех изменений `handoverNote` в `Order.history` с actor + timestamp + previous/new value. Как это устроено в текущем lifecycle?

**Investigation**: В [Orders.js:579-600](../../apps/web/src/collections/Orders.js#L580-L600):

```js
{ name: "history", type: "array",
  fields: [ /* статусные события + меняемые поля */ ] }
```

Документ-история заполняется автоматически через Payload `beforeChange` hook + lifecycle event emitter (051). Конкретная подсистема — `@/lib/lifecycle/events.ts` (`emitOrderEvent`).

**Decision**: Использовать существующий механизм. При обновлении `delivery.handoverNote` через admin-UI или API — добавить новую запись `history.push({ at, actor, kind: "delivery_note_updated", from, to })`. Реализация — небольшое расширение `Orders.beforeChange` hook (или в admin-only endpoint, если решим разделить admin/buyer flow).

**Rationale**: Не изобретаем audit-pipeline; пользуемся 051-infrastructure.

**Alternatives considered**:
- (A) Отдельная коллекция `OrderEdits` — **rejected**: overkill для одного поля.
- (B) Только в admin (без серверного hook) — **rejected**: пропустим программные изменения.

**Impact on plan.md / tasks.md**: Один новый task — добавить case `delivery_note_updated` в `Orders.beforeChange` hook. Тесты — extend `__tests__/events.test.ts`.

---

## R3. Структура миграции `tc → own_carrier`

**Question**: Как написать idempotent миграцию переименования enum-значения в Payload v3 + Drizzle adapter?

**Investigation**:
- Существующие миграции: [20260526_shipping_sender_pickup_type.ts](../../apps/web/src/migrations/20260526_shipping_sender_pickup_type.ts) — пример работы с enum (`CREATE TYPE ... AS ENUM(...)` + `ADD COLUMN`).
- Полная schema migration для enum-rename в Postgres требует:
  1. `ALTER TYPE ... ADD VALUE 'own_carrier'` (добавить новое значение)
  2. `UPDATE orders SET delivery_method = 'own_carrier' WHERE delivery_method = 'tc'` (миграция данных)
  3. Если нужно полностью удалить `'tc'` из enum — это сложно (Postgres не поддерживает `DROP VALUE`); приходится пересоздавать тип через временный (rename type → create new → cast → drop old).

**Decision**: **Двух-шаговый подход**:

**Шаг A (этот спринт)**:
- Не трогать enum в Postgres. Просто добавить новое значение `'own_carrier'` через `ALTER TYPE ... ADD VALUE IF NOT EXISTS 'own_carrier'`.
- `UPDATE orders SET delivery_method = 'own_carrier' WHERE delivery_method = 'tc'` (idempotent через `WHERE`).
- В Payload-схеме [Orders.js](../../apps/web/src/collections/Orders.js) — добавить новое option `own_carrier`, оставить старое `tc` как deprecated (для существующих записей и переходного периода).

**Шаг B (отложенно, в отдельной мини-миграции через 2-3 месяца)**:
- Когда убедимся, что `tc` больше нигде не используется (мониторим в БД) — выпилим его из enum через type-recreate procedure.

**Rationale**:
- Идемпотентность гарантирована `ADD VALUE IF NOT EXISTS` + `WHERE delivery_method = 'tc'`.
- Шаг A полностью совместим с FR-062-51 (legacy-толерантность PDF).
- Откладывание полной очистки enum — стандартная практика для production-safe Postgres миграций.

**Alternatives considered**:
- (A) Single-shot type-recreate (drop old, recreate with new) — **rejected**: требует кратковременной недоступности таблицы.
- (B) Сохранить enum `tc` навсегда как hidden legacy — **rejected**: грязная схема, путает разработчиков через год.

**Impact on plan.md / tasks.md**: один tasks для миграции (шаг A), один deferred-tracker для шага B (записать в `07-build-specifications/deferred-content-track.md`).

---

## R4. Адрес склада для PDF блока «Примечания» при `pickup`

**Question**: Откуда брать строку «Самовывоз со склада: <адрес>» в PDF-счёте?

**Investigation**:
- Уже есть [getCompanyContacts()](../../apps/web/src/lib/company/get-company-contacts.ts) — читает из `00-source-data/company/contacts.json`.
- Поля: `actualAddress` (приоритет), `legalAddress` (fallback), оба могут быть пустыми или начинаться с `TODO`.
- В существующем PDF-генераторе `actualAddress` уже отображается в блоке «Поставщик» при условии `!startsWith("TODO")`.

**Decision**: Использовать ту же приоритизацию:
1. `actualAddress` если задан и не TODO — основной адрес склада.
2. `legalAddress` если actualAddress TODO/пустой — fallback на юр.адрес.
3. Если оба TODO/пустые — выводим строку «Адрес склада уточнит менеджер» (явный placeholder, чтобы менеджер не забыл заполнить).

**Rationale**: Консистентность с уже принятой логикой в [invoice/[orderId]/route.ts](../../apps/web/src/app/api/invoice/[orderId]/route.ts). Никаких новых источников данных.

**Alternatives considered**:
- (A) Новое поле `pickupWarehouseAddress` в Payload Global — **rejected**: дублирует существующий source-of-truth.
- (B) Брать из ApiShip `senderDropoffAddress` (от 060/047) — **rejected**: этот адрес для драйверов ApiShip, не для покупателя.

**Impact on plan.md / tasks.md**: один utility-function в `/api/invoice/[orderId]/route.ts` для определения адреса склада.

---

## R5. DataLayer-payload для нового события `shipping_mode_changed`

**Question**: Какие параметры передавать в `shipping_mode_changed`? Существуют ли уже похожие события для guidance?

**Investigation**:
- [events.ts:402-411](../../apps/web/src/lib/analytics/events.ts#L402-L411) — `trackInnValidationSuccess/Failed` — структура: `{ form_type, error_code? }`.
- Существующие checkout-step events (`checkout_step_shipping`, `add_shipping_info`) принимают `checkout_type ∈ {physical, legal}` + контекстные параметры.
- 058 типизирует все события через `AnalyticsEventName` literal-union в `events.ts`.

**Decision**: Сигнатура `trackShippingModeChanged({ mode, checkoutType, previousMode? })`:

```ts
type ShippingMode = "pickup" | "apiship" | "own_carrier";

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

- `mode` — обязательный, текущий выбранный режим.
- `checkout_type = "legal"` для invoice-формы (для physical-формы событие не стреляет — там нет переключения режима).
- `previous_mode` — опциональный, чтобы измерить переходы (e.g. apiship → own_carrier — индикатор того, что ApiShip не покрыл case).

Событие добавляется в `AnalyticsEventName` union в `events.ts`.

**Rationale**:
- Соответствует существующему паттерну typed-helpers.
- `previous_mode` даёт ценную funnel-метрику (R5-aspect: SC-062-05).
- В Метрике это будет видно как `ym('reachGoal', 'shipping_mode_changed', { mode, previous_mode })`.

**Alternatives considered**:
- (A) Минимальная сигнатура `{ mode }` без context — **rejected**: теряем funnel-detail.
- (B) Сигнатура с tarif-параметрами — **rejected**: для этого уже есть `add_shipping_info`.

**Impact on plan.md / tasks.md**: один task — добавить `trackShippingModeChanged` в `events.ts` + extend `AnalyticsEventName` union + unit-тест.

---

## R6. Сохранение состояния `AddressForm` при переключении режима

**Question**: По FR-062-11 silent reset не должен терять введённый адрес, чтобы при возврате в режим ApiShip пользователь не вводил его повторно. Как это реализовать в React?

**Investigation**:
- `<AddressForm>` управляется через `value`/`onChange` prop ([AddressForm.tsx](../../apps/web/src/components/checkout/AddressForm.tsx) — controlled component, держит state наверху).
- В физлицовой форме [PhysicalCheckoutForm.tsx:25](../../apps/web/src/components/cart/PhysicalCheckoutForm.tsx#L25) — `const [address, setAddress] = useState<AddressFormValue>({ query: "" })` — поднят в parent, переживает unmount/remount `<DeliveryBlock>`.

**Decision**: Те же patterns:
- Подняуть `addressState` в `InvoiceCheckoutForm` (а не в условный render внутри режима ApiShip).
- При переключении режима — НЕ сбрасывать `addressState`.
- Что сбрасывается: `selectedRate` (ApiShip-тариф), `handoverNote` (если переход на другой режим где он другой) — через явный `setSelectedRate(null)` / условный сброс `handoverNote`.
- `<AddressForm>` и `<DeliveryBlock>` рендерятся только в режиме `apiship` (conditional render), но их state — в parent.

**Rationale**: Стандартный React-паттерн «lift state up». Никаких новых hooks.

**Alternatives considered**:
- (A) `localStorage` для сохранения адреса — **rejected**: overkill для within-session UX.
- (B) Не conditional-render, а `display: none` для скрытия — **rejected**: вызовет лишние API-запросы к `/api/shipping/calculate` при невидимом блоке.

**Impact on plan.md / tasks.md**: учитывается в основной UI-задаче по `InvoiceCheckoutForm`.

---

## R7. Валидация handoverNote на сервере (whitespace-only, длина)

**Question**: FR-062-24 требует серверного отказа при `method=own_carrier` без `handoverNote`. Что считать «пустым»?

**Decision**:
- Trim перед проверкой: `handoverNote.trim().length > 0`.
- Минимальная длина для `own_carrier`: 10 символов (рамочный sanity-check, не должен сильно резать UX, но защищает от «.», «—» и подобных пустых заглушек).
- Минимальная длина для `pickup`: 5 символов (мягче, потому что авто-предзаполняется).
- Максимальная длина: 1000 символов (FR-062-05/06 — UI лимит); сервер дополнительно ограничивает (защита от XSS-overflow).
- В случае нарушения — HTTP 400 с error code `MISSING_HANDOVER_NOTE` (own_carrier) или `HANDOVER_NOTE_TOO_SHORT` / `HANDOVER_NOTE_TOO_LONG`.

**Rationale**: trim + min-len — стандартный sanity-check, не позволяет UI обойти валидацию через devtools.

**Impact on plan.md / tasks.md**: учитывается в API-task.

---

## R8. Что если в БД нет ни одного заказа с `method='tc'`?

**Question**: Миграция данных нужна только если есть записи. Как проверить и что делать?

**Investigation**: Локальная БД не доступна в этой сессии. По CLAUDE.md / AGENTS.md проект уже в продакшене (commerce-MVP active), значит реальные данные могут быть. Допустим, есть `N ≥ 0` записей с `method='tc'`.

**Decision**:
- Миграция всё равно нужна (FR-062-52). Она idempotent: если N=0 — `UPDATE` ничего не сделает.
- Перед merge: получить `SELECT count(*) FROM orders WHERE delivery_method='tc';` на staging и production-replica (read-only). Записать число в quickstart.md как чек.

**Rationale**: Idempotent миграция работает и для 0 строк. Это не блокер.

**Impact on plan.md / tasks.md**: один pre-merge-task — «get baseline count of legacy `tc` records».

---

## Summary of decisions

| # | Decision | Affects |
|---|----------|---------|
| R1 | `handoverNote` уже автоматически mutable — никаких правок `immutability.ts` | plan.md (упростить), tasks.md (один task меньше) |
| R2 | Audit-log через `Orders.beforeChange` + lifecycle event emitter | tasks.md (один task) |
| R3 | 2-этапная миграция: сейчас `ALTER TYPE ADD VALUE IF NOT EXISTS`, выпиливание `tc` отложено | tasks.md (миграция) + deferred-tracker |
| R4 | Адрес склада для PDF — приоритет `actualAddress → legalAddress → плейсхолдер` | tasks.md (PDF) |
| R5 | `trackShippingModeChanged({ mode, checkoutType, previousMode? })` | tasks.md (events.ts) |
| R6 | Lift `addressState` to InvoiceCheckoutForm parent — стандартный React pattern | tasks.md (UI) |
| R7 | Trim + min-len validation на сервере, error-coded HTTP 400 | tasks.md (API) |
| R8 | Pre-merge: baseline count `tc`-записей — для documentation | tasks.md (smoke) |

**All NEEDS CLARIFICATION resolved**: ✅ (5 user-facing разрешены в /speckit-clarify; 8 технических в этом research.md).

**Ready for Phase 1**: ✅
