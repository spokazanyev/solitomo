# Feature Specification: llms.txt + Agent Entry Points

**Feature Branch**: `043-llms-txt-and-agent-entry`

**Created**: 2026-05-17

**Status**: Deferred (отложено до приоритизации — см. `07-build-specifications/deferred-content-track.md`)

**Input**: [llms.txt](https://llmstxt.org) — предложение Jeremy Howard от сент-2024 для упрощения парсинга сайта LLM-агентами. На май 2026 не индустриальный консенсус, но **нишевая аудитория** (Mintlify, FastHTML, Claude Code, некоторые dev-tools) ожидает его наличия. Затраты — минимальны, выигрыш — небольшой PR-эффект и удобство для агентов, поддерживающих этот стандарт.

Параллельно: `PotentialAction` на Organization JSON-LD говорит агентам, **что можно сделать** на сайте (search, contact, RFQ). Это превращает их из читателей в исполнителей.

## User Scenarios & Testing

### User Story 1 — LLM-агент находит структуру сайта в одном файле (Priority: P2)

Агент с поддержкой llms.txt парсит `/llms.txt`, видит секции «Каталог», «Документы», «Компания», «Машиночитаемые ресурсы» — мгновенно понимает топологию без crawl'а sitemap.

**Independent Test**: `curl /llms.txt` отдаёт markdown с структурой.

### User Story 2 — Organization PotentialAction говорит агенту как искать (Priority: P2)

В Organization JSON-LD есть `potentialAction: [SearchAction, OrderAction, ContactAction]` с URL-шаблонами. Агент знает: «чтобы найти товар на сайте Солитон, шаблон поиска — `?q={query}`».

**Acceptance**:
1. `curl /` → Organization JSON-LD содержит `potentialAction` массив.
2. Шаблон SearchAction правильный (для будущей поисковой страницы).

### User Story 3 — Расширенный llms-full.txt с ключевым контентом (Priority: P3)

Опциональный файл `/llms-full.txt` содержит ключевые секции (описание компании, главные категории с краткими описаниями, FAQ снапшот) в плоском Markdown. Полезно для агентов с маленьким context window.

### Edge Cases

- **Изменение каталога**: llms.txt обновляется при добавлении новых routes. Решение — генерить его статически в build-time из `seoRoutes`.
- **Размер**: llms-full.txt может разрастись — лимит 20–30 KB.

## Requirements

### Functional Requirements

- **FR-001**: `/llms.txt` MUST быть доступен на корне с MIME `text/markdown`.
- **FR-002**: Структура `/llms.txt` MUST соответствовать llmstxt.org спецификации: H1 с названием, blockquote с описанием, H2-секции с bullet-списками ссылок.
- **FR-003**: `/llms.txt` MUST генериться из текущего `seoRoutes` (один источник истины).
- **FR-004**: Organization JSON-LD MUST содержать `potentialAction` с минимум `SearchAction` (URL-шаблон поиска) и `ContactAction`.
- **FR-005**: `/llms-full.txt` (опционально) MUST содержать развёрнутое описание компании, ключевых категорий, основных FAQ.

### Quality Requirements

- **QR-001**: Файлы должны быть валидным Markdown.
- **QR-002**: Размер `/llms.txt` < 5 KB.
- **QR-003**: Размер `/llms-full.txt` < 30 KB.

## Success Criteria

- **SC-001**: `/llms.txt` валиден по llmstxt.org schema (manual review).
- **SC-002**: Organization JSON-LD проходит Google Rich Results Test с `potentialAction`.
- **SC-003**: При смене / добавлении категории файл автоматически обновляется (no manual edit needed).

## Assumptions

- `/search` route не существует — `SearchAction` шаблон указывает на `?search={query}` от каталога (даже если фронт не имплементирован). Это даёт агентам ожидание интерфейса.
- llms.txt — necessary-but-not-sufficient. Не заменяет sitemap.xml.
