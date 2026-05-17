# Quickstart: Conversion RFQ MVP

```bash
pnpm dev
```

Проверить:

- `http://localhost:3000/`
- `http://localhost:3000/catalog/pdu-uzip/`
- `http://localhost:3000/product/sp-8/`
- `http://localhost:3000/b2b/request-quote/`

Критичный сценарий: открыть главную, перейти в заявку на КП, отправить тестовую заявку с описанием сетевого фильтра или PDU.

Критичный сценарий RFQ-списка: открыть карточку `SP-8`, нажать `Добавить в заявку`, проверить счетчик `Запрос КП`, перейти в форму и убедиться, что SKU, название и количество заполнены.

Для отладки событий:

```bash
NEXT_PUBLIC_ANALYTICS_DEBUG=true pnpm dev
```

Проверить в console: `add_to_cart`, `begin_checkout`, `rfq_open`, `rfq_submit`.
