# Feature Specification: ЮKassa Frontend Integration

**Feature Branch**: `056-yookassa-frontend-integration`

**Created**: 2026-05-25

**Status**: Draft (Speckit Phase: **/specify**)

**Input**: Backend ЮKassa integration (055) полностью готов и закоммичен (4 коммита на ветке 055). НО: existing checkout UI (`ReviewClient.tsx`, `RetryPaymentButton.tsx`, `PhysicalCheckoutForm.tsx`) написан под старый mock-API contract и **сломан** после 055-изменений. Также отсутствует страница `/payment/return/[orderId]`, на которую ЮKassa перенаправляет customer'а после оплаты. Без этой спеки backend не доходит до пользователя — checkout не работает в браузере.

---

## 0. Контекст и dependencies

**Базовая зависимость**: Спека 055 (`/specs/055-yookassa-payments-integration/`) — backend, который этот frontend использует. На момент написания этой спеки 055 находится на feature-ветке (не merged в main) с 4 коммитами:
- `chore(speckit): switch integration from codex to claude`
- `docs(055): spec + plan + tasks for ЮKassa payments integration`
- `feat(055): ЮKassa payments integration backend MVP`
- `fix(055): code-review pass 2 — idempotency guards + security hardening`

**Связанные документы:**
- `specs/055-yookassa-payments-integration/spec.md` — backend FR
- `specs/055-yookassa-payments-integration/contracts/create-payment.openapi.yaml` — API contract для UI
- `specs/055-yookassa-payments-integration/contracts/payment-status.openapi.yaml` — polling contract
- `07-build-specifications/order-lifecycle-spec.md` — Phase 6 Review + Phase 7 Payment lifecycle
- `apps/web/src/lib/notifications/templates/index.ts` — registry для email шаблонов (049)
- `apps/web/src/components/checkout/ReviewClient.tsx` — текущая review-страница
- `apps/web/src/components/checkout/RetryPaymentButton.tsx` — retry-button
- `apps/web/src/components/cart/PhysicalCheckoutForm.tsx` — физлицо checkout

**Cross-spec impact**: 056 не меняет backend API. Только consumes contracts из 055, обновляет UI, добавляет 4 email-шаблона в реестр 049, и заполняет gap для customer-возврата с ЮKassa.

---

## 0.1. Clarifications

### Initial round (при /specify)

| # | Решение | Источник |
|---|---|---|
| Q1 | UI redirects на `confirmationUrl` от ЮKassa (для всех методов, включая СБП — ЮKassa сама показывает QR). Embed QR — Phase 2. | 055 §10 #4 |
| Q2 | Polling-стратегия на `/payment/return/[orderId]`: 2 сек × 30 попыток = 60 сек max. | 055 spec edge case |
| Q3 | SO-номер показываем покупателю только после `status=paid` (он генерируется только при первой оплате, 051). До оплаты — фронт-локальный ref. | 051 client-number-generator |
| Q4 | Failure UI: 3 разные ветви по severity — retry-возможный (`pending_payment` < window), expired (показываем «закажите снова»), error (ЮKassa unavailable). | 055 FR-5511 |
| Q5 | Существующие checkout-страницы (`/cart/checkout/physical/review`, `/cart/order/[token]/retry-payment`) трогаем минимально — только API-contract fix. Никаких redesign'ов в этой спеке. | scope guard |

### /clarify round (2026-05-25)

#### Resolved via code research (no user question needed):

| # | Question | Resolution |
|---|---|---|
| OQ-1 | Создаёт ли `/api/checkout/finalize-shipping` Order, или нужен отдельный endpoint? | **Существующий `POST /api/orders/route.ts` создаёт Order** через `payload.create({collection:"orders",...})` после Cart→Order конверсии (через 052 `markConverted`). `finalize-shipping` только фиксирует price snapshot. Frontend flow: (1) POST `/api/orders` → Order created in `pending_payment`, (2) POST `/api/payment/yookassa/create` с этим orderId. **Никаких новых endpoint'ов 056 не создаёт.** |
| OQ-2 | Существует ли `Order.publicToken` и заполняется автоматически? | **Да.** `Orders.js` line 666 содержит beforeChange hook: `if (operation === "create" && !data.publicToken) data.publicToken = randomBytes(16).toString("base64url")` — 128-bit entropy. Поле present, auto-generated при create. Готово для guest-fallback на `/payment/return`. |
| OQ-3 | Существует ли `/me/orders` UI? | **Нет.** Поиск `apps/web/src/app/*me*/*.tsx` нашёл только admin + documents + cart pages. 054 customer account — backend-only. → **US5 → отложено в Phase 2** (либо отдельную 057-спеку). `/me/orders` UI вне scope 056. |

#### Resolved interactively:

| # | Question | Resolution |
|---|---|---|
| OQ-4 | Откуда брать тексты ошибок в UI failure-state? | **Мапинг code→UI-string в UI**. UI имеет dictionary: `YOOKASSA_UNAVAILABLE`/`CONFIG_INVALID`/`INVALID_ORDER_STATUS`/`AMOUNT_MISMATCH` → conversion-oriented русский текст. Backend `body.message` — fallback для unknown codes. См. FR-5605/5606/5625. |
| OQ-5 | Polling-интервал настраиваемый? | **Hardcode 2 сек × 30 = 60 сек.** Webhook ЮKassa обычно срабатывает за 3-5 сек — 60 сек большой запас. Mobile detection и `paymentSettings.pollingIntervalSec` — Phase 2. См. FR-5622. |
| OQ-6 | T-015 email CTA для recovery? | **Оба CTA** — «Вернуться к вашему заказу» (primary, использует 052 cart-recovery через `Order.cartId` link) + «Начать заново» (secondary, ведёт на `/cart/`). Maximum conversion + flexibility. См. FR-5640. |
| OQ-NEW | Existing `POST /api/orders` нужен customer-session-binding? | **Да, добавить.** Если `customer_session` cookie present при create — link Order.customerId к Customer. Guest-checkout продолжает работать через cart-token. Это не breaking change — additive enhancement. **Влияет на flow US1**: `POST /api/orders` должен распознать customer_session и заполнить `customerId` автоматически. Нужно мини-патч в существующий route или middleware. |

#### Remaining OQ — Deferred:

| # | Question | Decision |
|---|---|---|
| OQ-7 | Admin US6 related-list — tabs / custom component? | **Defer на /plan-фазу** — определится при design phase. Минорно, не блокирует /tasks. |
| OQ-8 | RetryPaymentButton — inline error vs toast? | **Defer** — текущий inline-error в RetryPaymentButton.tsx остаётся, toast-system — Phase 2 если будет toast-инфраструктура. |

---

## 1. Текущее состояние (после backend 055)

### 1.1. Что работает

| Компонент | Статус | Файл |
|---|---|---|
| Backend `POST /api/payment/yookassa/create` | ✅ Готов (055) | `apps/web/src/app/api/payment/yookassa/create/route.ts` |
| Backend `GET /api/orders/[id]/payment-status` | ✅ Готов (055) | `apps/web/src/app/api/orders/[id]/payment-status/route.ts` |
| Backend webhook handler | ✅ Готов (055) | `apps/web/src/app/api/payment/yookassa/webhook/route.ts` |
| Cron expire/reconcile/retry | ✅ Готов (055) | `apps/web/src/app/api/cron/payments-expire/route.ts` |
| /cart/page.tsx (корзина) | ✅ Работает | `apps/web/src/app/(site)/cart/page.tsx` |
| `/cart/checkout/physical/page.tsx` | ✅ Работает | физлицо-checkout form |
| `/cart/checkout/physical/review/page.tsx` | ⚠️ Сломан после 055 | API contract mismatch |
| Email templates T-001/003/005/008/009/101..105 | ✅ Работают (049) | `apps/web/src/lib/notifications/templates/` |

### 1.2. Что сломано (после 055)

| Файл | Что не так | Где |
|---|---|---|
| `ReviewClient.tsx` | POST'ит `{cartId}`, ждёт `{redirectUrl}`. 055 ждёт `{orderId, retryNonce?}`, отдаёт `{confirmationUrl, ...}` | line 68-90 |
| `RetryPaymentButton.tsx` | POST'ит `{orderId, retry: true}`, ждёт `{redirectUrl}` | line 12-30 |
| `PhysicalCheckoutForm.tsx` | TODO-stub, не вызывает ЮKassa endpoint | line 144 |

### 1.3. Чего нет вообще

| Gap | Влияние | Решение в этой спеке |
|---|---|---|
| Страница `/payment/return/[orderId]` | Customer после ЮKassa попадает на 404 | **US3** |
| Cart→Order conversion endpoint | Unclear: пока checkout flow создаёт Order через 047 finalize-shipping? | Будет проверено в /clarify; либо использовать существующий, либо создать |
| Email templates T-015, T-109, T-110, T-111 | 4 события из 055 не рендерятся → email-alerts не уходят | **US4** |
| Display `paymentMethodSnapshot` для customer | UX nice-to-have, без него customer не видит «карта •••• 1234» | **US5 (P2)** |
| Admin: PaymentEvents related-list на Order page | Менеджер ищет PaymentEvents через filter | **US6 (P2)** |

---

## 2. User Scenarios & Testing

### User Story 1 — Физлицо платит картой через UI (Priority: P1) 🎯 MVP

Физлицо открывает корзину `/cart/`, выбирает «Купить как физлицо», вводит ФИО/email/телефон/адрес на `/cart/checkout/physical/`, видит сводку Order на `/cart/checkout/physical/review/`, нажимает «Оплатить картой». UI вызывает (1) finalize-shipping → создаёт Order в `pending_payment`, (2) `POST /api/payment/yookassa/create` → получает `confirmationUrl`, (3) `window.location = confirmationUrl` → редирект на ЮKassa. Покупатель оплачивает тестовой картой, возвращается на `/payment/return/{orderId}`, видит «Оплата принята, заказ SO-2026-0042, письмо с чеком отправлено на email». Через 3-5 секунд получает email-подтверждение (T-001).

**Why this priority**: Без этого flow checkout не работает end-to-end в браузере. Backend 055 не доходит до customer'а.

**Independent Test**: На test-shop ЮKassa, локальный dev-server с ngrok, пройти полный flow от `/cart/` до `/payment/return/{orderId}` с тестовой картой `5555 5555 5555 4477`. Проверить: Order.status=paid, paidAt filled, email T-001 в queue, UI показывает SO-номер.

**Acceptance Scenarios**:

1. **Given** customer на `/cart/checkout/physical/review/` со снапшотом Order'а, **When** нажимает «Оплатить», **Then** UI вызывает `POST /api/payment/yookassa/create` с `{orderId, retryNonce}`, получает `confirmationUrl`, выполняет `window.location.assign(confirmationUrl)`.
2. **Given** customer успешно оплатил на ЮKassa, **When** ЮKassa redirect'ит на `${origin}/payment/return/{orderId}`, **Then** страница опрашивает `GET /api/orders/{orderId}/payment-status` каждые 2 секунды.
3. **Given** webhook уже обработался к моменту polling'а, **When** ответ `{orderStatus: "paid", paidAt, clientNumber}`, **Then** UI показывает success-state с SO-номером + CTA «В личный кабинет» / «На главную».
4. **Given** webhook ещё не пришёл, **When** polling возвращает `{orderStatus: "pending_payment"}` после 60 секунд, **Then** UI показывает «Платёж обрабатывается, мы пришлём письмо когда подтвердим» + CTA «На главную».
5. **Given** ЮKassa-create endpoint возвращает 503, **When** UI получает error, **Then** показывает «Платёжная система временно недоступна, попробуйте позже» + кнопка «Назад в корзину».

---

### User Story 2 — Customer возвращается после прерванной оплаты (Priority: P1)

Customer закрыл вкладку ЮKassa без оплаты. Через 10 минут открыл письмо «Оплата ожидает» (либо вернулся через `/me/orders`). На Order page видит статус «Ожидает оплаты», кнопку «Оплатить снова» (RetryPaymentButton). Нажимает — UI вызывает `POST /api/payment/yookassa/create` с тем же `orderId` (без `retryNonce` — endpoint reuse existing `idempotenceKey`), получает тот же `confirmationUrl`, делает redirect.

**Why this priority**: P1 потому что без retry — customer потерян после первого abandon. Существующий `RetryPaymentButton.tsx` уже на странице `/cart/order/[token]/retry-payment/`, нужен только contract-fix.

**Independent Test**: Создать Order в `pending_payment` старше 1 минуты (но младше `paymentRetryWindowMin=60`), открыть `/cart/order/{token}/retry-payment`, нажать «Оплатить снова» → проверить, что endpoint возвращает existing `confirmationUrl` (а не создаёт новый платёж), customer попадает на ЮKassa.

**Acceptance Scenarios**:

1. **Given** Order в `pending_payment` с заполненными `payment.{providerRef, idempotenceKey, confirmationUrl}`, **When** customer на `/cart/order/{token}/retry-payment` нажимает «Оплатить снова», **Then** UI POST'ит `{orderId}` без `retryNonce`, получает в ответе тот же `confirmationUrl`, делает redirect.
2. **Given** Order в `expired` (старше `paymentRetryWindowMin`), **When** customer попадает на retry-страницу, **Then** показывается «Заказ аннулирован, оформите новый» + CTA «В корзину».
3. **Given** Order уже в `paid`, **When** customer попадает на retry-страницу, **Then** редирект на `/cart/order/{token}/` (страница оплаченного заказа).

---

### User Story 3 — Customer возвращается с ЮKassa на `/payment/return/{orderId}` (Priority: P1)

Сразу после успешной оплаты ЮKassa делает `window.location = ${origin}/payment/return/{orderId}`. **Эта страница сейчас не существует** — 404. Нужно создать её.

Логика страницы:
- Server Component: загружает Order (через 054 customer-session ИЛИ cart_session ИЛИ public-token), валидирует доступ
- Client Component: polling `GET /api/orders/{orderId}/payment-status` каждые 2 сек (max 30 раз = 60 сек)
- 4 финальных state UI: success / processing / expired / error

**Why this priority**: P1 critical — это URL, который мы сами зашили в backend как `return_url`. Без страницы customer попадает на 404.

**Independent Test**: Открыть `/payment/return/{orderId-with-paid-status}` напрямую → должна показать success-UI с SO-номером.

**Acceptance Scenarios**:

1. **Given** customer redirected на `/payment/return/{orderId}` после оплаты, **When** Order.status уже `paid`, **Then** немедленно (без polling-таймаута) показывается success-UI: SO-номер, «Чек отправлен на ваш email», CTA «В личный кабинет».
2. **Given** webhook ещё не пришёл (`status=pending_payment` при первом polling-tick), **When** polling делает GET каждые 2 сек, **Then** через 1-3 итерации Order перейдёт в `paid` (webhook прилетел) → UI обновляется на success.
3. **Given** Order остался в `pending_payment` после 60 сек polling, **When** timeout достигнут, **Then** UI показывает «Платёж обрабатывается, мы пришлём письмо когда подтвердим» + CTA «На главную». Customer получит email когда webhook подтвердит.
4. **Given** Order в `expired` / `cancelled`, **When** страница загружается, **Then** показывается failure-UI: «Платёж не прошёл», retry-button (если в `retryAvailable=true` окне), либо «Заказ аннулирован».
5. **Given** customer открывает `/payment/return/{orderId}` БЕЗ valid `customer_session`/`cart_session`/`?token=` — 403 от API, **When** UI получает FORBIDDEN, **Then** показывается «Не удалось проверить вашу сессию. Войдите в личный кабинет либо проверьте email».

---

### User Story 4 — Менеджер получает 4 новых типа email-алёртов (Priority: P1)

После 055 backend эмитит 4 новых doman-event'а, для которых нет email-шаблонов в `notifications/templates/`:
- `payment.expired` → **T-015 customer**: «Заказ аннулирован — оплата не получена»
- `payment.amount_mismatch` → **T-109 manager**: «⚠️ Несоответствие суммы по {clientNumber}»
- `payment.receipt_failed` → **T-110 manager**: «⚠️ Чек 54-ФЗ не выдан — проверить онлайн-кассу»
- `return.refund_failed` → **T-111 manager**: «⚠️ Refund failed для {returnNumber}»

Без них 049-emitter отметит NotificationJob как `skipped, reason=template_not_registered` и алёрты не отправляются.

**Why this priority**: P1 потому что T-109 / T-110 — это OPS-критичные алёрты. Без них owner/менеджер не узнает о mismatch-атаках или сорванной фискализации, а покупатель — об аннулировании.

**Independent Test**: Триггернуть каждый из 4 events вручную (через emitDomainEvent stub в test), убедиться что email rendered + queued в NotificationJobs.

**Acceptance Scenarios**:

1. **Given** ЮKassa webhook прислал `payment.canceled` после `paymentRetryWindowMin`, **When** 055 webhook handler эмитит `payment.expired`, **Then** 049 matcher находит T-015, render возвращает `{subject, text, html}`, NotificationJob → sent (через Unisender Go).
2. **Given** webhook прислал amount mismatch, **When** 055 эмитит `payment.amount_mismatch`, **Then** T-109 уходит менеджеру с полями `{clientNumber, expected, actual, providerRef}`.
3. **Given** receipt_registration=canceled в webhook, **When** 055 эмитит `payment.receipt_failed`, **Then** T-110 уходит менеджеру с CTA «Открыть онлайн-кассу».
4. **Given** ЮKassa прислал `refund.canceled`, **When** 053+055 эмитят `return.refund_failed`, **Then** T-111 уходит менеджеру с {returnNumber, providerRefundId, reason}.

---

### User Story 5 — Customer видит `paymentMethodSnapshot` в `/me/orders` (Priority: P2) — DEFERRED (см. OQ-3)

> **Note (post-/clarify)**: `/me/orders` UI не существует. US5 отложен — реализуется когда появится UI (вероятно spec 057). Backend данные (`paymentMethodSnapshot`) уже сохраняются 055 webhook handler, готовы к consumption.

После 054 (Customer account) customer может посмотреть свои заказы в `/me/orders` — но **UI этой страницы пока не существует** (054 backend-only). Для 056 — задача узкая: при создании UI (либо в отдельной 057) отображать:
- «Оплачено картой Visa •••• 1234» (для card)
- «Оплачено через СБП • Сбербанк Онлайн» (для SBP)
- «Чек 54-ФЗ отправлен на email» (receiptStatus=succeeded)
- «⚠️ Чек не выдан — мы решаем» (receiptStatus=canceled)

**Why this priority**: P2 — feature nice-to-have, customer всё ещё получает email-уведомление. Полная страница `/me/orders` UI — это отдельная фича (могла бы быть 057).

**Acceptance Scenarios**:

1. **Given** Order в `paid` с `paymentMethodSnapshot.card.{last4, cardType}`, **When** customer открывает `/me/orders/{id}`, **Then** видит строку «Оплачено Visa •••• 4477».
2. **Given** Order оплачен через СБП, **When** UI рендерит payment info, **Then** показывает bankName из `paymentMethodSnapshot.sbp.bankName`.
3. **Given** Order имеет `receiptStatus=canceled`, **When** customer на странице Order, **Then** показывается красное уведомление «Фискальный чек не выдан, мы свяжемся с вами».

---

### User Story 6 — Менеджер видит PaymentEvents related-list на странице Order (Priority: P2)

Admin Payload в стандартной конфигурации показывает PaymentEvents в общем списке collections + filter по `order` field. Но **на странице конкретного Order** related-list не отображается — менеджер должен искать вручную.

**Why this priority**: P2 — это удобство, не блокер. Admin filter работает.

**Acceptance Scenarios**:

1. **Given** менеджер открыл Order в Payload admin, **When** scroll down до `payment` group, **Then** видит related-list «События ЮKassa» с 5 последними PaymentEvents для этого заказа.
2. **Given** Order имеет 0 PaymentEvents, **When** менеджер открывает Order, **Then** related-list пустой с подсказкой «Платёжных событий нет».

---

### Edge Cases

- **Double-submit «Оплатить»**. Customer нажимает кнопку дважды быстро (или click-jacking). Решение: фронт disable's button после первого click + show spinner; backend имеет idempotency через `idempotenceKey` (FR-5510). При двойном click second call returns same `confirmationUrl`.
- **Browser back/forward после redirect на ЮKassa**. Customer на ЮKassa-странице нажимает «Назад». Customer возвращается на review-page с уже-converted Order'ом (`pending_payment`). Решение: review-page проверяет `Order.status`; если `pending_payment` — показывает retry-button (через RetryPaymentButton).
- **Customer закрыл вкладку и не вернулся**. Решение: cron expire (055 FR-5580) подбирает через 60 мин → email T-015.
- **Polling зависает на /payment/return**. После 30 attempts × 2 сек = 60 сек → timeout-UI с «Платёж обрабатывается». Это **финальный** state — не infinite polling.
- **Customer открыл `/payment/return/{wrong-orderId}`**. API `payment-status` вернёт 404 / 403. UI показывает generic error «Заказ не найден».
- **Concurrent webhook + polling**. Polling-tick получит current Order state; idempotency на backend (055 FR-5531) защищает.
- **Customer открыл /payment/return на мобильном из email-ссылки 24 часа спустя**. Сессия (cart_session / customer_session) могла истечь. Решение: использовать `Order.publicToken` (047 FR существующий) — `?token=<publicToken>` query param. URL генерируется в email T-001 как `${origin}/payment/return/${orderId}?token=${publicToken}`.
- **SBP customer не платит из банк-app**. ЮKassa-side timeout 20 мин → `payment.canceled` webhook → Order: cancelled (or expired). Стандартный flow.
- **Customer оплатил, но webhook не пришёл вообще (network glitch ЮKassa)**. cron-reconciliation (055 US7) подберёт через 5 мин. UI на `/payment/return` после 60 сек polling — timeout-UI. Customer получит email когда reconciliation подтвердит.
- **Webhook прилетел, но email Unisender Go не отправился**. NotificationJob останется в `pending` (с retry). UI всё равно показывает success.
- **Order.cartId is number (PG) vs cart_session cookie is string** (был баг H-01 в 055). Уже зафиксирован в code-review pass 2.

---

## 3. Requirements *(mandatory)*

### 3.1. Functional Requirements

**API contract fix (US1 + US2)**

- **FR-5601**: System MUST обновить `ReviewClient.tsx` — POST'ить `{orderId, retryNonce?}` (вместо `{cartId}`), читать `confirmationUrl` (вместо `redirectUrl`).
- **FR-5602**: System MUST обновить `RetryPaymentButton.tsx` — тот же contract; передавать только `{orderId}` (без `retryNonce` — реюзаем existing на backend).
- **FR-5603**: System MUST обновить `PhysicalCheckoutForm.tsx` — финализировать checkout через existing finalize-shipping + сразу POST'ить create-payment.
- **FR-5604**: System MUST после `confirmationUrl` выполнять `window.location.assign(url)` (не `window.location.href = url` — assign безопаснее для history). Использовать `replaceState=false` чтобы customer мог нажать «Назад».
- **FR-5605**: При HTTP 503 / network error из `/api/payment/yookassa/create` System MUST показать failure-UI с конкретным error code (`YOOKASSA_UNAVAILABLE` / `YOOKASSA_REJECTED` / `CONFIG_INVALID`) и CTA «Назад в корзину».
- **FR-5606**: При HTTP 409 (`INVALID_ORDER_STATUS`) System MUST не показывать ошибку, а перенаправлять на `/cart/order/{token}/` (Order уже paid / expired).

**Order conversion (US1) — Refined post-/clarify**

- **FR-5607** *(resolved OQ-1)*: System MUST использовать существующий `POST /api/orders` endpoint для создания Order'а ДО вызова `/api/payment/yookassa/create`. Flow клиента: (1) собрал customer/items/delivery → `POST /api/orders` → response `{order: {id, publicToken, ...}}`, (2) `POST /api/payment/yookassa/create` с этим `orderId`. Никаких новых endpoint'ов 056 не создаёт.
- **FR-5608**: System MUST атомарно: либо Order создан + платёжный URL получен, либо ничего не сохранено. Если create-payment падает — Order остаётся в `pending_payment` без `providerRef` → retry-button может пересоздать платёж.
- **FR-5609** *(NEW, OQ-NEW)*: System MUST расширить `POST /api/orders/route.ts` — если `customer_session` cookie present + валидна → парсить JWT, извлекать `customerId`, заполнять `Order.customerId` при создании. Guest-checkout (без customer_session) продолжает работать через cart-token. Additive enhancement, не breaking change для существующего guest-flow.

**Polling page (US3)**

- **FR-5620**: System MUST создать `apps/web/src/app/(site)/payment/return/[orderId]/page.tsx` (Server Component) + `components/payment/PaymentReturnClient.tsx` (Client Component).
- **FR-5621**: Server Component MUST загружать Order через Payload Local API с проверкой доступа (паттерн 054):
  - `customer_session` cookie matches `Order.customerId`, ИЛИ
  - `cart_session` cookie matches `Order.cartId`, ИЛИ
  - `?token=` query matches `Order.publicToken`
  - Иначе redirect на `/cart/` либо show 403 page.
- **FR-5622**: Client Component MUST polling `GET /api/orders/{orderId}/payment-status` каждые 2 секунды, max 30 attempts (60 секунд).
- **FR-5623**: Polling MUST останавливаться при ЛЮБОМ terminal state: `paid`, `cancelled`, `expired`, `refunded`.
- **FR-5624**: При `orderStatus=paid` System MUST показать success-UI: SO-номер (`clientNumber`), «Чек 54-ФЗ отправлен на ваш email», CTA «В личный кабинет» / «На главную». Если `receiptStatus=canceled` — дополнительное warning «⚠️ Фискальный чек не выдан, мы свяжемся с вами».
- **FR-5625**: При `orderStatus=expired` / `cancelled` System MUST показать failure-UI с reason (если backend отдаст) и CTA «Назад в каталог».
- **FR-5626**: При polling-timeout (60 сек, status всё ещё `pending_payment`) System MUST показать «Платёж обрабатывается — мы пришлём письмо в течение 5-10 минут когда подтвердим».
- **FR-5627**: Polling page MUST показывать loading-state (skeleton / spinner) пока ожидает первый ответ.
- **FR-5628**: Polling endpoint должен возвращать min headers / max ~5 KB body — нагрузка на polling приемлема.

**Email templates (US4)**

- **FR-5640**: System MUST создать `apps/web/src/lib/notifications/templates/t-015-payment-expired.ts` — рендерит email customer'у с темой «Заказ {clientNumber} аннулирован — оплата не получена» и текстом включающим: причина, ссылка «Оформить новый заказ» на `/cart/`, контакты support.
- **FR-5641**: System MUST создать `t-109-amount-mismatch.ts` — manager email с темой «⚠️ Несоответствие суммы по {clientNumber}», содержит `{expected, actual, providerRef, PaymentEvents-link}`.
- **FR-5642**: System MUST создать `t-110-receipt-failed.ts` — manager email с темой «⚠️ Чек 54-ФЗ не выдан по {clientNumber}», содержит instructions «Открыть онлайн-кассу, проверить ошибку».
- **FR-5643**: System MUST создать `t-111-refund-failed.ts` — manager email с темой «⚠️ Refund failed для {returnNumber}», содержит `{providerRefundId, reason}` + CTA «Обработать вручную в ЮKassa ЛК».
- **FR-5644**: System MUST зарегистрировать 4 шаблона в `templates/index.ts` REGISTRY map.
- **FR-5645**: Все 4 шаблона MUST использовать существующий паттерн `T-001` (HTML + plaintext, masked PII в логах, sender_name из NotificationsSettings).

**Customer account display (US5, P2)**

- **FR-5650**: System MUST показать в существующем `/me/orders` UI (либо создать его в этой спеке) для каждого `paid` Order:
  - «Карта •••• {last4} ({cardType})» (если `paymentMethodSnapshot.type === bank_card`)
  - «СБП • {bankName}» (если sbp)
  - «YooMoney-кошелёк» / «Сбербанк Онлайн» (для других methods)
- **FR-5651**: System MUST показать `payment.paidAt` в формате `dd.mm.yyyy HH:MM`.
- **FR-5652**: Если `receiptStatus=canceled` — отдельный alert-блок «Фискальный чек 54-ФЗ не выдан».

**Admin observability (US6, P2)**

- **FR-5660**: System MUST добавить related-list «События ЮKassa» на странице Order в Payload admin — показывает 5 последних PaymentEvents с фильтром `where: { order: { equals: doc.id } }`.

### 3.2. Non-Functional Requirements

- **NFR-5601**: Polling-page first-render ≤500 мс (SSR + skeleton).
- **NFR-5602**: Polling-tick ≤300 мс (легкий API).
- **NFR-5603**: Никаких client-side секретов; все ЮKassa-обращения через backend.
- **NFR-5604**: ARIA-доступность success/failure UI (screen-reader announcements, focus management на ключевых action-buttons).

---

## 4. Key Entities

Эта спека **не вводит новые DB-сущности** — только UI и email templates. Расширяется UI surface area:

- **NEW pages**: `/payment/return/[orderId]/page.tsx`
- **NEW components**: `PaymentReturnClient.tsx`, `PaymentReturnSuccess.tsx`, `PaymentReturnFailure.tsx`, `PaymentReturnProcessing.tsx`
- **NEW email-renderers**: `t-015`, `t-109`, `t-110`, `t-111` (+ registration в REGISTRY)
- **MODIFY**: `ReviewClient.tsx`, `RetryPaymentButton.tsx`, `PhysicalCheckoutForm.tsx`

---

## 5. State Machine — UI side

Locally на `/payment/return/[orderId]`:

```
[initial] → loading
  ↓ first poll-tick (≤500 мс)
  ├─ orderStatus=paid → success
  ├─ orderStatus=pending_payment → polling (max 30 ticks × 2s = 60s)
  │    ↓
  │    ├─ orderStatus=paid → success
  │    ├─ orderStatus=expired/cancelled → failure
  │    └─ timeout-after-30-ticks → processing-pending (final state)
  ├─ orderStatus=expired/cancelled → failure
  └─ HTTP 403/404 → error
```

UI-level state-machine простая, без edge case'ов уровня backend (backend handles все race conditions). UI просто отражает текущий backend state.

---

## 6. Out of Scope (MVP)

1. **Saved card UX** — «Использовать сохранённую карту» при retry. Phase 2 + 054 chain.
2. **Embed SBP QR на нашей странице** — пока используем redirect на ЮKassa-страницу (она показывает QR).
3. **Apple Pay / Google Pay** — Apple Pay в РФ не работает, Google Pay приостановлен. Не планируется.
4. **Полноценный `/me/orders` page UI** — это **отдельная спека 057** (если будет). В 056 — только display payment info **если page существует**; если нет — пропускаем US5.
5. **Custom email composer** — все шаблоны через existing `templates/` модуль, никаких WYSIWYG.
6. **Локализация English UI** — все тексты на русском (отвечает текущей audience РФ).
7. **A/B testing variants** — single canonical UI.
8. **Order recovery после magic-link login** — 054 уже это покрывает на backend; UI просто читает customer_session.
9. **Real-time updates (WebSocket / SSE)** — polling достаточен для MVP; SSE — Phase 2 если будет нагрузка.
10. **Печать чека на бумаге** — ЮKassa уже отправляет чек 54-ФЗ через ОФД (электронно). Бумажный — не applicable для онлайн-флоу.

---

## 7. Success Criteria

### Measurable Outcomes

- **SC-5601**: Customer проходит full checkout `/cart/checkout/physical/review/` → ЮKassa → `/payment/return/{orderId}` → success-UI за **≤120 секунд** в P95 (excluding time on ЮKassa side).
- **SC-5602**: **≥95%** customer'ов видят success-UI на `/payment/return/` без timeout-state (т.е. webhook прилетает за <60 сек polling). Метрика: ratio `paid_at_first_poll / total_polls`.
- **SC-5603**: **0 случаев** ошибок 404 на `/payment/return/{orderId}` для legitimate Order'ов. Метрика: error-rate в Vercel logs.
- **SC-5604**: 4 новых email-template MUST успешно рендериться (subject+text+html) на 100% NotificationJobs. Метрика: `notificationJobs.where: { template: in T-015/T-109/T-110/T-111, status: skipped, reason: template_not_registered }` count = 0.
- **SC-5605**: Customer success-rate с retry-flow: **≥70%** customer'ов, нажавших «Оплатить снова», доходят до paid. Метрика: NotificationJobs T-001 sent / Order in `pending_payment` after first abandon.
- **SC-5606**: UI accessibility audit (Lighthouse / axe-core) **≥90 баллов** на `/payment/return/` page.

---

## 8. Assumptions

- **Backend 055 merged в main** ДО implementation 056. (Сейчас 055 на feature-branch; нужен merge перед стартом implement 056. Либо 056 implement'ится поверх 055 branch до общего merge.)
- **Existing checkout pages** (`/cart/checkout/physical/`, `/cart/checkout/physical/review/`) сейчас работают и не требуют пересборки — только API-contract fix.
- **`POST /api/orders` endpoint** создаёт Order (verified в /clarify, OQ-1). Frontend вызывает его перед `/api/payment/yookassa/create`. `finalize-shipping` параллельно фиксирует price snapshot.
- **Order.publicToken** field существует и автогенерируется (verified в /clarify, OQ-2). 128-bit entropy.
- **/me/orders UI** не существует (verified в /clarify, OQ-3). US5 deferred к 057-спеке или Phase 2.
- **Unisender Go** (049) рендерит email-шаблоны через REGISTRY — нужно только добавить 4 новых; emitter уже находит template по `event.kind` через matrix (055 уже добавила matrix entries).

---

## 9. Dependencies

| Dependency | Что нужно | Status |
|---|---|---|
| 055 backend (create-payment endpoint) | OpenAPI contract finalized | ✅ Готов |
| 055 backend (payment-status endpoint) | OpenAPI contract finalized | ✅ Готов |
| 049 notifications/templates/ pattern | Existing T-001 как образец | ✅ Готов |
| 049 NotificationsSettings.senderEmail | senderName для emails | ✅ Готов |
| 054 customer_session JWT | Для auth на /payment/return | ✅ Готов |
| 047 Order.publicToken | Для guest fallback на /payment/return | ✅ Verified в /clarify (OQ-2) |
| 052 cart_session cookie | Для guest fallback | ✅ Готов |

---

## 10. Cross-spec impact

| Спека | Что 056 даёт | Что 056 берёт |
|---|---|---|
| 055 | UI consumer для backend API + 4 email-template | Endpoints + contracts |
| 049 | 4 новых template-renderer | REGISTRY pattern + senders |
| 054 | `/me/orders` display (если UI существует) | customer_session JWT |
| 047 | Использование `publicToken` для guest auth | `Order.publicToken` field |

---

## 11. Open Questions — все обработаны в /clarify

См. §0.1 Clarifications.

| # | Status |
|---|---|
| OQ-1 (Order conversion endpoint) | ✅ Resolved by research: existing `POST /api/orders` |
| OQ-2 (Order.publicToken) | ✅ Resolved by research: exists, auto-generated (128-bit) |
| OQ-3 (/me/orders UI) | ✅ Resolved by research: не существует → US5 deferred |
| OQ-4 (error messages source) | ✅ Resolved interactively: code→UI-string mapping |
| OQ-5 (polling-interval) | ✅ Resolved interactively: hardcode 2 sec × 30 attempts |
| OQ-6 (T-015 CTA) | ✅ Resolved interactively: оба CTA в email |
| OQ-NEW (Order create customer-session) | ✅ Resolved interactively: добавить binding (FR-5609) |
| OQ-7 (Admin US6 component pattern) | ⏭️ Deferred to /plan |
| OQ-8 (RetryPayment error UI) | ⏭️ Deferred — оставляем inline |

**Готовность к /plan**: 100% бизнес-решений принято; design choices (OQ-7, OQ-8) делаются в /plan-фазе.

---

## 12. Next Steps

1. ✅ `/speckit-specify` — этот документ.
2. **`/speckit-clarify`** — закрыть OQ-1..OQ-8 перед planning.
3. **`/speckit-plan`** — research existing UI patterns + design new components.
4. **`/speckit-tasks`** — декомпозиция в задачи (Phase 1 contract-fix, Phase 2 return page, Phase 3 email templates, Phase 4 admin, polish).
5. **`/speckit-implement`** — поэтапно, после merge 055 в main.

**Estimated effort**: ~12-18 часов backend-разработчика (frontend-skill требуется minimal). Plus 4-6 часов e2e в test-shop ЮKassa.

---

## 13. Глоссарий

- **`confirmationUrl`** — URL ЮKassa-страницы оплаты (приходит в ответе create-payment).
- **Polling-page** — `/payment/return/[orderId]` страница куда ЮKassa redirect'ит customer'а после оплаты.
- **Terminal state** — `paid`, `cancelled`, `expired`, `refunded` (polling stops).
- **Processing-pending state** — финальный UI после polling-timeout, когда webhook ещё не прилетел.
- **Public token** — `Order.publicToken` (047), random string для guest-доступа к Order (когда сессии истекли).
- **Retry-flow** — повторная оплата уже созданного Order (без нового create-payment), reuse existing `idempotenceKey`.

---

**End of spec — Feature 056 (Speckit Phase: /specify).**
