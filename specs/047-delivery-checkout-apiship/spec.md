# Feature Specification: Delivery Checkout With ApiShip Integration

**Feature Branch**: `047-delivery-checkout-apiship`

**Created**: 2026-05-23

**Status**: Draft

**Input**: User description: "Модуль оформления доставки для сайта Soliton с интеграцией ApiShip; референс — Medusa-плагин @gorgo/medusa-fulfillment-apiship (MIT). На месте трёх фиксированных опций доставки из 037-cart-and-checkout-flows нужен живой расчёт стоимости, выбор ПВЗ, создание отправления в ApiShip, получение этикетки и трекинга."

## Контекст и связи

- **Канонический документ жизненного цикла**: `07-build-specifications/order-lifecycle-spec.md` (создан 2026-05-23). При расхождении эта спека следует за ним.
- Спецификация 037 (`specs/037-cart-and-checkout-flows/spec.md`) явно зафиксировала: «в v1 — 3–4 фиксированных варианта; реальная интеграция с API курьеров — отдельная фича (ApiShip)». Настоящая спека и есть эта «отдельная фича».
- Дорожная карта `05-implementation-roadmap/russian-payment-delivery-aggregators.md` определила ApiShip как основной агрегатор для MVP-этапа 3 и закрепила интерфейс `ShippingProvider`.
- Референсная реализация — Medusa-плагин `@gorgo/medusa-fulfillment-apiship@0.2.1` (MIT, актив. поддержка, репо `gorgojs/medusa-plugins`). Берём как «донор кода», не как зависимость: наш стек — Next.js 16 + Payload v3, а не Medusa.
- Twenty CRM (self-host или cloud) — целевая CRM-система проекта (см. order-lifecycle-spec.md §4 и будущую спеку `specs/048-twenty-crm-sync/`). В рамках 047 закладываем pre-задел: event emitter + хранение `crmRefs` в `Order`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Физлицо видит реальную стоимость и сроки доставки в чекауте (Priority: P1)

Покупатель собрал корзину, перешёл в `/cart/checkout-physical/`, ввёл город / адрес. Под формой адреса появляется блок «Доставка» с реальными вариантами от ApiShip (СДЭК, Boxberry, Почта России, Яндекс и пр.) — для каждого видна стоимость, срок (мин-макс дней), описание тарифа, бейдж «дешевле всех» / «быстрее всех». При выборе варианта стоимость доставки попадает в итоговую сумму до оплаты.

**Why this priority**: Без реальной стоимости доставки физлицо не может купить — текущие «3–4 фиксированных варианта» (USD цена «по запросу» и «уточняется при заказе») фактически закрывают воронку.

**Independent Test**: Можно полностью проверить: в sandbox-кабинете ApiShip (`api.dev.apiship.ru`) с тестовым токеном выполнить чекаут с одним PDU 5 кг в Москву — список тарифов отображается, стоимость суммируется, после оплаты ЮKassa sandbox заказ создаётся с зафиксированным выбранным тарифом.

**Acceptance Scenarios**:

1. **Given** корзина с 1 PDU (вес из карточки), адрес «Москва», **When** покупатель ввёл индекс / город / улицу, **Then** в течение 2 секунд под адресом появляются ≥3 варианта доставки с ценой и сроком.
2. **Given** список тарифов отображён, **When** покупатель выбирает СДЭК до двери, **Then** «Итого» пересчитывается, выбор подсвечен.
3. **Given** покупатель меняет адрес, **When** новый город принят, **Then** список тарифов перезапрашивается, ранее выбранный тариф сбрасывается с подсказкой «выберите доставку заново».
4. **Given** товар без габаритов в карточке, **When** запускается расчёт, **Then** используются `defaultProductSizes` из настроек ApiShip; в логи пишется warning со списком SKU без габаритов.

---

### User Story 2 — Покупатель выбирает ПВЗ на карте или в списке (Priority: P1)

Покупатель выбрал тариф «От двери до ПВЗ» (`apiship_doortopoint`). Открывается двухпанельный селектор: слева — список ПВЗ в радиусе города с адресом / часами / способами оплаты, справа — карта с пинами. По клику на пин или пункт в списке показывается карточка ПВЗ с фотографией (если есть в Apiship), временем работы, габаритными ограничениями. Кнопка «Выбрать этот пункт» возвращает покупателя в чекаут с заполненным полем «Пункт выдачи».

**Why this priority**: Доставка в ПВЗ — самый частый сценарий для B2C в РФ; без удобного выбора либо теряется конверсия, либо менеджеру приходится созваниваться.

**Independent Test**: Открыть селектор после выбора `apiship_doortopoint` для Москвы — карта показывает ≥ 20 ПВЗ, список совпадает, выбор пинна и кнопки «Выбрать» возвращает чекаут с подписью «СДЭК ПВЗ MSK123, ул. ...».

**Acceptance Scenarios**:

1. **Given** выбран тариф `doortopoint`, **When** селектор открыт, **Then** список ПВЗ загружается ≤2 с и показывает ≥1 пункт.
2. **Given** ПВЗ выбран, **When** покупатель вернулся в чекаут, **Then** в форме заказа сохранены `pointOutId`, `pointAddress`, виден компактный summary.
3. **Given** в радиусе нет ПВЗ выбранного провайдера, **When** список пуст, **Then** показывается понятное сообщение и предложение сменить тариф.
4. **Given** покупатель закрывает селектор без выбора, **When** возвращается в чекаут, **Then** тариф `doortopoint` остаётся неприменённым, рядом — текст «выберите пункт выдачи» вместо стоимости.

---

### User Story 3 — Менеджер создаёт отправление в ApiShip и получает этикетку (Priority: P1)

После того как заказ оплачен (`status=paid`) или менеджер вручную помечает счёт оплаченным, на карточке заказа в Payload Admin появляется кнопка «Создать отправление». По клику плагин формирует payload по `OrderRequest` Apiship: получатель из `customer`, точка назначения из `delivery`, позиции из `items`, отправитель и габариты по умолчанию из `ApiShipSettings`. Apiship возвращает `orderId`, плагин опрашивает до готовности `providerNumber` и URL PDF-этикетки, кладёт всё в `shipment` группу заказа. Кнопка «Этикетка PDF» и «Накладная PDF» становятся доступны.

**Why this priority**: Это операционная часть — без неё цикл не закрыт, менеджер уходит копировать данные в кабинет ApiShip вручную.

**Independent Test**: На созданном тестовом заказе нажать «Создать отправление» → за ≤30 с в карточке появляются `trackNumber`, ссылка на этикетку, ссылка на накладную; статус заказа меняется на `fulfilling`.

**Acceptance Scenarios**:

1. **Given** заказ `paid`, **When** менеджер нажимает «Создать отправление», **Then** вызывается `POST /api/admin/shipping/orders` → `OrdersApi.addOrder` ApiShip → в заказе сохраняется `shipment.providerOrderId`, статус → `fulfilling`.
2. **Given** Apiship не успел сгенерировать `providerNumber` за 10 попыток (≈30 с), **When** polling истёк, **Then** заказ остаётся в `fulfilling`, в `shipment.status = pending_label`, виден баннер «Этикетка генерируется, попробуйте позже».
3. **Given** Apiship вернул ошибку (например, неверный тариф), **When** запрос упал, **Then** заказ не меняет статус, ошибка показана менеджеру в Payload и продублирована в `AdminChangeLog`.
4. **Given** этикетка получена, **When** менеджер нажимает «Этикетка PDF», **Then** открывается `label_url` Apiship в новой вкладке.

---

### User Story 4 — Покупатель и менеджер видят статус доставки в реальном времени (Priority: P2)

ApiShip присылает webhook о смене статуса (принято в обработку, передано перевозчику, отгружено, прибыло в ПВЗ, вручено, возврат). Эндпоинт `/api/webhooks/apiship` валидирует подпись/IP, маппит провайдерский статус в наш `delivery_status`, обновляет `shipment.events`, поднимает статус заказа (`shipped` / `delivered` / при необходимости `cancelled`). Покупатель на публичной странице заказа `/cart/order/[token]/` видит таймлайн событий и кнопку «Отследить» с `trackingUrl`.

**Why this priority**: Сокращает входящие «где мой заказ?» в поддержку и снимает с менеджера ручное обновление трекинга.

**Independent Test**: В sandbox-кабинете ApiShip изменить статус тестового заказа → webhook прилетает → публичная страница заказа показывает новое событие; статус заказа в Payload поднимается.

**Acceptance Scenarios**:

1. **Given** webhook от Apiship с валидной подписью, **When** статус «Передан перевозчику», **Then** `shipment.events` пополняется, `orders.status` остаётся `fulfilling`, баннер на публичной странице обновляется.
2. **Given** webhook со статусом «Вручён», **When** обработан, **Then** `orders.status` → `delivered`, клиенту уходит email «заказ доставлен».
3. **Given** webhook не прошёл валидацию (битая подпись), **When** запрос пришёл, **Then** возвращается 401, событие сохраняется в `AdminChangeLog` с пометкой «invalid signature», заказ не меняется.
4. **Given** webhook задвоился (тот же `eventId`), **When** обработан повторно, **Then** идемпотентно — событие не дублируется в `shipment.events`.

---

### User Story 6 — Транзакционные email на критичных событиях (минимальный stub, Priority: P1)

В 047 реализован **минимальный** email-канал для самых критичных моментов: `order.paid`, `shipment.created` (трек), `shipment.delivered`, `order.completed`. Это не полноценная инфраструктура уведомлений — а простой прямой вызов выбранного email-провайдера (Postmark/Mailgun) из доменного события, без шаблонизатора, без матрицы, без SMS, без opt-out. После релиза 049 этот stub снимается, US6 целиком переезжает в 049.

**Why this priority**: без минимальных email клиент в MVP «оплатил и забыл» — невозможно сопровождать заказ. Полноценный 049 потребует больше времени, но 4 шаблона стартового стек закрывает.

**Independent Test**: тестовый заказ → дойти до paid → получить T-001; создать отправление → получить T-003; пометить delivered → получить T-005; через 14 дней auto-closure → получить T-008. Все письма идут через один настроенный провайдер.

**Acceptance Scenarios**:

1. **Given** заказ оплачен, **When** webhook ЮKassa, **Then** клиенту уходит email `T-001` в течение 60 с.
2. **Given** создано отправление в ApiShip, **When** trackingNumber получен, **Then** клиенту `T-003` с треком.
3. **Given** webhook ApiShip → delivered, **When** обработан, **Then** клиенту `T-005`.
4. **Given** заказ автоматически закрыт (US7), **When** статус → completed, **Then** клиенту `T-008` с ссылкой на отзыв.
5. **Given** email-провайдер недоступен, **When** письмо не уходит, **Then** ошибка логируется, заказ не блокируется (письмо упустим, ретраев в 047 нет — это задача 049).

> **Все остальные сценарии** (SMS, ПВЗ-напоминания, courier_today, alerts менеджеру по stuck/error, dedup, queue, retry, opt-out) — в спеке **049-customer-notifications**.

---

### User Story 7 — Сделка закрывается автоматически после доставки (Priority: P2)

После статуса `delivered` запускается окно «период возврата» (по умолчанию **14 дней**). По истечении окна, если не было инициировано возврата или диспута, заказ автоматически переходит в `completed`, клиенту уходит письмо с просьбой оценить покупку или оставить отзыв, в Twenty CRM сделка переводится в `Won.Closed`.

**Why this priority**: Закрытие сделки — обязательный шаг для корректной воронки, LTV-метрик и пост-продажной коммуникации. Без него `delivered` копятся бесконечно.

**Independent Test**: В тестовой среде создать заказ со штампом `deliveredAt = now() - 15 дней`, прогнать cron → заказ становится `completed`, на тестовый email приходит `T-008`. (Если 048 включена — дополнительно Twenty Opportunity.stage → `Won.Closed`; в самой 047 этой проверки нет.)

**Acceptance Scenarios**:

1. **Given** заказ в `delivered` с `deliveredAt > closureWindowDays` назад, **When** cron сработал, **Then** статус → `completed`, `closedAt = now()`.
2. **Given** заказ перешёл в `completed`, **When** afterChange-hook сработал, **Then** уходит `T-008` (через email-stub) и эмитится `order.completed` через `emitDomainEvent` (для подписчиков 048/049, если они подключены).
3. **Given** менеджер вручную пометил заказ как «диспут / возврат», **When** cron сработал, **Then** заказ остаётся в `delivered` или переходит в `returned` (по решению менеджера), но не в `completed`.
4. **Given** заказ в `completed`, **When** менеджер пытается изменить статус, **Then** изменение возможно только через явную «реоткрыть сделку» (audit в `AdminChangeLog`).

---

### User Story 8 — Event emitter для будущих интеграций (Priority: P1, инфраструктура)

В 047 реализован `emitDomainEvent(event, order, payload)` — единая точка эмита доменных событий (`order.identified`, `order.created`, `order.paid`, `shipment.created`, `shipment.in_transit`, `shipment.at_point`, `shipment.delivered`, `order.completed`, `order.cancelled`). На MVP подключены только две стороны: минимальный email-stub (US6) и Twenty CRM (только если включена 048). Это закладывает фундамент для 048/049 без переделок 047.

**Why this priority**: Без emitter невозможно потом подключить 048/049. Минимальная имплементация — 100 строк кода.

**Independent Test**: добавить тестовый подписчик в `lib/lifecycle/events.ts` → на каждое доменное событие в нём появляется лог.

**Acceptance Scenarios**:

1. **Given** реализован `emitDomainEvent`, **When** заказ становится `paid`, **Then** все подписчики (email stub + опц. Twenty) получают событие.
2. **Given** один из подписчиков бросил исключение, **When** event эмитится, **Then** остальные подписчики продолжают работу (не блокирующий мост).

> **Twenty CRM** — отдельная спека **048-twenty-crm-sync**; в 047 — только подписка на emitter, без логики.

---

### User Story 5 — Администратор настраивает интеграцию ApiShip (Priority: P2)

Владелец/администратор открывает Payload Admin → Globals → «Доставка / ApiShip». В одной форме задаёт: токен, режим (тест/прод), URL webhook-приёмника, параметры отправителя (страна, адрес одной строкой, контакт, телефон), габариты по умолчанию (Д×Ш×В, вес), ставку НДС на доставку, флаг «использовать наложенный платёж», карту соответствий `connectionsMap` (наш склад → склад в ApiShip), список разрешённых тарифов / отключение конкретных провайдеров. После «Сохранить» делается лёгкий ping (`/lists/services`) и в карточке показывается статус «соединение OK / ошибка».

**Why this priority**: Хотя интеграция «работает и без формы» (через env), нам нужны редактируемые отправитель/габариты/НДС и аудит изменений в `AdminChangeLog` — это часть требования «integration settings» из AGENTS.md.

**Independent Test**: Открыть глобал, ввести валидный sandbox-токен → нажать «Проверить соединение» → видеть «OK», список доступных провайдеров.

**Acceptance Scenarios**:

1. **Given** настройки заполнены и сохранены, **When** запускается расчёт стоимости, **Then** используются именно эти отправитель/габариты/НДС.
2. **Given** токен пустой, **When** покупатель открывает чекаут, **Then** ApiShip-блок не показывается, корзина откатывается на «3–4 фиксированных варианта» из 037-спеки.
3. **Given** в `connectionsMap` указан склад A→ApiShip-склад X, **When** менеджер выбирает «отправить со склада A», **Then** заказ улетает в ApiShip с `connectionId = X`.

---

### Edge Cases

- Корзина пустая или сумма ниже минимальной у провайдера → блок «Доставка» показывает поясняющее сообщение, расчёт не запускается.
- Адрес неполный (нет дома или индекса) → расчёт отложен, поле подсвечено.
- Габариты больше, чем поддерживает выбранный тариф → тариф исключается из списка с пометкой «по габаритам не подходит».
- Сетевой таймаут ApiShip → показывается degraded-режим «расчёт временно недоступен», офер «оформить заявку, мы рассчитаем доставку вручную».
- Заказ создан, но менеджер отменяет до отправления → `OrdersApi.cancelOrder`, статус → `cancelled`, аудит в `AdminChangeLog`.
- Возврат от покупателя (стадия 2) → переходит в отдельную follow-up спецификацию; в этой фиксируем только заглушку поля `returnShipment` и интерфейс.
- Webhook задержан → событие применяется с временной меткой Apiship, а не получения; защита от out-of-order по `eventAt`.
- Тариф «По двери до двери» выбран, но адрес попал в зону, где провайдер делает только ПВЗ → перерасчёт, тариф пропадает, селектор предлагает альтернативы.
- **Цена доставки изменилась между выбором и переходом к оплате** → finalize-расчёт детектирует расхождение; при `delta > max(5%, 100 ₽)` — модал «Цена изменилась X → Y» с выбором: принять / сменить тариф / отменить.
- **Тариф пропал между выбором и оплатой** (провайдер отключил, регион перестал обслуживаться) → 409 RATE_UNAVAILABLE, возврат к шагу выбора с уведомлением.
- **Email-провайдер недоступен (для email-stub из 047)** → ошибка логируется, основной флоу не блокируется; полноценная очередь с retry — в **049** (`notification-jobs`).
- **Twenty CRM недоступен** → событие не дойдёт; очередь и retry — в **048** (`crm-sync-jobs`). Заказ оформляется без задержек.
- **Email-провайдер не настроен** → 047 работает в dry-run режиме (FR-116), писем не уходит, но в `AdminChangeLog` есть запись.
- **Дубликат webhook ЮKassa или ApiShip** → идемпотентность по `eventId`; уведомления не дублируются благодаря ключу `orderId+event+channel+recipient`.
- **Покупатель не согласился на канал «мессенджер»** в чекауте → email-канал остаётся обязательным для транзакционных писем; messenger-job, если в матрице 049 есть правило, будет `skipped, reason=opt_out`. SMS-канал не существует в принципе (решение 2026-05-23).
- **ПВЗ срок хранения истёк, посылка возвращается** → webhook `at_point → returned`; статус заказа не понижается до `cancelled` автоматически, менеджер решает вручную.
- **Менеджер вручную закрыл сделку в Twenty** (Opportunity.stage = Lost) → в фазе 2 (048) синхронизируется обратно в `orders.status = cancelled`; на MVP 047 — игнорируется (read-only из Twenty).
- **Заказ в `delivered` дольше окна возврата, но менеджер пометил «диспут»** → автоматический переход в `completed` блокируется, заказ остаётся в `delivered` до ручного решения.

## Requirements *(mandatory)*

### Functional Requirements

#### FR-1xx — Расчёт стоимости и тарифы

- **FR-101**: System MUST вычислять стоимость доставки через `CalculatorApi.getCalculator` ApiShip на основе адреса покупателя, габаритов, веса и денежной стоимости товаров.
- **FR-102**: System MUST кэшировать результат расчёта на стороне сервера по ключу `apiship:calc:{cartId}:{shippingOptionId}` со сроком жизни 30 минут (заимствуем механизм `saveCalculationWorkflow`/`getCalculationWorkflow` из Medusa-плагина).
- **FR-103**: System MUST поддерживать 4 типа тарифа: `doortodoor`, `doortopoint`, `pointtodoor`, `pointtopoint`.
- **FR-104**: System MUST выбирать «cheapest tariff» по умолчанию для каждого типа доставки (`getCheapestTariff`).
- **FR-105**: System MUST уметь скрывать тарифы по `connectionsMap` / black-list в настройках.
- **FR-106**: System MUST падать в graceful-degraded режим (fallback к фиксированным опциям из 037-спеки) при ошибке/таймауте ApiShip.
- **FR-107**: System MUST на шаге «Проверьте заказ» (см. screens.md S10) выполнять финальный refresh-расчёт тарифа и сохранять `Order.delivery.priceSnapshot { cost, currency, capturedAt, sourceCacheKey, refreshCheckAt }`. Снимок становится единственным источником истины для платежа.
- **FR-108**: System MUST при расхождении цены `delta > max(5%, 100 ₽)` между выбранной и текущей возвращать `409 PRICE_CHANGED` с обоими значениями; UI показывает модал S11 с выбором «Принять новую / Сменить тариф / Отменить». Если тариф пропал — `409 RATE_UNAVAILABLE`.
- **FR-109**: System MUST после старта платёжной сессии ЮKassa не пересчитывать стоимость доставки до её завершения (`paid` / `canceled` / `expired`).
- **FR-110**: System MUST хранить immutable snapshot строк заказа (`items[].priceSnapshot`) и итоговых сумм (`totals.snapshot`) на момент finalize — для аудита и возможных возвратов.
- **FR-111**: System MUST при `cancel/failure` платёжной сессии сохранять Order в статусе `pending_payment` ещё `paymentRetryWindowMin` минут (по умолчанию 30); в этом окне snapshot и тариф сохраняются, клиент может повторить оплату по той же ссылке `/cart/order/[token]/retry-payment/`. По истечении окна — `expired`.
- **FR-112**: System MUST при price mismatch (FR-108) и явном отказе клиента не создавать Order; кэш расчётов остаётся, корзина сохраняется.
- **FR-113**: System MUST для юрлиц поддерживать дополнительное поле `Order.customer.secondaryEmails[]` — список emailов получателей admin-уведомлений (бухгалтерия / закупка / директор); шлёт `T-001`/`T-003` на все.
- **FR-114**: System MUST при одновременном получении нескольких webhook'ов на один Order сериализовать обновления (PostgreSQL `FOR UPDATE` через Payload `req.transactionID` или явный `SELECT ... FOR UPDATE`); конфликтующие версии разрешаются по `eventAt`.
- **FR-115**: System MUST валидировать email клиента в форме чекаута (RFC syntactic check + опционально DNS MX-check); подтверждение email по ссылке — out of scope (в 049).
- **FR-116**: System MUST поддерживать «dry-run» режим email-stub (env `EMAIL_SANDBOX=true` или отсутствие `EMAIL_API_KEY`): письма не отправляются, content логируется в `AdminChangeLog`. Это позволяет деплоить 047 без выбора email-провайдера (Q1 из order-lifecycle).
- **FR-117**: `order.identified` эмитится один раз в момент первого сабмита формы Identify (email + phone validated, до создания Order). При повторном сабмите с теми же данными — не дублируется (idempotent по `cartId+email`).
- **FR-118**: `shipment.*` события эмитятся один раз на каждый **первый переход** в новый internal status. Если webhook ApiShip пришёл с тем же internal status, что уже есть в `shipment.status`, — событие не эмитится повторно (но запись в `shipment.events[]` для аудита добавляется).

#### FR-13xx — Внешние сервисы (Яндекс.Карты, DaData)

- **FR-1301**: System MUST интегрировать **Яндекс.Карты v3 JS API** в селекторе ПВЗ (S2). Ключ хранится в `apiShipSettings.yandexMapsApiKey` (Payload global) и/или env `YANDEX_MAPS_API_KEY`. Карты не загружаются для пользователей, не дошедших до селектора (lazy-load).
- **FR-1302**: System MUST показывать обязательный баннер «© Я.Карты» по правилам Яндекс.Карт API.
- **FR-1303**: System MUST интегрировать **DaData** для подсказок и нормализации адреса:
  - Suggest API — для подсказок при вводе адреса (debounce 300 мс, server-side proxy).
  - Clean API — для нормализации перед сохранением в Order (получение `kladrId`, `fiasId`, `lat/lon`, `postalCode`).
- **FR-1304**: System MUST хранить токены DaData в `apiShipSettings.dadata.{apiKey,secret}` и/или env `DADATA_API_KEY`/`DADATA_SECRET`. Secret никогда не выходит за пределы сервера.
- **FR-1305**: System MUST в degraded режиме (DaData недоступен) разрешать ручной ввод адреса с предупреждением «адрес сохранён как введён, проверьте корректность».
- **FR-1306**: System MUST сохранять в `Order.delivery.addressNormalized` полный DaData-объект (kladrId, fiasId, координаты, флаги качества) для будущих сверок.
- **FR-1307**: System MUST уважать тарифные лимиты DaData (free: 10k запросов/сутки): кэшировать ответы по нормализованной строке адреса, fallback на «сырой» ввод при превышении лимита.

#### FR-2xx — ПВЗ

- **FR-201**: System MUST отдавать список ПВЗ по городу/радиусу через `ListsApi.getListPoints` ApiShip, ограничивая результат тарифом и габаритами товара.
- **FR-202**: System MUST показывать ПВЗ в виде списка и карты (Яндекс.Карты или OpenStreetMap, решается в plan.md).
- **FR-203**: System MUST хранить в заказе `delivery.pointId`, `delivery.pointAddress`, `delivery.providerKey` после выбора.

#### FR-3xx — Создание отправления

- **FR-301**: System MUST формировать payload `OrderRequest` Apiship через адаптер `mapToApishipOrderRequest` (заимствуем из плагина, перепиливаем под наш Order).
- **FR-302**: System MUST вызывать `OrdersApi.addOrder` только после `paid` или явного решения менеджера.
- **FR-303**: System MUST с polling-ом получать `providerNumber`, `trackingUrl`, URL PDF-этикетки (до 10 попыток, экспоненциальный backoff 0.5–5 с — точная калька с `executeWithRetry`).
- **FR-304**: System MUST сохранять в Order поля `shipment.providerOrderId`, `shipment.trackingNumber`, `shipment.trackingUrl`, `shipment.labelUrl`, `shipment.waybillUrl`, `shipment.providerKey`, `shipment.tariffId`, `shipment.createdAt`, `shipment.status`, `shipment.events[]`.
- **FR-305**: System MUST поддерживать отмену отправления через `OrdersApi.cancelOrder` до момента фактической отгрузки.
- **FR-306**: System MUST уметь повторно запросить этикетку (`getLabels`) и накладную (`getWaybills`).

#### FR-4xx — Webhook и статусы

- **FR-401**: System MUST принимать webhook ApiShip на `POST /api/webhooks/apiship`.
- **FR-402**: System MUST валидировать подпись/секрет webhook (HMAC-SHA256 над телом по согласованному секрету; конкретный механизм Apiship уточняется в plan.md → research.md).
- **FR-403**: System MUST быть идемпотентной по `eventId` (де-дупликация в `shipment.events`).
- **FR-404**: System MUST маппить провайдерский статус Apiship → внутренний `delivery_status` (таблица в data-model.md).
- **FR-405**: System MUST повышать `orders.status` по детерминированным правилам (`shipped`, `delivered`, `cancelled`).
- **FR-406**: System MUST уметь обрабатывать webhook'и в обратном порядке времени (out-of-order) корректно — событие с более ранним `eventAt` не должно понижать статус.
- **FR-407**: System MUST реализовать `emitDomainEvent(event, order, payload)` в `lib/lifecycle/events.ts` — единая точка эмита доменных событий жизненного цикла; подписчики регистрируются на старте.
- **FR-408**: System MUST подключить минимальный email-stub к 4 событиям: `order.paid` (T-001), `shipment.created` (T-003), `shipment.delivered` (T-005), `order.completed` (T-008). Шаблоны — простые TS-функции без шаблонизатора.
- **FR-409**: System MUST хранить `pickupExpiresAt` в `Order.delivery` для использования в 049 (расчёт напоминания за 24 ч — задача 049).
- **FR-410**: System MUST логировать каждый emit события в `AdminChangeLog` (с маской ПДн) для аудита и future-debug.
- **FR-411**: System MUST не блокировать основной флоу, если подписчик emit'а бросил исключение (try/catch around каждый sub).
- **FR-412**: System MUST публиковать в `emitDomainEvent` достаточный payload для всех будущих consumer'ов (см. `contracts/event-payload.ts`).

> **Полноценная матрица уведомлений (email/SMS, dedup, queue, retry, opt-out, ПВЗ-напоминания, courier_today, alerts менеджеру)** — переехала в **049-customer-notifications** (FR-49xx).

#### FR-5xx — Настройки и админка

- **FR-501**: System MUST хранить настройки ApiShip в Payload Global `apiShipSettings` (отдельный конфиг от существующих `system-config`).
- **FR-502**: System MUST уметь делать ping-проверку соединения (`ListsApi.getServices` — простой read-only вызов).
- **FR-503**: System MUST логировать все админ-изменения настроек в `AdminChangeLog` (см. `apps/web/src/collections/AdminChangeLog.js`).
- **FR-504**: System MUST логировать все исходящие/входящие запросы к ApiShip в `shipping_logs` (новая коллекция, или ротация в logger).
- **FR-505**: System MUST не выводить токен ApiShip на клиент. Все запросы к ApiShip проходят через server-side Next.js route handler или Payload endpoint.

#### FR-6xx — Безопасность и приватность

- **FR-601**: System MUST не сохранять полные ПДн (паспорт, СНИЛС) — только то, что нужно для доставки (ФИО, телефон, email, адрес).
- **FR-602**: System MUST давать публичный доступ к статусу заказа только по `publicToken` (как уже принято в `orders` Payload).
- **FR-603**: System MUST скрывать от анонимных пользователей токен ApiShip, секреты webhook, внутренний `connectionsMap`.

#### FR-9xx — Закрытие сделки

- **FR-901**: System MUST расширить `orders.status` значениями `completed` (сделка закрыта) и `returned` (возврат от покупателя).
- **FR-902**: System MUST хранить `orders.deliveredAt`, `orders.closedAt`, `orders.disputeFlag` (bool) для управления окном закрытия.
- **FR-903**: System MUST через cron-задачу проверять заказы в `delivered` с `deliveredAt < now() - closureWindowDays` (по умолчанию 14, конфигурируется в `apiShipSettings.closureWindowDays`) и переводить их в `completed` при отсутствии `disputeFlag`.
- **FR-904**: System MUST при переходе в `completed` эмитить `order.completed` через `emitDomainEvent`. Email-stub из FR-408 подпишется и отправит `T-008`. Twenty Opportunity.stage = `Won.Closed` — задача 048-twenty-crm-sync (подписчик на том же событии).
- **FR-905**: System MUST блокировать переход `completed → *` без явного действия «Реоткрыть сделку» в Payload Admin с записью в `AdminChangeLog`.

#### FR-10xx — Алерты владельцу про ApiShip

- **FR-1001**: System MUST алертить владельца при `shipment.status = error` для отдельного заказа — запись в `AdminChangeLog` + email (через stub из FR-408) на адрес владельца.
- **FR-1002**: System MUST алертить владельца при недоступности ApiShip API >15 минут подряд.

> **Alerts «застрял в статусе», «ПВЗ через 24 ч»** — это часть полной матрицы 049.

#### FR-12xx — Schema-задел для Twenty CRM (только инфраструктура)

- **FR-1210**: System MUST в Payload `orders` хранить группу `crmRefs { opportunityId, personId, companyId, lastSyncedAt, lastSyncStatus, lastSyncError }` — заполнение этой группы делает 048, в 047 — только schema.
- **FR-1211**: System MUST через `emitDomainEvent` (FR-407) предоставлять все нужные 048 события с достаточным payload (см. `contracts/event-payload.ts`).

> **Сами интеграционные операции с Twenty (GraphQL, маппинг, миграция полей, очередь sync, авто-задачи менеджеру, двунаправленность)** — переехали в **048-twenty-crm-sync** (FR-48xx).

### Key Entities

- **ApiShipSettings (Payload global)**: токен, isTest, webhookSecret, отправитель (адрес, контакт, телефон, страна), `defaultProductSizes`, `deliveryCostVat`, `isCod`, `connectionsMap[]`, `disabledProviders[]`, `allowedDeliveryTypes[]`.
- **Order.delivery (расширение)**: `provider` (apiship | fallback), `providerKey` (cdek/boxberry/...), `tariffId`, `deliveryType` (1/2), `pickupType` (1/2), `pointId`, `pointAddress`, `cost`, `etaMin`, `etaMax`, `selectedAt`.
- **Order.shipment (новая группа)**: `providerOrderId`, `trackingNumber`, `trackingUrl`, `labelUrl`, `waybillUrl`, `status` (pending|created|pending_label|in_transit|at_point|delivered|returned|cancelled|error), `events[]` (eventId, status, providerStatus, message, at, payload), `createdAt`, `cancelledAt`, `errorMessage`.
- **ShippingCalculationCache (Payload collection или KV-таблица)**: `key`, `data` (raw tariff response), `expiresAt`. Маленькая, ротируется.
- **ShippingLog (Payload collection, опционально)**: `direction` (out/in), `endpoint`, `requestId`, `status`, `body`, `at`, `orderId?`.
- **Order.crmRefs (только schema, заполнение в 048)**: `opportunityId`, `personId`, `companyId`, `lastSyncedAt`, `lastSyncStatus`, `lastSyncError`.

> **NotificationJob и CrmSyncJob** — теперь в спеках 049 и 048 соответственно.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Покупатель видит реальные тарифы в чекауте за **p95 ≤ 2 с** после ввода адреса (кэш holdup для повторных адресов p95 ≤ 200 мс).
- **SC-002**: ≥95% оплаченных заказов получают `providerOrderId` от ApiShip за **≤30 с** после нажатия «Создать отправление».
- **SC-003**: ≥99% webhook-ов обрабатываются за **≤500 мс** и не более 0.1% дубликатов попадает в `shipment.events`.
- **SC-004**: Конверсия чекаут → оплата в сегменте «физлицо» вырастет не менее чем на **20% к/к** после релиза (vs. текущие фиксированные варианты с «уточняется»).
- **SC-005**: Менеджеры тратят на оформление одного отправления не более **30 секунд** (от клика «Создать отправление» до открытой этикетки).
- **SC-006**: Доля заказов с ручной правкой адреса/тарифа в Payload после оплаты — **≤3%** (косвенный показатель корректности расчёта).
- **SC-007**: Все исходящие запросы к ApiShip и все webhook'и логируются в `shipping_logs` с TTL 90 дней, ни одного потерянного события за 30 дней наблюдения.
- **SC-008**: ≥95% транзакционных email-stub (4 шаблона) уходят в течение 2 минут от события за 30 дней наблюдения. (Полноценный SLA — в 049.)
- **SC-009**: 100% доменных событий правильно эмитятся (проверка через тестовый подписчик-сборщик в CI).
- **SC-010**: Доля заказов, успешно переведённых в `completed` автоматом, ≥95% (остальные требуют ручного решения по диспутам/возвратам).

> **Метрики ПВЗ-возвратов, SMS-доставляемости, full notifications SLA** — целевые в 049. Метрики Twenty CRM — в 048.

## Assumptions

- У Soliton есть подписанный договор с ApiShip и реальный токен (для прод) + sandbox-токен (для разработки). Если договора нет — фича остаётся за флагом, активной фоллбэк-схемой работает 037.
- Габариты товаров хранятся в `products` (поля длина/ширина/высота/вес уже предусмотрены `product-attributes-spec.md`). Если у SKU габаритов нет — используется `defaultProductSizes` и в лог пишется warning.
- ЮKassa (или эквивалент) уже подключена по 037-спеке: статусы заказа `paid` / `awaiting_payment` существуют. **Зависимость**: webhook ЮKassa (роут `/api/webhooks/yookassa` из 037) должен после установки статуса `paid` вызывать `emitDomainEvent("order.paid", order, payload)` из этого 047. Это правка существующего роута, фиксируется как задача T133 в tasks.md.
- Карты: **Яндекс.Карты v3 JS API** (решение от 2026-05-23). Баннер «© Я.Карты» обязателен. Ключ — отдельная задача (Q6 в plan.md).
- Webhook от ApiShip публикуется на HTTPS-эндпоинте (Vercel/наш сервер); cекрет хранится в env + Payload global.
- Возвраты, заказ курьера на забор, B2B-сценарий «оплата по счёту + автотрек» — **в скоупе только заглушки и интерфейс**; полноценная реализация — в отдельной спеке `048-apiship-returns-and-courier` (на этап 4 дорожной карты).
- Стек неизменён: Next.js 16, Payload 3, PostgreSQL. Никаких зависимостей на `@medusajs/*` мы не добавляем — из плагина копируем только то, что переносимо (axios-клиент, маппинги, паттерны).

## Borrowed From Medusa Plugin (Reference)

Что предполагается перенести/адаптировать из `packages/medusa-fulfillment-apiship@0.2.1`:

| Из плагина | Куда у нас | Что меняем |
|---|---|---|
| `src/lib/apiship-client` (сгенерированный typescript-axios клиент) | `apps/web/src/lib/shipping/apiship/client/` | оставляем как есть, заново генерим из свежего OpenAPI Apiship через тот же `openapi-generator-cli` |
| `core/apiship-base.ts` (`calculatePrice`, `createFulfillment`, `executeWithRetry`, `waitForOrderInfo`, `waitForLabelUrl`, `getShipmentDocuments`, `cancelFulfillment`) | `apps/web/src/lib/shipping/apiship/provider.ts` | переписываем под наш `ShippingProvider` интерфейс, выкидываем зависимости от `AbstractFulfillmentProviderService`, `Logger` из `@medusajs/framework` |
| `services/apiship.ts` (4 типа `getFulfillmentOptions`) | `apps/web/src/lib/shipping/apiship/options.ts` | оставляем структуру, переводим лейблы в наш i18n |
| `utils/` (`getCheapestTariff`, `mapToApishipOrderRequest`, `mapToApishipCalculatorRequest`) | `apps/web/src/lib/shipping/apiship/mappers.ts` | адаптируем под наш `Order` / `Cart` |
| `api/store/apiship/{points,[shipping_option_id]/calculate}` | `apps/web/src/app/api/shipping/{points,calculate}/route.ts` | переписываем под App Router Next.js + Payload session |
| `workflows/{get-calculation,save-calculation,get-shipping-option,get-stock-location,get-point-addresses}` | внутренние сервисные функции в `lib/shipping/apiship/cache.ts` | без Medusa-workflows; кэш в PG или Payload collection |
| `modules/apiship/services/apiship-settings-service.ts` | Payload global `apiShipSettings` | замена на Payload Globals API |
| OpenAPI спека (`openapi/upstream.yaml`) | `apps/web/src/lib/shipping/apiship/openapi/upstream.yaml` | переиспользуем |

Что не берём:
- Medusa admin extension (UI плагина) — у нас Payload Admin, рисуем своё.
- Mikro-ORM модели — у нас Payload + Postgres через `@payloadcms/db-postgres`.
- Awilix DI — у нас простые модули + Next.js route handlers.

## Out Of Scope (для этой спеки)

- Возвратные отправления (`createReturnFulfillment`) — заглушка интерфейса + follow-up в 048.
- Заявка на забор курьером (`courier pickup`) — то же.
- Мультискладская маршрутизация с автовыбором склада — пока 1 склад, `connectionsMap` опционален.
- Прямая интеграция СДЭК/Деловые Линии (минуя ApiShip) — отдельная фича, если потребуется по объёмам B2B.
- B2B-сценарий «отправка по счёту со сложным документооборотом» — закрывается тем же ядром, но UX-нюансы — в follow-up.
- **Полноценная Twenty CRM интеграция** (GraphQL клиент, маппинг сущностей, очередь sync с retry, миграция custom fields, авто-задачи менеджеру, двунаправленность) — переехала целиком в спеку **048-twenty-crm-sync**. В 047 остаётся только schema поля `Order.crmRefs` и публикация событий через emitDomainEvent.
- **Полноценный модуль уведомлений** (шаблонизатор React-email, очередь notification-jobs с retry/dedup, SMS-канал, opt-out, ПВЗ-напоминания, alerts менеджеру по stuck/error, маркетинговые письма) — переехала целиком в спеку **049-customer-notifications**. В 047 остаётся **минимальный stub** для 4 транзакционных email (T-001/T-003/T-005/T-008) через прямой вызов одного провайдера, без queue/dedup/retry. После релиза 049 stub снимается.
- **Telegram-бот менеджера** — отдельная спека 050, отложено.
- **Cart abandonment** (`cart.abandoned` email через 1 час) — в 049.
- **NPS-опрос** как полноценная фича с дашбордом — в 049; в 047 — только отправка письма `T-008`.
- **Возвраты денег по отменам/возвратам** — отдельный процесс, требует доработки платежного модуля 037.

## Trace To Roadmap

Покрывает «Этап 3» из `05-implementation-roadmap/russian-payment-delivery-aggregators.md` («ApiShip, расчёт доставки, ПВЗ, СДЭК через ApiShip, трекинг») целиком.
