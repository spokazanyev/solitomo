# Tasks: Cart And Three Checkout Flows

**Input**: [spec.md](./spec.md), [plan.md](./plan.md).

## Phase 1 — Cart Foundation

- [ ] T001 Создать `apps/web/src/lib/cart/cart-store.ts` — client-side store на localStorage с миграцией со старого ключа `rfq-cart` → `cart`. Поля item: sku, name, slug, image, price (number|null), quantity.
- [ ] T002 Создать хук `useCart()` (replacement для `useRfqCartItems`).
- [ ] T003 Обновить `AddToRfqButton` → `AddToCartButton` (rename + alias старого имени для обратной совместимости).
- [ ] T004 Обновить рендер карточек товаров: на каталоге и PDP передавать в `AddToCartButton` price/slug/image, чтобы они попали в корзину.
- [ ] T005 Создать страницу `/cart/`: `apps/web/src/app/(site)/cart/page.tsx` + компонент `CartView`.
- [ ] T006 Empty state корзины: «Корзина пуста» + ссылка в каталог.
- [ ] T007 `RfqCartLink` в `SiteHeader` теперь ведёт на `/cart/`, не на `/b2b/request-quote/`.
- [ ] T008 Три CTA в корзине: «Купить как физлицо», «Выписать счёт», «Запросить КП». Каждая ведёт на свою checkout-страницу.
- [ ] T009 Аналитика: `view_cart` при открытии `/cart/`; `begin_checkout` при выборе любого из трёх путей.

## Phase 2 — Quote Flow

- [ ] T010 Создать `apps/web/src/app/(site)/cart/checkout/quote/page.tsx`, отдельный layout-skeleton.
- [ ] T011 Переиспользовать `RfqForm` (компонент), передать ему позиции корзины как initial state.
- [ ] T012 По успешной отправке RFQ — очистить корзину, redirect на success-state.
- [ ] T013 Сохранить запись в `rfq-requests` с массивом позиций (как сейчас).
- [ ] T014 Аналитика: `quote_submitted` с item details.

## Phase 3 — Orders Collection + Invoice Flow

- [ ] T015 Создать Payload коллекцию `orders`: `apps/web/src/collections/Orders.ts` с полями type, status, items, customer, delivery, payment, invoice, notes, history.
- [ ] T016 Зарегистрировать коллекцию в `apps/web/src/payload.config.ts`. Запустить `pnpm --filter @soliton/web generate:types`.
- [ ] T017 Создать `apps/web/src/app/(site)/cart/checkout/invoice/page.tsx`: форма с реквизитами юрлица (название, ИНН, КПП, ОГРН, юр. адрес, контактное лицо, email, phone) + выбор доставки.
- [ ] T018 API `apps/web/src/app/api/orders/route.ts` (POST): создаёт заказ типа `legal` со статусом `awaiting_payment`. Возвращает orderId.
- [ ] T019 Добавить зависимость `@react-pdf/renderer` (или альтернативу). Создать `apps/web/src/components/invoice/InvoicePdf.tsx` — компонент-шаблон счёта.
- [ ] T020 API `/api/invoice/[orderId]` (GET) — рендерит PDF на лету и отдаёт.
- [ ] T021 На создании заказа — отправить email юрлицу с PDF-вложением + менеджеру (через текущую email-инфраструктуру; заглушка в dev).
- [ ] T022 Success-страница `/cart/order/[id]/?type=invoice` — инструкция оплаты, ссылка на PDF.
- [ ] T023 Аналитика: `invoice_requested` с suma и item-list.

## Phase 4 — Physical Pay Flow + ЮKassa

- [ ] T024 Установить `@a2seven/yoo-checkout` (или прямые HTTP-вызовы к ЮKassa API).
- [ ] T025 `.env.example`: добавить `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_TEST_MODE`.
- [ ] T026 Создать `apps/web/src/app/(site)/cart/checkout/physical/page.tsx`: форма ФИО/email/phone/адрес/доставка.
- [ ] T027 API `/api/orders` принимает type=`physical`, создаёт `Order` со статусом `pending_payment`.
- [ ] T028 После создания заказа: создать платёж в ЮKassa, получить `confirmation_url`, redirect клиента туда.
- [ ] T029 API `/api/payment/yookassa/webhook` — принимает уведомления ЮKassa. Проверка подписи, идемпотентность, переход заказа в `paid` / `cancelled`.
- [ ] T030 Success-страница `/cart/order/[id]/?type=physical&status=paid` — спасибо + что дальше.
- [ ] T031 Email клиенту с подтверждением оплаты.
- [ ] T032 Аналитика: `add_payment_info`, `purchase` (с item-array).
- [ ] T033 Server-side hit в Метрику для `purchase` (адблок-устойчивость).

## Phase 5 — Manager Workflow + Public Order Page

- [ ] T034 Payload admin: настроить список заказов с фильтром по `type` и `status`, цветными бейджами.
- [ ] T035 В карточке заказа: workflow-история, выбор статуса, поле track-номера, поле комментария менеджера.
- [ ] T036 Hooks в Payload `Orders`: при смене статуса отправлять email клиенту (paid → shipped → delivered → cancelled).
- [ ] T037 Публичная страница `apps/web/src/app/(site)/cart/order/[id]/page.tsx`: показывает заказ по уникальному id (без авторизации), скрывает чувствительные поля.
- [ ] T038 В email-нотификациях клиенту прикладывать ссылку на эту страницу.

## Phase 6 — Analytics + Polish

- [ ] T039 Расширить `apps/web/src/lib/analytics/data-layer.ts`: добавить `trackViewCart`, `trackBeginCheckout`, `trackAddPaymentInfo`, `trackPurchase`, `trackInvoiceRequested`.
- [ ] T040 Server-side Measurement Protocol для `purchase` и `invoice_requested` через ЯМ API.
- [ ] T041 Mobile проход всех страниц на 375px viewport (`/cart/`, 3 × checkout, success).
- [ ] T042 E2E happy path тест (curl-based или Playwright): каталог → корзина → одна из трёх checkout-форм → success.
- [ ] T043 Обновить `07-build-specifications/checkout-rfq-spec.md` или создать `cart-checkout-spec.md` с финальным описанием реализации.
- [ ] T044 Обновить `06-reports/06-asset-inventory.json` если PDF-инвойсы будут храниться в Payload Media.
- [ ] T045 Проверить `pnpm public-copy-audit`, `pnpm validate:seo`, `pnpm validate:schema`. /cart/* должны быть `indexable: false`.
- [ ] T046 Документировать пререкизиты в `07-build-specifications/deferred-content-track.md`: ЮKassa key, банковские реквизиты, SMTP, доставка, НДС.

## Phase 7 — Verification

- [ ] T047 Sandbox-тест полного флоу физлица в ЮKassa test-mode.
- [ ] T048 Manual-тест invoice-flow: создание, PDF, email.
- [ ] T049 Manual-тест quote-flow с предзаполненными позициями.
- [ ] T050 Manager в Payload admin может изменить статус, добавить трек, увидеть историю.
- [ ] T051 Аналитика — все 5 событий видны в Yandex.Metrika в режиме отладки.
- [ ] T052 Acceptance scenarios из spec.md пройдены.
