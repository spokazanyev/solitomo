# Feature Specification: AI-bot Policy + Analytics

**Feature Branch**: `038-ai-bot-policy-and-analytics`

**Created**: 2026-05-17

**Status**: Deferred (отложено до приоритизации — см. `07-build-specifications/deferred-content-track.md`)

**Input**: Сайт должен попадать в ответы AI-агентов (ChatGPT, Claude, Perplexity, Gemini, Алиса/Нейро, GigaChat). Для этого нужно:
1. Явно разрешить AI-bot crawler'ы в `robots.txt` (иначе CDN/proxy/security-шаблоны могут случайно блокировать).
2. Контролировать цитирование через `<meta name="robots">` directives.
3. Логировать AI-bot визиты в аналитику — иначе нельзя измерять impact.

## User Scenarios & Testing

### User Story 1 — Anthropic ClaudeBot индексирует сайт (Priority: P1)

ClaudeBot (User-Agent: `ClaudeBot/1.0; +claudebot@anthropic.com`) обращается к `/robots.txt`, видит явный `Allow`, сканирует sitemap, читает страницы. Сайт попадает в knowledge базу Claude.

**Independent Test**: `curl -A "ClaudeBot/1.0" /robots.txt` показывает `Allow: /`. В access-логах за неделю есть визиты этого UA.

**Acceptance Scenarios**:

1. **Given** `/robots.txt`, **When** запрашивается ClaudeBot, GPTBot, PerplexityBot, Google-Extended, CCBot, Yandex-AI, GigaChat-Bot, **Then** все они получают `Allow: /` (с исключениями `/admin/`, `/api/`, `/_next/`).
2. **Given** access-логи, **When** их фильтруют по UA `ClaudeBot|GPTBot|PerplexityBot|Yandex-AI|...`, **Then** видны визиты с timestamp и URL.

### User Story 2 — Маркетинг видит долю AI-bot трафика (Priority: P2)

Маркетинг открывает Yandex.Metrika или серверный лог, смотрит фильтр «AI bots» и видит:
- сколько визитов от AI-bot за период
- какие страницы они посещают
- разбивку по агенту

**Independent Test**: В Metrika есть сегмент «AI bots» с не-нулевым счётчиком; в `06-reports/` лежит еженедельный AI-bot отчёт.

### User Story 3 — Контроль цитирования через meta-tags (Priority: P2)

На каждой публичной странице установлены meta-теги, разрешающие AI-агентам цитировать содержимое:
- `<meta name="robots" content="max-snippet:-1, max-image-preview:large, max-video-preview:-1">`

Это говорит поисковикам и AI-агентам: цитировать без ограничения длины.

**Acceptance Scenarios**:

1. **Given** любая публичная страница, **When** анализируется `<head>`, **Then** содержит `max-snippet:-1`.

### Edge Cases

- **Vague User-Agents** (`Mozilla/5.0` без специфики) — попадают в общий allow, отдельно не классифицируются. Это OK.
- **Bot impersonation** (кто-то выдаёт себя за ClaudeBot) — не верифицируется по User-Agent; для строгой верификации нужен reverse-DNS, выходит за scope v1.
- **Анти-DDoS блокировка legitimate AI-bot** — Cloudflare/AntiDDoS-провайдеры иногда блокируют. Документировать в operations spec.

## Requirements

### Functional Requirements

- **FR-001**: `robots.txt` MUST содержать явные `Allow:` блоки для `ClaudeBot`, `GPTBot`, `Google-Extended`, `PerplexityBot`, `CCBot`, `YandexBot`, `Yandex-AI`, `GigaChat-Bot`, `Bytespider`, `cohere-ai`, `Meta-ExternalAgent`.
- **FR-002**: Существующие `Disallow: /admin/`, `/api/`, `/_next/` MUST применяться ко всем перечисленным ботам.
- **FR-003**: `app/(site)/layout.tsx` MUST добавить в metadata `robots: { other: { "max-snippet": "-1", "max-image-preview": "large" } }` (через Next.js Metadata API).
- **FR-004**: Логирование visits MUST позволять отделять AI-bot UA. Реализуется через middleware, пишет `X-AI-Bot: <name>` header в access logs, либо собирает счётчики в Payload через collection `ai-bot-visits` (lightweight rolling counter).
- **FR-005**: Скрипт `pnpm report:ai-bots` MUST формировать report за период с разбивкой по агенту.

### Quality Requirements

- **QR-001**: Middleware не должен добавлять >5ms latency.
- **QR-002**: Логирование не должно блокировать рендеринг страницы.

## Success Criteria

- **SC-001**: `curl -A "ClaudeBot/1.0" /robots.txt` → ответ содержит `User-Agent: ClaudeBot` + `Allow: /`.
- **SC-002**: За 2 недели после деплоя в логах присутствуют визиты как минимум 3 разных AI-bot UA.
- **SC-003**: SSR HTML главной содержит `max-snippet:-1`.

## Assumptions

- Сайт не блокируется CDN-/anti-DDoS-провайдером (Vercel/Cloudflare настроены на разрешение объявленных ботов).
- Yandex Wordstat / Yandex.Webmaster не считается «AI-bot» — это поисковый crawler, оставляем как есть.
