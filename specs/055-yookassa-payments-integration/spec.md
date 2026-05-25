# Feature Specification: ЮKassa Payments Integration (purchase + refund alignment)

**Feature Branch**: `055-yookassa-payments-integration`

**Created**: 2026-05-24

**Status**: Draft (Speckit Phase: **/specify**)

**Input**: Платёжный шлюз для checkout физлиц (US1 в 037) и юрлиц-картой нужно подключить к реальной ЮKassa. Сейчас в коде есть только `yookassa-refunds.ts` (053) и mock-webhook без проверки подписи. Стартовать MVP без рабочего захвата средств нельзя. Спека закрывает полный жизненный цикл платежа: создание → ожидание → захват → подтверждение → возврат — и приводит в соответствие 037/047/051/053 с реальным API ЮKassa.

---

## 0. Терминология и связанные документы

**ЮMoney vs ЮKassa.** В обиходе «ЮMoney» иногда означает всю группу продуктов, иногда — кошелёк yoomoney.ru. В коде и в этой спеке **ЮKassa (yookassa.ru)** — это merchant-шлюз, который мы подключаем. YooMoney-кошелёк появляется только как один из `payment_method` у ЮKassa, не как отдельный провайдер.

**Канонические внешние документы:**

- ЮKassa API reference: <https://yookassa.ru/developers/api>
- Webhooks + IP-allowlist: <https://yookassa.ru/developers/using-api/webhooks>
- Чек 54-ФЗ: <https://yookassa.ru/developers/54fz>
- Двухстадийная оплата: <https://yookassa.ru/developers/payment-acceptance/scenario-extensions/capture-payment>
- СБП через ЮKassa: <https://yookassa.ru/developers/payment-acceptance/integration-scenarios/payment-methods/sbp>

**Канонические внутренние документы:**

- `07-build-specifications/order-lifecycle-spec.md` §Phase 7, §3 (state machine), §6 (handoffs)
- `07-build-specifications/crm-integration-pattern.md` (email-policy contract: transactional emails ALWAYS из сервиса)
- `apps/web/src/collections/Orders.js` — `payment.{method,providerStatus,providerRef,paidAt,amount,refunds[],payerBankDetails}`
- `specs/037-cart-and-checkout-flows/` — US1 физлицо/карта, US2 юрлицо/счёт (счёт не через ЮKassa)
- `specs/047-delivery-checkout-apiship/` — finalize-shipping, priceSnapshot, emit `order.paid`
- `specs/051-order-numbering-and-immutability/` — `wasEverPaid`, immutability оплаченных полей
- `specs/053-returns-and-refunds/` — уже использует `yookassa-refunds.ts`; webhook `refund.succeeded` сейчас НЕ обрабатывается
- `specs/052-cart-as-entity/` — конверсия Cart→Order **до** редиректа на ЮKassa
- `specs/054-customer-account/` — будущие saved payment methods (вне scope MVP)

---

## 0.1. Clarifications (зафиксированные решения)

**Начальный раунд** (до /clarify, при /specify):

| # | Вопрос | Решение | Источник |
| --- | --- | --- | --- |
| Q1 | Какой провайдер интегрируем? | **ЮKassa (merchant API)**. YooMoney-кошелёк — как один из `payment_method` ЮKassa. | Owner, 2026-05-24 |
| Q2 | Capture mode? | **Настраиваемый через глобал** `paymentSettings.captureMode` ∈ {`one_stage`, `two_stage`}, default `two_stage`. | Owner, 2026-05-24 |
| Q3 | Методы оплаты в MVP? | **Карта + СБП** (`bank_card`, `sbp`). YooMoney-кошелёк / Сбер-онлайн — Phase 2. | Owner, 2026-05-24 |
| Q4 | B2B-сценарий «выписать счёт» — через ЮKassa или вне её? | **Вне ЮKassa.** US2 037 — генерация PDF-счёта + ручное подтверждение поступления менеджером (статус `awaiting_payment` → `paid` admin-action). ЮKassa не задействован. | Принято из 037/047 lifecycle |
| Q5 | Чек 54-ФЗ при оплате формирует ЮKassa или мы? | **ЮKassa.** Передаём `receipt` объект в `POST /v3/payments` (auto-mode), фискализация — на стороне ЮKassa через подключённую онлайн-кассу. Атомика и фискализация чека коррекции при возврате — то же (см. §6, §7). | Принято: 053 уже опирается на эту модель |
| Q6 | Кто шлёт email о подтверждении оплаты? | **Сервис (049).** ЮKassa-уведомления покупателю в её ЛК — отключаем в настройках. Транзакционные письма — единственно из 049 (CRM-pattern contract). | crm-integration-pattern.md |
| Q7 | Что делать при mismatch суммы webhook vs Order? | **Reject + alert.** Не обновляем статус, эмитим `payment.amount_mismatch`, уведомляем менеджера через 049. Заказ остаётся в `pending_payment` для ручного разбора. | Безопасность; см. §8 FR-5530 |

**Раунды /clarify** (2026-05-24):

| # | Вопрос | Решение | Раунд |
| --- | --- | --- | --- |
| OQ-1 | `tax_system_code` для receipt 54-ФЗ | **`1` — ОСН** (основная система). В чеке нужен НДС 22% по каждой позиции (ФЗ-425 от 01.01.2026, см. OQ-3a). | R1 |
| OQ-2 | Подключена ли онлайн-касса к ЮKassa? | **Да, подключена.** FR-5540..5546 включаются в MVP. | R1 |
| OQ-3 | Добавлять `vatCode` в Products? | **Отложить на Phase 2.** В MVP — hardcoded `paymentSettings.defaultVatCode`. См. OQ-3a + §13 Assumptions. | R1 |
| OQ-3a | Как хранятся цены и какой vat_code в чеке? | **Цены ВКЛЮЧАЮТ НДС 22%** → `vat_code=12` (22/122 расчётная, действует с 01.01.2026 по ФЗ-425 от 28.11.2025). Default для всех товаров в MVP. См. §6 и FR-5544 для legacy-fallback. | R2 + R4 (НДС-correction) |
| OQ-4 | `paymentRetryWindowMin` | **60 минут** (default). Owner может изменить через `paymentSettings`. | R2 |
| OQ-5 | UTM в `payment.metadata` ЮKassa? | **Да, передаём.** Snapshot UTM из cookies/Cart.metadata в момент create-payment. | R3 |
| OQ-6 | Хранить ли masked card data? | **Да, полный snapshot**: `first6`, `last4`, `expiryMonth`, `expiryYear`, тип карты, имя бренда. PCI-DSS это разрешает. Видно покупателю в `/me/orders`. | R2 |
| OQ-7 | Тарифный план ЮKassa? | **Базовый/Стандарт.** СБП включён, можно использовать в MVP. | R1 |
| OQ-8 | Webhook URL? | **`https://pdumarket.ru/api/payment/yookassa/webhook`** (prod), staging — `https://staging.pdumarket.ru/...`, dev — ngrok-туннель. | Уточнено по умолчанию |
| OQ-9 | Что делать при capture failure (5xx) ПОСЛЕ auth? | **Retry от cron** с exponential backoff (1мин→5мин→15мин→1ч→6ч). До истечения 7-дневного hold'a у ЮKassa можем повторять. После 7д — alert + cancel auth. | R2 |
| OQ-10 | Что делать при amount_mismatch? | **Read-only алёрт.** Order остаётся в `pending_payment`, эмит `payment.amount_mismatch`, менеджер вручную отвечает покупателю + отменяет платёж в ЛК ЮKassa. Никаких auto-actions в MVP. | R3 |
| OQ-11 | Email или phone в `receipt.customer`? | **Email приоритет, phone fallback.** Если customer ввёл оба — отправляем `email`. Если только phone — отправляем `phone`. SMS-чек не используем (доп.комиссия). | R3 |
| OQ-12 | Test environment для /implement? | **Отдельный test-shop ЮKassa** (sandbox). Owner создаёт sandbox-магазин в ЛК ЮKassa, отдаёт shopId/secretKey для staging. Webhook URL — staging.pdumarket.ru. | R3 |

---

## 1. Текущее состояние (verification of "что у нас сейчас")

### 1.1. Что есть в коде

- `apps/web/src/lib/payments/yookassa-refunds.ts` — REST-adapter для `POST /v3/refunds`, basic-auth, idempotency, 10s timeout, prod-stub-forbidden. ✅ Готово к prod (053).
- `apps/web/src/app/api/payment/yookassa/webhook/route.ts` — **mock-stub**, принимает POST, ищет Order по `payment.providerRef`, переключает статус. **Проблемы:**
  - ❌ Нет проверки подписи / IP-allowlist.
  - ❌ Нет идемпотентности (повторный webhook повторно обновит Order).
  - ❌ Нет валидации суммы (mismatch-атака).
  - ❌ Обрабатывает только 4 статуса (`none|pending|succeeded|canceled`) без `waiting_for_capture` (нужен для two-stage).
  - ❌ Не обрабатывает `refund.succeeded` (053 шлёт refund-запрос, но webhook не закрывает loop).
  - ❌ Не эмитит доменное событие — Order меняется напрямую, минуя `emitDomainEvent`.
  - ✅ Есть `YOOKASSA_MOCK_DISABLED` env-flag — пригодится для prod-gate.
- `apps/web/src/collections/Orders.js` `payment` group:
  - ✅ Поля для текущей модели: `method`, `providerStatus`, `providerRef`, `paidAt`, `amount`, `refunds[]`, `payerBankDetails`.
  - ❌ Нет `confirmationUrl` (куда редиректить покупателя), `confirmationData` (для SBP-QR), `idempotenceKey` (для retry create-payment), `capturedAt`, `capturedAmount`, `paymentMethodSnapshot` (что было выбрано: карта/СБП/YooMoney).
  - ❌ Нет `webhookEvents[]` для observability (история всех событий от ЮKassa по этому заказу).

### 1.2. Чего нет вообще

| Gap | Влияние | Спек закрывает в US |
| --- | --- | --- |
| Endpoint `POST /api/payment/yookassa/create` | Без него Order остаётся в `pending_payment` навсегда. Покупатель не доходит до ЮKassa. | **US1** |
| Receipt-объект 54-ФЗ в `create payments` | Нарушение 54-ФЗ при первой же оплате. Штраф ≥10 тыс ₽. | **US1** (FR-5540) |
| Webhook signature verification | Mismatch-/replay-атаки. **Блокер для prod.** | **US3** |
| Idempotency на webhook (event-id dedup) | Двойная фиксация оплаты → двойной email клиенту, кривая аналитика. | **US3** |
| Two-stage capture (`POST /v3/payments/{id}/capture`) | Outage захвата → out-of-stock сценарии не безопасны. | **US2** |
| Refund webhook handling | 053 шлёт refund → не знает, succeeded ли. `Returns.status` застревает в `refund_pending`. | **US4** |
| `paymentSettings` global | Хардкод env-vars vs runtime-конфиг. Owner не может сменить captureMode без deploy. | **US5** |
| `PaymentEvents` коллекция | Невозможно расследовать спорный платёж — нет журнала webhook'ов. | **US6** |
| Cron auto-expire застрявших `pending_payment` orders | Cart восстанавливается (052), но Order остаётся в `pending_payment`. | **US7** |

### 1.3. Cross-spec inconsistencies (что нужно подкрутить)

- `order-lifecycle-spec.md` §Phase 7 говорит «webhook ЮKassa дёргает `emitDomainEvent`» — но текущий webhook этого НЕ делает. После спеки 055 — должен начать делать.
- 053 `repository.ts` `maybeMarkOrderReturned` корректно сравнивает kopecks (после C1 fix), но рассчитывает на то, что `payment.amount` приходит в рублях. Спека 055 фиксирует: `payment.amount` — **в рублях с 2 знаками** (как ЮKassa), `payment.refunds[].amount` — **в копейках** (как было). Расхождение задокументировать.
- 047 emit `order.paid` пока эмитится из admin-action / mock-webhook; после 055 — только из реального webhook (или admin override через `wasEverPaid` guard).

---

## 2. User Scenarios & Testing

### User Story 1 — Физлицо платит картой через ЮKassa (Priority: P1)

Покупатель добавил PDU в корзину, ввёл контакты + адрес (047), нажал «К оплате» на /cart/review. Сервис создаёт Order в статусе `pending_payment` (или конвертирует Cart в Order через 052), вызывает ЮKassa `POST /v3/payments` с двухстадийной авторизацией и receipt-объектом 54-ФЗ, получает `confirmation_url`, редиректит покупателя на ЮKassa-страницу. Покупатель вводит данные карты на стороне ЮKassa (PCI-DSS scope полностью у них), 3DS-проверка проходит, возвращается на success-страницу. Через ≤5 секунд приходит webhook `payment.waiting_for_capture` → сервис проверяет наличие на складе → вызывает `POST /v3/payments/{id}/capture` → webhook `payment.succeeded` → Order переходит в `paid`, эмитится `order.paid`, 049 шлёт письмо «Оплата получена».

**Why this priority**: Без рабочей оплаты картой сайт не закрывает US1 спеки 037 — основной e-commerce-сценарий. Это блокер запуска MVP.

**Independent Test**: На ЮKassa test-shop (тестовые карты) пройти полный flow от `/cart/review` → ЮKassa → возврат → webhook → `paid` → проверить, что в Order заполнены `paidAt`, `providerRef`, `amount`, `paymentMethodSnapshot=card`. Письмо ушло, событие `order.paid` в `domainEvents` журнале.

**Acceptance Scenarios**:

1. **Given** Order в `pending_payment` со снапшотом цены (047), **When** покупатель нажимает «Оплатить картой», **Then** POST `/api/payment/yookassa/create` создаёт ЮKassa-платёж с `capture=false` (two-stage), сохраняет `providerRef` + `confirmationUrl`, редиректит на ЮKassa.
2. **Given** оплата успешна на ЮKassa, **When** приходит webhook `payment.waiting_for_capture`, **Then** сервис верифицирует подпись + IP + amount, эмитит `payment.authorized`, инициирует capture через `POST /v3/payments/{id}/capture` с тем же amount.
3. **Given** capture успешен, **When** приходит webhook `payment.succeeded`, **Then** Order переходит `pending_payment → paid`, `wasEverPaid=true`, `paidAt` фиксируется, эмитится `order.paid`, 049 шлёт «Оплата получена».
4. **Given** покупатель закрыл вкладку, **When** webhook `payment.canceled` приходит через TTL ЮKassa (или истёк `paymentRetryWindowMin`), **Then** Order переходит `pending_payment → expired` (или `cancelled` по причине), cart восстанавливается (052), эмитится `payment.canceled`.
5. **Given** webhook повторяется (replay из ЮKassa), **When** второй POST с тем же `event_id`, **Then** сервис отвечает 200 OK без повторного обновления Order, инкрементируется `PaymentEvents.duplicateCount`.

---

### User Story 2 — Покупатель платит через СБП (QR-код) (Priority: P1)

Покупатель на ЮKassa-странице выбирает «Оплатить через СБП», ЮKassa возвращает `confirmation_data` с QR-кодом. Покупатель сканирует, оплачивает в банк-приложении, ЮKassa получает push → шлёт сервису `payment.succeeded` (для СБП ЮKassa использует one_stage даже когда наш captureMode=two_stage — это особенность СБП). Order → `paid`.

**Why this priority**: В 2025+ СБП занимает 30-40% e-commerce-расчётов. Без него теряем треть конверсии.

**Independent Test**: На ЮKassa test-shop включить СБП, в тестовом банк-приложении подтвердить QR, проверить, что Order → `paid` без шага capture (СБП одностадийный).

**Acceptance Scenarios**:

1. **Given** Order в `pending_payment`, **When** покупатель выбирает СБП на ЮKassa, **Then** ЮKassa отдаёт `confirmation_url` (страница с QR) и не отправляет `waiting_for_capture` — сразу `succeeded` после оплаты.
2. **Given** webhook `payment.succeeded` для СБП-платежа, **When** сервис проверяет `payment_method.type=sbp`, **Then** пропускает шаг capture, переходит в `paid` напрямую, сохраняет `paymentMethodSnapshot.type=sbp`.
3. **Given** покупатель не отсканировал QR за 20 минут (TTL ЮKassa-сессии СБП), **When** приходит `payment.canceled`, **Then** Order переходит в `expired`.

---

### User Story 3 — Webhook от ЮKassa защищён от подделки (Priority: P1)

Любой webhook от ЮKassa проходит три уровня проверки: (а) IP source ∈ allowlist `185.71.76.0/27, 185.71.77.0/27, 77.75.153.0/25, 77.75.154.128/25, 77.75.156.11, 77.75.156.35, 2a02:5180::/32` (актуальный список из ЮKassa docs); (б) идемпотентность по `event.id` — повторный POST не обновит Order; (в) match-проверка `amount.value/currency` с `Order.totals.total`. При любом нарушении webhook отбивается (403/409/422), но сохраняется в `PaymentEvents` для расследования.

**Why this priority**: Без подписи/IP-проверки злоумышленник может POST'нуть `payment.succeeded` от имени любого Order → бесплатные товары. **Блокер prod-deploy.**

**Independent Test**: Curl-запросом на webhook URL с поддельным телом и левого IP → должен вернуть 403, Order не меняется, в `PaymentEvents` запись с `rejectedReason=ip_not_allowed`.

**Acceptance Scenarios**:

1. **Given** webhook приходит с IP вне allowlist, **When** middleware проверяет `x-real-ip` / `cf-connecting-ip`, **Then** возвращается 403, Order не обновляется, в `PaymentEvents` пишется запись.
2. **Given** webhook с тем же `event.id`, что уже обработан, **When** сервис проверяет уникальность `event.id` в `PaymentEvents`, **Then** возвращается 200 OK без обновления, `duplicateCount++`.
3. **Given** webhook с `amount.value` отличным от `Order.totals.total`, **When** сервис проверяет match, **Then** эмитится `payment.amount_mismatch`, Order не переходит в `paid`, менеджер получает alert через 049, в `PaymentEvents.rejectedReason=amount_mismatch`.
4. **Given** ЮKassa добавит подпись в webhook-header (`webhook-signature` или аналог) в будущем, **When** `paymentSettings.webhookSignatureMode=enforce`, **Then** сервис проверяет HMAC-SHA256 от body с `webhookSecret`. **MVP**: только IP + amount.

---

### User Story 4 — Возврат средств закрывается webhook'ом `refund.succeeded` (Priority: P1)

053 уже шлёт `POST /v3/refunds` (через `yookassa-refunds.ts`). До спеки 055 webhook `refund.succeeded` НЕ обрабатывается — `Return.status` застревает в `refund_pending`. Спека 055 расширяет webhook-обработчик: принимает `refund.succeeded` / `refund.canceled` события, обновляет `Returns.{providerStatus,refundedAt}` через 053-репозиторий, эмитит `return.refunded` / `return.refund_failed`, 049 шлёт письмо клиенту.

**Why this priority**: Без этого возврат, инициированный покупателем, для него «исчезает» — деньги ушли (или нет?), статус в ЛК не меняется. Это P1, потому что 053 уже в проде после MVP-launch.

**Independent Test**: На test-shop оформить возврат через 053 → дождаться webhook → проверить, что `Return.status: refund_pending → refunded`, в Order `payment.refunds[].providerStatus=succeeded`.

**Acceptance Scenarios**:

1. **Given** Return в `refund_pending` с `providerRefundId`, **When** webhook `refund.succeeded` приходит, **Then** через 053-репозиторий: `Return.status → refunded`, `payment.refunds[].providerStatus=succeeded`, `payment.refunds[].refundedAt=now`.
2. **Given** webhook `refund.canceled` для возврата, **When** обрабатывается, **Then** `Return.status → refund_failed`, эмитится `return.refund_failed`, менеджеру alert.
3. **Given** webhook амбивалентен (нет нашего `Return` по `providerRefundId`), **When** сервис ищет в Returns, **Then** 404 + запись в `PaymentEvents.rejectedReason=unknown_refund`, alert менеджеру.

---

### User Story 5 — Owner настраивает captureMode и methods через admin (Priority: P2)

В Payload admin появляется глобал `PaymentSettings` (как `ApiShipSettings`/`CrmSettings`): owner выбирает `captureMode` (one_stage/two_stage), список разрешённых `paymentMethods` (card / sbp / yoo_money / sberbank), `paymentRetryWindowMin`, `webhookSignatureMode`. Меняется без редеплоя. `YOOKASSA_SHOP_ID/SECRET_KEY/WEBHOOK_SECRET` — в env (секреты).

**Why this priority**: Owner запускается с two-stage + card+sbp, но через 1-2 месяца захочет включить YooMoney или переключить на one-stage без вмешательства разработчика.

**Acceptance Scenarios**:

1. **Given** owner меняет `captureMode: two_stage → one_stage` в admin, **When** следующий create-payment, **Then** ЮKassa-запрос идёт с `capture=true`, шаг `waiting_for_capture` пропускается.
2. **Given** owner снимает галку `methods.yoo_money`, **When** create-payment, **Then** в `payment_method_data` передаётся `payment_method_type=bank_card,sbp` (whitelist), YooMoney на ЮKassa-странице недоступен.
3. **Given** новый `paymentSettings.webhookSecret` сохранён, **When** webhook приходит, **Then** проверка подписи (если включена) использует новый секрет; старый секрет деактивируется.

---

### User Story 6 — Менеджер видит историю webhook'ов в admin (Priority: P2)

В Payload admin появляется коллекция `PaymentEvents` (read-only): каждое входящее ЮKassa-событие сохраняется с {`eventId`, `eventType`, `orderId`, `payload`, `receivedAt`, `processedAt`, `result`, `rejectedReason`, `sourceIp`, `duplicateCount`}. Менеджер по номеру заказа видит весь хронологический ряд событий → может расследовать спорный платёж, увидеть mismatch'ы, replays, rejects.

**Why this priority**: Когда что-то пойдёт не так в проде (а пойдёт), у нас не будет инструмента «почему этот платёж не закрылся». Журнал критичен.

**Acceptance Scenarios**:

1. **Given** webhook любого типа пришёл, **When** обработка завершилась (успех/реджект/дубликат), **Then** в `PaymentEvents` создаётся запись.
2. **Given** менеджер открывает Order в admin, **When** scroll до раздела «События ЮKassa», **Then** видит список всех `PaymentEvents` для этого Order с фильтрами по типу.
3. **Given** payload-событие весит > 16 KB, **When** сохраняем, **Then** truncate с пометкой `truncatedAt`, полный payload — в логах.

---

### User Story 7 — Зависшие `pending_payment` Orders авто-экспирятся (Priority: P2)

Покупатель ушёл с ЮKassa-страницы, ЮKassa выслала `payment.canceled` через ~6 часов (или истёк TTL у них). На случай, если webhook потерян: cron `/api/cron/payments-expire` раз в N минут проверяет Orders в `pending_payment` старше `paymentRetryWindowMin` (default 60 мин), запрашивает у ЮKassa `GET /v3/payments/{id}` — если статус `canceled` или `expired`, переводит Order в `expired`, эмитит `payment.expired`, восстанавливает Cart (052 recovery-subscriber).

**Why this priority**: Без авто-экспирации Orders накапливаются в `pending_payment`, метрики conversion врут, аналитика не закрыта.

**Acceptance Scenarios**:

1. **Given** Order создан 65 минут назад в `pending_payment`, webhook от ЮKassa не получен, **When** cron срабатывает, **Then** GET в ЮKassa → если `canceled` → Order `expired`.
2. **Given** ЮKassa отвечает `pending` или `waiting_for_capture` (необычно долго), **When** cron срабатывает, **Then** Order **не** меняем — оставляем в `pending_payment`, пишем алёрт менеджеру (через 049).
3. **Given** cron не запускался 2 часа (cron-glitch), **When** запускается, **Then** обрабатывает все накопленные Orders в одной транзакции, защищён `pg_try_advisory_lock` (как 047/052/053).

---

### Edge Cases

- **Двойная попытка create-payment.** Покупатель жмёт «Оплатить» дважды быстро. Решение: idempotency на сервере — POST `/api/payment/yookassa/create` дедупит по `(orderId, retryNonce)`; повторный запрос возвращает тот же `confirmationUrl`. ЮKassa-side: используем `Idempotence-Key = ${orderId}:${retryNonce}` (UUID, генерируется при первом запросе и сохраняется в `Order.payment.idempotenceKey`).
- **Capture после out-of-stock.** Авторизация прошла (`waiting_for_capture`), но к моменту capture товара нет. Решение: `POST /v3/payments/{id}/cancel` (не capture), Order → `cancelled`, эмитим `payment.canceled` с reason=`stock_unavailable`, 049 шлёт извинение + refund hold ЮKassa делает за нас.
- **Webhook приходит раньше success-redirect'а.** Покупатель ещё на ЮKassa-странице, а webhook уже улетел в сервис. Решение: Order переходит в `paid` через webhook независимо от redirect'а. На /payment/success/[orderId] страница читает текущий статус Order.
- **Customer возвращается на сайт без webhook'а.** ЮKassa не дошлал, но пользователь видит «Оплачено» в банк-приложении. Решение: success-страница раз в 2 сек polling GET /api/orders/[id]/status. Если через 60 сек статус ещё `pending_payment` — показываем «Платёж обрабатывается, мы пришлём письмо когда подтвердим».
- **Partial refund + full refund сразу.** 053 отправляет два refund-запроса быстро. Решение: 053 уже сериализует через `Returns.status` state-machine, плюс ЮKassa-side `Idempotence-Key=${returnId}:refund`.
- **Refund на capture, который ещё в `waiting_for_capture`.** Нельзя refund'ить до capture. Решение: 053 проверяет `Order.payment.providerStatus === "succeeded"` перед refund'ом; если `waiting_for_capture` — отбивает refund с подсказкой "сначала отменить авторизацию через `POST /v3/payments/{id}/cancel`".
- **ЮKassa отвечает 500 на create-payment.** Решение: 047-pattern — 10s timeout, retry с тем же `Idempotence-Key` (до 3 попыток), при окончательной ошибке — Order остаётся в `pending_payment` без `providerRef`, покупатель видит «Платёжная система недоступна, попробуйте позже», 049 шлёт алёрт менеджеру.
- **Покупатель сменил адрес / товар после create-payment, но до оплаты.** Решение: после `POST /api/payment/yookassa/create` Order ставится в `pending_payment` → immutability guard 051 блокирует изменения. Если пользователь явно «вернуться к редактированию» — POST `/v3/payments/{id}/cancel` + Order возвращается в `draft` (только пока `pending_payment`, не `paid`).
- **СБП-платёж с превышением лимита 1 млн ₽.** Решение: фронт перед create-payment проверяет `Order.totals.total ≤ paymentSettings.sbpMaxAmount` (default 1 000 000 ₽); если выше — СБП недоступен на ЮKassa-странице.
- **Чек 54-ФЗ не сформировался у ЮKassa.** Решение: webhook `payment.succeeded` приходит даже если фискализация чека упала (ЮKassa async). Сервис не блокирует Order, но 049 шлёт менеджеру алёрт «чек не выдан, проверь онлайн-кассу», в Order сохраняется `payment.receiptStatus=failed`.
- **Currency drift.** ЮKassa возвращает только RUB. Решение: hardcode `currency=RUB`, проверка `webhook.amount.currency === "RUB"`, иначе reject.
- **Покупатель оплатил, но потом webhook не пришёл вообще (пропал).** Решение: cron US7 раз в 5 мин GET-ит ЮKassa по `pending_payment` orders старше 5 мин — если статус `succeeded`, обрабатывает как webhook (тот же handler в reconciliation-mode).
- **Refund после возврата средств на закрытую карту.** Решение: ЮKassa-side задача (они возвращают на счёт банка). Сервис не отвечает. В `PaymentEvents` фиксируем `refund.succeeded` — для нас закрыто.

---

## 3. Requirements *(mandatory)*

### 3.1. Functional Requirements

**Платёж: создание (US1, US2)**

- **FR-5500**: System MUST предоставить endpoint `POST /api/payment/yookassa/create` принимающий `{orderId, retryNonce?}`, возвращающий `{confirmationUrl, confirmationType, providerRef}`.
- **FR-5501**: System MUST создавать ЮKassa-платёж через `POST /v3/payments` с basic-auth (`shopId:secretKey` из env), header `Idempotence-Key=${orderId}:${retryNonce}`.
- **FR-5502**: System MUST передавать `amount.value` в рублях (формат `"1234.50"`) с `currency=RUB`, рассчитанным как `Order.totals.total` (snapshot из 047).
- **FR-5503**: System MUST передавать `capture=true` (one_stage) или `capture=false` (two_stage) в зависимости от `paymentSettings.captureMode`.
- **FR-5504**: System MUST передавать `confirmation={type:"redirect", return_url:"https://${BASE_URL}/payment/return/${orderId}"}` для card/yoo_money/sberbank и `type:"qr"` для СБП.
- **FR-5505**: System MUST передавать `payment_method_data.type` whitelist из `paymentSettings.paymentMethods`, либо опускать поле (тогда покупатель выбирает на ЮKassa-странице из всех разрешённых).
- **FR-5506**: System MUST передавать `description="${Order.clientNumber} (${itemsCount} поз.)"` ≤128 символов.
- **FR-5507**: System MUST передавать `metadata={orderId, clientNumber, sourceVersion:"055", utm: {source, medium, campaign, term, content}}` для трассировки в ЛК ЮKassa и атрибуции (OQ-5). UTM-snapshot берётся из `Cart.metadata.utm` (052) / cookies в момент create-payment.
- **FR-5508**: System MUST сохранять в Order `payment.{providerRef, confirmationUrl, idempotenceKey, paymentMethodSnapshot.expected, createdAt}` сразу после ЮKassa-ответа.
- **FR-5509**: System MUST проверять `Order.status==="pending_payment"` перед create-payment; если иной — возвращать 409 с кодом `INVALID_ORDER_STATUS`.
- **FR-5510**: System MUST вернуть тот же `confirmationUrl` при повторном `POST /api/payment/yookassa/create` с тем же `retryNonce` (idempotency на сервере).
- **FR-5511**: System MUST установить timeout 10s на запрос к ЮKassa, при таймауте — retry до 3 раз с экспоненциальной задержкой (как 047), при окончательной ошибке — 503 покупателю.

**Чек 54-ФЗ (US1)**

- **FR-5540**: System MUST передавать в `POST /v3/payments` объект `receipt={customer:{...}, items:[{description, quantity, amount, vat_code, payment_subject:"commodity", payment_mode:"full_prepayment"}], tax_system_code}` для каждого `Order.items[]`.
- **FR-5541**: `receipt.items[].amount.value` MUST равняться `priceSnapshot[sku].price × quantity` (рубли с 2 знаками). Цены **включают НДС 22%** (OQ-3a, ФЗ-425 от 28.11.2025, действует с 01.01.2026) — ЮKassa-касса рассчитает НДС внутри суммы по vat_code.
- **FR-5542**: System MUST передавать отдельным `receipt.items` пункт `delivery` с `payment_subject:"service"` если `Order.delivery.cost > 0`. **MVP-default**: `vat_code=12` (тот же что и товар, 22/122 расчётная). Это валидно для услуг под ОСН с включённым НДС 22%. Если бухгалтер укажет иное — owner меняет через `paymentSettings.deliveryVatCode` override (Phase 2; в MVP не реализуется, единая ставка). Pre-launch checklist (§17) включает бухгалтерскую валидацию этой ставки.
- **FR-5543**: `receipt.tax_system_code` MUST браться из `paymentSettings.taxSystemCode` (**hardcoded default `1` = ОСН**, OQ-1; настраивается owner'ом).
- **FR-5544**: `receipt.items[].vat_code` MUST браться из **`paymentSettings.defaultVatCode` = `12`** (22/122 расчётная, OQ-3a, действует с 01.01.2026). Применяется ко всем товарам единообразно. Когда появится `Product.vatCode` (Phase 2, OQ-3) — fallback на дефолт остаётся.
- **FR-5544c** *(VAT snapshot для legacy refund)*: System MUST сохранять в `Order.payment.vatCodeApplied` snapshot применённой ставки в момент `payment.succeeded`. При refund через 053 (chain 055→053) — vat_code в чеке коррекции берётся из этого snapshot'а, **НЕ** из текущего `paymentSettings.defaultVatCode`. Это страхует на случай будущих изменений ставки НДС и для возвратов по legacy-операциям (если когда-то будут Orders от 2025 с НДС 20%).
- **FR-5544d** *(Pre-2026 legacy guard)*: На launch (2026-05) НЕТ legacy-Orders по ставке 20% — все платежи через сайт пойдут уже по 22%. Но system MUST поддерживать legacy vat_code (4, 6) в `paymentSettings.allowedLegacyVatCodes` (default `[4, 6]`) для refund'ов по гипотетическим импортированным заказам. Валидация при create-payment запрещает использование legacy-кодов для НОВЫХ платежей.
- **FR-5544a**: System MUST в момент create-payment провалидировать `paymentSettings.taxSystemCode` ∈ {1,2,3,4,5,6} и `defaultVatCode` ∈ {1..6}. При некорректных значениях — fail-fast с алёртом owner'у, не запускать платёж.
- **FR-5544b** *(Receipt customer)*: `receipt.customer` MUST содержать `{email}` если `Order.customer.email` присутствует (приоритет, OQ-11). При отсутствии email — `{phone}` (формат `+7XXXXXXXXXX`). Если ни email, ни phone — fail-fast (validation error).
- **FR-5545**: При webhook `payment.succeeded` приходит вложенный `payment.receipt_registration` — System MUST сохранить статус в `Order.payment.receiptStatus` ∈ {pending, succeeded, canceled}.
- **FR-5546**: System MUST при `receiptStatus==="canceled"` эмитить `payment.receipt_failed` и слать менеджеру алёрт (049), но Order статус НЕ менять.

**Two-stage capture (US1)**

- **FR-5520**: При webhook `payment.waiting_for_capture` для two-stage платежа System MUST проверить наличие на складе для каждого `Order.items[].sku` (через future inventory-API; в MVP — без проверки, всегда capture).
- **FR-5521**: System MUST вызвать `POST /v3/payments/{id}/capture` с `amount` равным авторизованной сумме (или меньше — для частичного capture, не в scope MVP).
- **FR-5522**: System MUST использовать `Idempotence-Key=${orderId}:capture` для capture-запроса.
- **FR-5523**: При невозможности capture по бизнес-причинам (out-of-stock) System MUST вызвать `POST /v3/payments/{id}/cancel`, Order → `cancelled`, эмитировать `payment.canceled` с `reason="stock_unavailable"`.
- **FR-5523a** *(Capture transient failure, OQ-9)*: При сбое самого capture-запроса (ЮKassa 5xx / network timeout) — Order **остаётся в `pending_payment`**, capture **повторяется из cron** `payments-expire` с exponential backoff: 1 мин → 5 мин → 15 мин → 1 ч → 6 ч → 24 ч. Сохраняется в `Order.payment.captureAttempts[]` с `{attemptedAt, error}`. До истечения 7-дневного hold ЮKassa повторы продолжаются. После 7 дней — alert менеджеру + Order → `cancelled` (hold снимется автоматически у ЮKassa).
- **FR-5524**: System MUST устанавливать `Order.payment.capturedAt` при получении webhook `payment.succeeded` после capture.

**Webhook: безопасность (US3)**

- **FR-5530**: System MUST проверять source IP webhook'а против allowlist (CIDR-блоки из ЮKassa docs); при mismatch — 403, запись в `PaymentEvents` с `rejectedReason=ip_not_allowed`. IP берётся из `cf-connecting-ip` (Cloudflare) / `x-real-ip` / `x-vercel-forwarded-for` per 054-pattern.
- **FR-5531**: System MUST дедуплицировать webhook по `event.id`; повторный POST → 200 OK без обновления Order, `PaymentEvents.duplicateCount++`.
- **FR-5532**: System MUST проверять match `webhook.object.amount.value == Order.totals.total` (с допуском 0.01 ₽). При mismatch — Order не обновляется, эмитим `payment.amount_mismatch`, алёрт менеджеру.
- **FR-5532a** *(MVP UX, OQ-10)*: При `payment.amount_mismatch` в MVP — **read-only алёрт менеджеру**. Никаких admin-actions (force-accept / auto-refund) в коде. Менеджер вручную: (а) отвечает покупателю; (б) идёт в ЛК ЮKassa и отменяет авторизацию / делает refund на их стороне. `payment.amount_mismatch` event фиксируется в `PaymentEvents` и timeline Order'а для аудита. Admin-action "Force accept" — Phase 2 (см. §10).
- **FR-5533**: System MUST проверять `webhook.object.amount.currency === "RUB"`. При mismatch — reject.
- **FR-5534**: System MUST проверять, что Order найден по `webhook.object.id == Order.payment.providerRef`. При mismatch — 404, запись `rejectedReason=unknown_payment`.
- **FR-5535**: При `paymentSettings.webhookSignatureMode==="enforce"` System MUST верифицировать HMAC-SHA256 от body (header TBD; ЮKassa в 2026 объявила поддержку — следить за их changelog).
- **FR-5536**: Webhook handler MUST отвечать ЮKassa за ≤3 секунды; долгие операции (`emitDomainEvent`, 049-send) выполняются после ответа 200 (через `waitUntil` или asyncDispatch).

**Webhook: обработка событий (US1, US2, US4)**

- **FR-5550**: System MUST обрабатывать минимум 4 события: `payment.waiting_for_capture`, `payment.succeeded`, `payment.canceled`, `refund.succeeded`. Опционально `refund.canceled`, `payment.refunded` (мы не пользуем — у нас отдельные refund'ы через 053).
- **FR-5551**: При `payment.succeeded` System MUST перевести Order `pending_payment → paid` (или `awaiting_payment → paid` если это invoice-payment-confirmation), установить `paidAt=now`, `wasEverPaid=true`, эмитнуть `order.paid` (как 047).
- **FR-5552**: При `payment.canceled` (если `Order.status==="pending_payment"`) System MUST перевести Order → `expired` если истёк `paymentRetryWindowMin`, иначе → `cancelled`. Эмитировать `payment.canceled` (cart-recovery в 052).
- **FR-5553**: При `refund.succeeded` System MUST вызвать 053 `applyRefundSucceeded({providerRefundId, succeededAt})` — обновить `Returns.status: refund_pending → refunded`, `Order.payment.refunds[].providerStatus=succeeded`, эмитировать `return.refunded`.
- **FR-5554**: При `refund.canceled` System MUST вызвать 053 `applyRefundCanceled({providerRefundId, reason})` — `Returns.status → refund_failed`, эмитировать `return.refund_failed`, алёрт менеджеру.
- **FR-5555**: System MUST логировать все webhook-события в `PaymentEvents` (US6) ДО любой mutation Order/Returns.

**PaymentSettings global (US5)**

- **FR-5560**: System MUST предоставить Payload global `paymentSettings` с полями:
  - `enabled` (boolean, default true в проде если creds в env)
  - `captureMode` ∈ {`one_stage`, `two_stage`}, **default `two_stage`** (Q2)
  - `paymentMethods` (multi-select: `bank_card`, `sbp`, `yoo_money`, `sberbank`), **default [`bank_card`, `sbp`]** (Q3)
  - `paymentRetryWindowMin` (number, **default 60**, OQ-4)
  - `webhookSignatureMode` ∈ {`off`, `enforce`}, **default `off`** в MVP
  - `taxSystemCode` (1..6), **default `1` = ОСН** (OQ-1, hardcoded по умолчанию)
  - `defaultVatCode` (1..12), **default `12` = 22/122 расчётная** (OQ-3a, действует с 01.01.2026 по ФЗ-425, hardcoded для всех товаров до Phase 2)
  - `allowedLegacyVatCodes` (number[], default `[4, 6]`) — vat_code'ы для refund'ов по legacy-операциям (НДС 20%). НЕ используются для новых платежей.
  - `sbpMaxAmount` (number, default 1 000 000 ₽)
  - `webhookSecret` (text, secret — admin-only, `access.read: () => false`)
  - `senderCompanyInfo` (group: `inn`, `name`, `address` — для receipt и B2B-проверок)
- **FR-5561**: Изменение `paymentSettings` НЕ требует деплоя; следующий create-payment использует новые значения.
- **FR-5562**: System MUST хранить `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` только в env (не в Payload — секреты не в БД). Webhook secret — в Payload (как `apiShipSettings.webhookSecret`), потому что меняется чаще.
- **FR-5563**: System MUST gate'ить весь модуль через `paymentSettings.enabled` (default true в проде, false если creds не настроены).

**PaymentEvents collection (US6)**

- **FR-5570**: System MUST предоставить Payload collection `paymentEvents` (read-only в admin) с полями: `eventId` (unique), `eventType`, `orderId` (rel), `returnId` (rel, для refund-событий), `providerRef`, `payload` (JSON, truncate >16KB), `receivedAt`, `processedAt`, `result` (success|rejected|duplicate), `rejectedReason`, `sourceIp`, `duplicateCount` (default 0), `notificationJobId` (если триггерил 049).
- **FR-5571**: System MUST показывать события на странице Order в admin (related-list).
- **FR-5572**: `paymentEvents` MUST хранить максимум 90 дней (cron-prune); потом архив в S3 (вне scope MVP — TODO).

**Cron expire (US7)**

- **FR-5580**: System MUST предоставить cron `/api/cron/payments-expire` (защищён `CRON_SECRET` как другие cron'ы), запускается каждые 5 минут.
- **FR-5581**: Cron MUST брать Orders с `status==="pending_payment"` и `payment.createdAt < now - paymentSettings.paymentRetryWindowMin`, для каждого — GET `/v3/payments/{providerRef}` в ЮKassa.
- **FR-5582**: Если ЮKassa-статус `canceled|expired` — перевести Order → `expired` (или `cancelled`), эмитировать `payment.expired`.
- **FR-5583**: Если ЮKassa-статус `succeeded` (reconciliation — webhook потерян) — обработать как webhook `payment.succeeded`, пометить `PaymentEvents.source="cron_reconciliation"`.
- **FR-5584**: Cron MUST защищаться `pg_try_advisory_lock(payments_expire_lock)` от параллельных запусков.
- **FR-5585**: Cron MUST обрабатывать batch ≤100 Orders за один запуск (защита от deadlock); если очередь больше — следующий запуск через 5 мин.

**Idempotency & immutability cross-spec**

- **FR-5590**: 051 immutability guard MUST применяться независимо от источника изменения — webhook ЮKassa не может изменять frozen-поля (например, `Order.totals` после `paid`).
- **FR-5591**: System MUST использовать `Idempotence-Key` (с одним `e`, как пишет ЮKassa, не `Idempotency-Key`).
- **FR-5592**: Все вызовы create-payment / capture / cancel / refund MUST идти через единый module `apps/web/src/lib/payments/yookassa-client.ts` (новый, по образцу `yookassa-refunds.ts`).

**PII & security**

- **FR-5595**: System MUST НИКОГДА не логировать `payment_method.card.first6`/`last4` целиком — только маскированно (`****1234`).
- **FR-5596**: System MUST НИКОГДА не сохранять полные card details в Payload (PCI-DSS scope только у ЮKassa).
- **FR-5597**: System MUST маскировать email в `PaymentEvents.payload` (как 049 — `***@domain`).
- **FR-5598**: `YOOKASSA_SHOP_ID`/`SECRET_KEY`/`WEBHOOK_SECRET` MUST храниться только в `.env.local` (gitignored), как FR-505 (ApiShip).

**Analytics (Constitution Principle V)**

- **FR-5599**: System MUST включать `utm` snapshot (поля `source`, `medium`, `campaign`, `term`, `content`) в payload доменного события `payment.succeeded` для downstream-аналитики (dataLayer / GA4 `purchase` event / Twenty CRM Activity). UTM-данные берутся из `Cart.metadata.utm` (052) на момент конверсии Cart → Order; пустые поля передаются как `null`. Это закрывает Constitution V «User journeys, product views, ..., payment, ... events must be measurable».

### 3.2. Non-Functional Requirements

- **NFR-5500**: 95-й перцентиль ответа `POST /api/payment/yookassa/create` ≤ 800 мс (включая network к ЮKassa).
- **NFR-5501**: 95-й перцентиль ответа webhook-handler'а ≤ 1500 мс (handler отвечает быстро — heavy ops в `waitUntil`).
- **NFR-5502**: Зависимость от ЮKassa — best-effort. При их 5xx сервис не падает — Order остаётся в `pending_payment`, ретраи как FR-5511.
- **NFR-5503**: Cron-reconciliation MUST покрывать ≥99% потерянных webhook'ов (через GET-проверку статуса).
- **NFR-5504**: 0 случаев double-charge: idempotency + immutability + amount-match.

---

## 4. Key Entities

- **Order.payment** (расширяется): `{method, providerStatus, providerRef, paidAt, capturedAt, amount, idempotenceKey, confirmationUrl, paymentMethodSnapshot, receiptStatus, captureAttempts[], refunds[], payerBankDetails}`. `paymentMethodSnapshot` (OQ-6, полный snapshot): `{type, title, card?{first6, last4, expiryMonth, expiryYear, cardType: visa|mastercard|mir|jcb|unionpay, issuerCountry, issuerName}, sbp?{bankId, bankName}, yooMoney?{accountNumber: masked}, sberbank?{phone: masked}}`. `captureAttempts[]` (FR-5523a): `[{attemptedAt, error, nextRetryAt}]`.
- **PaymentSettings** (Payload global, новая): `{enabled, captureMode, paymentMethods[], paymentRetryWindowMin, webhookSignatureMode, taxSystemCode, sbpMaxAmount, webhookSecret}`.
- **PaymentEvents** (Payload collection, новая): см. FR-5570.
- **Domain events** (cross-spec, добавляются в `domain-events.ts` union family):
  - `payment.authorized` — после `waiting_for_capture`
  - `payment.captured` — после capture-success (для two-stage)
  - `payment.succeeded` — финальный success (общий)
  - `payment.canceled` — отказ ЮKassa / отмена покупателя
  - `payment.expired` — истёк retry-window
  - `payment.amount_mismatch` — webhook не сошёлся
  - `payment.receipt_failed` — чек 54-ФЗ упал
  - `return.refunded` — webhook `refund.succeeded` (cross-spec с 053)
  - `return.refund_failed` — webhook `refund.canceled` (cross-spec с 053)

---

## 5. State Machine Alignment

**Order.status** (фрагмент, фокус на платёжных переходах):

```
draft ──submit→ pending_payment
              │
              ├──webhook payment.waiting_for_capture──→ pending_payment (two_stage, payment.providerStatus=pending)
              │
              ├──webhook payment.succeeded──→ paid (wasEverPaid=true)
              │
              ├──webhook payment.canceled (within window)──→ cancelled
              │
              ├──webhook payment.canceled (window expired) OR cron payments-expire──→ expired
              │
              └──capture failed (out-of-stock)──→ cancelled (auth released by ЮKassa)
```

**ЮKassa payment.status → Order.payment.providerStatus mapping:**

| ЮKassa status | Order.payment.providerStatus | Order.status (effect) |
| --- | --- | --- |
| `pending` | `pending` | без изменений (pre-redirect) |
| `waiting_for_capture` | `pending` | без изменений; triggers capture-call (two_stage) |
| `succeeded` | `succeeded` | `paid` |
| `canceled` | `canceled` | `cancelled` или `expired` |

**Return.status (053) после интеграции 055 webhook'а:**

```
refund_pending ──webhook refund.succeeded──→ refunded
              ──webhook refund.canceled──→ refund_failed
```

Все остальные переходы 053 — без изменений; 055 лишь закрывает petlю на async-confirm.

---

## 6. Receipts (54-ФЗ) — контракт с ЮKassa

ЮKassa в auto-mode формирует фискальный чек через подключённую онлайн-кассу. Сервис передаёт `receipt`-объект в create-payment.

**Актуальные ставки НДС (с 01.01.2026, ФЗ-425 от 28.11.2025):**

| vat_code | Ставка | Применение в нашем MVP |
| --- | --- | --- |
| `1` | без НДС | не-облагаемые товары (Phase 2) |
| `2` | 0% | экспорт (Phase 2) |
| `3` | 10/110 расчётная | лекарства/детские/книги (Phase 2) |
| `5` | 10% (включаемая) | редко |
| `11` | 22% (включаемая) | если цена БЕЗ НДС, добавляется сверху |
| **`12`** | **22/122 расчётная** | **✅ DEFAULT в MVP** — цена включает НДС 22% |

Старые коды `4` (20/120) и `6` (20%) — только для refund'ов по legacy-операциям (если будут), не для новых платежей (FR-5544d).

**Состав items[]:**

1. По каждой `Order.items[i]`: `{description: ProductTitle, quantity, amount: {value: priceSnapshot[i].price, currency: RUB}, vat_code: paymentSettings.defaultVatCode (= 12 для PDU/розеток), payment_subject: "commodity", payment_mode: "full_prepayment"}`.
2. Если `Order.delivery.cost > 0`: `{description: "Доставка ${tariffName}", quantity: 1, amount: cost, vat_code: paymentSettings.defaultVatCode, payment_subject: "service", payment_mode: "full_prepayment"}`.

**При возврате (053 chain):**

- 053 уже формирует чек коррекции через `documents/credit-memo-number.ts` (stub) — это **наша** документация для бухгалтерии (КСФ для юрлица). А **фискальный чек коррекции** должна делать ЮKassa.
- 055 FR: при `POST /v3/refunds` (053) — передавать `receipt`-объект (как для full refund / partial refund) с теми же items, чтобы ЮKassa сформировала чек коррекции. **TODO для 053**: обновить `createRefund()` чтобы принимать `receipt`-объект; реализация — в фазе implementation 055 (см. §7).

**Что точно НЕ делает сервис:** не печатает чеки сам, не работает с ФН (фискальным накопителем), не интегрирует ОФД.

---

## 7. Refund flow alignment (053 ↔ 055)

| Шаг | Кто | Что изменяется в 055 |
| --- | --- | --- |
| Customer → POST /api/returns | 053 | без изменений |
| Менеджер approve → POST /api/admin/returns/:id/refund | 053 | без изменений |
| 053 calls `createRefund({paymentId, amount, idempotencyKey})` | 053 → ЮKassa | **055 расширяет**: добавить параметр `receipt?: ReceiptInput` для чека коррекции |
| ЮKassa отвечает с `Refund.id` и `status: pending` | ЮKassa → 053 | без изменений; 053 сохраняет в `payment.refunds[]` |
| **NEW: webhook `refund.succeeded`** | ЮKassa → 055 | 055 webhook handler находит `Return` по `providerRefundId`, вызывает 053-репозиторий `applyRefundSucceeded()` |
| 053 repository.maybeMarkOrderReturned | 053 | без изменений; aggregate-recompute как было |

**Контракт:** 055 экспонирует функцию `applyRefundWebhook(event)` в `apps/web/src/lib/payments/yookassa-webhook-handler.ts` (новая). 053-репозиторий получает её через import (как 052-recovery-subscriber).

---

## 8. Security & PCI scope

- **PCI-DSS**: scope полностью у ЮKassa. Сервис **не видит** номер карты — только `payment_method` snapshot с masked `first6/last4`.
- **Webhook**: трёхуровневая защита (FR-5530..5534): IP-allowlist + amount-match + payment-ref-match. HMAC-подпись — opt-in после ЮKassa update.
- **Secrets**: `YOOKASSA_SECRET_KEY` — только env (как `APISHIP_TOKEN`, FR-603). Никогда не выходит на клиент. Webhook secret — в Payload `paymentSettings` (но read-restricted: `access.read: () => false` для не-админов, как 054 `magicLinkToken`).
- **Logging**: PII-masking как 049 (email → `***@domain`, phone last 4). Card details — никогда не логируем, кроме masked first6/last4 (PCI-DSS позволяет).
- **Idempotency**: на трёх уровнях — (1) `Idempotence-Key` к ЮKassa, (2) дедупликация webhook по `event.id`, (3) immutability 051 после `wasEverPaid`.
- **Owner gate**: согласно `CLAUDE.md` security-constraint: changes to payment settings — high-risk, требуют owner confirmation. Spec 055 предусматривает audit-log на `paymentSettings.afterChange` (как `apiShipSettings`).

---

## 9. Observability

- `PaymentEvents` collection — журнал всех событий (US6).
- `DomainEvents` (`payment.*`, `return.*`) — пишутся в общий event-log (как 047).
- Структурные логи: `[yookassa-create]`, `[yookassa-webhook]`, `[yookassa-capture]`, `[yookassa-cron]` с маскированием PII.
- Metric counters (для будущего dashboard'а): `payment.created`, `payment.succeeded`, `payment.canceled`, `payment.rejected`, `webhook.duplicate`, `webhook.mismatch`, `cron.expired`, `cron.reconciled`.
- Admin observation: страница Order в admin показывает таймлайн `PaymentEvents` (US6).

---

## 10. Out of Scope (MVP)

Чтобы спека была реализуема за 1-2 недели, **из scope MVP исключены**:

1. **Saved payment methods** — recurring/one-click для returning customers через 054. → Phase 2 (после launch + 1 месяц).
2. **B2B-инвойс через ЮKassa** (`b2b_sberbank` method) — у нас другой флоу для юрлиц (US2 037 → PDF-счёт). → не планируется.
3. **Apple Pay / Google Pay** — Apple Pay в РФ не работает; Google Pay — после ЮKassa возобновит. → Phase 2.
4. **Multi-currency** — только RUB. Hardcode.
5. **Partial capture** — capture меньшей суммы, чем authorized. → Phase 2 (когда появится inventory с partial-stock).
6. **Receipt по подписке / рассрочке** — `payment_mode!="full_prepayment"`. → не планируется.
7. **HMAC webhook signature** — пока IP-allowlist (`webhookSignatureMode=off`). Включим, когда ЮKassa объявит формат подписи. → Phase 2.
8. **PaymentEvents archive в S3** — пока 90 дней + drop. → Phase 2.
9. **Inventory check перед capture** — пока всегда capture без проверки склада. → когда появится stock-API (отдельная спека).
10. **Frontend payment-method picker на /cart/review** — пока редирект на ЮKassa-страницу (она показывает выбор). Свой picker (как Wildberries) — Phase 2.
11. **Multi-shop fee splits** — у нас один магазин. → не планируется.
12. **YooMoney-кошелёк** как отдельный метод. → разрешим как `payment_method.type=yoo_money` после launch (Q3 решение).
13. **Receipt 54-ФЗ для juridical entity (b2b-receipt)** — нужен ИНН/КПП в `receipt.customer`. → когда сделаем US2 037 через ЮKassa (Phase 2; сейчас юрлица оплачивают по счёту вне ЮKassa).
14. **Heterogeneous VAT rates** (OQ-3, A1) — поддержка `Product.vatCode` (10%, 0%, без-НДС) для смешанного ассортимента. В MVP hardcoded `vat_code=12` (22/122) для всех. → Phase 2; **блокирует публикацию товаров с иной ставкой НДС**.
15. **Admin-action "Force accept" amount_mismatch** (FR-5532a, OQ-10) — кнопка в admin для ручного approve платежа с расхождением суммы. Phase 2.
16. **Auto-refund** при amount_mismatch — авто-возврат полученной суммы покупателю. Phase 2.
17. **Capture с уменьшением amount** — частичный capture (например, после out-of-stock одной позиции). Зависит от inventory-API. Phase 2.

---

## 11. Open Questions — **все resolved в /clarify** ✅

См. §0.1 Clarifications (раунды R1-R3). Перед `/plan` остался один минорный пункт:

| # | Вопрос | Статус |
| --- | --- | --- |
| OQ-1..OQ-12 | См. §0.1 — все 12 вопросов закрыты | ✅ Resolved 2026-05-24 |
| OQ-13 *(новый, на /plan)* | Какой именно ОФД (Платформа ОФД / Первый ОФД / Такском / Контур) подключён к онлайн-кассе? Нужен только для troubleshooting receipt-проблем; не блокирует код. | Спросим перед /implement |
| OQ-14 *(новый, на /plan)* | Whitelist email-доменов для тестов в test-shop (например, `staging.pdumarket.ru` или test+1@example.com)? | Минорно; зафиксируем в quickstart.md перед /implement |

**Готовность к /plan**: 100% по бизнес-решениям; технический /plan (стек, data-model, contracts) пишется на следующем шаге.

---

## 12. Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-5500**: Покупатель-физлицо проходит флоу /cart/review → ЮKassa → success-страница за **≤90 секунд** в P95 (исключая время на ЮKassa-странице).
- **SC-5501**: **≥99.5%** webhook'ов от ЮKassa обрабатываются за один вызов (без cron-reconciliation). Метрика — `webhook_first_pass_rate`.
- **SC-5502**: **0 случаев** double-charge за первые 6 месяцев в проде. Метрика — manual audit `PaymentEvents` каждый месяц.
- **SC-5503**: **0 случаев** успешного rogue-webhook (IP fake, amount mismatch). Метрика — `PaymentEvents.rejectedReason` ratio.
- **SC-5504**: Cron-reconciliation закрывает **≥99%** потерянных webhook'ов в течение 10 минут. Метрика — `cron.reconciled / (cron.reconciled + webhook.received)`.
- **SC-5505**: **100%** оплат → фискальный чек 54-ФЗ выдан ЮKassa успешно (`receiptStatus="succeeded"`). Метрика — `payment.receipt_failed` events == 0 / week.
- **SC-5506**: **≥95%** возвратов закрываются автоматически (Returns.status → refunded через webhook без ручного вмешательства менеджера). Метрика — `return.refunded / total_returns`.
- **SC-5507**: **0 случаев** изменения `Order.totals` после `paid` (immutability 051 + 055-webhook не нарушают). Метрика — schema-test, ESLint immutability hook.
- **SC-5508**: Доля оплат через СБП ≥30% от total payments через 3 месяца после launch (отраслевой бенчмарк 2025). Метрика — `paymentMethodSnapshot.type` distribution.
- **SC-5509**: P95 ответа `POST /api/payment/yookassa/create` ≤ 800 мс. Метрика — APM.
- **SC-5510**: 0 утечек secrets в repo (`YOOKASSA_SECRET_KEY` не появляется в commits — pre-commit hook).

---

## 13. Assumptions

**Налоговые (CRITICAL для 54-ФЗ корректности):**

- **A1 (launch-blocker)**: ВСЕ товары на сайте облагаются единой ставкой **НДС 22%** (vat_code=`12`, 22/122 расчётная; повышено с 20% по ФЗ-425 от 28.11.2025 с 01.01.2026). Это безопасно, пока ассортимент = только PDU/розетки/силовое оборудование на ОСН. **Если появится товар с иной ставкой (лекарства 10% → vat_code=3; экспорт 0% → vat_code=2; не-облагаемый → vat_code=1) — потребуется срочное расширение Products.vatCode (Phase 2, OQ-3) ПЕРЕД его публикацией.** Иначе чек 54-ФЗ некорректен → штраф ≥ 10 000 ₽ за каждую операцию.
- **A1a**: Цены в каталоге (PDU/розетки) **уже пересчитаны под новую ставку 22%** или будут пересчитаны owner'ом до launch. Если цены оставались с расчётом на 20% — нужен бизнес-вопрос: повышать конечную цену (покупатель платит больше) или сохранить (маржа падает на 2 п.п.). **Это решение НЕ техническое и должно быть закрыто до /implement.**
- **A2**: Цены в `Product.priceRub` хранятся как **итоговые с НДС 22%** (потребительская розничная практика). ЮKassa-касса рассчитает НДС внутри суммы.
- **A3**: ИНН/КПП/адрес юрлица в `paymentSettings.senderCompanyInfo` совпадают с регистрацией в ЮKassa и с настройками ОФД онлайн-кассы.
- **A4**: Доставка — `payment_subject=service` всегда, `vat_code=12` (22/122, единая ставка с товаром в MVP, FR-5542). Корректность для услуги доставки на ОСН входит в pre-launch checklist (§17), подтверждается бухгалтером. Если откроется кейс с иной ставкой — Phase 2 добавляет `paymentSettings.deliveryVatCode` override.
- **A5**: Покупка — `payment_mode=full_prepayment` всегда (нет рассрочки, нет COD/наложенного платежа в MVP).

**Инфраструктурные:**

- **A6**: Owner зарегистрирован в ЮKassa (yookassa.ru), shopId/secretKey получены, тарифный план **Базовый или выше** (OQ-7 — СБП включён).
- **A7**: Подключена онлайн-касса (АТОЛ Онлайн / Эвотор / Оранж-Дата / ЮKassa-касса) к ЮKassa-кабинету для 54-ФЗ (OQ-2). Auto-mode receipts включён в ЛК ЮKassa.
- **A8**: Test-shop ЮKassa (sandbox) выдан владельцем для staging (OQ-12). Webhook URL test-shop'а указывает на `staging.pdumarket.ru` (или ngrok для local dev).
- **A9**: Webhook URL prod = `https://pdumarket.ru/api/payment/yookassa/webhook` (OQ-8). DNS + TLS работают, IP-allowlist ЮKassa не заблокирован хостингом.

**Cross-spec dependencies:**

- **A10**: 052 Cart.metadata содержит UTM-snapshot (или копия из cookies через checkout-API) к моменту create-payment (OQ-5).
- **A11**: 049 готов отправить новые типы писем (`payment.succeeded`, `payment.canceled`, `payment.expired`, `payment.amount_mismatch`, `payment.receipt_failed`) — можно пере-использовать `order.paid` matrix-entry или добавить новые в notifications-matrix.
- **A12**: 052 готов восстановить Cart при `payment.canceled` / `payment.expired` (recovery-subscriber уже подписан на `order.cancelled`; добавим `payment.*` варианты).
- **A13**: 053 готов получить `applyRefundSucceeded(event)` / `applyRefundCanceled(event)` вызовы (новые методы репозитория — добавятся в impl-фазе).
- **A14**: Frontend для checkout (US1 037) — отдельный track; 055 предоставляет только backend API + redirect URL + status-polling endpoint.
- **A15**: Cron-инфраструктура (как 047/052/053) уже работает (`pg_try_advisory_lock`, `CRON_SECRET`, Vercel cron-config).
- **A16**: 048 Twenty CRM остаётся **off** на launch — никаких пересечений с 055 на этой стадии (capability matrix `customerEmails=payload`).

---

## 14. Dependencies

**Внутренние (cross-spec):**

| Спека | Что нужно от 055 | Что нужно для 055 |
| --- | --- | --- |
| 037 | `POST /api/payment/yookassa/create` endpoint + redirect URL | Готовая корзина + checkout-form |
| 047 | Webhook `payment.succeeded` эмитит `order.paid` (вместо текущего mock) | `priceSnapshot`, `Order.totals` |
| 049 | Шлёт письмо по `order.paid` (как сейчас) + новое `payment.expired` (cart-recovery) | Готовая matrix `notification-matrix.ts` |
| 051 | `wasEverPaid=true` после `payment.succeeded` | Immutability guard |
| 052 | Cart recovery при `payment.canceled` (subscriber подписан) | Conversion Cart→Order до redirect |
| 053 | `applyRefundSucceeded` / `applyRefundCanceled` экспортируется из 053-репозитория | `payment.refunds[]` после 055 webhook'а |
| 054 | (Phase 2) Saved payment methods — `Customer.savedPaymentMethods[]` | Не блокирует MVP |
| 048 | Twenty получает `order.paid` event (уже gated) | Не блокирует — Twenty off на launch |

**Внешние:**

- ЮKassa API доступность ≥99.5% (их SLA).
- DNS pdumarket.ru для webhook + return URL.
- Онлайн-касса для 54-ФЗ.
- Vercel/host принимает webhook POST'ы из ЮKassa IP-allowlist.

---

## 15. Cross-spec impact summary

Спека 055 затрагивает следующие коллекции/глобалы:

- **NEW**: `paymentSettings` global, `paymentEvents` collection, `yookassa-client.ts`, `yookassa-webhook-handler.ts`, `payments-expire` cron, `POST /api/payment/yookassa/create` endpoint, `GET /api/orders/[id]/status` endpoint (для success-page polling).
- **EXTEND**: `Orders.payment` (новые поля: `idempotenceKey`, `confirmationUrl`, `paymentMethodSnapshot`, `capturedAt`, `receiptStatus`), `domain-events.ts` (новые `payment.*` events), `notification-matrix.ts` (новые типы писем).
- **REPLACE**: текущий `/api/payment/yookassa/webhook/route.ts` (mock) → реальный handler с проверками.
- **EXTEND 053**: `createRefund()` принимает опциональный `receipt`, `repository` экспортирует `applyRefundSucceeded`/`applyRefundCanceled`.
- **UPDATE order-lifecycle-spec.md**: §Phase 7 описание становится фактическим (а не TODO), переход `pending_payment → paid` идёт через реальный webhook.
- **UPDATE document-register.md**: добавить запись о 055.
- **UPDATE AGENTS.md**: добавить запись `specs/055-yookassa-payments-integration/`.

---

## 16. Глоссарий

- **ЮKassa** — merchant payment gateway, yookassa.ru.
- **Two-stage payment** — авторизация (hold) + capture (списание). Hold до 7 дней.
- **One-stage payment** — авторизация + capture в одном шаге.
- **Webhook** — async push от ЮKassa в сервис о смене статуса.
- **СБП** — Система быстрых платежей ЦБ РФ, оплата по QR-коду.
- **54-ФЗ** — закон РФ о применении ККТ; обязывает выдавать фискальный чек.
- **ФЗ-425 (от 28.11.2025)** — закон, поднявший общую ставку НДС с 20% до 22% с 01.01.2026. ЮKassa ввела новые vat_code 11 (22%) и 12 (22/122).
- **Receipt** — чек 54-ФЗ, формируется ЮKassa через подключённую онлайн-кассу.
- **vat_code** — поле в receipt 54-ФЗ, обозначающее ставку НДС: 1 (без НДС), 2 (0%), 3 (10/110), 4 (20/120 legacy), 5 (10%), 6 (20% legacy), 11 (22%), 12 (22/122 — наш MVP-default).
- **Idempotence-Key** — header ЮKassa для дедупликации запросов (по их орфографии — без `y`).
- **`waiting_for_capture`** — промежуточный статус ЮKassa для two-stage платежей.
- **`paid` (Order.status)** — финальный успех; `wasEverPaid=true`, immutability включён.
- **`pending_payment` (Order.status)** — Order создан, ждёт оплату.
- **`expired` (Order.status)** — `pending_payment` истёк без оплаты.

---

## 17. Next Steps (для перехода в /plan)

Phase `/specify` + `/clarify` **завершены** (12 OQ resolved). Дальнейший путь:

1. ✅ **`/specify`** — этот документ.
2. ✅ **`/clarify`** — 3 раунда (R1 налоги/касса/тариф; R2 VAT/retry/capture-failure/cards; R3 receipt-customer/UTM/mismatch-UX/test-shop).
3. **`/plan`** (следующий шаг) — выбор стека (re-use `yookassa-refunds.ts` patterns), `plan.md`, `data-model.md`, `contracts/yookassa-webhook-events.ts`, `contracts/create-payment.openapi.yaml`. Минорно: OQ-13 (ОФД) + OQ-14 (test-emails) ответятся перед /implement.
4. **`/tasks`** — Phase 1 (foundation: client + settings global), Phase 2 (create-endpoint + receipt generation), Phase 3 (webhook handler + security + PaymentEvents), Phase 4 (cron expire/reconcile + capture-retry), Phase 5 (refund-webhook → 053), Phase 6 (admin observability + Order timeline UI), Phase 7 (review + e2e tests).
5. **`/implement`** — пошагово, как 052/053/054.
6. **`/review`** round — security audit (особое внимание FR-5530..5534 + PCI-DSS), prod-readiness, 54-ФЗ совместимость, документация для бухгалтера.

**Estimated effort**: 8-12 working days backend-only (без frontend, без e2e). Plus 2-3 days на e2e в test-shop ЮKassa.

**Critical pre-launch checklist** (для /review):

- [ ] `paymentSettings.taxSystemCode=1`, **`defaultVatCode=12`** (22/122 расчётная, ФЗ-425) подтверждены бухгалтером ИП Соликаново.
- [ ] Все Products на сайте облагаются **22% НДС** (A1 verification).
- [ ] **Цены в каталоге пересчитаны под 22% НДС** (A1a — бизнес-решение принято).
- [ ] **Доставка `vat_code=12` подтверждена бухгалтером** для ОСН (FR-5542, A4 verification).
- [ ] Онлайн-касса подключена к ЮKassa, auto-mode receipts on, **поддерживает новые ставки 22% (vat_code 11, 12)** (A7).
- [ ] Test-shop пройден end-to-end по US1, US2, US4 (refund).
- [ ] Webhook IP-allowlist обновлён на CIDR-блоки ЮKassa из их docs (актуальная версия).
- [ ] `YOOKASSA_SHOP_ID/SECRET_KEY` (prod) в Vercel env, не в repo.
- [ ] `paymentSettings.webhookSecret` ≥ 32 chars, генерируется один раз.
- [ ] PaymentEvents retention настроен (90 дней).

---

**End of spec — Feature 055 (Speckit Phase: /specify).**
