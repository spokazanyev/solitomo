# Goal Mapping — Yandex.Metrika

**Generated**: 2026-05-26 by `pnpm metrika:apply-config` (FR-292, FR-363).

**ВНИМАНИЕ**: этот файл — output `metrika:apply-config` CLI. Не редактировать руками
для метрика-ID (они синхронизируются автоматически). Редактировать можно только
`businessMeaning` и `owner` — эти колонки сохраняются при следующем apply через merge.

Source-of-truth для самой конфигурации Metrika — `apps/web/config/metrika.config.ts`.

| event_name | metrika_goal_id | ga4_event_name | business_meaning | owner | last_updated |
|---|---|---|---|---|---|
| purchase | 562674651 | purchase | Успешная оплата заказа (главная цель для оптимизации Я.Директа) | svp@heado.ru | 2026-05-26 |
| begin_checkout | 562674653 | begin_checkout | Пользователь начал оформление заказа | svp@heado.ru | 2026-05-26 |
| add_to_cart | 562674654 | add_to_cart | Товар добавлен в корзину | svp@heado.ru | 2026-05-26 |
| payment_intent | 562674587 | payment_intent | Платёж инициирован (клик 'Оплатить', до редиректа) | svp@heado.ru | 2026-05-26 |
| payment_failed | 562674588 | payment_failed | Оплата провалилась (по любой причине) | svp@heado.ru | 2026-05-26 |
| rfq_submit | 562674656 | rfq_submit | B2B запрос на КП отправлен | svp@heado.ru | 2026-05-26 |
| rfq_open | 562674589 | rfq_open | Пользователь открыл форму RFQ (начал заполнять) | svp@heado.ru | 2026-05-26 |
| price_request_click | 562674657 | price_request_click | B2B-сигнал: клик 'Запросить цену' на товаре без публичной цены | svp@heado.ru | 2026-05-26 |
| document_download | 562674658 | document_download | Скачан PDF (документация / паспорт / сертификат) | svp@heado.ru | 2026-05-26 |
| phone_click | 562674659 | phone_click | Клик по номеру телефона | svp@heado.ru | 2026-05-26 |
| email_click | 562674660 | email_click | Клик по email-ссылке | svp@heado.ru | 2026-05-26 |
| search | 562674661 | search | Использован внутренний поиск по сайту | svp@heado.ru | 2026-05-26 |
| search_no_results | 562674662 | search_no_results | Поиск дал 0 результатов (контент-сигнал) | svp@heado.ru | 2026-05-26 |
| filter_apply | 562674663 | filter_apply | Применён фильтр в каталоге | svp@heado.ru | 2026-05-26 |
