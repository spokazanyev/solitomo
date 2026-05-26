---
description: "Task list for 057-yookassa-buyer-info-compliance"
---

# Tasks: ЮKassa Buyer-Info Compliance

**Input**: Design documents from `/specs/057-yookassa-buyer-info-compliance/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓ (consent-shape.md, static-pages-api.md, 9× content-templates)

**Tests**: Spec включает явные acceptance criteria и quickstart.md; unit-тесты для consent-helpers и cookie-utils ОБЯЗАТЕЛЬНЫ (SC-008, SC-012). E2E через Playwright опционально, оставлено в Phase Polish

**Organization**: задачи сгруппированы по user stories spec.md (US1-US6) с приоритетами P1 (US1, US4), P2 (US2, US3), P3 (US5, US6). Каждая фаза delivers независимый increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Можно запускать параллельно (разные файлы, без зависимостей от незавершённых)
- **[Story]**: к какой user story задача относится (US1, US2, ...)

## Path Conventions

- Web app monorepo: `apps/web/src/` (Next.js + Payload v3 в одном пакете)
- Тесты: `apps/web/src/lib/**/__tests__/` или рядом с модулем как `*.test.ts`
- Спека: `specs/057-yookassa-buyer-info-compliance/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ветка, ignore-файлы, проверки готовности окружения. Не блокирует следующие фазы дольше, чем нужно.

- [X] T001 Подтвердить, что текущая ветка `057-yookassa-buyer-info-compliance` (уже создана на этапе /specify). Если нет — `git checkout -b 057-yookassa-buyer-info-compliance main`
- [X] T002 Проверить чистоту рабочего дерева (`git status`); зафиксировать не относящиеся к 057 изменения отдельным коммитом перед началом
- [X] T003 [P] Убедиться что `.gitignore` уже покрывает `node_modules/`, `dist/`, `*.log`, `.env*` (паттерн 047-056) — изменений не требуется, проверка
- [X] T004 [P] Убедиться что dev-сервер всё ещё запускается через `pnpm --filter @soliton/web dev` (или `expect`-обёртка `/tmp/run-dev.exp`) — baseline для последующих тестов

**Checkpoint**: дерево чистое, ветка правильная, dev запускается → можно переходить к Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: типы, helpers, коллекция Payload и регистрация — без этого ни одна US не стартует.

**⚠️ CRITICAL**: эти задачи MUST быть закрыты до начала US1-US6.

- [X] T010 Создать `apps/web/src/lib/consent/consent-types.ts` с экспортом интерфейса `ConsentRecord` + type guard `hasValidConsent` (по контракту `contracts/consent-shape.md` §TypeScript-тип)
- [X] T011 [P] Создать `apps/web/src/lib/consent/consent-field.ts` с функцией `consentField()` возвращающей Payload `Field` definition (по контракту §Payload field definition)
- [X] T012 [P] Создать `apps/web/src/lib/consent/make-consent-record.ts` с экспортом `makeConsentRecord(req)` + `invalidatePolicyVersionCache()` (по контракту §API: makeConsentRecord)
- [X] T013 [P] Создать unit-тест `apps/web/src/lib/consent/make-consent-record.test.ts` с проверками: ISO timestamp, sha256 IP-hash (32 hex), userAgent truncation, unknown-IP fallback (по контракту §Тесты unit)
- [X] T014 Создать `apps/web/src/collections/StaticPages.ts` с Payload `CollectionConfig`: поля slug/section/title/body/category/version/effectiveFrom/seoTitle/seoDescription/indexingPolicy/status, versions={drafts:true, maxPerDoc:50}, hooks beforeChange (валидация version+effectiveFrom для category=policy) + afterChange (cache invalidation) (по data-model.md §1)
- [X] T015 Создать `apps/web/src/lib/static-pages/get-static-page.ts` с экспортом `getStaticPage(slug)` + `invalidateStaticPageCache(slug?)` (по контракту `contracts/static-pages-api.md`)
- [X] T016 [P] Создать unit-тест `apps/web/src/lib/static-pages/get-static-page.test.ts` с проверками: возврат null для draft при отсутствии user-сессии, кэш TTL 60s, invalidate работает
- [X] T017 Зарегистрировать `StaticPages` в `apps/web/src/payload.config.ts`: импорт + добавление в массив `collections` (рядом с `Documents`)
- [X] T018 Сгенерировать типы Payload: `pnpm --filter @soliton/web generate:types`. Проверить что `payload-types.ts` содержит `StaticPage` интерфейс
- [X] T019 Расширить `apps/web/src/lib/seo/seo-registry.ts`: добавить `"info"` в union `Section`, добавить 9 routes под `/info/{payload,delivery,return,warranty,offer,privacy,pd-policy,terms,faq}/` с title/description/keywords/indexingPolicy=index (по data-model.md §5)
- [X] T020 Расширить `apps/web/src/lib/seo/seo-registry.ts`: добавить export `getSingleSlugParamsForSection("info")` если ещё нет (паттерн company)
- [X] T021 Запустить dev-сервер: убедиться что Drizzle push создаёт таблицу `static_pages` и embedded columns ещё нет (они добавятся в US4 после расширения коллекций) — лог должен показать `CREATE TABLE static_pages ...`

**Checkpoint**: Payload содержит коллекцию `static-pages`, helpers готовы, типы сгенерированы → можно стартовать US1.

---

## Phase 3: User Story 1 — Модератор ЮKassa проверяет соответствие требованиям (Priority: P1) 🎯 MVP

**Goal**: На сайте появляются 9 buyer-info страниц `/info/*`, footer содержит реквизиты + ссылки на политики + логотипы платёжных систем, все юр-документы имеют версию и дату.

**Independent Test**: Зайти на homepage, прокрутить до footer — увидеть ИНН/ОГРН/4 ссылки на политики/4 логотипа платёжных систем. Открыть все 9 URL `/info/*` — каждый 200. Открыть `/info/offer/` — увидеть «Версия 2026-05-25-v1, действует с 25 мая 2026 года».

### Implementation for User Story 1

- [X] T030 [US1] Создать `apps/web/src/app/(site)/info/layout.tsx` с breadcrumbs «Главная / Покупателям / …» и sidebar-навигацией (импорт BuyerInfoNav из T032)
- [X] T031 [US1] Создать `apps/web/src/app/(site)/info/[slug]/page.tsx` с `generateStaticParams`, `generateMetadata` (через SEO-registry), `dynamic="force-static"`, `revalidate=300`, render `<StaticPageRenderer>` (по контракту `static-pages-api.md` §Page contract)
- [X] T032 [US1] [P] Создать `apps/web/src/components/layout/BuyerInfoNav.tsx` — sidebar-навигация для `/info/*` с активным состоянием по `currentSlug`
- [X] T033 [US1] [P] Создать `apps/web/src/components/static-pages/StaticPageRenderer.tsx` — обёртка <article> с breadcrumb + title + subtitle + version-disclaimer + LexicalRenderer
- [X] T034 [US1] [P] Создать `apps/web/src/components/static-pages/LexicalRenderer.tsx` — обёртка над `@payloadcms/richtext-lexical` рендерером (паттерн product-description если уже есть)
- [X] T035 [US1] Создать `apps/web/scripts/seed-static-pages.mjs` — idempotent seed-скрипт с 9 страницами из `contracts/content-templates/*.md`, конверсия markdown→Lexical через простой paragraph-splitter (по контракту §Seed-скрипт)
- [X] T036 [US1] Добавить npm-скрипт в `apps/web/package.json`: `"seed:static-pages": "node scripts/seed-static-pages.mjs"`
- [X] T037 [US1] Запустить seed: `pnpm --filter @soliton/web seed:static-pages` — проверить, что в БД появилось 9 строк `static_pages` (с `status=published`)
- [X] T038 [US1] Расширить `apps/web/src/lib/seo/structured-data.ts`: добавить `getFAQPageJsonLd(items)` и `getArticleJsonLd(page)` (по research.md R12)
- [X] T039 [US1] Wire JSON-LD в `StaticPageRenderer`: для `category=faq` → FAQPage, для `category=policy` → Article с `dateModified=updatedAt`, для остальных → WebPage
- [X] T040 [US1] Расширить `apps/web/src/components/layout/SiteFooter.tsx`: добавить блок реквизитов (ИНН + ОГРН + юр.наименование из `getCompanyContacts()`) + 4 ссылки на политики + блок логотипов платёжных систем
- [X] T041 [US1] [P] Создать SVG-логотипы платёжных систем в `apps/web/public/payment-logos/`: `mir.svg`, `visa.svg`, `mastercard.svg`, `sbp.svg` (из официальных брендбуков, alt-text по research.md R7)
- [X] T042 [US1] Smoke-test: для каждого slug из (payment, delivery, return, warranty, offer, privacy, pd-policy, terms, faq) выполнить `curl -fsSL http://localhost:3000/info/$slug/` — все 200 (по quickstart.md Step 3)
- [X] T043 [US1] Smoke-test footer: открыть `/`, `/catalog/pdu/`, `/product/<slug>/`, `/info/payment/` — на каждой странице видны ИНН 6659009140 + ОГРН 1026602965850 + 4 policy-ссылки (по quickstart.md Step 4)
- [X] T044 [US1] Smoke-test версионирование: открыть `/info/offer/`, `/info/privacy/`, `/info/pd-policy/`, `/info/terms/` — каждая страница показывает «Версия 2026-05-25-v1 · Действует с 25 мая 2026 года»

**Checkpoint**: 9 страниц работают, footer на каждой странице, логотипы видны, версии политик отображены. **US1 готов к demo.**

---

## Phase 4: User Story 4 — 152-ФЗ checkbox-согласия во всех формах (Priority: P1)

**Goal**: Все 5 форм собирают явное согласие через ConsentCheckbox (не pre-checked). Submit заблокирован без галки. При создании сущности в БД записывается group `consent` с timestamp/policyVersion/ipHash/userAgent.

**Independent Test**: Открыть `/cart/checkout/physical/review/` → видна галка «Согласен с офертой и политикой ПДн» (не pre-checked) → кнопка submit `disabled` → поставить галку → submit → в `orders` строке `consent.consentedAt` непуст.

### Implementation for User Story 4

- [X] T050 [US4] Расширить `apps/web/src/collections/Orders.js`: импортировать `consentField` из `lib/consent/consent-field.ts`, добавить в массив `fields` после `customerId/companyId` (data-model.md §6)
- [X] T051 [US4] [P] Расширить `apps/web/src/collections/Carts.ts`: то же
- [X] T052 [US4] [P] Расширить `apps/web/src/collections/Customers.ts`: то же
- [X] T053 [US4] [P] Расширить `apps/web/src/collections/RfqRequests.ts`: то же
- [X] T054 [US4] Перегенерировать Payload types: `pnpm --filter @soliton/web generate:types` — проверить что `OrderResponse.consent` появилась
- [X] T055 [US4] Запустить dev-сервер чтобы Drizzle push добавил колонки `*_consent_consented_at` / `*_consent_policy_version_*` / `*_consent_ip_hash` / `*_consent_user_agent` в 4 таблицах. Если возникнет prompt — баги ambiguity не должно быть (новые колонки)
- [X] T056 [US4] Проверить через psql, что колонки создались: `\d orders` / `\d carts` / `\d customers` / `\d rfq_requests` показывают 5 новых полей в каждой
- [X] T057 [US4] Создать `apps/web/src/components/consent/ConsentCheckbox.tsx` — client component с props (value/onChange/required/className/label), дефолтный label из research.md R10, link target=_blank на /info/offer/ и /info/pd-policy/
- [X] T058 [US4] [P] Создать unit-тест `ConsentCheckbox.test.tsx`: рендер, дефолтный label содержит ссылки, onChange срабатывает на toggle, accessibility (label привязан к input)
- [X] T059 [US4] Wire ConsentCheckbox в форму checkout physical: найти текущий form-компонент `apps/web/src/app/(site)/cart/checkout/physical/review/*` — добавить state `consent: boolean`, передать в ConsentCheckbox, заблокировать submit при `!consent`
- [X] T060 [US4] [P] Wire ConsentCheckbox в форму checkout invoice: найти `apps/web/src/app/(site)/cart/checkout/invoice/*` — то же
- [X] T061 [US4] [P] Wire ConsentCheckbox в форму checkout quote: `apps/web/src/app/(site)/cart/checkout/quote/*` — то же
- [X] T062 [US4] [P] Wire ConsentCheckbox в RFQ-форму: найти текущую форму в `apps/web/src/app/(site)/b2b/request-quote/` или в каталоге компонентов — то же
- [ ] T063 [US4] [P] Wire ConsentCheckbox в форму регистрации клиента и magic-link форму: `apps/web/src/app/(site)/me/register/*` (если есть в 054) и/или magic-request-форма — то же
- [X] T064 [US4] Расширить `apps/web/src/app/api/orders/route.ts`: если `body.consent !== true` → 400 `{error:"CONSENT_REQUIRED"}`; иначе вызвать `makeConsentRecord(request)` и передать в `payload.create({data:{..., consent}})`
- [X] T065 [US4] [P] Расширить `apps/web/src/app/api/cart/route.ts` (или соответствующий POST) — аналогично
- [X] T066 [US4] [P] Расширить RFQ-endpoint (если есть отдельный, обычно `/api/rfq` или интеграция через 048) — аналогично. Для RFQ из 047/048 — проверить существующий путь и расширить
- [X] T067 [US4] [P] Расширить `apps/web/src/app/api/customers/register/route.ts` и `apps/web/src/app/api/customers/magic-request/route.ts` — аналогично
- [X] T068 [US4] Smoke-test форм: для каждой формы (5 шт) проверить вручную — submit disabled без галки, после галки submit работает, в БД появилась запись с непустым `consent.consented_at`
- [X] T069 [US4] Smoke-test API: `curl -sS POST /api/orders` без `consent:true` → 400; с `consent:true` → 201 (по quickstart.md Step 7)

**Checkpoint**: все 5 форм собирают согласие, БД фиксирует факт. **152-ФЗ compliance закрыт.**

---

## Phase 5: User Story 2 — Покупатель находит ответы перед оплатой (Priority: P2)

**Goal**: Меню «Покупателям» в шапке (desktop + mobile) с 6 ссылками на info-страницы; за ≤2 клика доступны Оплата/Доставка/Возврат/Гарантия/Оферта/FAQ.

**Independent Test**: На homepage навести на «Покупателям» → dropdown с 6 пунктами → кликнуть «Оплата» → открывается `/info/payment/`. На mobile открыть menu → раздел раскрывается аккордеоном.

### Implementation for User Story 2

- [X] T080 [US2] Расширить `apps/web/src/components/layout/SiteHeader.tsx`: добавить пункт «Покупателям» с desktop-dropdown между «Документы» и «Компания», 6 ссылок из research.md R9, semantic `<nav aria-label="Покупателям">`
- [X] T081 [US2] Расширить mobile-меню в том же `SiteHeader.tsx` (или вынесенном `MobileMenu.tsx`): «Покупателям» как collapsible-блок с теми же 6 ссылками
- [X] T082 [US2] Smoke-test desktop: открыть `/` в браузере ширины >768px, навести на «Покупателям» → выпадает dropdown → каждая ссылка ведёт на соответствующий /info/* (US2.1)
- [X] T083 [US2] Smoke-test mobile: emulate ширину 375px в DevTools, открыть burger-menu → «Покупателям» раскрывается → все 6 ссылок видны и кликабельны

**Checkpoint**: меню «Покупателям» доступно на всех устройствах. Конверсия checkout-флоу не должна упасть.

---

## Phase 6: User Story 3 — Юрлицо проверяет банковские реквизиты (Priority: P2)

**Goal**: `/company/contacts/` показывает блок «Банковские реквизиты» (банк/БИК/р-счёт/к-счёт) и «Руководитель» (директор + дата назначения) — из `contacts.json`.

**Independent Test**: Открыть `/company/contacts/`, прокрутить вниз → видны оба блока с актуальными данными (БИК 046577964, директор Показаньев В.Г., с 29.11.2002).

### Implementation for User Story 3

- [X] T090 [US3] [P] Создать `apps/web/src/components/company/BankingDetails.tsx` — RSC, читает `getCompanyContacts()` и рендерит 2 блока (banking + director) + 1 опциональный блок (ОКПО/ОКОНХ/ОКВЭД)
- [X] T091 [US3] [P] (опционально) Расширить `apps/web/src/lib/company/get-company-contacts.ts`: добавить `getBankingDetails()` и `getDirector()` helpers (исключительно для удобства, можно обойтись текущей структурой `contacts.banking`/`contacts.director`)
- [X] T092 [US3] Wire `<BankingDetails />` в `apps/web/src/components/SeoLandingPage.tsx`: условный rendering при `route.path === "/company/contacts/"` — рендерим в конце страницы перед footer-блоком CTA
- [X] T093 [US3] Smoke-test: открыть `/company/contacts/` — проверить вручную видимость обоих блоков с корректными значениями (по quickstart.md Step 5)

**Checkpoint**: B2B-бухгалтеры могут сверить реквизиты на сайте перед оплатой счёта.

---

## Phase 7: User Story 5 — Полная веб-оферта (Priority: P3)

**Goal**: `/info/offer/` рендерит публичную оферту как HTML (не PDF), с разделами по ГК ст. 432-435: предмет, акцепт, цена/оплата, доставка, гарантия и возврат, ответственность, форс-мажор, разрешение споров, реквизиты Поставщика.

**Independent Test**: Открыть `/info/offer/` — содержимое ≥ 8000 символов, все 9 разделов присутствуют, версия и дата видны вверху, ссылки на /info/warranty/ и /info/return/ работают.

### Implementation for User Story 5

> US5 практически полностью покрыт реализацией US1 (seed-скрипт уже создаёт страницу с offer.md). Здесь — финальная проверка и расширенный schema.org.

- [X] T100 [US5] Smoke-test содержания: открыть `/info/offer/` — убедиться, что все 9 разделов присутствуют (предмет, акцепт, цена и порядок оплаты, доставка, гарантия и возврат, ответственность, форс-мажор, разрешение споров, реквизиты)
- [X] T101 [US5] Проверить ссылки внутри оферты: `/info/warranty/`, `/info/return/`, `/company/contacts/` — все возвращают 200
- [X] T102 [US5] Проверить JSON-LD: открыть DevTools → Elements → найти `<script type="application/ld+json">` → должна быть структура `{"@type":"Article", "headline":"Публичная оферта", "datePublished":"2026-05-25", "publisher":{...}}`
- [X] T103 [US5] Проверить footer-link: на любой странице кликнуть «Публичная оферта» в footer → должна открыться `/info/offer/` (US5.3)

**Checkpoint**: оферта валидна юридически (по структуре) и technically (HTML + JSON-LD).

---

## Phase 8: User Story 6 — Cookies-consent banner (Priority: P3)

**Goal**: При первом визите показывается баннер согласия на cookies аналитики. До opt-in `gtag.js` и `ym.js` не загружены. После accept — аналитика инициализируется. На mobile — нижняя плашка вместо модалки.

**Independent Test**: Incognito-сессия → открыть `/` → DevTools Network → нет запросов к `google-analytics.com`/`googletagmanager.com`/`mc.yandex.ru`. Виден баннер. Accept → перезагрузить → запросы появляются. Decline в новой incognito-сессии → запросы по-прежнему отсутствуют.

### Implementation for User Story 6

- [X] T110 [US6] Создать `apps/web/src/lib/analytics/cookie-consent.ts` — utils: `readCookieConsent()`, `setCookieConsent(value, days)`, типы `"accepted"|"declined"|null`
- [X] T111 [US6] [P] Создать unit-тест `apps/web/src/lib/analytics/cookie-consent.test.ts`: parse cookie из document.cookie, write c правильными атрибутами (Max-Age, Path, SameSite, Secure), null при отсутствии
- [X] T112 [US6] [P] Создать `apps/web/src/lib/analytics/analytics-loader.ts` — функции `loadGoogleAnalytics(measurementId)`, `loadYandexMetrika(counterId)` — программно добавляют `<script>` в `document.head`. Идемпотентны (повторный вызов — no-op)
- [X] T113 [US6] [P] Создать unit-тест `apps/web/src/lib/analytics/analytics-loader.test.ts`: mock `document.head.appendChild`, проверка корректного src и идемпотентности
- [X] T114 [US6] Создать `apps/web/src/components/consent/CookieConsentBanner.tsx` — client component (`"use client"`), на mount читает cookie_consent, если null показывает banner с 2 кнопками + ссылкой на /info/pd-policy/. На mobile (≤768px) — нижняя плашка
- [X] T115 [US6] Wire `<CookieConsentBanner />` в `apps/web/src/app/layout.tsx` (или `apps/web/src/app/(site)/layout.tsx`): после `<body>` основной content, до `<SiteFooter>`
- [X] T116 [US6] Найти текущие `<Script src="https://www.googletagmanager.com/...">` и `<Script src="https://mc.yandex.ru/...">` в layout (если есть) — заменить на программную загрузку через `loadGoogleAnalytics()` + `loadYandexMetrika()` в `CookieConsentBanner` на mount при `consent === "accepted"`
- [X] T117 [US6] Добавить ссылку «Управление cookies» в SiteFooter (требует client-side re-prompt) — простой `<button onClick={openBanner}>` или global event-emitter
- [ ] T118 [US6] [P] Создать unit-тест для CookieConsentBanner: рендер при отсутствии cookie, скрытие после accept, скрытие после decline, mobile-классы при window.innerWidth ≤ 768
- [X] T119 [US6] Smoke-test: incognito → `/` → DevTools Network filter `analytics|gtag|metrika` → перезагрузить → 0 запросов. Виден баннер. Accept → перезагрузить → запросы появляются (по quickstart.md Step 6)
- [X] T120 [US6] Smoke-test decline: новая incognito → decline → перезагрузить → 0 запросов, баннер не показывается, cookie_consent=declined

**Checkpoint**: cookies-compliance закрыт. Полный 152-ФЗ-compliance достигнут.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: финальные tests, докуменация, smoke-checks из quickstart.md, обновление контекста.

- [X] T130 [P] Запустить полный typecheck: `pnpm typecheck` (или `pnpm --filter @soliton/web typecheck`) — 0 ошибок
- [X] T131 [P] Запустить ESLint: `pnpm lint` — 0 ошибок
- [X] T132 [P] Запустить Vitest: `pnpm --filter @soliton/web test` — все тесты зелёные, включая новые (`make-consent-record`, `get-static-page`, `cookie-consent`, `analytics-loader`, `ConsentCheckbox`, `CookieConsentBanner`)
- [X] T133 Прогнать smoke-test из quickstart.md Step «Smoke-test — full sequence (CI)» — bash-скрипт с 5 curl-проверками, должен напечатать 5 строк OK
- [X] T134 Обновить `apps/web/AGENTS.md`: добавить раздел про 057 в active features с кратким описанием и ссылкой на спеку
- [ ] T135 Обновить `agent-project-context.md` (root): зарегистрировать раздел `/info/*` как новый layout, упомянуть consent-флоу и cookies-banner
- [ ] T136 (Опционально) Создать Playwright e2e specs в `apps/web/e2e/`: `info-pages.spec.ts` (US1), `consent-checkbox.spec.ts` (US4), `cookie-banner.spec.ts` (US6), `footer-policies.spec.ts` (US1/US2), `company-contacts.spec.ts` (US3) — для запуска в CI/staging
- [ ] T137 Обновить `07-build-specifications/document-register.md` (если есть) — добавить ссылку на спеку 057
- [X] T138 Прокликать вручную quickstart.md шаги 1-11 (Step 12 — activation gate — выполняется после прода и не в этой спеке)
- [X] T139 Code review pass: проверить что нет хардкода реквизитов, везде используется `getCompanyContacts()`, согласие записывается через `makeConsentRecord(req)`, тексты политик не дублируются между шаблонами и кодом

**Checkpoint 057**: спека готова к merge в `main`. Staging-деплой пройдёт smoke-test. Прод-релиз ждёт прохождения модерации ЮKassa.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: без зависимостей — стартует сразу
- **Foundational (Phase 2)**: после Setup. **БЛОКИРУЕТ ВСЕ US**.
- **User Stories (Phase 3-8)**: после Foundational. Могут идти параллельно или по приоритетам P1 → P2 → P3
- **Polish (Phase 9)**: после желаемых US завершены

### User Story Dependencies

- **US1 (P1)**: после Foundational. Независим. Создаёт страницы + footer + JSON-LD
- **US4 (P1)**: после Foundational + после T038 (JSON-LD не нужно, но contracts/consent-shape ссылается на existence политик в БД, так что seed из US1.T037 желателен)
  - В практике: US1 и US4 можно делать параллельно, но T067 (API) зависит от T012 (makeConsentRecord) и от seed (политики в БД). T037 — soft dep
- **US2 (P2)**: после Foundational + после US1 (нужны рабочие URL /info/* для меню). Желательно после US1.T037 чтобы ссылки не были 404
- **US3 (P2)**: после Foundational. Независим от других US
- **US5 (P3)**: после US1 (просто финальные проверки оферты)
- **US6 (P3)**: после Foundational. Независим от US1-US5

### Within Each User Story

- Tests (если запрошены) до implementation
- Models / collections до services
- Services до endpoints/components
- Components до wiring в layout
- Wiring до smoke-tests

### Parallel Opportunities

- **Phase 2** parallel: T010, T011, T012, T013, T016 (разные файлы, нет циклических зависимостей)
- **US1** parallel: T032, T033, T034, T041 (компоненты), T038 (structured-data)
- **US4** parallel: T051, T052, T053 (4 collection patches), T058 (test), T060, T061, T062, T063 (5 форм wiring) + T065, T066, T067 (API endpoints)
- **US6** parallel: T111, T112, T113, T118 (тесты и независимые модули)
- **Phase 9** parallel: T130, T131, T132 (lint/test независимы)

---

## Parallel Example: User Story 4 (152-ФЗ согласия)

```bash
# После T050 (расширение Orders.js), параллельно можно запускать:
Task: T051 [P] Расширить Carts.ts с consentField
Task: T052 [P] Расширить Customers.ts с consentField
Task: T053 [P] Расширить RfqRequests.ts с consentField

# После T057 (ConsentCheckbox component), параллельно:
Task: T058 [P] Unit-тест ConsentCheckbox.test.tsx
Task: T060 [P] Wire в checkout/invoice
Task: T061 [P] Wire в checkout/quote
Task: T062 [P] Wire в RFQ form
Task: T063 [P] Wire в register/magic-link

# После T064 (POST /api/orders), параллельно:
Task: T065 [P] POST /api/cart
Task: T066 [P] POST /api/rfq
Task: T067 [P] POST /api/customers/*
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 4)

1. Phase 1: Setup (T001-T004)
2. Phase 2: Foundational (T010-T021) — критично, блокирует всё
3. Phase 3: US1 (T030-T044) — публичные страницы + footer → **первый видимый результат для модератора**
4. Phase 4: US4 (T050-T069) — checkbox-согласия → **152-ФЗ compliance закрыт**
5. **STOP, VALIDATE**: Quickstart Steps 1-9. Можно демонстрировать staging-версию модератору ЮKassa уже здесь
6. Merge → staging deploy → подача заявки в ЮKassa

### Incremental Delivery

После MVP merge:
1. US2 (T080-T083) — меню «Покупателям» (UX-улучшение)
2. US3 (T090-T093) — банковские реквизиты на contacts/ (B2B-доверие)
3. US5 (T100-T103) — финальные проверки оферты
4. US6 (T110-T120) — cookies-consent (полный 152-ФЗ)
5. Polish (T130-T139)

### Parallel Team Strategy

При наличии команды:
1. Все вместе: Phase 1 + Phase 2 (1-2 дня)
2. После Foundational:
   - Разработчик A: US1 (P1)
   - Разработчик B: US4 (P1)
   - Разработчик C: US6 (P3 — cookies, изолирован)
3. После US1: Разработчик A → US2, US3, US5

---

## Notes

- **[P]** = разные файлы, нет блокировок по совпадающим путям
- **[Story]** label — для traceability с spec.md user stories
- Каждая US должна быть **independently testable** — checkpoint в конце фазы
- Commit после каждой задачи или логической группы (рекомендуемая гранулярность 3-5 связанных задач = 1 коммит)
- **Source of truth для реквизитов:** `00-source-data/company/contacts.json` → `getCompanyContacts()`. Дублирование запрещено
- **Тексты юр-документов:** черновики в `specs/057-yookassa-buyer-info-compliance/contracts/content-templates/*.md` → seed в Payload `static-pages` → Owner правит через админ-панель
- **Verification ordering:** Step 1-9 quickstart.md = MVP (US1+US4) приёмка; Step 10-12 = US2-US6 приёмка
- **Activation gate:** `paymentSettings.enabled=true` НЕ переключается этой спекой. Это manual gate Owner'a после прохождения модерации ЮKassa
