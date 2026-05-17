# Feature Specification: Machine-Readable Product Feeds

**Feature Branch**: `040-machine-readable-product-feeds`

**Created**: 2026-05-17

**Status**: Deferred (отложено до приоритизации — см. `07-build-specifications/deferred-content-track.md`)

**Input**: AI-агенты и агрегаторы (Yandex.Market, Yandex.Neuro, Perplexity, ChatGPT с retrieval) тратят токены на парсинг HTML 66 PDP. Дать им машиночитаемые feeds — один URL = вся номенклатура. Дополнительно YML-feed критичен для попадания в Yandex.Market и алгоритмы Алисы.

## User Scenarios & Testing

### User Story 1 — Yandex.Market забирает товары через YML (Priority: P1)

Yandex.Market crawler по адресу `/feed/yandex-market.xml` получает валидный YML 2.0 (Yandex Market XML) со всеми товарами, ценами, картинками, категориями, описаниями. Товары появляются в Маркете → попадают в Алису → попадают в AI-выдачу Yandex.Neuro.

**Independent Test**: `curl /feed/yandex-market.xml` отдаёт валидный XML со `<offer>` блоками для всех товаров с ценой.

**Acceptance**:
1. YML соответствует [официальной схеме Yandex Market](https://yandex.ru/support/marketplace-prices/index.html).
2. Каждый offer содержит `id`, `name`, `url`, `price`, `currencyId="RUB"`, `picture`, `description`, `categoryId`, `vendor`, `vendorCode`.
3. Категории — массив `<category id>` сверху.

### User Story 2 — AI-агент получает каталог одним JSON-запросом (Priority: P1)

LLM-агент или скрипт fetch'ит `/api/products.json` и получает массив всех товаров в плоском JSON с ключевыми полями + URL для глубокого парсинга PDP.

**Independent Test**: `curl /api/products.json | jq '.products | length'` ≥ 66.

**Acceptance**:
1. JSON содержит `count`, `updatedAt`, `products[]`.
2. Каждый product: `sku`, `name`, `slug`, `url`, `price` (number или null), `currency`, `images[]`, `attributes` (плоские пары ключ-значение), `availability`, `category`, `description`.
3. Стабильная сериализация (сортировка по sku) — для дельта-сравнений.

### User Story 3 — Один товар через API для агентов (Priority: P2)

`/api/products/[sku].json` отдаёт один товар в формате User Story 2 plus `documents[]` (паспорта, сертификаты, чертежи) и `relatedProducts[]`.

**Acceptance**: `curl /api/products/SP-8.json` → 200 + полный объект; `/api/products/non-exist.json` → 404.

### User Story 4 — Google Merchant Feed для AI-агентов вне РФ (Priority: P2)

`/feed/google-merchant.xml` отдаёт Google Shopping XML. Это менее критично для РФ (Google Shopping ограничен), но используется международными AI-агентами как стандартный формат каталога.

**Acceptance**: XML валиден по [Google Merchant schema](https://support.google.com/merchants/answer/7052112).

### Edge Cases

- **Товары без цены**: в YML offer тогда выставляется флаг «available=false, price отсутствует» — Yandex может не принять offer. Решение: фильтровать товары без цены из YML, оставлять в `/api/products.json` с `price: null`.
- **Большое описание/изображения**: лимит YML — 50000 строк, 350MB. У нас 66 товаров — далеко от лимита.
- **Категории**: YML требует иерархию. У нас 11 категорий — выгружаем как плоский список, маппя `Product.categories[0]` → categoryId.

## Requirements

### Functional Requirements

- **FR-001**: `/feed/yandex-market.xml` MUST возвращать валидный YML с правильным declaration `<?xml version="1.0" encoding="UTF-8"?>`, `<!DOCTYPE yml_catalog ...>`, `<yml_catalog>`, `<shop>` элементами.
- **FR-002**: Каждый `<offer>` в YML содержит обязательные поля YML.
- **FR-003**: `/api/products.json` MUST возвращать JSON без авторизации.
- **FR-004**: `/api/products/[sku].json` MUST возвращать товар или 404.
- **FR-005**: `/feed/google-merchant.xml` MUST соответствовать Google Merchant XML schema.
- **FR-006**: Все feeds MUST иметь заголовки `Cache-Control: public, max-age=3600`, `Content-Type` корректный.
- **FR-007**: `robots.txt` MUST содержать прямые ссылки на feeds в sitemap-блоке.

### Quality Requirements

- **QR-001**: Yandex Market XML-валидатор не выдаёт ошибок.
- **QR-002**: `/api/products.json` отвечает за < 200ms на dev (с кешированием).
- **QR-003**: Все три feeds доступны без auth.

## Success Criteria

- **SC-001**: Все 66 товаров с известной ценой представлены в YML feed.
- **SC-002**: Sitemap.xml содержит ссылку на feed.
- **SC-003**: После регистрации feed в Yandex.Market — товары загружаются (это уже organisational, не блокер).

## Assumptions

- YML формат стабилен (не меняется в ближайшие 12 мес).
- Цены в `00-source-data/assortment/soliton1_assortment_raw.json` хоть как-то актуальны (см. deferred-content-track п.7).
- Картинки уже локальные (`/legacy/wp/...`), могут отдаваться боту.
