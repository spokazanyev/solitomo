# Tasks: Machine-Readable Product Feeds

- [ ] T001 Создать `apps/web/src/lib/feeds/serialize.ts` с функциями `serializeYml(products, shopMeta)`, `serializeGoogleMerchant(products, shopMeta)`, `serializeJson(products)`.
- [ ] T002 Создать route handler `apps/web/src/app/feed/yandex-market.xml/route.ts` (export GET, Content-Type: application/xml).
- [ ] T003 Создать route handler `apps/web/src/app/feed/google-merchant.xml/route.ts`.
- [ ] T004 Создать route handler `apps/web/src/app/api/products.json/route.ts`.
- [ ] T005 Создать route handler `apps/web/src/app/api/products/[sku].json/route.ts`. 404 если sku не найден.
- [ ] T006 Обновить `apps/web/src/app/sitemap.ts`: добавить ссылки на feeds (с приоритетом 0.5).
- [ ] T007 Обновить `apps/web/src/app/robots.ts`: добавить `Sitemap: /feed/yandex-market.xml` (можно несколько Sitemap-директив).
- [ ] T008 Cache headers через response init.
- [ ] T009 `curl /feed/yandex-market.xml` — XML валиден.
- [ ] T010 `curl /api/products.json | jq '.products | length'` — 66+.
- [ ] T011 `pnpm typecheck`, `pnpm lint`, `pnpm validate:seo` — зелёные.
