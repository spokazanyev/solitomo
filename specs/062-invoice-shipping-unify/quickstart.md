# Quickstart: Унификация выбора доставки в чекауте юрлица

**Branch**: `062-invoice-shipping-unify` | **Phase**: 1 — Design | **Date**: 2026-05-27

Dev-smoke сценарий для верификации фичи после `/speckit-implement`. Поэтапно, без автоматики (manual visual smoke за владельцем для PDF — как было в 061).

---

## 0. Preflight

### 0.1. Зависимости и сборка

```bash
# From repo root
pnpm install
pnpm --filter @soliton/web generate:types   # regenerate after Orders.js change
pnpm typecheck
pnpm lint
```

Ожидаемое: 0 ошибок.

### 0.2. Pre-merge baseline check (R8)

В staging / production-replica (read-only):

```sql
SELECT COUNT(*) AS legacy_tc_count FROM orders WHERE delivery_method = 'tc';
```

**Записать в PR description**: `legacy_tc_count = N` (где N — фактическое число).

Это служит контрольным показателем для проверки миграции (см. §3.4).

### 0.3. Run migration locally

```bash
# Run pending migrations
pnpm --filter @soliton/web payload migrate
```

Ожидаемое: миграция `20260527_rename_method_tc_to_own_carrier` выполняется без ошибок. Если есть `tc`-записи — они переходят в `own_carrier`.

Проверка:

```sql
SELECT COUNT(*) FROM orders WHERE delivery_method = 'tc';   -- → 0 after migration
SELECT COUNT(*) FROM orders WHERE delivery_method = 'own_carrier';  -- → N (baseline)
```

Idempotency-check: повторный запуск миграции — no-op (никаких ошибок про duplicate value, потому что `IF NOT EXISTS`).

---

## 1. UI smoke: три режима в чекауте юрлица

### 1.1. Запуск dev-сервера

```bash
pnpm --filter @soliton/web dev
```

Открыть `http://localhost:3000/cart/`.

### 1.2. Подготовка корзины

Добавить 2-3 товара с ценами (любой PDU или блок розеток). Перейти `Корзина → Выписать счёт` (`/cart/checkout/invoice/`).

### 1.3. Сценарий A — режим «Через службу доставки» (default)

1. Открыть страницу — убедиться, что radio «Через службу доставки» предвыбран (FR-062-03).
2. Заполнить реквизиты компании (название, ИНН).
3. Заполнить контактное лицо (ФИО, email, телефон).
4. Ввести валидный адрес — выбрать из DaData-подсказок.
5. **Ожидать**: появляется список тарифов (СДЭК / Boxberry / Почта России) с ценой, сроками, бейджами.
6. Выбрать тариф «СДЭК до двери».
7. Согласие — поставить чекбокс PDPA.
8. Кнопка «Выписать счёт» должна стать активной.
9. Открыть DevTools → Network. Записать payload `POST /api/orders`:
   - `delivery.method = "cdek"`, `delivery.cost = 850` (пример), `delivery.providerKey`, `delivery.tariffId`, `delivery.addressNormalized.*` — все поля присутствуют.
   - `delivery.handoverNote` — отсутствует или пусто.
10. Submit → ожидать redirect на `/cart/order/<token>/?type=invoice`.

**Pass criteria**: payload корректный, заказ создан, PDF-генерация работает (см. §2.1).

### 1.4. Сценарий B — режим «Транспортной компанией покупателя»

1. Reload `/cart/checkout/invoice/`.
2. Заполнить реквизиты и контакты как в сценарии A.
3. Кликнуть radio «Транспортной компанией покупателя».
4. **Ожидать**: появляется обязательное поле «Уточнение по отгрузке» (textarea). Подсказка/placeholder: «Название ТК, договор, контакт водителя/менеджера».
5. Кнопка «Выписать счёт» — **неактивна** (поле пусто).
6. Заполнить поле: `"ПЭК, договор № 4567 от 12.01.2025, контакт водителя +7 999 123-45-67"`.
7. Согласие → кнопка активна.
8. Submit → Network payload:
   - `delivery.method = "own_carrier"`.
   - `delivery.cost = 0`.
   - `delivery.handoverNote = "ПЭК, договор № 4567 ..."`.
   - **Нет** ApiShip-полей (`tariffId`, `providerKey` отсутствуют или null).
9. Перенаправление на `/cart/order/<token>/?type=invoice`.

**Pass criteria**: serverside-валидация `MISSING_HANDOVER_NOTE` не сработала, заказ создан с корректным method.

### 1.5. Сценарий C — режим «Самовывоз»

1. Reload `/cart/checkout/invoice/`.
2. Заполнить реквизиты + контактное лицо (`ФИО=Иванов И.И.`, `Тел=+7 999 ...`).
3. Кликнуть radio «Самовывоз».
4. **Ожидать**: появляется поле «Кто заберёт» с **авто-предзаполненным** значением «Иванов И.И., тел. +7 999 ...» (FR-062-06 + Q4 clarif).
5. Сохранить дефолт (или отредактировать).
6. Согласие → кнопка активна.
7. Submit → Network payload:
   - `delivery.method = "pickup"`.
   - `delivery.cost = 0`.
   - `delivery.handoverNote = "Иванов И.И., тел. +7 999 ..."`.

**Pass criteria**: авто-предзаполнение работает; serverside-валидация `MISSING_HANDOVER_NOTE` не сработала.

### 1.6. Сценарий D — переключение режимов (silent reset)

1. Открыть `/cart/checkout/invoice/`. Default — режим «Через службу».
2. Ввести адрес, дождаться тарифов, выбрать СДЭК (cost=850).
3. Переключить radio на «Транспортной компанией».
4. **Ожидать**: ApiShip-выбор сброшен (никакого ApiShip-поля в DOM); поле адреса в `<AddressForm>` **сохранилось**; новое поле handoverNote — пусто.
5. Заполнить handoverNote, переключить обратно на «Через службу».
6. **Ожидать**: адрес сохранён, тарифы пересчитываются автоматически, handoverNote из «своей ТК» **не виден** (он только для своей ТК).

**Pass criteria**: state в parent component хранится корректно (R6); silent reset без диалогов (Q2 clarif).

### 1.7. Сценарий E — submit без consent (regression check 057)

1. Заполнить любой режим до состояния "Готово".
2. НЕ ставить чекбокс согласия.
3. **Ожидать**: кнопка «Выписать счёт» неактивна.
4. Поставить → активна → submit.

**Pass criteria**: 057-gate работает как было.

---

## 2. PDF smoke (manual visual за владельцем)

### 2.1. Сценарий A (ApiShip): открыть PDF от созданного заказа

URL: `http://localhost:3000/api/invoice/<orderId>` (или `<publicToken>`).

**Ожидаемая структура**:
- Заголовок «Счёт № …»
- Блок «Поставщик» с реквизитами компании.
- Блок «Плательщик» с реквизитами клиента-юрлица.
- Блок «Позиции» — табличная часть.
- **Итоги (правый край)**:
  - «Сумма позиций: …»
  - «В т.ч. НДС 20%: …»
  - **«Доставка: 850,00 ₽»** ← новая строка
  - «Итого к оплате: …» — включает доставку
- Footer: «Оплата производится по реквизитам …»
- **Блока «Примечания» — НЕТ** (потому что ApiShip-режим).
- Подпись директора.

### 2.2. Сценарий B (own_carrier)

**Ожидаемая структура**:
- Заголовок + Поставщик + Плательщик + Позиции — без изменений.
- **Итоги**:
  - «Сумма позиций: …»
  - «В т.ч. НДС 20%: …»
  - ~~«Доставка»~~ ← **строки нет**
  - «Итого к оплате: …» — равно subtotal
- Footer: «Оплата производится …»
- **Блок «Примечания»** (новый, с подчёркнутым заголовком):
  > «Отгрузка транспортной компанией покупателя: ПЭК, договор № 4567 от 12.01.2025, контакт водителя +7 999 123-45-67»
- Подпись.

### 2.3. Сценарий C (pickup)

**Ожидаемая структура**: как §2.2, но в блоке «Примечания»:
> «Самовывоз со склада: <actualAddress из contacts.json>.»
> «Получатель: Иванов И.И., тел. +7 999 ...»

### 2.4. Regression: legacy `tc`-заказ из БД (если есть)

После миграции этот заказ имеет `method='own_carrier'` и `handoverNote=null` (legacy).
**Ожидаемая структура**: как §2.2, но в блоке «Примечания»:
> «Отгрузка транспортной компанией покупателя (по согласованию с менеджером).»

### 2.5. Regression: legacy ApiShip-заказ из БД

Order с `method='cdek'`, `cost=650`, без handoverNote.
**Ожидаемая структура**: identical to pre-062 PDF (нет блока «Примечания», есть строка «Доставка», как раньше). Визуальный diff ≤ small font-metric differences (SC-062-06).

---

## 3. API smoke (без UI)

### 3.1. Validation: `own_carrier` без `handoverNote`

```bash
curl -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "legal",
    "items": [{"sku":"TEST","name":"Test","quantity":1,"price":100}],
    "customer": {"fullName":"Тест","email":"test@example.com","companyName":"ООО Тест","inn":"7700000000"},
    "delivery": {"method": "own_carrier"},
    "consent": true
  }'
```

**Ожидаемо**: HTTP 400, body `{"error":"MISSING_HANDOVER_NOTE","message":"handoverNote required for pickup/own_carrier"}`.

### 3.2. Validation: `own_carrier` с handoverNote < 10 chars

```bash
curl -X POST ... -d '{... "delivery": {"method":"own_carrier","handoverNote":"ПЭК"} ...}'
```

**Ожидаемо**: HTTP 400, `{"error":"HANDOVER_NOTE_TOO_SHORT", ...}`.

### 3.3. Validation: `own_carrier` с handoverNote > 1000 chars

```bash
curl -X POST ... -d '{... "delivery": {"method":"own_carrier","handoverNote":"<1001 chars>"} ...}'
```

**Ожидаемо**: HTTP 400, `{"error":"HANDOVER_NOTE_TOO_LONG", ...}`.

### 3.4. Soft-mapping: `tc` → `own_carrier` (legacy compat)

```bash
curl -X POST ... -d '{... "delivery": {"method":"tc","handoverNote":"ПЭК, договор 1234"} ...}'
```

**Ожидаемо**: HTTP 201, заказ создан с `method='own_carrier'` (soft-mapping применился).

### 3.5. ApiShip-mode: full payload

```bash
curl -X POST ... -d '{... "delivery": {
  "method":"cdek",
  "cost":850,
  "providerKey":"cdek_door",
  "tariffId":136,
  "deliveryType":"1",
  "pickupType":"1",
  "etaMinDays":2,
  "etaMaxDays":3,
  "addressNormalized": {...}
} ...}'
```

**Ожидаемо**: HTTP 201, заказ создан со всеми ApiShip-полями.

---

## 4. Analytics smoke

### 4.1. DataLayer inspection

В DevTools → Console:

```js
dataLayer.length  // → before opening page
// перейти на /cart/checkout/invoice/
dataLayer.length  // → должно увеличиться
dataLayer.filter(e => e.event === "shipping_mode_changed")
// → [] на первом mount (default режим, явного клика не было)
```

### 4.2. Trigger: switch mode

В UI кликнуть «Транспортной компанией покупателя».

```js
dataLayer.filter(e => e.event === "shipping_mode_changed")
// → [{ event: "shipping_mode_changed", mode: "own_carrier", checkout_type: "legal", previous_mode: "apiship" }]
```

### 4.3. Trigger: switch back

В UI кликнуть «Самовывоз».

```js
dataLayer.filter(e => e.event === "shipping_mode_changed")
// → 2 entries, последний: { mode: "pickup", previous_mode: "own_carrier" }
```

### 4.4. `checkout_step_shipping` payload

```js
dataLayer.filter(e => e.event === "checkout_step_shipping")
// → [{ ..., shipping_mode: "apiship" }]  — fires once при первом видении блока
```

---

## 5. Admin smoke (Payload)

### 5.1. Создать заказ через UI (сценарий B из §1.4), потом открыть в admin

`http://localhost:3000/admin/collections/orders/<id>`

**Ожидаемо в group "Доставка"**:
- Поле «Способ» = «Транспортной компанией покупателя».
- Поле «Стоимость доставки, ₽» = 0.
- **Новое поле «Примечание к отгрузке»** = «ПЭК, договор № 4567 ...».

### 5.2. Edit handoverNote после `paid` (R1/R2 verification)

1. Перевести заказ в `paid` (manually через admin).
2. Открыть заказ, изменить `delivery.handoverNote` в admin-UI.
3. Сохранить.
4. **Ожидаемо**: сохранение прошло без immutability-error (FR-062-61, R1).
5. Открыть таб «История»: появилась запись «delivery_note_updated» с actor email и timestamp (R2).
6. Финансовые поля (`items`, `totals.total`, `customer.email`) — попытка изменить → блокируется immutability-guard.

---

## 6. Post-release: deferred items checklist

После релиза записать в `07-build-specifications/deferred-content-track.md`:

- [ ] **DEFERRED-062-A**: финальная очистка enum `delivery_method` от значения `'tc'` (R3 step B). Когда: 2-3 месяца наблюдения, что в новых записях `tc` не появляется. Способ: type-recreate procedure.
- [ ] **DEFERRED-062-B**: удалить soft-mapping `tc → own_carrier` из `/api/orders` (§3.4). Когда: 1-2 месяца после релиза, когда уверены, что все клиенты обновили SPA.
- [ ] **DEFERRED-062-C**: настроить goal `shipping_mode_changed` в Yandex.Метрика через `config/metrika.config.ts` + `pnpm metrika:apply-config`.
- [ ] **DEFERRED-062-D**: при активации Twenty CRM (048) — пробросить `delivery.handoverNote` в `opportunity.description` (см. CRM-sync сабсистему 048).

---

## 7. PASS/FAIL summary

Все сценарии §1–§5 должны пройти. Любой `FAIL` → блокер мерджа.

После прохождения — commit + push + PR review.

**Manual smoke за владельцем** (как в 061): §2 (визуальный осмотр 3 PDF) — не автоматизируется, выполняется reviewer.
