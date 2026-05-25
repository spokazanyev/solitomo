# Implementation Plan: Twenty CRM Sync

**Branch**: `048-twenty-crm-sync` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

## Summary

Реализовать двунаправленную (на MVP — только Soliton → Twenty) интеграцию Payload Orders с Twenty CRM через GraphQL. Использовать event emitter из 047 как источник событий, очередь `crm-sync-jobs` для надёжной доставки с retry, готовый client из `contracts/twenty-crm-sync.md`.

## Technical Context

**Language/Version**: TypeScript 5, Node 20.

**Primary Dependencies**:
- `graphql-request@^7` или `@apollo/client@^3` (выбор — в research.md).
- `zod@^3` для валидации схемы Twenty.
- Twenty self-host: Docker Compose с образами `twentycrm/twenty` и `postgres:16` (отдельной БД, не наша Payload-PG).

**Storage**: PostgreSQL (через Payload).

**Testing**: Vitest (unit + httpmock против GraphQL); Playwright e2e против self-host Twenty в docker-compose.

**Target Platform**: server-side only (Node runtime, не Edge).

**Performance Goals**:
- Sync job p95 ≤ 5 с (один заказ).
- Retry latency p99 ≤ 5 минут (5 попыток с backoff).

**Constraints**:
- API-ключ только server-side.
- 100% sync операций идемпотентны.
- При недоступности Twenty основной флоу не блокируется.

**Scale/Scope**:
- 1 спека на 1–2 спринта (≈10–15 дней разработки).
- ~5 модулей в `lib/crm/twenty/*`.
- 2 cron-задачи.
- 1 GraphQL client.

## Project Structure

```text
specs/048-twenty-crm-sync/
├── spec.md
├── plan.md
├── data-model.md
├── screens.md            # S14 CRM-блок в Payload Admin
├── quickstart.md
├── tasks.md
└── contracts/
    ├── twenty-crm-sync.md      # перенесён из 047
    ├── twenty-fields.md        # каталог custom fields
    ├── twenty-graphql.ts       # типы запросов
    └── twenty-webhook.handler.ts  # для US5 (фаза 2)
```

```text
apps/web/src/
├── globals/CrmSettings.ts
├── collections/CrmSyncJobs.ts
├── lib/crm/twenty/
│   ├── client.ts          # GraphQL client + retry
│   ├── mappers.ts         # Order → Person/Company/Opportunity inputs
│   ├── sync.ts            # обработчик jobs
│   ├── tasks.ts           # авто-создание Tasks
│   ├── fields-migration.ts # crm:migrate-fields
│   ├── webhook.ts         # для US5
│   └── logger.ts
├── app/api/
│   ├── admin/crm/
│   │   ├── force-sync/route.ts    # POST принудительный sync
│   │   └── ping/route.ts          # connection check
│   └── webhooks/twenty/route.ts   # для US5
└── components/admin/orders/CrmInfoPanel.tsx  # S14
```

## Constitution Check

- Высокорисковая интеграция (содержит ПДн) — требует owner confirmation перед прод-релизом.
- Не выводить токен/секреты на клиент — выполняется через server-only routes.
- Логирование в `AdminChangeLog` для изменения `crmSettings` — заложено.

## Phase 0 Research

1. Финальный выбор GraphQL client (`graphql-request` vs `@apollo/client`).
2. Twenty self-host: подготовить `deploy/docker-compose.twenty.yml` (отдельный compose-файл), prom/setup-скрипт, бэкап-стратегия для отдельной PG.
3. Подпись webhook Twenty (для US5): HMAC-SHA256 над raw body — подтвердить из docs.
4. Custom fields: проверить через GraphQL introspection, что schema принимает миграции на актуальном релизе Twenty.
5. Запросить у владельца поддомен (Q6) и email админа (Q7) для первоначального деплоя.

## Phase 1 Outputs

- `data-model.md`
- `contracts/twenty-fields.md`
- `contracts/twenty-graphql.ts`
- `screens.md` (S14 + onboarding wizard)
- `quickstart.md`

## Phase 2 Tasks

Создаётся `/speckit-tasks`. Группировка по US.

## Dependencies

- **Hard**: 047 завершён (event emitter готов).
- **Soft**: 049 не блокирует, но желательно — общий шаблон job queue.

## Risk & Mitigation

| Риск | Митигация |
|---|---|
| Twenty cloud имеет ограничения GraphQL | Подтвердить в research.md, при необходимости — self-host. |
| Кастомные поля «расходятся» с миграцией | `crm:migrate-fields --check` в CI; алерт при несоответствии. |
| Утечка токена в client | `import "server-only"`, lint-правило, тест бандла в CI. |
| Лавина jobs после большого инцидента | Внутренний rate-limit 60 rpm на исходящие к Twenty. |
| Изменение API Twenty (open-source проект) | Подписка на release notes; контрактные snapshot-тесты. |
