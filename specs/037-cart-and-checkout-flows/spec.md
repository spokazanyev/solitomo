# Feature Specification: Cart And Three Checkout Flows

**Feature Branch**: `037-cart-and-checkout-flows`

**Created**: 2026-05-16

**Status**: Draft

**Input**: Текущая «корзина» — это `RfqCartLink` со списком артикулов, который ведёт пользователя в одну форму запроса КП. Не покрывает основной сценарий e-commerce: физлицо хочет купить готовое, юрлицо хочет счёт, объёмные заказы хотят КП. Нужна полноценная корзина и три выходных пути:

1. **Купить как физлицо** — корзина → выбор доставки → оплата картой через платёжный шлюз → подтверждение заказа.
2. **Выписать счёт юрлицу** — корзина → реквизиты компании → выбор доставки → формирование счёта PDF → отправка email → ожидание оплаты по реквизитам → отгрузка после поступления.
3. **Запросить КП** — корзина → форма КП с прикреплёнными позициями → отправка менеджеру (текущий поток, расширенный).

Карточки товаров и каталог должны поддерживать новый формат корзины. Существующая `AddToRfqButton` переименовывается в `AddToCartButton` (с обратной совместимостью семантики — позиции из корзины можно отправить и на КП).

## User Scenarios & Testing

### User Story 1 — Физлицо покупает один PDU и оплачивает картой (Priority: P1)

Покупатель находит блок розеток в каталоге, добавляет в корзину, открывает корзину, выбирает «Купить как физлицо», вводит ФИО / email / телефон / адрес доставки, выбирает способ доставки, оплачивает картой через платёжный шлюз. Получает подтверждение заказа email и видит success-страницу с номером заказа.

**Why this priority**: Это базовый e-commerce сценарий, без которого «купить PDU» на сайте невозможно. Физлица — небольшой сегмент по объёму, но критичный для воспринимаемой полноты сайта.

**Independent Test**: Полный сценарий happy path: каталог → корзина → checkout-physical → ЮKassa sandbox → success-страница.

**Acceptance Scenarios**:

1. **Given** корзина с одним товаром, **When** покупатель выбирает «Купить как физлицо» и заполняет форму, **Then** создаётся `order` в Payload со статусом `pending_payment`, redirect на платёжный шлюз.
2. **Given** оплата успешна, **When** платёжный шлюз шлёт webhook, **Then** статус заказа меняется на `paid`, отправляется email с подтверждением.
3. **Given** оплата отклонена, **When** покупатель возвращается на сайт, **Then** показывается страница с возможностью повторить оплату или сменить способ.

### User Story 2 — Юрлицо выписывает счёт и оплачивает по реквизитам (Priority: P1)

Снабжение компании добавляет PDU в корзину, открывает корзину, выбирает «Выписать счёт для юрлица», заполняет реквизиты компании (название, ИНН, КПП, юр. адрес, контактное лицо, email, телефон), **сразу выбирает способ доставки** (это фиксируется в счёте), отправляет запрос. Получает email со счётом PDF и инструкцией по оплате. После оплаты заказ переходит в статус «оплачен» и менеджер запускает отгрузку.

**Why this priority**: Это **основной B2B-сценарий**, ради которого делается сайт. Большая часть оборота — закупки юрлицами через счёт. Без этого сценария сайт остаётся только лидогенерацией.

**Independent Test**: Корзина → invoice-flow → форма реквизитов → submit → email со счётом → admin видит заказ в статусе `awaiting_payment`.

**Acceptance Scenarios**:

1. **Given** корзина с тремя товарами, **When** юрлицо подаёт реквизиты и выбирает доставку, **Then** создаётся `order` со статусом `awaiting_payment`, генерируется PDF-счёт, прикладывается к заказу.
2. **Given** заказ создан, **When** payload-хук срабатывает, **Then** email со счётом уходит на email юрлица и менеджеру.
3. **Given** менеджер вручную помечает заказ оплаченным в Payload admin, **When** статус меняется, **Then** клиенту уходит email об отправке.
4. **Given** заказ не оплачен в течение `N` дней, **When** срок истёк, **Then** заказ автоматически переходит в `expired` (или ждёт ручной отмены — на выбор владельца).

### User Story 3 — Объёмный заказ или тендер — запрос КП (Priority: P1)

Закупщик добавляет 20 PDU в корзину, видит, что для тендера нужно КП с документами, выбирает «Запросить КП», форма КП открывается с предзаполненными позициями. Отправляет — менеджер получает заявку.

**Why this priority**: Существующий RFQ-флоу, но переподключённый к новой корзине. Сохраняет текущую возможность.

**Independent Test**: Корзина → RFQ-flow → форма с предзаполненными позициями → submit → success-state как сейчас.

**Acceptance Scenarios**:

1. **Given** корзина с позициями, **When** покупатель выбирает «Запросить КП», **Then** открывается форма с позициями, цены не показываются как окончательные, а как «ориентировочные».
2. **Given** форма заполнена, **When** отправлена, **Then** создаётся `rfq-request` в Payload (текущая коллекция), позиции прикреплены.

### User Story 4 — Покупатель просматривает корзину перед действием (Priority: P1)

Покупатель добавил товары на разных страницах. Открывает корзину (по иконке в шапке). Видит список позиций, цены, количество, суммарную стоимость, может изменить количество, удалить позицию, перейти к одному из трёх checkout-сценариев. На пустой корзине — пустое состояние с CTA в каталог.

**Why this priority**: Без отдельной страницы корзины три checkout-сценария не работают.

**Independent Test**: `/cart/` отдаёт корзину со счётчиком и кнопками выбора пути.

**Acceptance Scenarios**:

1. **Given** корзина пуста, **When** открыта `/cart/`, **Then** видна empty-state с ссылкой в каталог.
2. **Given** в корзине 3 позиции, **When** открыта `/cart/`, **Then** видны позиции с возможностью изменить количество и удалить, виден итог и три CTA: «Купить как физлицо», «Выписать счёт», «Запросить КП».
3. **Given** позиция удалена, **When** покупатель возвращается на каталог и снова открывает корзину, **Then** удалённая позиция отсутствует.

### User Story 5 — Менеджер обрабатывает заказы в Payload admin (Priority: P2)

Менеджер открывает Payload admin, видит список заказов с фильтрами по статусу. На заказе видит: тип (физлицо/юрлицо/КП), позиции, реквизиты, статус, историю смены статусов, прикреплённые документы (счёт). Может изменить статус, добавить трек-номер, прокомментировать.

**Why this priority**: Без admin-обработки заказы становятся мусором — некому реагировать.

**Independent Test**: В Payload admin доступна коллекция `orders` с workflow-полями и фильтрами.

**Acceptance Scenarios**:

1. **Given** заказ от юрлица создан, **When** менеджер открывает Payload admin, **Then** заказ виден в списке с цветным бейджем статуса.
2. **Given** менеджер меняет статус с `paid` на `shipped` и заполняет трек-номер, **When** сохраняет, **Then** клиенту уходит email об отправке с трек-номером.

### User Story 6 — Аналитика покрывает full funnel (Priority: P2)

Маркетинг видит в Метрике события `view_item → add_to_cart → view_cart → begin_checkout → purchase` (для физлица) / `invoice_requested` (для юрлица) / `quote_submitted` (для КП).

**Why this priority**: Текущая аналитика покрывает только RFQ. Без новых событий разделить три воронки нельзя.

**Independent Test**: Метрика в режиме отладки показывает все события сценария.

### Edge Cases

- **Корзина пуста на checkout**: redirect на `/cart/` или каталог.
- **Цена изменилась между добавлением и оплатой**: показать пересчёт перед оплатой, дать согласие.
- **Webhook от платёжного шлюза задержан**: оптимистично показать «оплата проверяется», обновить статус по сигналу.
- **Несколько устройств одного пользователя**: корзина в localStorage — состояние не синхронизировано; в v1 это нормально, синк — отдельная фича.
- **Юрлицо вводит несуществующий ИНН**: формат проверяется, но факт существования — нет (нет интеграции с DaData); менеджер проверяет вручную.
- **Доставка в город без поддержки**: показать «доставка согласовывается отдельно» и предложить переход на КП.
- **Превышение лимита платёжного шлюза**: показать инструкцию по оплате счётом.
- **Возврат / отмена заказа** после оплаты: ручной workflow менеджера в Payload, без автоматизации в v1.

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a `/cart/` page rendering cart contents, totals, and three checkout entry points.
- **FR-002**: Cart state MUST persist in localStorage (same as current `RfqCart`) until checkout completes.
- **FR-003**: System MUST provide three distinct checkout flows: physical-pay, legal-invoice, quote-request.
- **FR-004**: Each successful checkout MUST create an `order` record in Payload with type-specific fields.
- **FR-005**: Physical-pay flow MUST integrate with one Russian payment gateway (target: ЮKassa).
- **FR-006**: Legal-invoice flow MUST generate a PDF invoice with company requisites and send it via email.
- **FR-007**: Quote-request flow MUST preserve current RFQ behaviour and store the cart as line items.
- **FR-008**: System MUST emit analytics events for each funnel step (view_cart, begin_checkout, purchase / invoice_requested / quote_submitted).
- **FR-009**: Cart icon in header MUST show item count and link to `/cart/`, not directly to RFQ.
- **FR-010**: Empty cart MUST show a friendly empty state with a CTA into the catalog.
- **FR-011**: All three flows MUST share a common customer-info collection step where applicable (email/phone), but legal-invoice extends with company requisites.
- **FR-012**: Legal-invoice MUST require delivery selection upfront and freeze it in the invoice; physical delivery selection happens after payment confirmation in v1 (or before — to be decided per UX review).
- **FR-013**: System MUST send a confirmation email to the customer on each successful checkout (paid / invoice issued / quote received).
- **FR-014**: System MUST notify a manager (email + Payload admin) of each new order.

### Quality Requirements

- **QR-001**: All three flows MUST be mobile-usable on 375px width.
- **QR-002**: Each step of checkout MUST be reachable via direct URL (`/cart/`, `/cart/checkout/physical/`, `/cart/checkout/invoice/`, `/cart/checkout/quote/`) for resumption.
- **QR-003**: Payment gateway integration MUST be sandbox-toggleable via env flag.
- **QR-004**: PDF invoice MUST contain bank requisites, ИНН/КПП/ОГРН Солитон, customer requisites, items table, total with VAT, payment instructions.
- **QR-005**: No customer payment data (card numbers) MUST be stored on Solton servers — all card handling delegated to the payment gateway.

### Key Entities

- **CartItem** (client): sku, name, image, price, quantity, unit "шт".
- **Order** (Payload collection `orders`): id, type (`physical` / `legal` / `quote`), status, items, totals (subtotal/VAT/delivery/total), customer, delivery, payment, invoice, notes, timestamps, history.
- **Customer** (embedded): type, fullName, email, phone; for legal: companyName, inn, kpp, ogrn, legalAddress, contactPerson.
- **DeliveryOption**: code (cdek / boxberry / russian-post / pickup), label, cost, eta.
- **PaymentRecord** (embedded in order): provider, ref, status, paidAt, amount.
- **InvoiceRecord** (embedded for legal): number, date, pdfMediaId, paidAt.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Покупатель может пройти полный цикл «добавить → корзина → оплатить» (физлицо) за < 2 минут на ЮKassa sandbox.
- **SC-002**: Менеджер может выпустить и отправить счёт юрлицу в течение часа после получения заказа.
- **SC-003**: Все три воронки видны в Yandex.Metrika как раздельные сценарии за 7 дней после запуска.
- **SC-004**: 0 случаев потери данных корзины при checkout (тесты + мониторинг).

## Assumptions

- Платёжный шлюз — ЮKassa (наиболее распространён в РФ, есть в `05-implementation-roadmap/russian-payment-delivery-aggregators.md` как референс). Если ЮKassa не подходит — fallback Тинькофф.
- Доставка в v1 — выбор из 3–4 фиксированных вариантов (СДЭК / Boxberry / Почта России / самовывоз). Реальная интеграция с API курьеров — отдельная фича (ApiShip).
- НДС в v1 — фиксированная ставка 20% или «без НДС» (флаг компании-продавца); полноценный налоговый учёт — не в скоупе.
- 54-ФЗ (чеки онлайн-кассы) — обеспечивается ЮKassa либо через интеграцию с АТОЛ-онлайн / Kassatka; в v1 регистрация чека делегируется ЮKassa если сервис включён.
- Реальные банковские реквизиты Солитон должен предоставить владелец перед запуском (отложенный пункт `deferred-content-track.md`).
- Multi-currency не нужно — только ₽.
- Скидки от объёма — не в v1.
- Личный кабинет покупателя — не в v1; история заказов через email-ссылку «посмотреть заказ».

## Non-Goals

- Email/SMS-маркетинг (отдельная фича).
- Личный кабинет с историей заказов.
- Multi-step возврат денег.
- Интеграция с 1С / МойСклад (отдельный проект).
- Подписки, рекурринг.
- Промокоды, лояльность.
- Live-сток (количество на складе) — в v1 «есть в наличии» / «под заказ».
- Self-service возвраты.
