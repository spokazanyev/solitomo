# Implementation Plan: DaData Party Autofill (063)

**Branch**: `063-dadata-party-autofill` | **Date**: 2026-05-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/063-dadata-party-autofill/spec.md`

## Summary

Добавить в чекаут юрлица ([InvoiceCheckoutForm.tsx](../../apps/web/src/components/cart/InvoiceCheckoutForm.tsx)) единое поле подсказок организаций на базе DaData `suggest/party`. Клиент вводит название ИЛИ ИНН → выбирает организацию из списка → поля `companyName, inn, kpp, ogrn, legalAddress` автозаполняются. Добавляется локальная проверка контрольной суммы ИНН (10/12 знаков, блокирует отправку) и предупреждение о статусе контрагента (ликвидация/банкротство, не блокирует). Ручной ввод сохраняется как fallback; запросы идут через серверный прокси (токен не утекает в браузер). Аналитические события через существующий dataLayer (058).

**Технический подход**: переиспользуем существующий паттерн DaData-прокси (`/api/dadata/{fio,email}` + `@/lib/dadata/client`). Новый endpoint `suggest/party` — на том же бесплатном тарифе «Подсказки» (Token-only, без X-Secret). Схема БД не меняется — поля уже есть в Orders. Новых npm-зависимостей нет.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20.x (Next.js 16 runtime)

**Primary Dependencies**: Next.js 16 (App Router, RSC), React 19; существующие модули — `@/lib/dadata/client` (axios-based), `@/components/checkout/DadataSuggestInput`, `@/lib/analytics/events` + `@/lib/analytics/data-layer`. Новых внешних зависимостей нет.

**Storage**: N/A — изменений схемы Payload/Postgres нет. Поля `companyName, inn, kpp, ogrn, legalAddress` уже принимаются `POST /api/orders` (`customer.*`).

**Testing**: Vitest (`pnpm --filter @soliton/web test`); unit-тесты на INN-checksum и нормализацию party-ответа; manual smoke автозаполнения на чекауте.

**Target Platform**: Web (страница чекаута юрлица `/cart/...`, client component).

**Project Type**: Web application (Next.js 16 + Payload CMS v3 + PostgreSQL monorepo, `apps/web/`).

**Performance Goals**: debounce 300 мс (зеркалит [DadataSuggestInput.tsx:118](../../apps/web/src/components/checkout/DadataSuggestInput.tsx)), минимум 3 символа запроса (FR-002), `count` ≤ 7. Цель — заполнение реквизитов одной подсказкой (SC-001), −50% времени (SC-003).

**Constraints**: токен DaData только на сервере (FR-011); мягкая деградация при сбое/лимите (FR-012); события не несут сырых ИНН/наименования в payload (хотя маскирование UI не требуется, FR-016 — см. research R6).

**Scale/Scope**: B2B-трафик чекаута. Лимит бесплатного тарифа «Подсказки» DaData (общий дневной) — достаточность подтверждается на аккаунте до релиза (Assumption спеки).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Статус | Обоснование |
|---|---|---|
| I. Specification-First | ✅ PASS | `/specify` + `/clarify` (5 вопросов) пройдены до плана. |
| II. SEO как требование | ✅ N/A | Чекаут не индексируется; schema.org / URL не затрагиваются. |
| III. B2B/RFQ first | ✅ PASS | Фича усиливает B2B-поток (реквизиты юрлица), B2C-чекаут не затрагивает и не ослабляет. |
| IV. Integrations isolated & observable | ✅ PASS | DaData через провайдер-интерфейс `@/lib/dadata/client` + серверный прокси; не размазано по UI. Сбои логируются и деградируют (FR-012). |
| V. Analytics required | ✅ PASS | FR-015 — события показа/выбора/предупреждения через `@/lib/analytics/events`. |
| VI. Maintainable by Codex | ✅ PASS | Typed-контракты, code-first, без скрытой admin-логики; токен в settings/env как у существующего DaData. |
| VII. Quality gates | ✅ PASS | Vitest на checksum + нормализацию; ручной smoke автозаполнения; тест деградации (пустой ответ). |

**Violations**: нет. Complexity Tracking не заполняется.

**Post-Design re-check (после Phase 1)**: ✅ PASS — дизайн не вводит новых нарушений. DaData party изолирован в `@/lib/dadata/*` + серверный прокси (IV); события через `@/lib/analytics/events` (V); схема БД не тронута; токен только на сервере; новых внешних зависимостей нет (VI).

## Project Structure

### Documentation (this feature)

```text
specs/063-dadata-party-autofill/
├── plan.md              # Этот файл (/speckit-plan)
├── research.md          # Phase 0 — решения по DaData party / checksum / branch-only / events
├── data-model.md        # Phase 1 — PartySuggestion / нормализация / маппинг полей
├── quickstart.md        # Phase 1 — как проверить фичу вручную + конфиг
├── contracts/           # Phase 1 — API-прокси, компонент, INN-util
│   ├── dadata-party-api.md
│   ├── company-suggest-input.md
│   └── inn-validation.md
├── checklists/
│   └── requirements.md  # (от /specify)
└── tasks.md             # Phase 2 (/speckit-tasks — НЕ создаётся этим шагом)
```

### Source Code (repository root)

```text
apps/web/src/
├── lib/
│   ├── dadata/
│   │   ├── client.ts                # + suggestParty() + DadataPartySuggestion/Data + SUGGEST_PARTY_URL
│   │   ├── inn.ts                   # NEW: isValidInn() — контрольная сумма 10/12
│   │   ├── party-normalize.ts       # NEW: partyToRequisites() — DaData data → 5 полей + статус
│   │   └── __tests__/
│   │       ├── inn.test.ts          # NEW
│   │       └── party-normalize.test.ts  # NEW
│   └── analytics/
│       └── events.ts                # + 3 event-name + trackCompanySuggest*/trackCompanySelected/trackCompanyStatusWarning
├── app/api/dadata/
│   └── party/route.ts               # NEW: серверный прокси (Token-only, MAIN-only фильтр)
└── components/
    ├── checkout/
    │   └── CompanySuggestInput.tsx  # NEW: единое поле подсказок (2-строчные строки: название + ИНН), onSelect(party)
    └── cart/
        └── InvoiceCheckoutForm.tsx  # MODIFY: интеграция поля, автозаполнение, checksum-gate, статус-warning, overwrite-on-reselect, события
```

**Structure Decision**: Web-app monorepo `apps/web/`. Логика DaData локализована в `src/lib/dadata/` (провайдер-интерфейс по Constitution IV), серверный прокси в `app/api/dadata/party/`, презентация — отдельный компонент `CompanySuggestInput` (вместо расширения `DadataSuggestInput`, т.к. строки двухстрочные и результат маппится в 5 setters — чище для сопровождения, Constitution VI). Интеграция — точечная модификация существующей `InvoiceCheckoutForm`.

## Complexity Tracking

> Нарушений Constitution Check нет — раздел не заполняется.
