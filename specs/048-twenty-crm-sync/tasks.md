---
description: "Task list for 048-twenty-crm-sync"
---

# Tasks: Twenty CRM Sync

## Phase 1: Setup

- [ ] T001 Создать ветку `048-twenty-crm-sync`, каталог `apps/web/src/lib/crm/twenty/*`.
- [ ] T002 Установить `graphql-request@^7` или `@apollo/client@^3` (после research).
- [ ] T003 Lint-правило: `lib/crm/twenty/client.ts` обязан иметь `import "server-only"`.
- [ ] T004 Подготовить `deploy/docker-compose.twenty.yml` (self-host Twenty + отдельная PG + Redis для очереди). Документация по запуску в `quickstart.md`.
- [ ] T005 Развернуть тестовый Twenty self-host на dev-окружении; создать admin-аккаунт, получить API key, workspace id, default assignee user id; зафиксировать в `.env.example`.

## Phase 2: Foundational

- [ ] T010 Создать `apps/web/src/globals/CrmSettings.ts` по `data-model.md §1`. Подключить.
- [ ] T011 Создать коллекцию `CrmSyncJobs.ts` по `data-model.md §3`. Подключить.
- [ ] T012 Расширить `orders` группой `crmRefs` (`data-model.md §2`). Миграция Payload.
- [ ] T013 Реализовать `lib/crm/twenty/client.ts` — GraphQL client с rate-limit и retry.
- [ ] T014 [P] Реализовать `lib/crm/twenty/logger.ts` — журналирование с маской ПДн.
- [ ] T015 Custom field component для маскированного ввода `apiKey` / `webhookSecret`.

## Phase 3: US1 — Сделки в Twenty

- [ ] T020 [US1] Реализовать `lib/crm/twenty/mappers.ts` (Order → Person/Company/Opportunity inputs) — см. `contracts/twenty-crm-sync.md`.
- [ ] T021 [US1] Реализовать `lib/crm/twenty/sync.ts` — основной обработчик jobs: matching event → mutation.
- [ ] T022 [US1] Подключить event subscriber к `emitDomainEvent` из 047: на каждое событие создаём `crm-sync-job`.
- [ ] T023 [US1] Cron `crm-sync-runner` каждые 60 c обрабатывает `queued` jobs.
- [ ] T024 [US1] Vitest snapshot-тесты mappers; httpmock-тесты client.
- [ ] T025 [US1] Playwright e2e: paid → Opportunity создан с правильными полями.

## Phase 4: US2 — Migration кастомных полей

- [ ] T030 [US2] Реализовать `apps/web/scripts/crm-migrate-fields.ts` с парсером `contracts/twenty-fields.md`.
- [ ] T031 [US2] Тесты на dry-run / apply / conflict scenarios.
- [ ] T032 [US2] Документация в `quickstart.md`.

## Phase 5: US3 — UI в Payload

- [ ] T040 [US3] Компонент `CrmInfoPanel.tsx` (S14 блок в карточке заказа).
- [ ] T041 [US3] Роут `POST /api/admin/crm/force-sync/route.ts`.
- [ ] T042 [US3] Роут `GET /api/admin/crm/ping/route.ts` (connection check).
- [ ] T043 [P] [US3] Connection check в `CrmSettings` global с кнопкой.

## Phase 6: US4 — Авто-задачи

- [ ] T050 [US4] Cron `crm-task-creator` каждые 30 минут.
- [ ] T051 [US4] Правила: 4ч без shipment → Task; 13 дней до closure → Task; Lost → Task.
- [ ] T052 [US4] Дедупликация Tasks по externalKey.
- [ ] T053 [US4] Тесты.

## Phase 7: US5 — Двунаправленный sync (фаза 2, опционально на MVP)

- [ ] T060 [US5] Роут `POST /api/webhooks/twenty/route.ts` с HMAC-валидацией.
- [ ] T061 [US5] Маппинг Twenty stage → orders.status (обратная таблица).
- [ ] T062 [US5] Защита от обратных переходов (статус нельзя «откатить» с delivered на awaiting_payment).
- [ ] T063 [US5] Тесты.

## Phase N: Polish

- [ ] T090 [P] Алерт владельцу при 401/403/непрерывных ошибках Twenty.
- [ ] T091 [P] Backfill-скрипт: синхронизировать существующие paid+ заказы.
- [ ] T092 [P] Performance: rate-limit 60 rpm на исходящие.
- [ ] T093 Документация `quickstart.md` со скриптом онбординга.
- [ ] T094 Обновить document-register.md и AGENTS.md.

## Dependencies

- **Hard**: 047 завершён до точки emit events (можно работать параллельно после T024 в 047).
- Внутри 048: Phase 2 блокирует всё; US1 — стержень; US2 идёт параллельно; US3 после US1; US4 после US1; US5 — в любой момент после US1.

## MVP

US1 + US2 + US3 = минимум; US4 на втором релизе; US5 на третьем.
