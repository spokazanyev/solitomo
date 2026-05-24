# Feature Specification: Returns & Refunds

**Feature Branch**: `053-returns-and-refunds`

**Created**: 2026-05-23

**Status**: Draft

**Input**: Полноценная сущность `Return` с жизненным циклом (запрошен → одобрен → товар принят → деньги возвращены), частичными возвратами по позициям, интеграцией с ЮKassa Refunds API и ApiShip return-shipment, налоговыми последствиями (корректировочный счёт-фактура для юрлица, чек коррекции по 54-ФЗ). Сейчас возврат отражается единственным флагом `Order.disputeFlag: bool` + статус `returned` — этого недостаточно для реального операционного и юридического цикла.

## Контекст и связи

- **Канонический документ**: `07-build-specifications/order-lifecycle-spec.md §6` (раздел «Возвраты и закрытие сделки»). Эта спека реализует то, что лайфсайкл-документ описывает декларативно.
- **Зависимости**:
  - **037 (cart & checkout)** — даёт публичную страницу `/cart/order/[token]/`, на которую вешается секция «Оформить возврат».
  - **047 (ApiShip)** — `ShippingProvider` интерфейс, который расширяется методами `createReturnShipment` / `cancelShipment`. `emitDomainEvent` используется как шина событий.
  - **048 (Twenty CRM)** — события `return.created` / `return.refunded` синхронизируются в CRM как Activity на Opportunity (новые правила в `crm-sync-matrix`).
  - **049 (notifications)** — новые шаблоны email `T-015` («возврат одобрен, инструкция») и `T-016` («возврат завершён, деньги возвращены»).
  - **ЮKassa (часть 037)** — REST `POST /v3/refunds`. Документ возврата ссылается на `paymentId`, который Soliton хранит в `Order.payment.providerPaymentId`.
- **Правовая база (РФ)**:
  - **Закон РФ от 07.02.1992 № 2300-1** «О защите прав потребителей», ст. 26.1 — дистанционная продажа: товар надлежащего качества можно вернуть в течение **7 дней** после получения; до получения — в любое время; при отсутствии письменной информации о порядке/сроках — **3 месяца**. Товар ненадлежащего качества — общие правила ст. 18 (срок до 15 дней для технически сложного товара, далее — гарантия).
  - **Постановление Правительства РФ № 2463 от 31.12.2020** — перечень непродовольственных товаров надлежащего качества, не подлежащих обмену/возврату.
  - **54-ФЗ «О применении ККТ»** — при возврате денежных средств покупателю формируется **чек коррекции** (признак расчёта «возврат прихода»), фискализация через подключённую онлайн-кассу.
  - **НК РФ ст. 169** — при возврате товаров плательщику НДС выставляется **корректировочный счёт-фактура** (УПД со статусом 1, признак «возврат»).
- **Текущее состояние кода (`apps/web/src/collections/Orders.js`)**: единственный механизм — `disputeFlag: checkbox` (стр. 269) и значение статуса `returned` (стр. 59, 223). Нет коллекции `returns`, нет частичных возвратов, нет связи с refund в платёжной системе, нет интеграции с CreditMemo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Покупатель оформляет возврат с публичной страницы заказа (Priority: P1)

На странице `/cart/order/[token]/` (доступна по immutable-токену из 037) после `status = delivered` показывается блок «Оформить возврат». По клику открывается форма `/cart/order/[token]/return/`: чекбоксы напротив позиций (с указанием доступного к возврату количества — учитывает уже оформленные возвраты), для каждой выбранной позиции — селект «Причина» из enum (`defect` / `wrong-item` / `not-needed` / `other`) и опционально текстовое поле «Состояние / комментарий», обязательное поле «Способ возврата денег» (по умолчанию — на ту же карту, что и оплата), общий комментарий. Submit — создаётся `Return` со статусом `requested`, клиенту показывается номер `RT-YYYY-NNNN` и баннер «Заявка принята; менеджер свяжется в течение 1 рабочего дня».

**Why this priority**: без публичной формы единственный канал — звонок/письмо в поддержку, что плодит ошибки и не даёт юридически зафиксировать дату обращения (критично для 7-дневного окна ст. 26.1).

**Independent Test**: оформить тестовый заказ → довести до `delivered` → открыть `/cart/order/[token]/` → нажать «Оформить возврат» → выбрать 1 из 2 позиций → отправить → получить номер RT-2026-0001 → в Payload Admin появилась запись.

**Acceptance Scenarios**:

1. **Given** заказ `delivered`, `customerType = physical`, доступны 3 позиции, **When** покупатель выбирает 2 и указывает причины, **Then** создаётся `Return.status = requested` с двумя `items[]`, остаток третьей позиции остаётся доступным для будущих возвратов.
2. **Given** заказ `delivered` 20 дней назад без письменной памятки (worst case — 3 месяца по ст. 26.1), **When** клиент оформляет возврат, **Then** заявка принимается, в `Return.statusReason` помечается `outside_default_window` (требует решения менеджера).
3. **Given** заказ `delivered` 5 дней назад, **When** клиент оформляет возврат всех позиций, **Then** заявка принимается без особых пометок (внутри 7-дневного окна).
4. **Given** клиент оформил возврат и через 5 минут хочет добавить ещё позицию, **When** открывает форму повторно, **Then** видит существующую заявку и кнопку «Дополнить» (создаст вторую `Return` или вернёт ошибку, если первая уже одобрена — решает менеджер).
5. **Given** статус заказа `paid` (ещё не отгружен), **When** клиент пытается открыть `/return/`, **Then** показывается сообщение «До отгрузки возврат не нужен — отмените заказ» с CTA «Отменить».

---

### User Story 2 — Менеджер одобряет заявку и отправляет клиенту инструкцию (Priority: P1)

В Payload Admin появилась коллекция `returns` с фильтром «Активные заявки» (статус ≠ `refunded`/`rejected`/`cancelled`). На карточке `Return` менеджер видит: позиции, причины, фотографии (если клиент приложил), окно «Проверка» (≤ срока, ИНН/КПП юрлица), кнопки **«Одобрить»**, **«Отклонить»**, **«Запросить доп. фото»**. По «Одобрить» — `status = approved`, отправляется email `T-015` с инструкцией: куда отправлять (адрес склада из настроек), что приложить (копия заявления + копия паспорта если > 10 000 ₽ — для физлица), сроки.

**Why this priority**: без понятной инструкции клиенту 70 % возвратов теряют товар или приходят в неполной комплектации; менеджер не должен писать руками каждое письмо.

**Independent Test**: создать тестовый `Return` → в админке кликнуть «Одобрить» → на mailtrap прилетает T-015 с правильным адресом склада, списком позиций, ссылкой на PDF-заявления (если генерируется) → `Return.status = approved`, `approvedAt = now()`.

**Acceptance Scenarios**:

1. **Given** `Return.status = requested`, **When** менеджер кликает «Одобрить», **Then** статус → `approved`, `approvedAt = now()`, отправляется `T-015`, в Twenty создаётся Activity «Return approved».
2. **Given** `Return.status = requested`, **When** менеджер кликает «Отклонить» и обязательно заполняет `statusReason`, **Then** статус → `rejected`, отправляется отдельный шаблон (T-015-rejected) с обоснованием.
3. **Given** заявка оформлена на товар из «перечня невозвратных» (например, парфюмерно-косметический товар вскрытый), **When** менеджер открывает карточку, **Then** виден баннер «Внимание: товар из перечня ПП РФ № 2463 — возврат возможен только при недостатках».

---

### User Story 3 — Менеджер фиксирует получение и инициирует возврат денег в ЮKassa (Priority: P1)

После того как клиент отправил посылку и она пришла на склад / в офис, менеджер на карточке `Return` (статус `approved`) проверяет позиции и нажимает **«Зафиксировать получение»**. Статус → `received`. Появляется блок «Возврат денег»: предварительно рассчитанная сумма (`refundAmount`), способ (`refundMethod = card-original` по умолчанию для оплаченных картой), кнопка **«Вернуть деньги через ЮKassa»**. По клику — server вызывает `POST /v3/refunds` с `payment_id` исходной оплаты, суммой и описанием. При успехе — статус → `refunded`, `refundedAt = now()`, `refundProviderRef = response.id`, отправляется `T-016`. Параллельно ставится job в очередь фискализации: чек коррекции «возврат прихода» через подключённую онлайн-кассу (54-ФЗ).

**Why this priority**: ручной возврат через личный кабинет ЮKassa — это +5 минут на заявку, ошибки в сумме, нет идемпотентности, нет автоматической фискализации.

**Independent Test**: на тестовой заявке `approved` нажать «Зафиксировать получение» → нажать «Вернуть деньги» (sandbox ЮKassa) → за ≤30 с заявка переходит в `refunded`, `refundProviderRef` заполнен, на mailtrap T-016, в Twenty Activity «Refund issued».

**Acceptance Scenarios**:

1. **Given** `Return.status = approved`, **When** менеджер кликает «Зафиксировать получение», **Then** статус → `received`, `receivedAt = now()`, никакие деньги пока не возвращаются.
2. **Given** `Return.status = received`, `refundAmount = 5000 ₽`, **When** менеджер кликает «Вернуть деньги», **Then** вызывается `POST /v3/refunds` ЮKassa с `Idempotency-Key = return.id + ":refund"`; при `succeeded` — статус `refunded`, `refundProviderRef = "23d93cac-...."`.
3. **Given** ЮKassa вернула 4xx (например, `payment_not_found`), **When** ошибка обработана, **Then** статус остаётся `received`, в `statusReason` записывается ошибка, баннер для менеджера.
4. **Given** идемпотентный повтор клика «Вернуть деньги» в течение 5 минут, **When** второй запрос, **Then** ЮKassa вернёт тот же `refund.id`, статус не дублируется.
5. **Given** возврат частичный (`refundAmount < order.total`), **When** ЮKassa провела refund, **Then** в `Order.payment.refunds[]` появляется запись (новое поле в Orders), но `Order.status` не меняется на `returned` (он `returned` только при полном возврате).
6. **Given** заказ был оплачен через фискализированную ККТ, **When** refund завершён, **Then** создаётся job `cash-register/correction-receipt` — чек коррекции «возврат прихода» с теми же позициями (54-ФЗ).

---

### User Story 4 — Возврат через службу доставки с ApiShip return-label (Priority: P2)

Если клиент в форме US1 выбрал способ «Через службу доставки», менеджер при одобрении (US2) дополнительно может нажать **«Оформить return-shipment»**. Soliton вызывает `OrdersApi.createReturnOrder` ApiShip с обратным маршрутом (от адреса клиента до склада), получает `apiShipReturnOrderId` и URL обратной этикетки PDF. Этикетка вкладывается в email `T-015` ссылкой. Когда клиент сдаёт посылку и ApiShip присылает webhook с возвратом — статус `Return` автоматически переходит в `received`.

**Why this priority**: ускоряет оборачиваемость возвратов, снимает с клиента поход на почту с непонятным адресом; но не блокирует основной флоу (US1-3 работают без ApiShip-возвратов).

**Independent Test**: одобрить тестовый `Return` с `returnMethod = pickup_via_courier` → в карточке появляется кнопка «Оформить return-shipment» → клик → ApiShip sandbox создаёт обратный заказ → в email лежит ссылка на этикетку → webhook ApiShip «delivered» автоматически переводит `Return.status = received`.

**Acceptance Scenarios**:

1. **Given** `Return.status = approved`, `returnMethod = pickup_via_courier`, **When** менеджер кликает «Оформить return-shipment», **Then** создаётся ApiShip return order, `apiShipReturnOrderId` сохраняется, PDF-этикетка прикреплена.
2. **Given** ApiShip webhook `delivered` по `apiShipReturnOrderId`, **When** обработан, **Then** `Return.status → received` автоматически, отправляется внутреннее уведомление менеджеру «возврат прибыл, проверьте».

---

### User Story 5 — Корректировочный счёт-фактура / УПД для юрлица (Priority: P2)

При `Return.status = refunded` и `Order.type = legal` (юрлицо с ИНН) автоматически генерируется **корректировочный счёт-фактура** (CreditMemo): PDF на основе шаблона УПД-1 со ссылкой на исходный счёт-фактуру (`Order.invoiceNumber`), позициями возврата и итоговой суммой со знаком «—». Документ получает `creditMemoNumber` (формат `CM-YYYY-NNNN`, отдельный счётчик), сохраняется в Payload Media, ссылка кладётся в `Return.creditMemoPdfUrl` и отправляется клиенту вместе с T-016.

**Why this priority**: для юрлиц это **обязательное** требование НК РФ ст. 169 — без КСФ контрагент не примет вычет к корректировке, бухгалтерия отклонит сделку.

**Independent Test**: создать заказ `type = legal` с ИНН → довести до `refunded` тестовый `Return` → в карточке `Return` появляется ссылка `CM-2026-0001.pdf` с корректной шапкой, ссылкой на исходный счёт-фактуру, позициями и подписью.

**Acceptance Scenarios**:

1. **Given** `Order.type = legal`, `Return.status = refunded`, **When** хук afterChange сработал, **Then** генерируется PDF КСФ, выдаётся `creditMemoNumber`, ссылка сохраняется.
2. **Given** `Order.type = physical`, **When** Return переходит в `refunded`, **Then** КСФ не генерируется (физлицу — только чек коррекции).
3. **Given** генерация PDF упала (template error), **When** ошибка перехвачена, **Then** статус `Return` остаётся `refunded`, но в `Return.documentsError` пишется причина, баннер менеджеру «КСФ не сформирован — сформируйте вручную».

---

### User Story 7 — Менеджер вручную создаёт Return от имени клиента (Priority: P2)

Клиент обращается по телефону или через мессенджер с просьбой оформить возврат. Менеджер в Payload Admin создаёт Return через `POST /api/admin/returns` (admin-auth). Body — расширенный `CreateReturnRequest` + `orderId` (вместо `orderToken`). `createdVia = manager-manual`.

**Why this priority**: клиент часто звонит/пишет вместо самостоятельного оформления через сайт. Без этого `createdVia = manager-manual` — мёртвое enum-значение.

**Acceptance Scenarios**:

1. **Given** менеджер авторизован в Payload Admin, заказ `delivered`, **When** менеджер создаёт Return через admin API с `orderId`, **Then** создаётся `Return.createdVia = manager-manual`, клиенту уходит email о принятии заявки.
2. **Given** заказ `paid` (ещё не отгружен), **When** менеджер пытается создать Return, **Then** ошибка 403 «Заказ не доставлен».

---

### User Story 6 — Аналитика возвратов (Priority: P3)

Менеджер на странице `/admin/collections/returns` видит фильтр по причинам, сортировку и top-bar с метриками: «Доля возвратов за 30 дней», «Средний срок обработки (requested → refunded)», «Топ-5 SKU по возвратам». Опционально — экспорт CSV.

**Why this priority**: операционная улучшалка, не блокирует базовый цикл; решает задачу «что чаще всего возвращают и почему» для отдела закупок.

**Acceptance Scenarios**:

1. **Given** ≥ 10 возвратов в БД, **When** менеджер открывает `/admin/collections/returns`, **Then** в верхнем баннере видны три метрики.
2. **Given** менеджер фильтрует `reasonCategory = defect` за 30 дней, **When** применяет фильтр, **Then** список и top-5 SKU обновляются.

---

## Edge Cases

- **Возврат после истечения 7 дней без письменной памятки**: по ст. 26.1 окно расширяется до 3 месяцев — заявка должна **приниматься**, но `Return.statusReason = outside_short_window` (требует ручного решения менеджера). Жёстко не блокировать.
- **Частичный возврат + остаток в пути**: если заказ разбит на несколько отправлений (multi-shipment, отложено) и часть ещё `in_transit` — возврат оформляется только на уже delivered-позиции; форма должна это понимать.
- **Возврат комплектов / наборов**: если позиция — комплект (`product.kit = true`), вернуть можно только полностью; в форме одна строка с qty=1.
- **Возврат после фискализации (54-ФЗ)**: refund в ЮKassa не освобождает от **чека коррекции** — отдельная job через подключённую онлайн-кассу. Без чека коррекции — нарушение, штраф ФНС (КоАП ст. 14.5).
- **Возврат товара из перечня ПП РФ № 2463** (например, парфюмерно-косметика, бельё): возврат **возможен только при недостатках** (`reasonCategory = defect`). Если клиент выбирает `not-needed` для такого SKU — форма показывает предупреждение, заявка принимается, но менеджер видит баннер с обоснованием для отказа.
- **Возврат после `Order.status = completed`**: окно по умолчанию закрылось (`closureWindowDays` = 14 в order-lifecycle-spec). Заявка всё равно принимается, но требует разморозки сделки — `Order.status` откатывается к `delivered`, `closedAt = null`, `disputeFlag = true`, в Twenty Opportunity возвращается на стадию `Won` (не `Won.Closed`). Требуется patch к `status-machine.ts`: расширить `ALLOWED['completed']` значениями `['completed', 'delivered', 'returned']` под условием `reopenAuthorized=true`. См. FR-5316a.
- **При возврате клиента `Order.shipment.status` не меняется**: исходная отгрузка логистически дошла до клиента, `Order.shipment.status` остаётся `delivered`. Return-shipment ApiShip (US4) — отдельный объект, его статус не агрегируется в `Order.shipment.status`.
- **Возврат при оплате наличными / счётом** (юрлицо, оплата ПП): refund через ЮKassa невозможен — `refundMethod = bank-transfer`, менеджер делает платёжку вручную, фиксирует факт в `Return` кнопкой «Возврат проведён вручную», `refundProviderRef = null`, но `manualRefundConfirmation = { byUser, at, paymentDoc, bankAccount, bik, recipientName, purpose }`. Для bank-transfer: поля `bankAccount`, `bik`, `recipientName`, `purpose` ('Возврат по заказу № ...'). При `paid` (юрлицо) snapshot реквизитов плательщика сохраняется в `Order.payment.payerBankDetails` (если есть в платёжке); при создании Return с `refundMethod=bank-transfer` поля предзаполняются.
- **Идемпотентность повторного refund в ЮKassa**: всегда передавать `Idempotency-Key = return.id + ":refund"` — даже при двойном клике/повторе хука получаем тот же refund.
- **Курсы / НДС**: цены и НДС фиксируются на момент создания Order (snapshot из 047). КСФ строится на тех же snapshot-данных, никаких пересчётов по сегодняшнему курсу.
- **Полностью возвращённый заказ**: когда сумма возвратов = `Order.total`, `Order.status` → `returned` (автоматический хук), `Order.totalRefunded = total`.
- **Невозможность вернуть на исходную карту** (карта истекла, токен ЮKassa отозван): ЮKassa возвращает ошибку → менеджер переключает `refundMethod = bank-transfer` и вручную проводит платёжку.

## Functional Requirements *(блоки сгруппированы)*

### Сущность Return (FR-5301..5310)

- **FR-5301**: Новая Payload коллекция `returns` со схемой, описанной в `data-model.md §1`.
- **FR-5301a**: Расширить `DomainEventKind` в `apps/web/src/lib/lifecycle/events.ts`: добавить `return.created`, `return.approved`, `return.rejected`, `return.received`, `return.refunded`, `return.cancelled`, `return.overdue`. Добавить `ReturnSnapshot` тип (или поле `currentReturn?: ReturnSnapshot` в `OrderSnapshot`). Обновить subscribers (`notifications/subscriber.ts`, `crm/twenty/subscriber.ts`) — `kinds[]` фильтр + handlers.
- **FR-5302**: Уникальный человекочитаемый номер `returnNumber` формата `RT-YYYY-NNNN`, генерируется **атомарно** (через advisory lock или sequence в PostgreSQL — см. подход из спеки 051), не дублируется при concurrent inserts.
- **FR-5303**: Связь `Return.orderId` → `Order`, **required**. Один Order может иметь несколько Returns (массив-агрегат как computed на Order).
- **FR-5304**: `Return.items[]` — частичный возврат: subset позиций исходного Order с `orderItemSku`, `qty` (≤ доступного к возврату с учётом ранее оформленных Returns), `reason`, `condition`.
- **FR-5305**: enum `reasonCategory` фиксированный: `defect` | `wrong-item` | `not-needed` | `other`.
- **FR-5306**: `Return.status` — state machine: `requested` → `approved` → `received` → `refunded`; альтернативные терминалы: `rejected` (из любого), `cancelled` (из любого до `refunded`). Запрещённые переходы валидируются в beforeChange.
- **FR-5307**: Поля времени всех переходов: `requestedAt`, `approvedAt`, `receivedAt`, `refundedAt`, `rejectedAt`, `cancelledAt` — заполняются автоматически при смене статуса.
- **FR-5308**: `Return.refundAmount` — вычисляется суммой `items[].qty × items[].priceSnapshot` (snapshot берётся из Order, **не** пересчитывается). Менеджер может корректировать ±, причина — обязательна в `managerNotes`.
- **FR-5308a**: `Return.items[]` иммутабельны после перехода `approved`. До `approved` менеджер может скорректировать состав через action 'Скорректировать заявку' с обязательным `managerNotes`; история изменений пишется в `history[]`.
- **FR-5308b**: `Sum(returns[refunded ∪ pending].refundAmount) ≤ Order.totals.total`. Валидация в `Returns.beforeChange` + в `/refund` route перед вызовом ЮKassa. При превышении — error + admin escalation.
- **FR-5309**: `Return.refundMethod` — enum `card-original` | `bank-transfer` | `other`. По умолчанию `card-original` если `Order.payment.method = card`, иначе `bank-transfer`.
- **FR-5310**: Расширение `Orders` collection computed-полями `hasReturns: bool`, `returnsCount: number`, `totalRefunded: number` (sum по всем `refunded` returns этого заказа).
- **FR-5310a**: `Order.disputeFlag` — derived fast-flag: `true` ⟺ существует хотя бы один Return со статусом ∈ {requested, approved, received}. Синхронизируется в `recomputeOrderReturnAggregates(orderId)`. При терминальных статусах всех returns → `disputeFlag=false`, cron-closure снова может закрыть заказ.

### Жизненный цикл и статусная машина (FR-5311..5316)

- **FR-5311**: Переход `requested → approved` — action в Payload Admin или API `POST /api/admin/returns/{id}/approve`.
- **FR-5312**: Переход `approved → received` — action «Зафиксировать получение» (US3) **или** автоматически по webhook ApiShip `delivered` для `apiShipReturnOrderId` (US4).
- **FR-5313**: Переход `received → refunded` — action «Вернуть деньги»; делает реальный вызов ЮKassa Refunds (US3) **или** ручную фиксацию (если `refundMethod = bank-transfer`).
- **FR-5314**: Переход `* → rejected` — обязательно заполнено `statusReason`; переход `* → cancelled` (от клиента / по таймауту) — допустим только до `received`.
- **FR-5315**: При полном возврате (`Order.totalRefunded == Order.total`) — хук `afterChange` поднимает `Order.status = returned` и эмитит `order.returned`.
- **FR-5316**: При возврате после `Order.status = completed` — `Order.status` откатывается на `delivered`, `closedAt = null`, `disputeFlag = true`.
- **FR-5316a**: При наличии `reopenAuthorized=true` от хука `returns.afterChange` разрешён переход `completed → delivered` с заполнением `closedAt = null`, `disputeFlag = true`. Требуется patch к `status-machine.ts`: расширить `ALLOWED['completed']` значениями `['completed', 'delivered', 'returned']` под условием `reopenAuthorized=true`. Обновить unit-тесты (positive case `completed → delivered` под `reopenAuthorized + disputeFlag = true`).

### Cross-spec patches (FR-5316a..5316b)

- **FR-5316b**: Patch к 051 spec.md FR-5107: добавить `hasReturns, returnsCount, totalRefunded` в whitelist always-mutable полей. Без этого immutability hook 051 отвергнет обновления computed полей из `returns.afterChange`. Также явно упомянуть `payment.refunds[]` (формально под `payment.*` уже разрешено, но лучше явно).

### Интеграции (FR-5317..5325)

- **FR-5317**: ЮKassa Refunds: новый модуль `lib/payments/yookassa-refunds.ts` с методом `createRefund({ paymentId, amount, description, idempotencyKey })`, REST `POST /v3/refunds`. Auth — basic auth (shopId + secretKey) из `paymentsSettings` (037).
- **FR-5318**: Идемпотентность: `Idempotency-Key = return.id + ":refund"`. Повтор не плодит refund.
- **FR-5319**: ApiShip ReturnOrder: новый метод в `ShippingProvider` `createReturnShipment({ originalOrderId, items, pickupAddress })`, реализация в `lib/shipping/apiship/provider.ts`. Маппится на `OrdersApi.createReturnOrder` ApiShip OpenAPI.
- **FR-5320**: Webhook ApiShip `delivered` по return-order: handler в `/api/webhooks/apiship` (расширение existing handler из 047) маппит `apiShipReturnOrderId` → `Return`, переводит в `received`.
- **FR-5321**: CRM-sync (через 048): новые правила в `crm-sync-matrix` — `return.created` → Activity на Opportunity, `return.refunded` → Activity «Refund issued» + переход стадии (`Won` → `Won.Refunded` если полный возврат).
- **FR-5321a**: Patch к 048: добавить `return.*` events в FR-4804; стадии `Won.Refunded` / `Won.PartialRefund`; custom fields Opportunity: `returnsCount`, `totalRefunded`, `lastReturnNumber`.
- **FR-5322**: Notifications (через 049): новые шаблоны `T-015-return-approved.tsx`, `T-015-return-rejected.tsx`, `T-016-return-refunded.tsx`. Регистрируются в `notification-matrix`. Получатель — `customer.email`.
- **FR-5322a**: Patch к 049 `notification-events.md`: добавить events `return.created/approved/rejected/refunded/overdue` и шаблоны. Нумерация: T-011 (customer-approved), T-012 (customer-rejected), T-013 (customer-refunded), T-014 (customer-order-returned), T-106 (manager-return-created), T-107 (manager-refunded), T-108 (manager-overdue).
- **FR-5323**: Чек коррекции 54-ФЗ: новая job-очередь `fiscal-jobs` (или продление existing) — событие `return.refunded` ставит job «correction-receipt» с типом «возврат прихода». Подключение к ККТ — отдельный пункт реализации (Атол / Контур / Орловчанин), MVP — заглушка с логом и admin-уведомлением «провести вручную».
- **FR-5324**: КСФ для юрлица: модуль `lib/documents/credit-memo.ts` с функцией `generateCreditMemo(returnDoc, orderDoc)` → PDF через тот же движок, что счёт-фактура в 037 (pdfkit / puppeteer). Уникальный `creditMemoNumber` формата `CM-YYYY-NNNN` (отдельный sequence).
- **FR-5325**: Все секреты (ЮKassa secretKey, ApiShip token, ККТ-токен) — только server-side, маска в логах.

### Публичный UX (FR-5326..5330)

- **FR-5326**: Страница `/cart/order/[token]/return/` — публичная, защищена тем же `token` что и `/cart/order/[token]/`, доступна только при `Order.status ∈ {delivered, completed}`.
- **FR-5327**: Форма содержит: список позиций с qty-селектором (1..available), select причины, textarea комментария, select способа возврата денег (предзаполнено на основе `Order.payment.method`), общий комментарий, согласие с правилами возврата (ссылка на `/policies/returns/`).
- **FR-5328**: Submit вызывает `POST /api/returns` (публичный, без auth, только `orderToken`). Rate-limit: ≤3 заявки/час на токен.
- **FR-5329**: После успешного submit показывается экран благодарности с номером `RT-YYYY-NNNN`, оценкой сроков, ссылкой «Скачать заявление на возврат PDF» (статичный шаблон с автозаполнением — для физлица > 10 000 ₽ нужна копия паспорта).
- **FR-5330**: Загрузка фото («приложите фото дефекта») — опциональное поле в форме, до 5 файлов × 5 МБ, сохраняется в Payload Media с привязкой к `Return`. MIME: `image/jpeg`, `image/png`, `image/heic`, `image/webp`. EXIF-strip обязателен (152-ФЗ, геолокация = ПДн). Virus-scan — nice-to-have.

### Admin UX (FR-5331..5335)

- **FR-5331**: Коллекция `returns` в Payload Admin: defaultColumns `[returnNumber, orderId, status, refundAmount, requestedAt]`, фильтр по статусу, поиск по `returnNumber` / `orderId`.
- **FR-5332**: Кастомные admin-actions на карточке Return: «Одобрить», «Отклонить» (с обязательным `statusReason`), «Зафиксировать получение», «Вернуть деньги», «Сгенерировать КСФ заново», «Оформить return-shipment».
- **FR-5333**: Read-only блок «История переходов» — таймлайн всех `*At` полей + кто из менеджеров что сделал (берётся из `req.user`).
- **FR-5334**: Cron `returns/auto-reminder-manager` — раз в 24 часа выбирает `Return.status = requested` старше 24 ч и шлёт менеджеру письмо «Не забыли про заявку RT-...?».
- **FR-5335**: Аналитический баннер (US6) на `/admin/collections/returns` — три виджета поверх списка.

### Legal / Tax (FR-5336..5340)

- **FR-5336**: На странице `/policies/returns/` (новая публичная) — текст условий возврата по ст. 26.1 Закона 2300-1, перечень невозвратных товаров (ссылка на ПП РФ № 2463), порядок (7 дней / 3 месяца), реквизиты для отправки. `[needs-content]` TODO для юриста: структура страницы `/policies/returns/`.
- **FR-5337**: Email `T-015` («одобрено») обязательно содержит: адрес склада, что приложить (заявление + копия паспорта при сумме > 10 000 ₽), сроки.
- **FR-5338**: КСФ (`CreditMemo`) для юрлица — обязательная атрибутика по НК РФ ст. 169: номер исходного счёта-фактуры, дата, ИНН/КПП обеих сторон, наименование товара, ставка НДС, сумма НДС, итог. MVP scope: PDF УПД-1 (печатная форма) для ручной отправки по email. Обмен через ЭДО (Диадок/СБИС/Такском) — follow-up спека 056+.
- **FR-5339**: Чек коррекции 54-ФЗ — обязательная job на событие `return.refunded`. MVP scope: запись в `fiscal-corrections` + email менеджеру. SLA на ручное пробитие = 24 часа (требование 54-ФЗ — «в день расчёта»). При отсутствии `status=issued` за 24 ч — escalate владельцу. Коннектор к ККТ — out-of-scope follow-up.
- **FR-5340**: Срок возврата денег по ст. 22 Закона 2300-1 — **10 календарных дней** с момента предъявления требования (для денежного возврата при дистанционной торговле). Cron мониторит просрочки: `requested` старше 10 дней без `refunded` — баннер красный + письмо менеджеру **и** клиенту с извинениями.
- **FR-5341**: Окно возврата отсчитывается от `Order.deliveredAt`. Для pickup — от webhook `delivered` (момент вручения в ПВЗ). При отсутствии `deliveredAt` — fallback на `Order.createdAt + 30 дней`. Все формулы и тесты используют именно это поле.
- **FR-5342**: `Product.returnability`: select `[returnable | non-returnable | defect-only]` (default `returnable`). Seed по ПП 2463. MVP: stub `isNonReturnableSku` с TODO.
- **FR-5343**: `qtyAvailableForReturn(item) = item.qty - sum(non-terminal returns items for this SKU) - qty whose shipment is in_transit/pending/created`.

## Out of Scope (вынесено в follow-up)

- **Гарантийный ремонт** (другой бизнес-процесс, отдельная коллекция `warranty-cases`).
- **Обмен товара** без возврата денег (1:1 swap) — потенциальная follow-up спека 055.
- **Возвраты по подпискам** (рекуррентные платежи) — у нас их пока нет.
- **Реальный коннектор к Атол / Эвотор ККТ** — спека 050+ или ручная фискализация в MVP.
- **Возврат в магазине** (offline pickup) — у Soliton нет физических точек, не применимо.

## Success Metrics

- 95 % заявок переходят из `requested` в терминальный статус (`refunded`/`rejected`) за ≤7 рабочих дней.
- 100 % успешных refund в ЮKassa имеют `refundProviderRef` (не теряем привязку).
- 100 % refund для юрлица имеют `creditMemoPdfUrl` в течение 1 часа после `refunded`.
- 0 нарушений ст. 22 (срок возврата денег 10 дней) за квартал.
- Доля возвратов на товар (топ-5 SKU) видна менеджеру в одном клике (US6).
