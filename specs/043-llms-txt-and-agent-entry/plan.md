# Implementation Plan: llms.txt + Agent Entry Points

**Branch**: `043-llms-txt-and-agent-entry`

**Spec**: [spec.md](./spec.md)

## Touchpoints

- New: `apps/web/src/app/llms.txt/route.ts` — динамически генерится из `seoRoutes` + `getProducts()`
- New: `apps/web/src/app/llms-full.txt/route.ts` — расширенная версия с описаниями
- `apps/web/src/lib/seo/structured-data.ts` `createOrganizationJsonLd()` — добавить `potentialAction`

## llms.txt structure

```markdown
# Солитон

> Российский производитель модульных PDU и блоков розеток 19″ для серверных шкафов, ЦОД, телеком-инфраструктуры. 19 лет на рынке.

## Каталог

- [Все PDU и блоки розеток](https://soliton.ru/catalog/pdu/): полная номенклатура
- [Блоки розеток 19″ 1U](https://soliton.ru/catalog/bloki-rozetok-19-1u/): горизонтальные
- ...

## Под заказ

- [Модульная сборка под задачу](https://soliton.ru/b2b/custom-pdu/)
- [Запрос КП](https://soliton.ru/b2b/request-quote/)

## База знаний

- [Как выбрать PDU](https://soliton.ru/knowledge/kak-vybrat-pdu/)
- [Замена импортных PDU](https://soliton.ru/knowledge/zamena-importnyh-pdu/)
- ...

## Документы

- [Сертификаты](https://soliton.ru/documents/certificates/)
- [Каталог PDF](https://soliton.ru/documents/catalog/)

## Машиночитаемые ресурсы

- [Yandex Market XML feed](https://soliton.ru/feed/yandex-market.xml)
- [Все товары JSON](https://soliton.ru/api/products.json)
- [Sitemap](https://soliton.ru/sitemap.xml)

## Компания

- [О компании](https://soliton.ru/company/about/)
- [Контакты](https://soliton.ru/company/contacts/)
```

## PotentialAction в Organization

```json
"potentialAction": [
  {
    "@type": "SearchAction",
    "target": "https://soliton.ru/catalog/pdu/?q={search_term_string}",
    "query-input": "required name=search_term_string"
  },
  {
    "@type": "ContactAction",
    "target": "https://soliton.ru/b2b/request-quote/"
  }
]
```

## Validation

- `curl /llms.txt` отдаёт markdown
- Manual review структуры по llmstxt.org
- `pnpm validate:schema` — Organization с potentialAction
