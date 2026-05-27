# Specification Quality Checklist: Унификация выбора доставки в чекауте юрлица

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-05-27
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

## Notes

### Validation iteration log

**Iteration 1 (2026-05-27)** — initial spec review:

- ✅ Никаких языков/фреймворков/API в FR (только домен: DaData как «подсказки адресов», ApiShip как «расчёт тарифов» — это user-facing концепции, известные стейкхолдерам).
- ⚠ **Уточнено**: упоминания `getCompanyContacts()`, `OrderSummaryCard`, `DeliveryBlock` присутствуют в разделе Dependencies — это допустимо как ссылки на существующие компоненты проекта (для трассируемости), не как требования к реализации. FR-разделы остаются agnostic.
- ✅ User Stories независимо тестируемы: US1 покрывает ApiShip-режим, US2 — свою ТК, US3 — самовывоз; каждый MVP-самостоятелен.
- ✅ Success Criteria измеримы: SC-062-01..06 содержат %, baseline-сравнения, конкретные пороги.
- ✅ Edge cases охватывают: ApiShip недоступен, длинный handoverNote, смена режима, отсутствие adresса склада, существующие заказы, race-condition при пересчёте.
- ✅ Scope явно отделён в Out of Scope.

### Open items for /speckit-clarify (if user opts in)

Спека не содержит [NEEDS CLARIFICATION] маркеров — все решения приняты по разумным дефолтам. Однако следующие пункты могут потребовать явного подтверждения владельца на шаге `/speckit-clarify`:

1. **Дефолтный режим** — спека предлагает «Через службу доставки». Альтернатива: вообще не выбирать ничего по умолчанию (заставить пользователя сделать явный выбор). Влияет на UX и аналитику (доля выбравших каждый режим).
2. **Лимит handoverNote 1000 символов** — разумный дефолт, но владелец может захотеть 2000 или 500. Влияет на размер БД и читаемость PDF.
3. **Обязательность handoverNote в режиме «Самовывоз»** — сейчас опциональный (только в `tc` обязательный). Может стоит сделать обязательным «контактное лицо получателя» — для самовывоза менеджеру нужно знать, кому отдавать. Но это спор: владелец юрлица сам — это контакт.
4. **Поведение CRM-sync** — `handoverNote` в Twenty `opportunity.description` или отдельным полем custom-field? (Отложено до активации Twenty, но решение влияет на DataModel.)
