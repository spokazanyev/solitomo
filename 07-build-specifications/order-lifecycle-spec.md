# Order Lifecycle, Notifications & Twenty CRM Sync — Canonical Spec

Дата: 2026-05-23.

## Назначение

Документ — единая правда о жизненном цикле сделки в Soliton: от добавления товара в корзину до закрытия сделки после доставки и периода возвратов. Описывает:

- последовательность шагов и переходы статусов;
- кто отвечает за каждый шаг (Next.js / Payload / ApiShip / ЮKassa / Twenty CRM / менеджер);
- какие уведомления и кому уходят на каждом этапе (email, messenger, в админку, в CRM);
- как состояния синхронизируются с Twenty CRM (Companies, People, Opportunities, Activities, Tasks, Notes);
- SLA по уведомлениям, идемпотентность, обработка сбоев.

Этот документ — backbone для feature-спецификаций:

- `specs/037-cart-and-checkout-flows/` — корзина и три checkout-сценария.
- `specs/047-delivery-checkout-apiship/` — модуль доставки с ApiShip, snapshot цены, closure сделки, event emitter, минимальный email-stub.
- `specs/048-twenty-crm-sync/` — синхронизация с Twenty CRM (Soliton → Twenty; двунаправленность в фазе 2).
- `specs/049-customer-notifications/` — полноценный модуль уведомлений (email/messenger/admin, queue, dedup, opt-out, шаблоны).

При расхождении между этим документом и feature-спекой — приоритет у этого документа; feature-спеку правим, чтобы соответствовать.

## Связанные документы

- `07-build-specifications/checkout-rfq-spec.md` — RFQ-флоу как часть жизненного цикла.
- `07-build-specifications/admin-configuration-spec.md` — глобальные настройки.
- `07-build-specifications/analytics-measurement-spec.md` — события dataLayer на ключевых шагах.
- `05-implementation-roadmap/russian-payment-delivery-aggregators.md` — выбор ApiShip и ЮKassa.
- `apps/web/src/collections/Orders.js` — реализация коллекции `orders`.

## Принципы

1. **Единственный источник истины — Payload `orders`**. Twenty CRM, email-провайдер, messenger-провайдер (050), ApiShip — это «реплики» / «дальние службы». Все восстанавливается из Payload.
2. **Snapshot цены в момент перехода к оплате**. После клика «К оплате» цены не пересчитываются до окончания платёжной сессии. Любое расхождение — отдельный пользовательский шаг подтверждения.
3. **Уведомления — событийная модель**. Один и тот же доменный event (`order.paid`, `shipment.delivered`) порождает множество уведомлений по матрице (email клиенту + email менеджеру + Twenty Activity + dataLayer-эвент); шаблон, канал и получатель — конфигурация, а не код.
4. **Идемпотентность по eventId / orderId+stage**. Любой шаг можно безопасно повторить.
5. **Каждый шаг имеет владельца — одна система**. Хэндофы фиксированы (см. §6).
6. **CRM-синк — асинхронный, eventual consistency**. Если Twenty недоступен — сообщение становится в очередь, заказ оформляется и доставляется без задержек.
7. **Никаких ПДн в системах, где они не нужны**. ЮKassa получает только нужное для оплаты, Twenty — контакты и сделки, ApiShip — данные для доставки.
8. **Локализация и доступность**. Все клиентские письма и сообщения — на русском, корректный sender name, отписка по правилам 152-ФЗ / ФЗ «О рекламе».

## 1. Этапы жизненного цикла

```text
[1] Discovery   →  [2] Cart  →  [3] Identify  →  [4] Address  →  [5] Delivery rate
                                                                       │
                                                                       ▼
                                                              [6] Review & confirm
                                                                       │
                                                                       ▼
[10] Closure  ◄  [9] Delivered  ◄  [8] In transit  ◄  [7] Payment & order create
        │
        ▼
[11] Post-sale (отзыв, повторная продажа, аналитика)
```

### Phase 1 — Discovery

- Покупатель открывает каталог / карточку / лендинг.
- DataLayer: `view_item_list`, `view_item`.
- Twenty: ничего (анонимный визитёр; UTM-метки в `lead` опционально, см. 048).

### Phase 2 — Cart

- Действие: добавление в корзину (`add_to_cart`).
- Хранение: `localStorage` (анонимная корзина) + копия в Payload `carts` (если решим персистить — см. 037).
- Twenty: ничего.

### Phase 3 — Identify

- На /cart/checkout-*/ покупатель вводит email/телефон/ФИО (физлицо) или реквизиты компании (юрлицо).
- Эмитится **`order.identified`** в момент успешной валидации email + phone (до создания Order).
- В Twenty (если 048 включена) создаётся / находится `Person` (или `Company` + `Person`).
- DataLayer: `begin_checkout`.
- Идемпотентность: повторный сабмит той же пары `(cartId, email)` событие не дублирует.

### Phase 4 — Address

- Покупатель вводит адрес (для физлица: доставка; для юрлица: юр. адрес + адрес доставки).
- Валидация через `/api/shipping/validate-address` (опц. DaData).
- В Payload Order создаётся черновик в статусе `draft` (после подтверждения email/телефона).

### Phase 5 — Delivery rate

- Триггер: адрес введён.
- Запрос `POST /api/shipping/calculate`.
- Покупатель выбирает тариф; для ПВЗ-тарифов — селектор `/api/shipping/points`.
- Состояние: `Order.delivery.{provider,providerKey,tariffId,deliveryType,pickupType,pointId,cost,etaMinDays,etaMaxDays}`.
- Twenty: создаётся `Opportunity` в стадии `Discovery` (если ещё нет).

### Phase 6 — Review & confirm

- Экран сводки: товары, реквизиты, адрес, тариф, итог.
- Покупатель нажимает «К оплате».
- Backend:
  1. Делает финальный refresh-расчёт тарифа.
  2. Если расхождение `≤ max(5%, 100 ₽)` — принимает старую цену.
  3. Иначе показывает диалог «Цена изменилась X → Y, принять?».
  4. Фиксирует `Order.delivery.priceSnapshot`, `Order.totals` (immutable до конца платёжной сессии).
- DataLayer: `add_shipping_info`, `add_payment_info` (при выборе метода оплаты).

### Phase 7 — Payment & order create

- Создаётся `Order.status = pending_payment` (физлицо/карта) или `awaiting_payment` (юрлицо/счёт).
- Передача в ЮKassa суммы из snapshot.
- Twenty: `Opportunity.stage = Quote` (юрлицо) или `Negotiation` (физлицо).
- Покупатель оплачивает.
- Webhook ЮKassa → `Order.status = paid`.
- DataLayer: `purchase`.
- Twenty: `Opportunity.stage = Won`, `Activity: Payment received`, `closeDate` фиксируется.
- Email клиенту: «Спасибо за оплату» (шаблон `T-001`).
- Email менеджеру: «Новый оплаченный заказ» (`T-101`).

### Phase 8 — In transit

Шаги внутри:

- **8a Shipment create**: менеджер (или автомат) нажимает «Создать отправление» → `Order.shipment.status = pending → created → pending_label → created` (когда есть label).
- **8b Hand over**: курьер приехал на склад / ApiShip забрал.
- **8c In transit**: едет.
- **8d At point / Out for delivery**: для ПВЗ — «прибыл в ПВЗ»; для курьера — «курьер выехал, ожидайте сегодня».
- **8e Pickup reminders** (только для ПВЗ): за 24 часа до конца срока хранения.

На каждом подшаге:

- Email клиенту по матрице §3.
- Twenty: `Activity: Status update` с трек-номером и event-payload.
- Messenger клиенту на критичных подшагах (8a с треком, 8d, 8e) — после реализации спеки 050.

**Семантика эмита `shipment.*` событий** (FR-118 в 047):
- Каждое доменное событие `shipment.*` эмитится **один раз на каждый первый переход** в новый internal status. Если webhook ApiShip пришёл с тем же internal status, что уже в `shipment.status`, — событие не эмитится повторно.
- В `shipment.events[]` для аудита запись добавляется в любом случае (для трассировки порядка webhook'ов).

### Phase 9 — Delivered

- Webhook ApiShip «вручён» или менеджер вручную.
- `Order.status = delivered`, `Order.deliveredAt = now()`.
- Twenty: `Opportunity.stage = Delivered` (внутренний sub-stage Won), `Activity: Delivered`.
- Email клиенту: «Ваш заказ доставлен. Сохраните чек».
- DataLayer: `delivery_complete`.

### Phase 10 — Closure

- Через `closureWindowDays` дней (по умолчанию **14** — соответствует периоду возврата по ст. 26.1 «Закон о защите прав потребителей» при дистанционной торговле; для юрлица — по договору) после `delivered` без споров/возвратов → `Order.status = completed`, `Order.closedAt = now()`.
- Twenty: `Opportunity.stage = Won.Closed`, deal архивируется.
- Email клиенту: NPS-опрос или просьба об отзыве (`T-008`).
- DataLayer: `order_closed`.

### Phase 11 — Post-sale

- Запрос отзыва (по согласию).
- Повторная продажа: триггеры для CRM (Twenty Workflows) — повторный заказ через N месяцев.
- Аналитика: cohort-метрики, LTV.

## 2. State machine

### 2.1 `orders.status`

```text
draft → pending_payment ─┬─→ paid → fulfilling → shipped → delivered → completed
                         │                                                ▲
                         │                                                │
                         └─→ cancelled / expired                          │
                                                                          │
awaiting_payment ──→ paid (manual) ──→ fulfilling ─────────────────────────┘
                  │
                  └─→ expired
```

Правила переходов и кто инициирует:

| from → to | Триггер | Кто |
|---|---|---|
| `draft → pending_payment` | submit checkout (физлицо) | сайт |
| `draft → awaiting_payment` | submit invoice (юрлицо) | сайт |
| `pending_payment → paid` | webhook ЮKassa | платёжный провайдер |
| `pending_payment → pending_payment` (retry) | клиент жмёт «Оплатить снова» в окне `paymentRetryWindowMin` | сайт |
| `pending_payment → expired` | истёк `paymentRetryWindowMin` без оплаты | cron |
| `awaiting_payment → paid` | менеджер ставит флаг «оплачен» | менеджер |
| `paid → fulfilling` | менеджер «Создать отправление» (US3) | менеджер/автомат |
| `fulfilling → shipped` | webhook ApiShip → in_transit (см. apiship-events.md) | ApiShip |
| `shipped → delivered` | webhook ApiShip → delivered | ApiShip |
| `delivered → returned` | webhook ApiShip → returned (посылка вернулась к отправителю) | ApiShip |
| `delivered → completed` | автомат через `closureWindowDays` при `disputeFlag=false` | cron |
| `delivered/completed → returned` | клиент инициировал возврат в окне 14 дней; менеджер вручную | менеджер |
| `* → cancelled` | менеджер или клиент до отгрузки | менеджер |
| `awaiting_payment → expired` | автомат через `invoiceExpiresDays` (по умолчанию 5 банковских дней) | cron |

Запрещённые переходы:
- `completed → *` — только через явное «Реоткрыть сделку» (FR-905), пишется в AdminChangeLog. **Исключение (053)**: `completed → delivered` разрешён при `reopenAuthorized = true` (менеджер инициирует возврат в окне 14 дней после закрытия).
- `delivered → shipped` (понижение) — блокируется hook'ом.
- `cancelled → *` — только через «Восстановить заказ» (отдельный flow, не в MVP).

Невозможные обратные переходы блокируются Payload-hook'ом (`Orders.beforeChange`).

### 2.2 `orders.shipment.status`

См. `specs/047-delivery-checkout-apiship/data-model.md §2.2`.
Ранги для защиты от out-of-order: `none < pending < created < pending_label < in_transit < at_point < delivered`; терминальные: `cancelled`, `returned`, `error`.

### 2.3 Twenty `Opportunity.stage`

```text
New → Discovery → Quote → Negotiation → Won → Won.Closed
                                          │
                                          ├→ Won.Refunded        (053: полный возврат)
                                          ├→ Won.PartialRefund   (053: частичный возврат)
                                          │
                                Lost (вне сделки, ручной перевод)
```

Маппинг `orders.status` ↔ `Twenty.opportunity.stage`:

| orders.status | Twenty stage | Twenty closeDate | Notes |
|---|---|---|---|
| `draft` | `New` (создаётся, когда есть `Person`) | — | оптимистично |
| `pending_payment` / `awaiting_payment` | `Quote` | tentative | |
| `paid` | `Negotiation` → `Won` | дата оплаты | trigger workflow «оплачен» |
| `fulfilling` | `Won` (sub: `In fulfillment`) | дата оплаты | |
| `shipped` | `Won` (sub: `In transit`) | дата оплаты | |
| `delivered` | `Won` (sub: `Delivered`) | дата оплаты | |
| `completed` | `Won.Closed` | дата оплаты | архив |
| `cancelled` | `Lost` (reason: `Cancelled by customer/manager`) | — | |
| `expired` | `Lost` (reason: `Invoice expired`) | — | |

Twenty не имеет нативных sub-stages в Opportunity (на 2026-05). Реализуем через дополнительное поле `fulfillmentStage` (Select) на `Opportunity`. Подробности — в spec 048.

## 3. Уведомления — матрица

Условные обозначения:

- **Каналы**: `Email`, ~~`SMS`~~ **`Messenger`** (placeholder для спеки 050), `AdminUI` (бейдж/нотификация в Payload), `CRM` (Twenty Activity/Task), `DataLayer` (GA/Яндекс).
- **Получатель**: `Customer`, `Manager`, `Owner` (для критических ошибок).

| Event | Customer Email | Customer Messenger (050) | Manager | CRM Activity | DataLayer | Шаблон |
|---|---|---|---|---|---|---|
| `cart.abandoned` (опц.) | T-010 (через 1 ч) | — | — | — | `cart_abandoned` | T-010 |
| `order.created` (юрлицо, счёт выставлен) | T-002 «Счёт PDF» | — | T-102 «Новый счёт» | `Invoice issued` | `generate_invoice` | T-002 |
| `order.paid` | T-001 «Оплата получена» | M-001 (после 050) | T-101 | `Payment received` | `purchase` | T-001 |
| `shipment.created` (трек получен) | T-003 «Заказ отправлен. Трек: …» | M-003 (после 050) | — | `Shipped, track: …` | `shipment_created` | T-003 |
| `shipment.in_transit` | — | — | — | `In transit` (silent) | `shipment_in_transit` | — |
| `shipment.at_point` (ПВЗ) | T-004 «Заказ прибыл в ПВЗ … Заберите до DD.MM» | M-004 (после 050) | — | `Arrived at point` | `shipment_at_point` | T-004 |
| `shipment.courier_today` | T-006 «Курьер сегодня к XX:YY» | — | — | `Out for delivery` | `out_for_delivery` | T-006 |
| `shipment.pickup_reminder_24h` | T-007 «Напоминание: до DD.MM» | — | — | `Pickup reminder` | `pickup_reminder` | T-007 |
| `shipment.delivered` | T-005 «Доставлено» | M-005 (после 050) | — | `Delivered` | `delivery_complete` | T-005 |
| `order.completed` (sделка закрыта) | T-008 «Спасибо! Оцените» | — | — | `Closed` | `order_closed` | T-008 |
| `shipment.error` | — | — | T-103 «Ошибка ApiShip» | `Error` | `shipment_error` | T-103 |
| `order.stuck` (>N дней в статусе) | — | — | T-104 «Заказ застрял» | `Stuck alert` | — | T-104 |
| `order.cancelled` | T-009 «Заказ отменён» | — | T-105 | `Cancelled` | `order_cancelled` | T-009 |
| `cart.abandoned` (052) | T-010 (через 1 ч, requires marketingOptIn) | M-010 (после 050) | — | — | `cart_abandoned` | T-010 |
| `cart.converted` (052) | — | — | — | — | `cart_converted` | — |
| `cart.recovered` (052) | — | — | — | — | `cart_recovered` | — |
| `return.created` (053) | — | — | T-106 «Новый возврат» | `Return created` | — | T-106 |
| `return.approved` (053) | T-011 «Возврат одобрен» | — | — | `Return approved` | — | T-011 |
| `return.rejected` (053) | T-012 «Возврат отклонён» | — | — | — | — | T-012 |
| `return.refunded` (053) | T-013 «Средства возвращены» | — | T-107 | `Return refunded` | — | T-013 |
| `return.overdue` (053) | — | — | T-108 «Возврат просрочен» | — | — | T-108 |
| `order.returned` (053) | T-014 «Заказ полностью возвращён» | — | — | `Order returned` | — | T-014 |

> **Messenger** (замена SMS, решение Q2): Шаблоны M-001/M-003/M-004/M-005/M-010 — placeholder, реализуются в спеке 050.

Правила:

- Каждое уведомление пишется в `Order.notifications[]` (см. data-model 047 §2.3) для идемпотентности и аудита.
- Отдельный канал «Telegram-бот менеджера» можно добавить отдельной спекой 050, но он не обязателен для MVP.
- Клиент может отключить messenger / маркетинговые письма в личном кабинете (вне MVP; на старте — флаг согласия в форме чекаута).
- Email-уведомления отправляются через единый провайдер (выбор: Mailgun / Postmark / SendPulse — решение в 049-customer-notifications).
- Messenger — через Telegram bot / MAX / VK Messages (реализация в спеке 050).

## 4. Twenty CRM Sync

### 4.1 Объекты Twenty, которые мы используем

- **Company** — юрлицо-покупатель; для физлиц — не создаётся.
- **Person** — контакт (физлицо или контактное лицо юрлица).
- **Opportunity** — сделка (1 заказ = 1 opportunity).
- **Note** — снимки переписки / счёт PDF / артефакты.
- **Task** — менеджеру: «Обработать отправление», «Связаться с клиентом», «Напоминание о просроченном счёте».
- **Activity** (timeline events) — события жизненного цикла.

### 4.2 Маппинг полей

```text
Soliton                          Twenty
─────────────────────────────────────────────────────────────────
Order.id                  →     Opportunity.externalId (custom)
Order.publicToken         →     Opportunity.externalToken (custom)
Order.customer.email      →     Person.emails[0]
Order.customer.phone      →     Person.phones[0]
Order.customer.fullName   →     Person.name (split into first/last)
Order.customer.companyName→     Company.name
Order.customer.inn        →     Company.taxId (custom)
Order.customer.kpp        →     Company.kpp (custom)
Order.totals.total        →     Opportunity.amount
Order.status              →     Opportunity.stage  (см. §2.3)
Order.delivery.cost       →     Opportunity.shippingCost (custom)
Order.delivery.providerKey→     Opportunity.shippingProvider (custom)
Order.shipment.trackingNumber → Opportunity.trackingNumber (custom)
Order.shipment.trackingUrl→     Opportunity.trackingUrl (custom)
Order.items[]             →     N/A в Twenty (хранится в Note `Items snapshot`)
Order.delivery.address    →     Opportunity.shippingAddress (custom long text)
```

Кастомные поля создаются один раз при онбординге Twenty (миграция через Twenty API).

### 4.3 Направления синхронизации

- **Soliton → Twenty** (обязательно): создание/апдейт `Person`, `Company`, `Opportunity`, добавление `Activity` на каждое событие, создание `Task` для менеджера на критичных переходах.
- **Twenty → Soliton** (опционально, фаза 2): webhook от Twenty при ручном изменении stage менеджером (например, поставил `Lost`) — синхронизируем обратно `orders.status = cancelled`. На MVP — read-only из Twenty.

### 4.4 Способ интеграции

- API: **Twenty GraphQL API** (`/graphql`) + REST для health-check.
- Авторизация: API key в env `TWENTY_API_KEY`, Bearer-токен в заголовке.
- Очередь: внутренняя очередь Payload (`crm-sync-jobs` collection или Vercel Queue / pg_cron). Шаг 1 — отправить событие; шаг 2 — `success` или `retry` (макс. 5 попыток, экспоненциальный backoff).
- Идемпотентность: ключ `{orderId}:{eventType}:{at}`; при ретрае Twenty по `externalId` обновляет существующую запись, а не создаёт дубль.
- Локально: Twenty self-hosted (Docker) для разработки; в проде — managed (twenty.com cloud) или собственный self-host.

### 4.5 Workflows в Twenty

Настраиваются в UI Twenty (no-code), но описаны здесь как требование:

- При `Opportunity.stage = Quote` → задача менеджеру «Проверить заказ».
- При `Opportunity.stage = Won` и `fulfillmentStage = Paid` → задача «Создать отправление».
- При `Opportunity.stage = Won.Delivered` через 14 дней → задача «Закрыть сделку».
- При `Opportunity.stage = Lost` → задача «Связаться с клиентом, узнать причину».

## 5. Snapshot цены и обработка расхождений

### 5.1 Snapshot

- При клике «К оплате» (Phase 6) на сервере выполняется finalize:
  1. Re-вызов `provider.calculate()` с тем же `cartId` и адресом.
  2. Поиск выбранного тарифа в свежем ответе по `(providerKey, tariffId, deliveryType, pickupType)`.
  3. Если найден — сравниваем цену:
     - `delta = |new - old|`
     - Если `delta ≤ max(5%, 100 ₽)` → принимаем старую цену, snapshot записан.
     - Иначе → возвращаем `409 PRICE_CHANGED` с обоими значениями.
  4. Если тариф пропал (например, провайдер отключил его) → `409 RATE_UNAVAILABLE`, клиент выбирает заново.
- Snapshot сохраняется в `Order.delivery.priceSnapshot`:

  ```ts
  {
    cost: number;               // финальная цена
    currency: "RUB";
    capturedAt: string;         // ISO
    sourceCacheKey: string;     // ключ кэша из которого взято
    refreshCheckAt: string;     // когда был finalize
  }
  ```

### 5.2 Поведение UI при расхождении

См. `screens.md` S11: модал с двумя ценами и кнопками «Принять новую» / «Сменить тариф» / «Отменить».

### 5.3 После старта оплаты

С момента создания платёжной сессии ЮKassa цена доставки **не меняется** до завершения сессии (`paid` / `canceled` / `expired`). Любой webhook от ApiShip с новой ценой игнорируется (не должен прийти на этой стадии — мы только калькулятор зовём).

## 6. Хэндофы между системами

```text
Customer browser → Next.js  (UI, корзина, чекаут)
Next.js          → Payload  (Order CRUD)
Next.js          → ApiShip  (calculate, points, validate-address)
Next.js          → ЮKassa   (create payment)
ЮKassa           → Next.js  (webhook /api/webhooks/yookassa)   # status → paid
Payload          → Next.js cron / queue (closure, reminders)
Payload          → Twenty   (CRM sync jobs)                    # async
Manager (Payload Admin) → ApiShip via Next.js admin routes     # create shipment
ApiShip          → Next.js  (webhook /api/webhooks/apiship)    # tracking
Notification job → Email provider (Mailgun и т.п.) / Messenger (050)
```

Каждая стрелка имеет:

- Транспорт (HTTPS).
- Аутентификация (secret / API key / HMAC).
- Идемпотентность.
- Логирование в `shipping-logs` или `notification-logs`.

## 7. SLA уведомлений

| Уведомление | SLA от события до доставки |
|---|---|
| Order paid → email клиенту | ≤ 1 минута |
| Order paid → Twenty Opportunity update | ≤ 5 минут |
| Shipment created → email клиенту | ≤ 2 минуты |
| Shipment at_point → email клиенту | ≤ 5 минут после webhook |
| Customer messenger (после релиза 050) | ≤ 2 минуты |
| Pickup reminder 24h | за 24 ± 2 часа до конца срока |
| Stuck alert менеджеру | первый раз через 24 часа после фиксации статуса; повтор каждые 24 часа |
| Closure → email клиенту | ≤ 1 час после автоперехода |
| CRM sync (`Soliton → Twenty`) | eventual ≤ 15 минут (с ретраями 5 раз) |

При непрохождении SLA — алерт в `notification-logs` со статусом `delayed`, и менеджеру в Payload (бейдж на заказе).

## 8. Идемпотентность и журнал

### 8.1 Order.notifications[]

Каждое отправленное уведомление пишется в массив:

```ts
{
  notificationId: string;    // uuid
  event: string;             // "order.paid", "shipment.at_point" ...
  channel: "email" | "messenger" | "crm" | "admin_ui" | "dataLayer";  // "sms" deprecated, replaced by "messenger" (050)
  template: string;          // "T-001"
  recipient: string;         // email / phone / user id / "crm:opportunityId"
  sentAt: string;            // ISO
  status: "queued" | "sent" | "failed" | "skipped";
  errorMessage?: string;
  externalRef?: string;      // id у провайдера (Mailgun message-id, SMSC id)
}
```

Перед отправкой — проверка: уже было `event+channel+recipient` за последние N часов? Если да — `skipped`.

### 8.2 CRM sync журнал

Отдельная коллекция `crm-sync-jobs`:

```ts
{
  jobId: string;
  orderId: string;
  event: string;
  payload: object;
  attempt: number;          // 0..5
  status: "queued" | "in_progress" | "success" | "failed";
  lastAttemptAt: string;
  nextAttemptAt: string;
  errorMessage?: string;
  twentyRef?: { opportunityId, personId, companyId };
}
```

## 9. Open Questions / Decisions Needed

### Закрыто 2026-05-23

| # | Вопрос | Решение |
|---|---|---|
| Q1 | Email-провайдер | ⏸ ещё не выбран; 047 stub работает в dry-run mode (FR-116) пока пусто. 049 — за feature-flag. |
| Q2 | Второй канал (замена SMS) | ✅ **Messenger** (Telegram/MAX/VK Messages) в спеке **050**. В 049 — placeholder-канал `messenger`. |
| Q3 | Twenty: self-host или cloud | ✅ **Self-host** (Docker, отдельный поддомен `crm.soliton.ru` или аналогичный). |
| Q4-карты | Карты в селекторе ПВЗ | ✅ **Яндекс.Карты v3 JS API**, ключ `YANDEX_MAPS_API_KEY`, обязательный баннер «© Я.Карты». |
| Q5-DaData | Нормализация адреса | ✅ **DaData** (Suggest + Clean API), server-side proxy, ENV `DADATA_API_KEY`/`DADATA_SECRET`. |

### Остаются открытыми

| # | Вопрос | Кому | Влияние |
|---|---|---|---|
| Q6 | `closureWindowDays` дефолт 14 — для всех типов заказов (физ/юр)? | владелец/юрист | 047 |
| Q7 | `invoiceExpiresDays` дефолт 5 — устраивает? | владелец | 037 |
| Q8 | Маркетинговые письма (отзыв/повторная продажа) — opt-in или opt-out? | владелец/юрист | 049 |
| Q9 | Кастомные поля в Twenty — финальный список (см. `048/contracts/twenty-fields.md`) | владелец/CRM | 048 |
| Q10 | DataLayer-события — финальный список и формат | маркетинг | analytics-measurement-spec |
| Q11 | Уведомления по «застрявшему» заказу — порог N дней по статусам | менеджмент | 047 |
| Q12 | Поддомен self-host Twenty | владелец/devops | 048 |
| Q13 | Email-аккаунт админа Twenty для первого логина | владелец | 048 |
| Q14 | Тарифный план Яндекс.Карт (free / commercial) | владелец | 047 |
| Q15 | Тариф DaData (free до 10k/сутки / starter / business) | владелец | 047 |
| Q16 | Финальный выбор email-провайдера (Postmark / Mailgun / SendPulse) | владелец | 047 stub + 049 |

## 10. Mapping в feature-спеки

| Раздел этого документа | Куда «оседает» в реализации |
|---|---|
| Phase 5 + §5 (snapshot) | **047** (FR-107..FR-112, US1) |
| Phase 6 (Review & confirm) | **047** (экран S10) + 037 (доработка checkout-страниц) |
| Phase 7 (Payment) | 037 + **047** webhook ЮKassa дёргает `emitDomainEvent` |
| Phase 8 (in transit + подшаги) | **047** (US3, US4) для шипмента; уведомления подшагов at_point/courier_today — **049** |
| Phase 9 (delivered) | **047** (US4) |
| Phase 10 (closure) | **047** (FR-901..FR-905, US7) + cron |
| §2.3 + §4 (CRM mapping) | **048-twenty-crm-sync** целиком (047 только `Order.crmRefs` schema) |
| §3 (матрица уведомлений) | **049-customer-notifications** целиком (047 только 4 шаблона stub: T-001/T-003/T-005/T-008) |
| §7 (SLA) | NFR во всех feature-спеках |
| §8 (журналы) | `notification-jobs` → 049; `crm-sync-jobs` → 048; `shipping-logs` → 047 |
| §6 (event emitter) | **047** (US8 — инфраструктура; источник событий для 048/049) |

## 11. Acceptance для всего lifecycle

Чек-лист для приёмки всего пакета:

- [ ] Клиент видит цену доставки до клика «К оплате».
- [ ] Цена доставки заморожена с момента finalize до окончания платёжной сессии.
- [ ] При расхождении цен пользователь явно подтверждает новую цену.
- [ ] Покупатель получает email на: оплата, отправлено (с треком), прибыло в ПВЗ, доставлено, сделка закрыта.
- [ ] Для ПВЗ-тарифов есть напоминание за 24 часа до конца хранения.
- [ ] Менеджер получает алерт при `shipment.error` и при «застрявшем» заказе.
- [ ] Все ключевые события отображены в Twenty как Activity на Opportunity.
- [ ] Каждое уведомление журналируется, дубли отсекаются.
- [ ] Через 14 дней после `delivered` сделка автоматически становится `completed`.
- [ ] Twenty Opportunity.stage отражает текущий orders.status (см. §2.3).
- [ ] При сбое Twenty покупка/доставка не блокируются (eventual consistency).
- [ ] Все каналы отписки (email/messenger) работают.

## 13. Идентификаторы и связи сущностей

Этот раздел — карта всех идентификаторов системы и связей между сущностями, нужная для дебага и интеграций. Расширяется спеками 051–054.

### 13.1 Карта сущностей (current + planned)

| Сущность | Где живёт | Статус | Главный id | Бизнес-номер | Спека |
|---|---|---|---|---|---|
| **Cart** | localStorage / cookie | сейчас | cartToken (`cart_lqx9k_a7b3c2`) | — | → **052** выделяет в `carts` collection |
| **Order** | coll. `orders` | есть | `id` (integer) | `publicToken` (16-hex) | + **051** добавляет `clientNumber` (`SO-2026-0142`) |
| **Customer** | встроен в `Order.customer` | сейчас (guest) | — | — | → **054** выделяет в `customers` collection |
| **Company** | встроен в `Order.customer.companyName/inn` | сейчас | — | ИНН | → **054** выделяет в `companies` |
| **Payment** | встроен в `Order.payment` | встроен | `payment.providerRef` | — | future |
| **Delivery / Shipment** | встроен в `Order.delivery`, `Order.shipment` | встроен | `shipment.providerOrderId` (ApiShip) | `shipment.trackingNumber` | (future split) |
| **Invoice** | встроен в `Order.invoice` | встроен | `invoice.number` | `invoice.number` | (future credit memos) |
| **Return** | — | нет | — | — | → **053** создаёт `returns` collection с `returnNumber` (`RT-2026-0007`) |
| **Notification job** | coll. `notification-jobs` | есть | `notificationId` | — | 049 |
| **CRM sync job** | coll. `crm-sync-jobs` | есть | `jobId` | — | 048 |
| **Shipping calc cache** | coll. `shipping-calculations` | есть | `key` | — | 047 |
| **Shipping log** | coll. `shipping-logs` | есть | id | — | 047 |
| **Admin change log** | coll. `admin-change-log` | есть | id | — | 016 |

### 13.2 Внешние ID (привязка к третьим системам)

| Внешняя система | Поле в Order | Формат | Назначение |
|---|---|---|---|
| ЮKassa | `payment.providerRef` | UUID `2dbdbeb6-...` | Поиск платежа в ЛК ЮKassa |
| ЮKassa Refund | `Return.refundProviderRef` (053) | UUID | Поиск возврата в ЛК ЮKassa |
| ApiShip | `shipment.providerOrderId` | int `998877` | Поиск заказа в ЛК ApiShip |
| ApiShip Tariff | `delivery.tariffId` | int `1058` | Какой тариф выбрали |
| ApiShip Pickup point | `delivery.pointId` | string `MSK001` | Какой ПВЗ выбрали |
| Carrier (СДЭК, Boxberry...) | `shipment.trackingNumber` | string `1078234567` | Передаётся клиенту, показывается в email/UI |
| DaData | `delivery.addressNormalized.kladrId`, `fiasId` | string | Стабильный идентификатор адреса |
| Twenty | `crmRefs.opportunityId`, `personId`, `companyId` | UUID | Привязка к CRM-сущностям |
| Email provider | `notifications[].externalRef` | provider message-id | Поиск письма у провайдера для bounce/delivery-проверок |
| Cart (после 052) | `Order.cartId` | UUID | Откуда конверсия (анализ funnel) |
| Customer (после 054) | `Order.customerId`, `Order.companyId` | UUID | Группировка заказов под одним покупателем |

### 13.3 Главный correlation hub

`Order.id` — точка, из которой видно **всё**:

```
Order.id = 142
  ├─ publicToken  → URL для клиента
  ├─ clientNumber → SO-2026-0142 (после 051) ─→ диктуется по телефону, в email, в Twenty
  ├─ cartId        → исходная корзина        (после 052)
  ├─ customerId    → история покупок         (после 054)
  ├─ payment.providerRef    → ЮKassa
  ├─ shipment.providerOrderId → ApiShip
  ├─ shipment.trackingNumber → перевозчик
  ├─ crmRefs.opportunityId   → Twenty
  └─ Order.id используется как FK в:
       ├─ notification-jobs (1:N)
       ├─ crm-sync-jobs     (1:N)
       ├─ shipping-logs     (1:N)
       └─ returns           (1:N, после 053)
```

### 13.4 Сценарии поиска для саппорта

1. **«Клиент звонит по номеру SO-2026-0142»** → после 051: `payload.find({collection:"orders", where:{clientNumber:{equals}}})`.
2. **«Клиент пишет с email, номера не помнит»** → `where: {"customer.email": {equals}}` → список заказов.
3. **«ЮKassa прислала webhook с payment_id»** → `where: {"payment.providerRef": {equals}}`.
4. **«Перевозчик прислал трек 1078234567»** → `where: {"shipment.trackingNumber": {equals}}`.
5. **«Менеджер в Twenty хочет в Soliton»** → Opportunity.externalId = Order.id → прямой переход в Payload Admin.
6. **«Где письмо потерялось»** → `notification-jobs.orderId = X` + `notifications[].externalRef` → у Postmark/Mailgun.

### 13.5 Иммутабельность после `paid` (FR-110, расширяется в 051)

После статуса `paid` нельзя менять:
- `items[]` (snapshot позиций)
- `totals.snapshot*` (subtotal/vat/deliveryCost/total)
- `delivery.priceSnapshot`
- `customer.email` (используется для линковки с Customer/Twenty)
- `clientNumber` (после 051)

Изменения **только** через явные операции (refund / partial-cancel / re-issue), каждая из которых пишет в audit-log.

## 14. Эволюция: от aggregate к разделению

Текущий «Order как агрегат с встроенным customer/payment/delivery/shipment» — это валидный DDD-паттерн. Выделение в отдельные сущности оправдано только когда:

| Сущность выделяется | Триггер выделения |
|---|---|
| **Cart** → coll. (052) | Появляется потребность в cart-abandonment / cross-device sync. |
| **Return** → coll. (053) | Первый реальный возврат через ЮKassa Refund API. |
| **Customer / Company** → coll. (054) | Личный кабинет, история заказов, B2B-роли. |
| **Shipment** → coll. (future) | Split-доставка с двух складов или несколько посылок на заказ. |
| **Payment** → coll. (future) | Multi-payment (предоплата + остаток), credit balance, invoice-payments. |
| **Invoice / CreditMemo** → coll. (future) | Полноценный налоговый учёт (УПД, корректировочные счёт-фактуры). |

**Принцип**: YAGNI. Не выделяем сущность пока нет конкретного use-case.

## 12. История изменений

- 2026-05-23 — первая редакция. Покрывает: state machine, notification matrix, Twenty CRM mapping, snapshot цены. Привязка к 047. Open questions Q1–Q10 ожидают ответа владельца.
- 2026-05-23 — добавлены §13 (идентификаторы и связи) и §14 (эволюция). Ссылки на планируемые спеки 051–054.
