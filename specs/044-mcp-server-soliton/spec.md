# Feature Specification: MCP Server for Soliton Catalog

**Feature Branch**: `044-mcp-server-soliton`

**Created**: 2026-05-17

**Status**: Deferred (отложено до приоритизации — см. `07-build-specifications/deferred-content-track.md`)

**Input**: [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — стандарт Anthropic (ноябрь 2024), через который AI-клиенты (Claude Desktop, Cursor, некоторые IDE) могут подключаться к серверам и вызывать tools/resources напрямую. На май 2026 MCP — **нишевой канал**, в основном для IT/dev-аудитории, но это **наша целевая аудитория** (инженеры серверной, IT-закупки). Создание `mcp-server-soliton` даёт:

- Прямой канал для IT-пользователей Claude Desktop / Cursor / etc.
- PR-эффект «первый российский производитель PDU с MCP».
- Технологическую готовность к расширению (когда MCP станет mainstream).

## User Scenarios & Testing

### User Story 1 — IT-инженер подбирает PDU через Claude Desktop (Priority: P2)

ИТ-инженер серверной добавил MCP-сервер Солитон в `claude_desktop_config.json`. Спрашивает Claude: «Подбери PDU для стойки 42U с 16 серверами на C13». Claude вызывает `search_products(filters: {outletType: "C13", count: ">=16"})` → получает массив подходящих SKU → даёт рекомендацию с URL.

**Independent Test (organisational)**: `npm install -g @soliton/mcp-server-catalog && soliton-mcp-server` запускается, в Claude Desktop виден как connected MCP. Запрос «search products schuko 16a» возвращает результат.

**Acceptance**:
1. Сервер регистрирует tools: `search_products`, `get_product`, `get_quote_estimate`, `list_categories`.
2. Сервер регистрирует resources: `catalog`, `documents`.
3. Все tools возвращают valid JSON-RPC ответы по MCP spec.

### User Story 2 — Тендерный отдел получает быструю оценку (Priority: P3)

Закупщик в чате с Claude (с подключённым MCP): «Сколько будет стоить 20 PDU SP-8 + 5 S-12AB с доставкой в Новосибирск?». Claude → `get_quote_estimate(items, deliveryCity)` → возвращает приблизительный итог + рекомендация запросить КП.

### Edge Cases

- **MCP-сервер должен быть development-friendly**: запускается локально через `npx`. Production-deployment (через web URL) пока не предусмотрен — MCP-over-HTTP в активной разработке.
- **Версионирование**: MCP spec эволюционирует. Использовать SDK Anthropic (`@modelcontextprotocol/sdk-typescript`), которое инкапсулирует версии.
- **Аутентификация**: для public-каталога не нужна. Для quote-estimate можно добавить `MCP_API_KEY` env.

## Requirements

### Functional Requirements

- **FR-001**: Создать отдельный пакет `packages/mcp-server-soliton-catalog` (Node.js, TypeScript, использует MCP SDK).
- **FR-002**: Сервер запускается через `npx @soliton/mcp-server-catalog` или установленный CLI.
- **FR-003**: Сервер использует данные из `/api/products.json` (spec 040) — не дублирует state.
- **FR-004**: Поддерживаемые tools:
  - `search_products({ query?, outletType?, current?, mounting?, monitoring?, surge?, minOutlets?, maxOutlets? })` — возвращает массив товаров.
  - `get_product({ sku })` — возвращает один товар со всеми полями.
  - `get_quote_estimate({ items: [{sku, quantity}], deliveryCity?, customerType? })` — приблизительная стоимость.
  - `list_categories()` — список категорий каталога.
- **FR-005**: Поддерживаемые resources:
  - `catalog://products` — полный каталог.
  - `catalog://categories` — категории.
- **FR-006**: Все ответы — структурированный JSON. Текстовые описания — на русском.
- **FR-007**: README с инструкцией для пользователя Claude Desktop по подключению.

### Quality Requirements

- **QR-001**: Сервер запускается за <2 сек.
- **QR-002**: Каждый tool-call отвечает за <500 мс при кешированном catalog.
- **QR-003**: README на русском + английском.

## Success Criteria

- **SC-001**: Pakcage опубликован на npm как `@soliton/mcp-server-catalog`.
- **SC-002**: В Claude Desktop тестово подключается за <5 минут.
- **SC-003**: PR-релиз на dev-форумах / Habr.

## Assumptions

- Доступен публичный `/api/products.json` (spec 040).
- npm-аккаунт `@soliton` либо публикация под личным namespace владельца.
- MCP SDK достаточно зрелый для использования.
- В v1 поддерживаются только stdio-transport (не HTTP) — это стандартный режим Claude Desktop.

## Non-Goals

- Real-time price updates через WebSocket.
- Authentication для public tools.
- HTTP-transport (MCP-over-HTTP всё ещё стабилизируется).
- Прямой order placement через MCP (создание заказов идёт через web UI).
