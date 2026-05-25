# UI Implementation Notes — 047 Delivery Checkout

Файлы, созданные в этой итерации, и оставшиеся TODO.

## Созданные файлы

### Компоненты чекаута (`apps/web/src/components/checkout/`)
- `DeliverySummary.tsx` — sticky-сводка с расчётом subtotal/VAT/доставки/итого; кнопка «К оплате» disabled до выбора тарифа (S3).
- `ReviewSummary.tsx` — экран «Проверьте заказ» (S10): сводка получатель/адрес/доставка/позиции/итого + два чекбокса (оферта обязательный, мессенджер опц.); «Перейти к оплате» disabled пока оферта не отмечена.
- `ReviewClient.tsx` — клиентский wrapper для review-страницы: вызывает `/api/checkout/finalize-shipping`, на 409 PRICE_CHANGED открывает `PriceMismatchModal`, на 409 RATE_UNAVAILABLE редиректит обратно, на 200 — POST `/api/payment/yookassa/create` → redirect.
- `CheckoutShippingClient.tsx` — клиент-wrapper для шага «Доставка»: оборачивает `DeliveryBlock` + `DeliverySummary`, хранит `selectedRate`. При «К оплате» POST `/api/checkout/draft` (HTTP-only cookie) и push на `/cart/checkout/physical/review/`.
- `RetryPaymentButton.tsx` — клиентская кнопка повторной оплаты, POST `/api/payment/yookassa/create` с `{ orderId, retry: true }`.

### Страницы (`apps/web/src/app/(site)/cart/`)
- `checkout/physical/review/page.tsx` — server-component review-страницы (S10). Читает draft через `readDraftOrder()`, рендерит `ReviewClient`. Если draft отсутствует → redirect на чекаут.
- `order/[token]/retry-payment/page.tsx` — страница повторной оплаты (S13a). Подгружает заказ по `publicToken`, проверяет `status === pending_payment` и `paymentRetryUntil > now`. Иначе — redirect на /cart/order/[token]/ или /cart/?error=order-expired.
- `order/[token]/review/page.tsx` — публичная форма отзыва (S13). Проверяет history на наличие записи `[review]` (alreadySubmitted) и показывает «Спасибо» либо `ReviewForm`.

### Компоненты заказа (`apps/web/src/components/order/`)
- `ReviewForm.tsx` — форма отзыва (★ 1–5, два textarea, чекбокс публикации). POST `/api/orders/[token]/review`. На `ALREADY_SUBMITTED` показывает «Спасибо».

### Admin-компоненты (`apps/web/src/components/admin/orders/`)
- `CreateShipmentButton.tsx` — кнопка «Создать отправление». Использует `useDocumentInfo()` для проверки `order.status ∈ {paid,fulfilling}` и `shipment.status ∈ {none, error, ""}`. POST `/api/admin/shipping/create`.
- `ShipmentInfoPanel.tsx` — readonly-блок с tracking, кнопки «Этикетка PDF», «Накладная PDF», «⟳ Обновить трекинг», «✕ Отменить отправление». Использует `useDocumentInfo()`.

### Утилиты (`apps/web/src/lib/checkout/`)
- `draft-order.ts` — `readDraftOrder()` / `writeDraftOrder()` / `clearDraftOrder()` через Next.js `cookies()`. JSON в HTTP-only cookie `soliton_checkout_draft`, TTL 30 минут.

### API-роуты (`apps/web/src/app/api/`)
- `checkout/draft/route.ts` — POST (запись draft) / DELETE (очистка). Используется `CheckoutShippingClient`.
- `orders/[token]/review/route.ts` — POST публичного отзыва. Сейчас сохраняет в `Order.history` с префиксом `[review]` (stub до спеки 049).

## Ключевые UX-решения

1. **Два шага вместо одного.** Чекаут разделён на «выбор доставки» (`/cart/checkout/physical/`) и «проверка» (`/cart/checkout/physical/review/`). Между шагами — HTTP-only cookie draft с TTL 30 мин.
2. **PriceMismatchModal** — обязательный шаг защиты от расхождения цены: открывается только при 409 PRICE_CHANGED от finalize-shipping, не при первом расчёте.
3. **Disabled-кнопки с пояснением.** На S3 — «Выберите вариант доставки выше». На S10 — пока оферта не отмечена, кнопка серая.
4. **Retry-payment как отдельная страница**, а не модал — даёт прямую ссылку из email и явно показывает оставшееся время.
5. **Review form**: после успеха показывается inline-«Спасибо» без редиректа.
6. **Admin-кнопки** через `@payloadcms/ui` `useDocumentInfo()` — без localStorage, без своих fetches данных.

## TODO / открытые вопросы

- [ ] Подключить кнопки `CreateShipmentButton` и `ShipmentInfoPanel` в `Orders.js` через `admin.components.fields` / `admin.components.beforeFields`.
- [ ] Реализовать `/api/payment/yookassa/create` (упоминается в `ReviewClient` и `RetryPaymentButton`). Сейчас обе клиентские кнопки уже корректно обрабатывают 4xx и `body.redirectUrl`.
- [ ] Заменить stub-сохранение отзыва в `Order.history` на отдельную коллекцию `order-reviews` (спека 049).
- [ ] Прикрутить полную клиент-форму получателя на шаге доставки. Сейчас `customer` в draft пустой — на review-странице ФИО/email/телефон не показываются, если их не передать через `CheckoutShippingClient` `props.customer`.
- [ ] Адрес доставки в draft содержит только `query` — `house`/`flat`/`postalCode` не пробрасываются из `DeliveryBlock` (он не экспортирует address наружу). Нужно обновить `DeliveryBlock` API или дублировать AddressForm в `CheckoutShippingClient`.
- [ ] Обновить страницу `/cart/checkout/physical/page.tsx`, чтобы она рендерила новый `CheckoutShippingClient` вместо устаревшего `PhysicalCheckoutForm` (или объединить их).
- [ ] DaData-координаты адреса не пробрасываются в draft (нужны для ApiShip create).
- [ ] PointSelector не интегрирован в `CheckoutShippingClient` — `selectedRate.pointId` остаётся undefined для тарифов с `pickupType=2`. Открытие модала нужно подключить через колбэк из `DeliveryBlock`.
- [ ] i18n: все строки сейчас русские; admin-компоненты используют русские лейблы напрямую.

## Совместимость с существующим кодом

- `PhysicalCheckoutForm` (старый) **не удалён** — он продолжает работать как fallback на `/cart/checkout/physical/` до полной миграции на `CheckoutShippingClient`.
- API `/api/checkout/finalize-shipping` уже существует и используется `ReviewClient` без изменений.
- `PriceMismatchModal`, `DeliveryBlock`, `AddressForm`, `PointSelector` использованы as-is, без правок.

## Acceptance-маркеры (для тестировщика)

| Экран | Файл | Проверка |
|---|---|---|
| S3 | `DeliverySummary.tsx` | Итого пересчитывается при смене `selectedRate`; кнопка disabled без тарифа. |
| S10 | `ReviewSummary.tsx` + page | Чекбокс оферты управляет disabled state кнопки. |
| S11 | `ReviewClient.tsx` | Модал открывается при 409 PRICE_CHANGED; «Принять» дёргает finalize с `?accept=true`. |
| S13 | `ReviewForm.tsx` + API | POST `/api/orders/[token]/review`; повторный POST возвращает 409 ALREADY_SUBMITTED. |
| S13a | `retry-payment/page.tsx` | redirect если статус ≠ pending_payment или `paymentRetryUntil` истёк. |
| Admin | `CreateShipmentButton.tsx` | Кнопка появляется только для подходящих статусов. |
| Admin | `ShipmentInfoPanel.tsx` | Все кнопки идут на правильные admin/shipping/* endpoints. |
