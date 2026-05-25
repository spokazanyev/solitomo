# Specification Quality Checklist: Behavior & Ad Analytics

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-05-25
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Validation Notes

**Initial pass — 2026-05-25**: все пункты пройдены.

**Revision pass (Level B, 2026-05-25)**: после senior-analytics ревью спека расширена; повторно прогнана через все пункты — все пройдены.

- Спека сфокусирована на бизнес-ценности (воронка, эффективность рекламы, недельный отчёт, retention), а не на технических деталях реализации.
- Названия `dataLayer`, `ecommerce`, `UserID`, пути файлов `lib/analytics/*` встречаются как контекст в Input / Dependencies / Edge Cases, но FR сформулированы как поведенческие требования.
- 7 user stories: P1×2 (воронка, реклама), P2×3 (микро-конверсии, adblock, weekly), P3×2 (приватность+боты, когорты). Каждая — независимо тестируемая.
- ~55 функциональных требований сгруппированы по 18 областям: разметка событий, параметры, атрибуция, серверные события, цели/воронки, Webvisor/приватность, Web Vitals, боты, недельный отчёт, **электронная коммерция (новое)**, **шаги checkout (новое)**, **внутренний поиск + zero-result (новое)**, **call-tracking готовность (новое)**, **кросс-устройства (новое)**, **аннотации релизов (новое)**, **JS-error/404/5xx (новое)**, **когорты и time-to-purchase (новое)**, **B2B-сигналы (новое)**, **ретаргетинговые сегменты (новое)**, **qualified_visit (новое)**, **operator manual (новое)**, конфигурация.
- 19 measurable success criteria, технологически-нейтральных.
- Edge cases расширены (Intersection Observer fallback, dev/prod аннотации, customer-merge, печать в инкогнито, лимит Webvisor).
- Key Entities расширены: добавлены EcommerceItem, CustomerLink, DeployAnnotation, RetargetingSegment, CohortRecord, OperatorGuide.
- Assumptions явно фиксируют, что теперь IN scope: e-commerce dashboard Метрики, готовность к call-tracking, UserID для кросс-устройств. Явно OUT: Tag Manager, Roistat-сквозная, anomaly detection, Logs API, A/B-тесты.

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
- Готово к `/speckit-clarify`. Перед `/speckit-plan` рекомендуется зафиксировать через clarify:
  1. Конкретный формат недельного отчёта (только MD vs MD+HTML-дашборд в админке).
  2. Дефолтный набор ботовых User-Agent шаблонов.
  3. Безопасное хранение токена API Метрики (env vs зашифрованное поле Payload Globals).
  4. Метод классификации `user_type=legal_entity` (по факту заполнения ИНН, по наличию Company-связки в Customer, или гибрид).
  5. Источник `first_seen_at` (cookie vs Payload-fallback для авторизованных).
