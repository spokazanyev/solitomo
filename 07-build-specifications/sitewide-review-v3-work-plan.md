# Sitewide Review v3 — План Работ

Дата: 2026-05-15.

## Назначение

План закрытия дефектов, найденных в `sitewide-content-design-review-v3` (см. отчёт в чате 2026-05-15, скриншоты в `/tmp/soliton-screens/`). План разбит на 6 спринтов и 12 SDD-фич (`specs/017-028`). Каждая фича имеет собственные `spec.md`, `plan.md`, `tasks.md`.

## Базовые принципы

- Перед стартом спринта: pull → `pnpm install` → `pnpm typecheck` → `pnpm validate:catalog`.
- В конце каждого PR: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm validate:seo`, `pnpm validate:schema`, `pnpm smoke:public-pages`, `pnpm public-copy-audit`.
- Все правки контента помечаются `// TODO(payload-migration): move to {collection}` для последующего переноса в админку.
- Скриншоты до/после — в `07-build-specifications/<NNN-spec>/screenshots/`.

## Спринт 0 — Подготовка ассетов (3–4 дня)

Цель: вернуть себе все картинки и PDF, исчезновение которых из `soliton1.ru` блокирует релиз.

- `specs/017-media-and-documents-migration` — инвентаризация, скачивание, seeding в Payload, переключение компонентов на локальные URL, новый `/documents/files/[id]` route, SVG-плейсхолдер.

## Спринт 1 — Public Copy Gate, контакты, Organization JSON-LD (5–7 дней)

Цель: убрать утечку внутренних SEO-терминов в публичный UI, добавить реальные контакты, наполнить Organization schema.

- `specs/015-sitewide-public-copy-qa` (уже создан) — поднять до Implementation. `publicSummary` в `SeoRoute`, замена `routeEyebrow` fallback, переписывание главной/B2B/knowledge формулировок, `pnpm public-copy-audit`.
- `specs/018-company-contacts` — singleton-коллекция, `ContactsTemplate`, использование в шапке/футере.
- `specs/019-organization-jsonld` — расширение `Organization` schema.

## Спринт 2 — Главная и trust (5 дней)

Цель: сделать главную похожей на сайт производителя, убрать keyword-чипы из non-home heroes, добавить OG-картинки.

- `specs/020-homepage-product-first` — hero с реальным фото, proof-метрики, TrustBand с proof-ссылками, ManufacturingShowcase, удаление keyword aside, dynamic OG.

## Спринт 3 — Конверсионные шаблоны (5–7 дней)

Цель: убрать дубли на RFQ-странице, переработать PDP-hero, объединить шапки.

- `specs/021-rfq-page-focus` — `RfqPageTemplate`, success-state.
- `specs/022-product-detail-redesign` — hero с галереей и ценой, breadcrumbs, mobile sticky CTA.
- `specs/023-site-shell` — единый `SiteHeader`, mobile drawer, skip-link.

## Спринт 4 — Каталог и подбор (4–5 дней)

Цель: сделать каталог удобным на mobile, дать solution-странице интерактивный подбор.

- `specs/024-catalog-mobile-filters` — drawer, accordion, URL-state.
- `specs/025-solution-mini-finder` — `RackParametersForm`, related-solutions на PDP.

## Спринт 5 — Качество, аналитика, SEO-валидация (5–7 дней)

Цель: дозакрыть P2-дефекты, верифицировать аналитику, заменить placeholder-скрипты на реальные.

- `specs/026-data-and-content-polish` — priceUpdatedAt, dedup документов, FAQ на B2B/solutions, токены, toast.
- `specs/027-analytics-verification` — dataLayer-события, server-side hit, consent.
- `specs/028-seo-canonical-check` — trailing slash, реальные `validate:seo` и `validate:schema`.

## Линия отсечения «MVP-ready»

Спринты 0–3 закрыты + критическая часть спринта 5 (27.1 события). Это закрывает все P0/P1 и делает сайт пригодным для публичного запуска по органике.

## Сводный график

| Спринт | Фокус | Длительность | Параллельность |
|---|---|---|---|
| 0 — Ассеты | 017 | 3–4 дня | блокирует все остальное |
| 1 — Copy + Contacts + Schema | 015, 018, 019 | 5–7 дней | можно делать параллельно с 2 при ≥ 2 разработчиков |
| 2 — Главная и trust | 020 | 5 дней | параллельно с 3 после спринта 1 |
| 3 — Конверсия | 021, 022, 023 | 5–7 дней | параллельно с 2 |
| 4 — Каталог и подбор | 024, 025 | 4–5 дней | после 2 (общие шаблоны) |
| 5 — Качество, аналитика | 026, 027, 028 | 5–7 дней | параллельно с 4 |

## Риски

| Риск | Митигация |
|---|---|
| Реальные контакты Soliton не согласованы | Начать со спецификаций 015 и 019, контакты добавить отдельным PR |
| Цены устарели | 026.1 — добавить дату; до полного fix перейти на «Цена по запросу» через флаг |
| Отсутствие фото производства | Использовать вектор-плейсхолдеры до фотосессии |
| `soliton1.ru` ограничит массовое скачивание | Throttle 1–2 req/sec, retry с backoff |
| Конфликт SDD-веток между разработчиками | Закрепить владение: один dev на page-templates.tsx, другой на site/* и product/* |

## Acceptance ревью v3 → v4

Re-run методологии из `design-review-methodology.md`:

- Public Language Gate: 102/102 PASS (включая отсутствие маркеров `RFQ`, `Trust`, `Brand trust`, `Conversion`, `B2B use-case`, `органическ`, `перелинков`, `Листинг`, `B2B-процесс`).
- Внешних запросов к `soliton1.ru` в SSR HTML: 0.
- Hero главной содержит продуктовое фото; non-home heroes без keyword-чипов.
- `/b2b/request-quote/` рендерит только форму + sidebar + success state.
- PDP: галерея и цена в одном hero, breadcrumbs с категорией.
- Единый `SiteHeader` на всех страницах, mobile drawer работает.
- `/company/contacts/` содержит phone (`tel:`), email (`mailto:`), реквизиты.
- `pnpm validate:seo` и `pnpm validate:schema` — реальные скрипты, зелёные.
- В Yandex.Metrika виден funnel `view_item → add_to_rfq → quote_submitted`.

Результаты v3 → v4 фиксируются в `07-build-specifications/sitewide-content-design-review-v3.md` (после исправлений) и `sitewide-content-design-review-v4.md` (повторный аудит).
