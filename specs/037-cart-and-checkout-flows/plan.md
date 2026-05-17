# Implementation Plan: Cart And Three Checkout Flows

**Branch**: `037-cart-and-checkout-flows`

**Date**: 2026-05-16

**Spec**: [spec.md](./spec.md)

## Summary

Превратить «RFQ-корзину» (текущий `RfqCart` со списком артикулов) в полноценную e-commerce корзину с тремя выходными путями: оплата картой (физлицо), счёт (юрлицо), запрос КП. Создать Payload-коллекцию `orders`, страницу корзины, многошаговый checkout, PDF-генерацию счёта, интеграцию с платёжным шлюзом ЮKassa, аналитические события.

## Технический контекст

**Стек**: Next.js 16 App Router, React 19, Payload 3, PostgreSQL.

**Текущее состояние**:
- `RfqCart` живёт в `apps/web/src/components/rfq/RfqCart.tsx` — localStorage, addItem/removeItem.
- `AddToRfqButton` на каталоге и PDP добавляет позиции.
- `RfqCartLink` в `SiteHeader` показывает иконку-корзину с бейджем.
- `RfqForm` в `apps/web/src/components/RfqForm.tsx` — форма КП, читает search-params, отправляет в `/api/rfq`.
- Payload коллекция `rfq-requests` хранит RFQ-заявки.

## Архитектура

### Хранение и состояние

- **Cart state (client)**: остаётся в localStorage. Ключ переименовать с `rfq-cart` на `cart` (миграция при загрузке).
- **Cart structure** расширяется: помимо `{sku, name, quantity}` добавляется `{price, image, slug}` для отрисовки без обращения к источнику.
- **Order (server)**: новая Payload коллекция `orders` с полями `type`, `status`, `items[]`, `customer`, `delivery`, `payment`, `invoice`, `notes`, `history[]`.

### Маршруты

```
/cart/                          — корзина (страница)
/cart/checkout/physical/        — checkout физлица (форма + redirect на pay-gateway)
/cart/checkout/invoice/         — checkout юрлица (форма + создание счёта)
/cart/checkout/quote/           — quote-flow (форма КП с предзаполненными позициями)
/cart/order/[id]/               — публичная страница заказа (для клиента по ссылке из email)
/api/orders                     — POST создание заказа
/api/orders/[id]                — GET статус
/api/payment/yookassa/webhook   — webhook ЮKassa
/api/invoice/[orderId]          — генерация и скачивание PDF
```

### Существующая совместимость

- `AddToRfqButton` → переименовать в `AddToCartButton`. Старое имя экспортировать как alias до полной миграции.
- Текущая `/b2b/request-quote/` страница продолжает работать самостоятельно (для прямого перехода без корзины) — её форма умеет работать и с пустыми позициями.

## Фазы

### Phase 1 — Cart Foundation (5 дней)

- Переименовать localStorage ключ + миграция со старого ключа.
- Создать `/cart/` страницу, рендер `CartView` компонента.
- Расширить `CartItem` структуру: добавить price, image, slug.
- Обновить `AddToCartButton` (с обратной совместимостью имени).
- `CartView` показывает три CTA-блока: «Купить как физлицо», «Выписать счёт», «Запросить КП».
- Пустое состояние: «Корзина пуста» + CTA в каталог.
- Header icon ведёт на `/cart/`, не на `/b2b/request-quote/`.

### Phase 2 — Quote Flow (1 день, простейший)

- `/cart/checkout/quote/` — форма КП, открытая с предзаполненными позициями из корзины.
- При submit — создаёт запись в `rfq-requests` (текущая коллекция) с прикреплёнными позициями + очищает корзину.
- Success-state. Аналитика `quote_submitted`.

Этот flow — переиспользование текущего `RfqForm`. Самый быстрый сценарий из трёх.

### Phase 3 — Orders Collection + Invoice Flow (5 дней)

- Payload коллекция `orders` с полями (см. spec.md `Order entity`).
- Workflow-поля (status, history) через shared admin helpers (как в `rfq-requests`).
- `/cart/checkout/invoice/` — форма реквизитов юрлица + выбор доставки.
- API `/api/orders` (POST) — создаёт заказ типа `legal` со статусом `awaiting_payment`.
- PDF-генератор счёта: использует библиотеку `pdfkit` или `@react-pdf/renderer`.
- PDF сохраняется в Payload Media или генерится on-demand через `/api/invoice/[orderId]`.
- Email с PDF клиенту + менеджеру (используется текущая email-инфраструктура из RFQ; если её нет — отдельная мини-фича).
- Success-страница `/cart/order/[id]/?type=legal` с инструкцией оплаты.
- Аналитика `invoice_requested`.

### Phase 4 — Physical Pay Flow + ЮKassa (5 дней)

- `/cart/checkout/physical/` — форма ФИО/контакты/адрес + выбор доставки.
- API `/api/orders` принимает type=`physical`, создаёт заказ со статусом `pending_payment`.
- Интеграция с ЮKassa: создание платежа через API, redirect на их confirmation URL.
- Webhook `/api/payment/yookassa/webhook` принимает уведомления, обновляет статус заказа на `paid`.
- Success-страница `/cart/order/[id]/?type=physical&status=paid` — спасибо за заказ, трек скоро будет.
- Email клиенту с подтверждением.
- Аналитика `purchase` (ecommerce event, с item-deталями для Metrika/GA).

### Phase 5 — Manager Workflow + Public Order Page (3 дня)

- Payload admin views: список заказов с фильтром по статусу, в карточке заказа — workflow, история, email-уведомления.
- Менеджер может: отметить как paid (для invoice), указать трек-номер, изменить статус, добавить комментарий, прикрепить файлы.
- Email-нотификации клиенту при смене статуса (paid → shipped → delivered).
- Публичная страница `/cart/order/[id]/` показывает клиенту его заказ по уникальному id-токену из email (без авторизации, по ссылке).

### Phase 6 — Analytics + Polish (2 дня)

- События в `dataLayer`: `view_cart`, `begin_checkout`, `add_payment_info`, `purchase`, `invoice_requested`, `quote_submitted`.
- Server-side hit для `purchase` и `invoice_requested` (адблок-устойчивость).
- Тесты на полные сценарии (Cypress / Playwright базово).
- Mobile-проход всех страниц на 375px.
- Documentation в `07-build-specifications/checkout-rfq-spec.md` обновить (или новый `cart-checkout-spec.md`).

## Зависимости и пререкизиты

- **Платёжный шлюз — ЮKassa API ключ** (sandbox + prod). Без этого Phase 4 живёт в режиме mock.
- **Банковские реквизиты Солитон** для PDF-счёта. Без этого Phase 3 шаблон с TODO(owner).
- **Реальный SMTP / email-сервис** для отправки PDF и нотификаций. Если нет — Phase 3 ставит заказы только в Payload без email.
- **Решение по доставке**: список курьеров для v1 (СДЭК / Boxberry / Почта / самовывоз). Цены — фиксированные таблицы или per-city. Пока — флаги «согласуется отдельно».
- **Решение по НДС**: ставка 20% или без НДС.

Все пререкизиты документируются в `07-build-specifications/deferred-content-track.md`.

## Архитектурные решения

### Cart как client-side

В v1 корзина живёт в localStorage. Нет сессионного синка между устройствами. Это упрощает архитектуру; синк добавим, когда появится login.

### Order как single Payload collection с типом

Все три типа (`physical`, `legal`, `quote`) живут в одной коллекции `orders`, отличаются полем `type` и набором заполненных полей. Это упрощает админку и аналитику. RFQ-quote дублирует данные в `rfq-requests` для обратной совместимости — postpone разделения.

Альтернатива (отдельная коллекция per type) — не выбрана, потому что общий статус-машина и общая admin-сетка важнее.

### Платёжная интеграция через ЮKassa hosted-форма

Не Embedded form, не SDK — простой redirect к их странице. Минимум кода на нашей стороне, нет PCI-DSS требований.

### PDF через @react-pdf/renderer

React-компонент → PDF. Удобно поддерживать вместе с UI. Альтернатива (HTML→PDF через Puppeteer) — слишком тяжёлый Chrome-runtime для серверлесс.

### Email через Resend / собственный SMTP

Решение принимает владелец. Заглушка через console.log в dev до получения ключа.

### Двойная коллекция (`orders` + `rfq-requests`) на переходный период

Quote-flow пишет в обе, чтобы не сломать существующие отчёты по RFQ. Финальная консолидация — отдельная фича после стабилизации.

## Риски

| Риск | Митигация |
|---|---|
| 54-ФЗ (онлайн-чеки) | Делегируем ЮKassa если их сервис «Чеки» включён; иначе блокер до интеграции с АТОЛ |
| Возвраты/отмены через закон о защите прав потребителей | Ручной workflow менеджера; политика возврата на отдельной странице (отложить) |
| Стоимость доставки не известна на этапе оплаты у физлица | В v1 — фиксированные тарифы или «уточняется» с post-payment согласованием |
| Дубль заказа при ретрае webhook | Idempotency key в Order + проверка по reference |
| Корзина теряется при очистке localStorage | Email-fallback: «сохранить корзину на email» (не в v1) |

## Validation

- `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- `pnpm public-copy-audit`, `pnpm validate:seo`, `pnpm validate:schema` остаются зелёными (новые routes — public, indexable: false для `checkout` шагов).
- End-to-end: каталог → корзина → 3 пути → success-state каждого.
- Webhook idempotency: повторный вызов не создаёт дубль платежа.

## Follow-ups (после этой фичи)

- Личный кабинет покупателя с историей заказов.
- Multi-tab синк корзины (через BroadcastChannel или server-сторонней session).
- Live-сток и резервирование.
- Промокоды.
- DaData / валидация ИНН.
- Курьерская интеграция через ApiShip (получение реальной стоимости/срока).
- Налоговый учёт, интеграция с 1С.
