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

**Revision pass (Level B, 2026-05-25)**: после senior-analytics ревью — добавлены e-commerce dashboard, step-level checkout, когорты, UserID, аннотации, B2B-сигналы, ретаргетинг-сегменты, qualified_visit, operator-guide. Все пункты пройдены.

**Revision pass (Level C-Full, 2026-05-25)**: после senior-analytics + SEO ревью — закрыт «слепой» организический канал и базовая инженерная гигиена. Все пункты пройдены.

**Revision pass (MVP-Lite breakdown, 2026-05-25)**: после reverse-ревью «что избыточно для launch» — добавлена секция `## Scope Phases (MVP-Lite Breakdown)`. Каждое FR-требование явно отнесено к фазе v1 (MVP-Lite, ~70 FR) / v1.1 (+1 месяц, ~30 FR) / v1.2 (+3 месяца, остаток). Все пункты пройдены повторно: спека остаётся полной по содержанию, но даёт чёткое разделение приоритетов для `/speckit-tasks`. Цель v1 — недельный MD-отчёт, отвечающий на 4 главных вопроса бизнеса, реалистично достижим одним разработчиком за 2-3 недели.

**Revision pass (Agent-Driven Analytics Model, 2026-05-26)**: после установки пользователя «agent (Claude) настраивает Метрику через API, читает данные, предлагает изменения с approve оператора» — добавлен новый actor Analytics Agent в Personas; +3 User Stories (US9 P1 config-apply, US10 P2 daily-review, US11 P2 weekly-structural); +6 групп FR (FR-360…FR-411: config-as-code, daily/weekly review, propose-approve workflow, auth+safety, drift detection, MCP-v1.2); +6 SC (SC-031…SC-036); +6 Key Entities (AnalyticsAgent, MetrikaConfigFile, AgentProposal, AgentExecutionLog, EvaluatorResult, DriftRecord); +Phase 12 в tasks.md (35 задач T091-T125); +4 contract'а (metrika-management-api, agent-proposals-api, evaluator-contracts, daily-review-cron); +R17-R21 в research.md; +AgentProposals + AgentExecutionLog коллекции + MetrikaConfigFile section в data-model.md. T080-T083 manual-setup tasks заменены на `apply-config` (FR-361). Constitution Check post-design: STRONGLY PASS (agent-driven model усиливает Принципы IV/V/VI/VII). Total tasks: 90 → **125**.

- Спека сфокусирована на бизнес-ценности (воронка, эффективность рекламы, **SEO-канал**, недельный отчёт, retention, качество индекса), а не на технических деталях реализации.
- Технические термины (`dataLayer`, `ecommerce`, `UserID`, `_ym_uid`, `yclid`, API Webmaster/GSC) встречаются как контекст, но FR сформулированы как поведенческие требования.
- 8 user stories: **P1×3** (воронка, реклама, **SEO weekly**), P2×3 (микро-конверсии, adblock, weekly), P3×2 (приватность+боты, когорты). Каждая — независимо тестируемая.
- ~95 функциональных требований сгруппированы по 30 областям:
  - **Базовая разметка событий** (FR-001…FR-019) и параметры визита (FR-020…FR-024).
  - **Атрибуция и UTM** (FR-030…FR-035), **серверные события** (FR-040…FR-044), **цели Метрики и воронки** (FR-050…FR-052).
  - **Webvisor/приватность** (FR-060…FR-063), **Web Vitals** (FR-070…FR-071), **боты** (FR-080…FR-081).
  - **Weekly-отчёт** (FR-090…FR-093) — расширен SEO/индекс/ROAS/consent блоками.
  - **Конфигурация и эксплуатация** (FR-100…FR-102).
  - Level B-расширения: e-commerce Метрики (FR-110…FR-115), step-level checkout (FR-120…FR-125), внутренний поиск + zero-result (FR-130…FR-132), call-tracking готовность (FR-140…FR-142), кросс-устройства (FR-150…FR-152), аннотации релизов (FR-160…FR-162), JS-error/404/5xx (FR-170…FR-173), когорты и time-to-purchase (FR-180…FR-183), B2B-сигналы (FR-190…FR-194), ретаргетинговые сегменты (FR-200…FR-202), qualified_visit (FR-210…FR-211), operator manual (FR-220…FR-221).
  - **Level C-Full SEO/инженерные расширения**:
    - **SEO-интеграция Webmaster/GSC** (FR-230…FR-235).
    - **Классификация реферера и атрибуция организики** (FR-240…FR-243).
    - **Crawl errors + Soft 404 + индекс-санитар** (FR-250…FR-253).
    - **Кластер и landing-page анализ** (FR-260…FR-262).
    - **Изоляция test/staging** (FR-270…FR-272).
    - **Мета-аналитика cookie-banner** (FR-280…FR-282).
    - **Pre-deploy smoke test и goal-mapping** (FR-290…FR-293).
    - **Импорт стоимости Я.Директа + ROAS** (FR-300…FR-302).
    - **Retry-очередь серверных хитов** (FR-310…FR-312).
    - **Базовое page_view** (FR-320).
    - **Webhook на цели** (FR-330…FR-331).
    - **Safari/ITP first-party cookies** (FR-340…FR-341).
    - **152-ФЗ DSAR для аналитики** (FR-350…FR-352).
- **30 measurable success criteria** (SC-001…SC-030), технологически-нейтральных.
- Edge cases расширены ещё на 10 кейсов (домен не подтверждён в Webmaster, GSC квота, AI без узнаваемого UA, утечка staging→prod, серверный hit failed all retries, ITP-неверная DNS, PDF из выдачи).
- Key Entities: добавлены SearchConsoleQuery, IndexCoverageRecord, CrawlErrorRecord, ReferrerClassification, AcquisitionQueryRecord, AnalyticsHitQueueItem, GoalMappingEntry, MetrikaCounterEnvironment, ConsentBannerInteraction, DSARRequest.
- Assumptions явно фиксируют предусловия (подтверждение прав на домен, лимиты Webmaster API, ограничения ITP-резистентности, ручная Я.Директ-привязка). Явно OUT-of-scope: Tag Manager, Roistat-сквозная, anomaly detection, Logs API в собственное хранилище, A/B-тесты.
- Dependencies расширены спеками 028, 030, 040, 041, 042, 044, 045; явно прописана связь с 038 (AI-bot policy).

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
- Готово к `/speckit-clarify`. Перед `/speckit-plan` стоит зафиксировать через clarify:
  1. **Формат weekly-отчёта**: только MD vs MD + HTML-дашборд в админ-панели.
  2. **Дефолтный набор ботовых User-Agent шаблонов** (для `visitor_type=bot`).
  3. **Хранение секретов**: token API Метрики, OAuth-Я.Вебмастера, service-account GSC — env vs зашифрованное поле Payload Globals.
  4. **Метод классификации `user_type=legal_entity`** (по факту заполнения ИНН, по Company-связке, гибрид).
  5. **Источник `first_seen_at`** (cookie vs Payload-fallback для авторизованных).
  6. **Признаки Soft 404**: фиксированный набор маркеров vs конфигурируемый список фраз.
  7. **Способ доставки webhook на цели в админ-alerting**: Telegram-bot, email, оба, что-то ещё.
  8. **Smoke-test исполнение**: где запускается (Playwright в CI vs jsdom-симуляция vs реальный staging).

**Status after clarify (2026-05-25)**: пункты 1, 3, 4, 5, 8 из списка выше **решены** через `/speckit-clarify` (Session 2026-05-25, 5 Q→A). Пункты 2 (дефолтный набор bot-UA), 6 (Soft 404 маркеры), 7 (способ доставки webhook) — отложены: low-impact, разрешаются на этапе `/speckit-plan` через дефолтный seed Payload Globals.
