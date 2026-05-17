# Implementation Plan: Machine-Readable Product Feeds

**Branch**: `040-machine-readable-product-feeds`

**Spec**: [spec.md](./spec.md)

## Touchpoints

- New: `apps/web/src/app/feed/yandex-market.xml/route.ts` (Next.js route handler)
- New: `apps/web/src/app/feed/google-merchant.xml/route.ts`
- New: `apps/web/src/app/api/products.json/route.ts`
- New: `apps/web/src/app/api/products/[sku].json/route.ts`
- `apps/web/src/app/sitemap.ts` — добавить ссылки на feeds
- `apps/web/src/app/robots.ts` — добавить sitemap references

## Architecture

Все 4 endpoint'а — это **single-source-of-truth** компиляция из `getProducts()` + helpers из `source-products.ts`. Один билдер `apps/web/src/lib/feeds/serialize.ts` отдаёт нужные форматы.

```
getProducts() → serializeYml() → /feed/yandex-market.xml
              → serializeGoogleMerchant() → /feed/google-merchant.xml
              → serializeJson() → /api/products.json + /api/products/[sku].json
```

## Cache strategy

- Feeds статичны (66 товаров). Делать `revalidate: 3600` (1 час) или `force-static`.
- `Cache-Control: public, max-age=3600, s-maxage=3600`.

## Validation

- YML: онлайн-валидатор Yandex или ручной XML lint.
- Google Merchant: `googleapis` schema validation.
- JSON: schema-валидация через zod.
- `curl` на все endpoint'ы.
