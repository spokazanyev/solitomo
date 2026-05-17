# Checkout And RFQ Specification

Дата: 2026-05-15.

## Назначение

Документ фиксирует первый рабочий контур заявки Soliton: переход из карточки товара в запрос КП, форма для юрлиц и проектных покупателей, API, сохранение заявки и дальнейшее развитие в корзину, уведомления и интеграции.

## Реализованный Базис

Кодовая реализация:

- `apps/web/src/components/RfqForm.tsx` - клиентская форма запроса КП.
- `apps/web/src/components/rfq/RfqCart.tsx` - клиентский список позиций для КП в `localStorage`, кнопка добавления и счетчик заявки.
- `apps/web/src/lib/analytics/events.ts` - события `add_to_cart`, `begin_checkout`, `rfq_open`, `rfq_submit`.
- `apps/web/src/app/api/rfq-submit/route.ts` - API сохранения заявки.
- `apps/web/src/collections/RfqRequests.js` - Payload collection для заявок.
- `apps/web/src/components/page-templates.tsx` - вывод формы на `/b2b/request-quote/`, кнопки добавления товаров из листинга.
- `apps/web/src/components/product/ProductDetailPage.tsx` - добавление товара в заявку и переход в форму.
- `apps/web/src/components/SeoLandingPage.tsx` - счетчик выбранных позиций в шапке.
- `.gitignore` - исключение локальных JSONL-файлов заявок.

## RFQ Flow

1. Пользователь открывает карточку товара.
2. Нажимает `Добавить в заявку` в карточке товара или в листинге категории.
3. Позиция сохраняется в клиентский список RFQ в `localStorage`; счетчик в шапке показывает количество выбранных позиций.
4. Пользователь переходит на `/b2b/request-quote/`.
5. Форма подхватывает сохраненные позиции. Прямой переход `/b2b/request-quote/?sku=...&product=...` также поддерживается.
6. Пользователь добавляет количество, компанию, ИНН, контакт, город, срок, комментарий и ТЗ текстом.
7. API валидирует контактные данные.
8. Заявка сохраняется в Payload `rfq-requests`.
9. Если Postgres недоступен локально, заявка сохраняется в `00-source-data/rfq-submissions/rfq-requests.jsonl`.
10. После успешной отправки клиентский список RFQ очищается.

## RFQ Item List

Клиентский список не является полноценной корзиной и не обещает онлайн-покупку. Его задача - собрать несколько SKU перед отправкой КП.

Правила:

- хранить только `sku`, `name`, `quantity`;
- объединять одинаковые SKU/названия;
- ограничивать список 20 позициями;
- не хранить цены, остатки, персональные данные или условия доставки в `localStorage`;
- использовать форму КП как единственный источник отправки заявки.

## Fields

| Поле | Назначение |
|---|---|
| `customerType` | Юрлицо, физлицо или интегратор |
| `companyName` | Компания или организация |
| `inn` | ИНН для счета и реквизитов |
| `contactName` | Контактное лицо, обязательно |
| `email` | Email, один из способов связи |
| `phone` | Телефон, один из способов связи |
| `city` | Город поставки |
| `deadline` | Желаемый срок |
| `items` | JSON со SKU, названием и количеством |
| `message` | Комментарий |
| `technicalSpec` | ТЗ или список оборудования текстом |
| `analytics` | Источник формы и user-agent |

## Access Control

Payload collection:

- публично разрешено только `create`;
- `read`, `update`, `delete` доступны только авторизованному администратору.

## Deferred

Следующие части остаются отдельными feature:

- файл-аплоад ТЗ;
- email-уведомления менеджеру и клиенту;
- расширенные события аналитики по просмотрам категорий, товаров и документам;
- полноценная корзина с ценами, резервированием, оплатой и доставкой;
- экспорт заявки в МойСклад;
- статусы и SLA обработки;
- антиспам и rate limiting.

## Validation

Проверки:

```bash
pnpm lint
pnpm typecheck
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm build
curl -sI 'http://localhost:3000/b2b/request-quote/?sku=S-16C13%2B2C19&product=test'
curl -s -X POST http://localhost:3000/api/rfq-submit/ -H 'Content-Type: application/json' --data '{"contactName":"Test","email":"test@example.com"}'
```

## Next Feature

`014-analytics-events`: события `add_to_cart`, `rfq_open`, `rfq_submit` для Яндекс Метрики/GA4.

`013-moysklad-sync`: синхронизация товаров, цен, остатков, заказов/заявок и контрагентов с МойСклад остается отложенной до отдельного этапа.
