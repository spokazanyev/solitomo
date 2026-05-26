# Implementation Plan: ЮKassa Buyer-Info Compliance

**Branch**: `057-yookassa-buyer-info-compliance` | **Date**: 2026-05-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/057-yookassa-buyer-info-compliance/spec.md`

## Summary

Подготовка публичной части сайта pdumarket.ru к модерации ЮKassa перед запуском приёма реальных платежей: создание раздела `/info/` (9 страниц: оплата, доставка, возврат, гарантия, оферта, политика конфиденциальности, политика ПДн 152-ФЗ, пользовательское соглашение, FAQ), реквизиты компании в footer на каждой странице, чекбоксы согласия 152-ФЗ во всех формах с фиксацией факта согласия (`consent` embedded group в Order/Cart/RFQ/Customer), cookies-consent баннер с opt-in для аналитики, расширение `/company/contacts/` блоком банковских реквизитов и руководителя, логотипы платёжных систем.

Технический подход: новая Payload-коллекция `static-pages` с rich-text body + versioning (для юр-документов), статические маршруты `/info/[slug]/` через SEO-registry (паттерн 056), общий footer-компонент с реквизитами из `contacts.json`, shared client-component `ConsentCheckbox` для 5 форм, light-weight `CookieConsentBanner` с no-SSR-hydration. Тексты юр-документов генерируются Claude из shop.nag.ru-шаблонов, Owner финализирует через админ-панель. `paymentSettings.enabled=true` переключается Owner'ом вручную после прохождения модерации (паттерн 055).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Next.js 16 App Router + RSC, React 19

**Primary Dependencies**: Payload CMS v3 (admin + collections + versioning), Drizzle ORM + PostgreSQL, Tailwind CSS, @payloadcms/richtext-lexical (rich-text rendering для юр-документов), schema.org JSON-LD utilities (существующие из 047+)

**Storage**: PostgreSQL через @payloadcms/db-postgres. Новая таблица `static_pages` + расширение `consent` embedded в 4 существующих коллекциях (Orders, Carts, Returns, Customers) — последняя через extension RFQ не требуется (RFQ-flow уже хранит согласие из 047, см. research.md R5)

**Testing**: Vitest для unit (consent-helpers, cookie-utils, content-helpers); Playwright для критичных user-flows (US1 — модератор, US4 — согласие, US6 — cookies); CI smoke-tests на staging-домене

**Target Platform**: Mobile-first responsive (≤768px нижняя cookies-плашка, выше — модалка), браузеры из списка Next.js default (browserslist), screen-readers: aria-label на checkbox/banner, keyboard navigation

**Project Type**: Web application (Next.js + Payload monorepo `apps/web`, паттерн 047-056). Backend и frontend в одном проекте

**Performance Goals**: TTFB ≤ 200ms для `/info/*` (статический контент через RSC + кэш). Cookies-banner — non-blocking hydration, не задерживает LCP. Consent-checkbox — синхронная валидация. JSON-LD не добавляет > 1KB к page weight

**Constraints**: 
- Не сломать существующие 055/056 ЮKassa-флоу
- contacts.json остаётся source-of-truth для реквизитов (FR-5722) — никаких хардкодов
- Тексты юр-документов хранятся в Payload (FR-5740) — без миграций на изменение текста
- Cookies-banner — до получения opt-in аналитика **не загружается** (FR-5751) — критично для compliance
- Согласие — не pre-checked (FR-5735) — критично для compliance

**Scale/Scope**: ~12 публичных страниц (9 новых /info + 3 расширения), 5 форм с consent, 1 footer-компонент, 1 cookies-banner, 1 menu-extension. Без новых внешних сервисов

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Статус |
|---|---|---|
| I. Specification-First Development | Spec написан, `/clarify` пройден (5 вопросов), constitution-aware | ✅ PASS |
| II. SEO And Demand Are Product Requirements | Все 9 `/info/*` страниц через SEO-registry с metadata, schema.org для Article/FAQPage где применимо. FR-5705 требует index. JSON-LD WebPage обязателен для всех новых страниц | ✅ PASS — закрывается в Phase 1 |
| III. B2B/RFQ First, B2C Checkout Second | FR-5712 явно покрывает обе ветки (физлица 14 дней + юрлица по ГК). FR-5710 описывает оплату для юрлиц (счёт). RFQ-форма (FR-5733) получает consent наравне с checkout | ✅ PASS |
| IV. Integrations Must Be Isolated And Observable | Cookies-consent — изолированный провайдер аналитики (analytics-loader.ts), включается ТОЛЬКО при `cookie_consent=accepted`. PaymentSettings уже изолирован 055. AdminChangeLog логирует изменения от Owner (FR + A11) | ✅ PASS |
| V. Analytics And Search Control Are Required | GA4/Метрика остаются, но загружаются с opt-in. Событие `cookie_consent_set` (accepted/declined) логируется через dataLayer как proxy-метрика. Без opt-in — события не уходят | ✅ PASS |
| VI. Code Must Stay Maintainable By Codex | Тексты в Payload — редактируются админом, но **слаг + порядок страниц + версии** фиксированы в коде (seed-функция). Все consent-логики типизированы | ✅ PASS |
| VII. Quality Gates Before Release | 12 Success Criteria покрывают core gates (footer на каждой странице, mobile, форма, smoke-test). SC-002 — внешний gate ЮKassa-модерация. Playwright e2e для US1/US4/US6 | ✅ PASS |

**Дополнительные соображения:**

- **Schema.org**: на `/info/faq/` обязателен `FAQPage`, на `/info/payment/` опционально `WebPage` + `mainEntity=Article`. Юр-документы (оферта, политики) — `Article` с `dateModified`
- **Indexation**: все `/info/*` индексируются (`index, follow`). PDF-версии (если будут) — `noindex` по умолчанию
- **No secrets in commits**: cookies-banner не использует никаких secret keys. Tracking IDs (GA4, Yandex Metrika) — публичные, не secrets

**Gate: PASS** — нет нарушений, переходим к Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/057-yookassa-buyer-info-compliance/
├── plan.md                          # Этот файл
├── spec.md                          # Спецификация (после /clarify)
├── research.md                      # Phase 0 — архитектурные решения
├── data-model.md                    # Phase 1 — StaticPage + consent group
├── quickstart.md                    # Phase 1 — manual verification scenarios
├── contracts/
│   ├── consent-shape.md             # Embedded group для Order/Cart/Returns/Customer
│   ├── static-pages-api.md          # Payload API access for /info/* pages
│   └── content-templates/           # Шаблоны текстов из shop.nag.ru
│       ├── offer.md
│       ├── privacy.md
│       ├── pd-policy.md
│       ├── terms.md
│       ├── warranty.md
│       ├── payment.md
│       ├── delivery.md
│       ├── return.md
│       └── faq.md
├── checklists/
│   └── requirements.md              # PASS из /specify
└── tasks.md                         # Phase 2 — /speckit-tasks
```

### Source Code (repository root)

```text
apps/web/src/
├── app/
│   └── (site)/
│       ├── info/                    # НОВАЯ секция — buyer-info-страницы
│       │   ├── layout.tsx           # Общий layout с breadcrumb + sidebar nav
│       │   └── [slug]/
│       │       └── page.tsx         # Рендерит StaticPage из Payload через slug
│       ├── company/
│       │   └── [slug]/page.tsx      # Существующий — РАСШИРИТЬ /contacts блоком банк/директор
│       └── ...                      # остальные секции — без изменений
├── collections/
│   ├── StaticPages.ts               # НОВАЯ — Payload-коллекция для /info/* контента
│   ├── Orders.js                    # РАСШИРИТЬ — добавить group `consent`
│   ├── Carts.ts                     # РАСШИРИТЬ — добавить group `consent`
│   ├── Returns.ts                   # РАСШИРИТЬ (для RFQ-form аналог — но returns не имеют consent)
│   ├── RfqRequests.ts               # РАСШИРИТЬ — добавить group `consent`
│   └── Customers.ts                 # РАСШИРИТЬ — добавить group `consent`
├── components/
│   ├── layout/
│   │   ├── SiteFooter.tsx           # РАСШИРИТЬ — реквизиты + policies + payment logos
│   │   ├── SiteHeader.tsx           # РАСШИРИТЬ — пункт меню «Покупателям»
│   │   └── BuyerInfoNav.tsx         # НОВЫЙ — sidebar nav для /info/*
│   ├── consent/
│   │   ├── ConsentCheckbox.tsx      # НОВЫЙ — общий checkbox-компонент
│   │   ├── ConsentCheckbox.test.tsx
│   │   └── CookieConsentBanner.tsx  # НОВЫЙ — банер согласия на cookies
│   └── company/
│       └── BankingDetails.tsx       # НОВЫЙ — блок для /company/contacts/
├── lib/
│   ├── analytics/
│   │   ├── analytics-loader.ts      # НОВЫЙ — условная загрузка GA4/Метрики
│   │   └── cookie-consent.ts        # НОВЫЙ — read/write cookie_consent
│   ├── consent/
│   │   ├── make-consent-record.ts   # НОВЫЙ — server-side создание group `consent`
│   │   └── consent-types.ts         # НОВЫЙ — TS типы для shared usage
│   ├── company/
│   │   └── get-company-contacts.ts  # СУЩЕСТВУЮЩИЙ — расширить banking/director getters (если нужно)
│   ├── seo/
│   │   └── seo-registry.ts          # РАСШИРИТЬ — секция `info` + 9 paths
│   └── static-pages/
│       ├── get-static-page.ts       # НОВЫЙ — fetch from Payload by slug
│       └── seed-static-pages.ts     # НОВЫЙ — seed-функция для первичного контента
├── globals/
│   └── (без изменений — PaymentSettings уже есть)
└── seed/
    └── seed-static-pages.mjs        # НОВЫЙ скрипт — npx tsx seed-static-pages.mjs
```

**Structure Decision**: Web application (Next.js + Payload), один app `apps/web`. Новая секция `/info/` соответствует существующему паттерну `/company/[slug]/`. Реализация:
- **Payload-коллекция `static-pages`** — выбрана вместо расширения `documents` (которая занимается продуктовыми документами: паспорта, сертификаты — другой домен). Изолированный домен **buyer-info контента** заслуживает отдельной коллекции
- **Footer/Header — компоненты, переиспользуются** на всех публичных страницах через корневой layout `app/(site)/layout.tsx`
- **Consent — embedded group**, добавляется в 4 существующие коллекции через расширение `fields[]` массивов

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Нет нарушений конституции — все принципы соблюдаются (см. таблицу выше). Complexity tracking не требуется.
