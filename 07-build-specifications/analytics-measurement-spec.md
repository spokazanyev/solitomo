# Спецификация Аналитики И Измерений

Дата: 2026-05-13. **Обновлено: 2026-05-26 после реализации спеки 058 v1.**

> **СТАТУС (2026-05-26)**: текущая канонической спекой является
> `specs/058-behavior-and-ad-analytics/spec.md` (v3, Level C-Full + Agent-Driven
> Model). Этот документ оставлен как high-level summary; детали — в 058.
>
> **Реализованная разметка v1**:
> - 14 целей создано на counter 109422539 (pdumarket.ru) через
>   `pnpm metrika:apply-config` (agent-driven). См. `06-reports/analytics/goal-mapping.md`.
> - События frontend: view_item / view_item_list / select_item / add_to_cart /
>   view_cart / remove_from_cart / begin_checkout / checkout_step_* /
>   payment_intent / payment_failed / payment_retry / purchase + ecommerce
>   dual-push.
> - Контент-сигналы: phone_click / email_click (через TrackedPhone/TrackedEmail) /
>   category_view / outbound_click.
> - B2B-сигналы: price_view / price_request_click / stock_status_view /
>   inn_validation_success/failed.
> - Воронка checkout: 5 step-events + cta_pay_clicked.
> - Server-side hit purchase (FR-040) для adblock-resilience.
> - Offline-conversion в Я.Директ (FR-033/034) для post-факт оптимизации.
> - PII-фильтр (FR-062) на всех events; Webvisor data-mask на PII-полях.
> - Consent banner events (shown/accepted/declined).
> - Cookie attribution: UTM/yclid/gclid + first_seen + legal_entity_flag.
> - Middleware-уровень классификация реферера (acquisition_channel).
> - Agent-driven config-as-code: `apps/web/config/metrika.config.ts` +
>   `pnpm metrika:apply-config` + `pnpm metrika:validate-config` CI-gate.
>
> **Operator guide**: `06-reports/analytics/operator-guide.md`

## Цель

Настроить измерение SEO, поведения пользователей, заявок, заказов, оплаты и доставки так, чтобы после запуска можно было понимать:

- какие страницы дают органический трафик;
- какие запросы приводят пользователей;
- какие категории и товары конвертируют;
- где пользователи бросают корзину;
- какие B2B-формы работают;
- какие страницы требуют доработки.

## Инструменты

Обязательно:

- Яндекс Метрика;
- Яндекс Вебмастер;
- Google Analytics 4;
- Google Search Console.

Желательно:

- server-side логирование событий заказов;
- собственная таблица analytics events для критичных бизнес-событий;
- dashboard в админке или отдельный отчет.

## События

## Реализованный MVP-Слой

Кодовая реализация:

- `apps/web/src/components/analytics/AnalyticsScripts.tsx` - подключение GA4 и Яндекс Метрики через публичные env-переменные.
- `apps/web/src/lib/analytics/events.ts` - единая функция отправки событий в `dataLayer`, `gtag` и `ym`.
- `apps/web/src/components/rfq/RfqCart.tsx` - событие `add_to_cart` при добавлении товара в RFQ-список.
- `apps/web/src/components/RfqForm.tsx` - события `begin_checkout`, `rfq_open`, `rfq_submit`.

Env-переменные:

| Переменная | Назначение |
|---|---|
| `NEXT_PUBLIC_YANDEX_METRICA_ID` | ID счетчика Яндекс Метрики |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 Measurement ID |
| `NEXT_PUBLIC_ANALYTICS_DEBUG` | Локальный вывод событий в console при значении `true` |

Правило приватности: события не должны передавать ФИО, email, телефон, ИНН, комментарий или текст ТЗ. Для RFQ допустимы только технические поля: тип формы, количество позиций, факт заполнения компании/ИНН, source page и внутренний request id.

## Просмотр И Навигация

- `page_view`;
- `category_view`;
- `product_view`;
- `search`;
- `filter_apply`;
- `document_download`;
- `phone_click`;
- `email_click`.

## Ecommerce

- `view_item`;
- `view_item_list`;
- `select_item`;
- `add_to_cart`;
- `remove_from_cart`;
- `begin_checkout`;
- `add_shipping_info`;
- `add_payment_info`;
- `purchase`.

## B2B И Заявки

- `rfq_open`;
- `rfq_submit`;
- `quick_order_submit`;
- `company_form_submit`;
- `invoice_request_submit`;
- `file_upload`;
- `callback_request_submit`.

## Интеграции

- `payment_created`;
- `payment_success`;
- `payment_failed`;
- `shipment_rate_requested`;
- `shipment_selected`;
- `moysklad_order_created`;
- `moysklad_sync_failed`.

## Параметры Событий

Для товарных событий:

- `product_id`;
- `sku`;
- `product_name`;
- `category`;
- `price`;
- `quantity`;
- `brand`;
- `availability`;

Для B2B:

- `form_type`;
- `company_provided`;
- `inn_provided`;
- `cart_value`;
- `items_count`;
- `source_page`;

Для SEO:

- `page_type`;
- `cluster`;
- `landing_type`;
- `category_slug`;
- `query_cluster`, если известен.

## Цели В Яндекс Метрике

Минимальный набор:

- отправка запроса КП;
- быстрый заказ;
- отправка формы юрлица;
- клик по телефону;
- клик по email;
- добавление в корзину;
- начало checkout;
- успешная покупка;
- скачивание документа.

## GA4

В GA4 использовать стандартные ecommerce events, где это возможно:

- `view_item`;
- `add_to_cart`;
- `begin_checkout`;
- `purchase`.

Для B2B использовать custom events:

- `rfq_submit`;
- `invoice_request_submit`;
- `company_form_submit`.

## Поисковый Контроль

Яндекс Вебмастер:

- индексация;
- страницы в поиске;
- запросы;
- показы;
- CTR;
- ошибки обхода;
- регионы;
- sitemap.

Google Search Console:

- performance;
- indexing;
- sitemap;
- page experience;
- rich results.

## Отладка

Для каждого события нужно проверить:

- событие отправляется только один раз;
- данные не содержат персональных данных без необходимости;
- ecommerce сумма совпадает с заказом;
- `purchase` отправляется только после подтвержденного заказа/платежа;
- события работают на desktop и mobile;
- события не ломают скорость страниц.

Локальная проверка MVP:

```bash
NEXT_PUBLIC_ANALYTICS_DEBUG=true pnpm dev
```

Дальше в браузере:

1. Открыть карточку товара.
2. Нажать `Добавить в заявку`.
3. Проверить в console событие `add_to_cart`.
4. Открыть `/b2b/request-quote/`.
5. Проверить `begin_checkout` и `rfq_open`.
6. Отправить тестовую заявку с email или телефоном.
7. Проверить `rfq_submit`.

## Критерии Приемки

- счетчики установлены на всех публичных страницах;
- события форм видны в Яндекс Метрике;
- ecommerce events видны в GA4 debug;
- sitemap добавлен в Яндекс Вебмастер и Google Search Console;
- цели по заявкам настроены;
- есть тестовый отчет по первым событиям.

## Источники

- Яндекс Метрика: https://yandex.ru/support/metrica/
- Google Analytics 4 ecommerce: https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
- Google Search Console API: https://developers.google.com/webmaster-tools
- Яндекс Вебмастер API: https://yandex.ru/dev/webmaster/
