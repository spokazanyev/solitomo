# Phase 0 Research: ApiShip — поддержка любого перевозчика (064)

Цель — зафиксировать решения по развязке «канал ↔ перевозчик», форме хранения и миграции. Открытых `[NEEDS CLARIFICATION]` в спеке нет; ниже — обоснования технических развилок на основе текущего кода.

---

## R1 — Где именно «зашиты» три перевозчика

**Decision**: Дефект локализован в `apps/web/src/app/api/orders/route.ts`, а не в ApiShip-слое.

**Findings** (по коду на момент планирования):

- `route.ts:138` — `METHOD_WHITELIST = ["pickup","cdek","boxberry","russian-post","own_carrier"]`; `route.ts:139-141` — любой `method` вне списка → `method = undefined`.
- `route.ts:187` — `isApiShipMethod = method === "cdek" || "boxberry" || "russian-post"`.
- `route.ts:188-190` — `deliveryCost = isApiShipMethod ? cost : 0` → для любого другого перевозчика стоимость обнуляется.
- `route.ts:293-306` — блок ApiShip (`provider, providerKey, deliveryType, pickupType, pointId, pointAddress, eta*, addressNormalized`) пишется только при `isApiShipMethod`.
- `ShippingRate.providerKey` (`lib/shipping/types.ts:82`) — **уже открытая строка**; `providerNameFromKey` (`lib/shipping/apiship/mappers.ts:157`) уже маппит ~10 служб с fallback `?? key`.
- Фронт уже шлёт перевозчика: `InvoiceCheckoutForm.tsx:263` — `method: rate.providerKey` + полный блок; `physical/review/page.tsx:112` — `method: draft.rate.providerKey`, **но без блока ApiShip** (только method/address/city/cost).

**Rationale**: «Любой перевозчик» уже течёт от ApiShip до тела запроса. Чинить надо приём на бэкенде (снять whitelist/гейт) и докинуть полный блок в physical-flow. Создание отправлений (`toOrderRequest`) уже работает с произвольным `providerKey` — вне scope (spec Assumptions «Создание отправлений»).

**Alternatives considered**: расширять `METHOD_WHITELIST` новыми кодами — отклонено: воспроизводит ту же болезнь при каждом новом перевозчике (нарушает FR-005/SC-003).

---

## R2 — Модель хранения: канал (closed) vs перевозчик (open)

**Decision**: Ввести закрытое поле `delivery.channel ∈ {pickup, service, own_carrier}` как единственный драйвер поведения. Перевозчик — открытый `delivery.providerKey` (существует) + новый `delivery.providerName` (text). Существующее `delivery.method` конвертируется `enum → text` и становится **транзитным алиасом канала** (бэкенд пишет `method = channel`); как дискриминатор перевозчика `method` больше не используется.

**Rationale**:
- Прямо реализует FR-003 (канал отдельно от перевозчика) и Key Entities спеки.
- `channel` — закрытый список из 3 значений → предсказуемое поведение (cost, примечания, блок), без хардкода перевозчиков.
- `providerKey` уже открытый text — менять тип не нужно; добавляем только `providerName`.
- `method` оставляем колонкой (не дропаем) ради дешёвой миграции и чтобы не сломать читателей разом; пишем в неё значение канала, новые читатели переходят на `channel`.

**Alternatives considered**:
- Отдельная таблица «перевозчики» / справочник — отклонено: ApiShip уже источник истины, denylist уже управляет доступностью (спека 047); таблица = лишний слой (нарушает простоту, Principle VI).
- Хранить перевозчика прямо в `method` (enum→text, без `channel`) — отклонено: снова конфлейтит канал и перевозчика; поведенческие проверки (`isPickup`/`isOwnCarrier`) стали бы зависеть от парсинга открытой строки.
- Дропнуть `method` полностью в этой же миграции — отклонено: дороже и рискованнее, чем оставить nullable-text алиас; читателей правим в коде, а не разрушительной схемой.

---

## R3 — Форма миграции Postgres (enum → text)

**Decision**: Одна formal-миграция `20260528_064_delivery_channel.ts`:
1. `ALTER TABLE orders ALTER COLUMN delivery_method TYPE text USING delivery_method::text;`
2. `DROP TYPE IF EXISTS enum_orders_delivery_method;` (тип больше не нужен).
3. `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_channel text;`
4. `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_provider_name text;`

Backfill существующих строк **не требуется** (на проде нет реальных заказов — spec Assumptions «Хранилище»). Миграция idempotent (`IF EXISTS`/`IF NOT EXISTS`), `down` — best-effort обратная (text→enum пересоздание опускаем как deferred, т.к. данных нет).

**Rationale**: Чистая смена схемы дешевле и без риска порчи истории, раз истории нет. `payload migrate` на проде (autopush off) применяет formal-миграцию контролируемо при `deploy/push.sh`.

**Alternatives considered**: `ALTER TYPE ... ADD VALUE 'service'` + ручной перенос — отклонено: оставляет лишние enum-значения (cdek/boxberry/russian-post/tc) и не даёт открытости перевозчику в `method`. Сохранение данных — не нужно (нет данных).

**Caveat (Payload schema drift)**: Payload по `delivery.channel`-select может захотеть собственный enum-тип `enum_orders_delivery_channel`. Чтобы не плодить дрейф схемы — `channel` в коллекции объявляем как `select` с тремя опциями (Payload создаст enum для нового поля — это ок, оно закрытое), а `method` оставляем `type: "text"` (открытое). Решение о точном Payload-типе `channel` (`select` → его enum vs `text` + валидация) фиксируется в data-model.md; предпочтение — `select` (admin-дружелюбно, закрытый набор).

---

## R4 — Человекочитаемое название перевозчика

**Decision**: `providerName` определяется на бэкенде при создании заказа: приоритет `body.delivery.providerName` (фронт уже знает `rate.providerName`) → `providerNameFromKey(providerKey)` → `providerKey` → `"служба доставки"`. Хелпер `resolveProviderName` живёт в `lib/shipping/delivery-channel.ts`.

**Rationale**: FR-006 требует fallback на код без пустот/ошибок. `providerNameFromKey` уже даёт ~10 названий с `?? key`. Сохранение `providerName` в заказ делает PDF/админку независимыми от перевычисления и от наличия маппинга на момент чтения.

**Alternatives considered**: вычислять имя только на чтении (в PDF) — отклонено: дублирует логику в нескольких читателях и теряет имя, если маппинг поменяется; хранение в заказе — snapshot-friendly.

---

## R5 — Детекция канала на бэкенде (доверие фронту vs вывод)

**Decision**: Фронт шлёт явный `delivery.channel`. Бэкенд валидирует его по закрытому набору `{pickup, service, own_carrier}`. Если `channel` отсутствует/неизвестен — **вывести** из payload: есть `providerKey`/`tariffId` → `service`; иначе fallback `pickup` (безопасно: cost=0). Логика — в `normalizeDeliveryChannel(body.delivery)`.

**Rationale**: Явный `channel` от формы — источник истины (форма уже знает `shippingMode`). Вывод — только страховка для прямых API-клиентов/legacy-тела, чтобы не падать (FR-010, edge «пустой код»).

**Alternatives considered**: всегда выводить канал из полей, игнорируя присланный — отклонено: теряет намерение пользователя (например own_carrier без providerKey неотличим от pickup без явного канала).

---

## R6 — Поведение каналов pickup / own_carrier

**Decision**: Без изменений по сравнению с 062: `pickup` и `own_carrier` → `deliveryCost = 0`, валидация `handoverNote` (pickup ≥5, own_carrier ≥10, ≤1000), блок ApiShip не пишется, в PDF — блок «Примечания»/адрес склада. В новой модели это просто `channel ∈ {pickup, own_carrier}`.

**Rationale**: FR-008 (бывш. FR-009) явно требует сохранить текущее поведение этих каналов. `tc` как отдельное legacy-значение убираем (нет данных, backward-compat снят) — фронт его уже маппил в own_carrier (062), теперь это просто own_carrier.

**Alternatives considered**: трогать handoverNote-правила — вне scope; не трогаем.

---

## R7 — Тестирование

**Decision**: Unit-тест на чистый `delivery-channel.ts` (`normalizeDeliveryChannel`, `resolveProviderName`): сервисный перевозчик вне трёх прежних, pickup, own_carrier, пустой/unknown providerKey, отсутствующий channel (вывод). Обновить `app/api/orders/__tests__/handover-validation.test.ts` под новую форму (`channel` вместо `method`-маппинга `tc→own_carrier`). Интеграция — ручной smoke (quickstart): заказ с Деловыми Линиями/DPD от физлица и юрлица + PDF.

**Rationale**: Чистая функция — детерминированно тестируема без БД (зеркало стиля 063: `inn.ts`/`party-normalize.ts`). Полный TDD-suite не запрашивался.

---

## Сводка решений

| # | Решение |
|---|---------|
| R1 | Чинить приём в `api/orders/route.ts` (снять whitelist/гейт) + докинуть блок в physical-flow; ApiShip-слой не трогаем |
| R2 | `channel` (closed: pickup/service/own_carrier) + `providerKey`(open)+`providerName`(new); `method` enum→text как алиас канала |
| R3 | Одна formal-миграция: enum→text, drop type, +channel +provider_name; без backfill (нет данных) |
| R4 | `providerName` резолвится на бэкенде (body → providerNameFromKey → key → «служба доставки») и сохраняется в заказ |
| R5 | Фронт шлёт `channel`; бэкенд валидирует, при отсутствии — выводит из полей |
| R6 | pickup/own_carrier — поведение из 062 без изменений; legacy `tc` убран |
| R7 | Unit-тест чистого хелпера + обновить handover-тест; интеграция — ручной smoke |
