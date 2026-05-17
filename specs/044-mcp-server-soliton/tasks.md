# Tasks: MCP Server for Soliton Catalog

## Phase 1 — Scaffolding

- [ ] T001 Создать новый pnpm-workspace пакет `packages/mcp-server-soliton-catalog`.
- [ ] T002 Установить `@modelcontextprotocol/sdk`, `zod`, dev: `typescript`, `@types/node`.
- [ ] T003 Конфиг tsconfig.json, package.json с bin `soliton-mcp-server`.

## Phase 2 — Catalog source

- [ ] T004 `src/catalog-source.ts`: fetch с `SOLITON_API_BASE/api/products.json` (env), кеш на 15 мин в-памяти.
- [ ] T005 `src/catalog-source.ts`: fetch `/feed/yandex-market.xml` НЕ нужен — JSON достаточно.

## Phase 3 — Tools

- [ ] T006 `tools/search-products.ts` — params validated по zod schema, фильтрация in-memory.
- [ ] T007 `tools/get-product.ts` — простой lookup по sku.
- [ ] T008 `tools/list-categories.ts` — distinct categories.
- [ ] T009 `tools/get-quote-estimate.ts` — расчёт суммы + рекомендация перейти на запрос КП.

## Phase 4 — Resources

- [ ] T010 `resources/catalog.ts` — `catalog://products` отдаёт полный каталог.
- [ ] T011 `resources/categories.ts` — `catalog://categories` отдаёт категории.

## Phase 5 — Entry point

- [ ] T012 `src/index.ts` — создание MCP server, регистрация tools и resources, listen на stdio.
- [ ] T013 Логирование (через MCP SDK logger).

## Phase 6 — Docs

- [ ] T014 `README.md` (русский): описание, установка через npx, пример конфига Claude Desktop.
- [ ] T015 `README.en.md` (английский).
- [ ] T016 Пример `claude_desktop_config.json` snippet в `examples/`.

## Phase 7 — Publish (опционально)

- [ ] T017 Опубликовать на npm (после решения с namespace владельцем).
- [ ] T018 Анонс на Habr / Soliton blog.
