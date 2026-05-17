# Implementation Plan: MCP Server for Soliton Catalog

**Branch**: `044-mcp-server-soliton`

**Spec**: [spec.md](./spec.md)

## Архитектура

Отдельный пакет в pnpm workspace: `packages/mcp-server-soliton-catalog`. Использует `@modelcontextprotocol/sdk-typescript` для имплементации MCP-протокола.

```
packages/mcp-server-soliton-catalog/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # entry: создаёт server, регистрирует tools/resources
│   ├── catalog-source.ts # fetch с /api/products.json + cache
│   ├── tools/
│   │   ├── search-products.ts
│   │   ├── get-product.ts
│   │   ├── get-quote-estimate.ts
│   │   └── list-categories.ts
│   └── resources/
│       ├── catalog.ts
│       └── categories.ts
├── README.md
└── README.en.md
```

## Data flow

Сервер при запуске fetch'ит `SOLITON_API_BASE/api/products.json` и кеширует на 15 минут. По запросу tool — отдаёт из кеша. Это держит сервер lightweight и не нагружает основной сайт.

## Зависимости

- `@modelcontextprotocol/sdk` — TypeScript SDK
- `zod` — валидация tool-args
- Node 20+ (для built-in `fetch`)

## Build / publish

- `pnpm build` через tsc.
- Опубликовать на npm под `@soliton/mcp-server-catalog` или другим namespace (нужно решить с владельцем).
- npm bin: `soliton-mcp-server`.

## Validation

- Локальный запуск: `pnpm dev`, в Claude Desktop добавить через `claude_desktop_config.json`.
- Manual: задать query «show me Schuko 16A 1U» — должен вернуть SP-8 и аналоги.
- `pnpm typecheck`, `pnpm test` (минимальные unit на каждый tool).
