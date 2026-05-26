# Contract: Daily Review Cron Endpoint

**Spec**: [../spec.md](../spec.md) | **Requirements**: FR-370, FR-376 | **Status**: v1.1

## Endpoint

`POST /api/cron/agent-daily-review`

**Auth**: `Authorization: Bearer ${CRON_SECRET}` (consistent с другими cron-эндпоинтами в проекте).

**Schedule (v1.1)**: external cron-trigger (Vercel cron / external scheduler) ежедневно в 09:00 МСК. Cron-expression: `0 6 * * *` UTC (= 09:00 МСК).

**v1**: эндпоинт не запускается scheduled — только on-demand через CLI (FR-376).

## Request body

```json
{
  "period": "day" | "week",     // default "day"
  "date": "2026-05-26",          // optional, default yesterday (МСК)
  "evaluators": ["...", "..."],  // optional, default = AnalyticsSettings.agentReview.enabledEvaluators
  "dryRun": false                // optional, default false; если true — evaluators run, но AgentProposals не создаются
}
```

## Response

`202 Accepted` (immediate; работа async):

```json
{
  "runId": "uuid",
  "period": "day",
  "date": "2026-05-26",
  "scheduledAt": "2026-05-27T06:00:00Z",
  "evaluatorsToRun": 6,
  "statusUrl": "/api/cron/agent-daily-review/status/<runId>"
}
```

## Workflow

1. **Validate**: проверка `CRON_SECRET` + `AnalyticsSettings.activation.agentEnabled === true` (kill-switch FR-394).
2. **Generate runId**: UUID.
3. **Async**: запускает background-task с пайплайном:
    a. Load `metrika.config.ts`.
    b. Initialize `MetrikaManagementClient` через `YM_AGENT_TOKEN`.
    c. Health check: `client.getCounterPermissions()` — если 401/403 → abort с alert.
    d. Compute baseline (7-day avg для daily evaluators / 4-week avg для weekly).
    e. For each enabled evaluator (parallel где возможно):
        - `evaluator.run(ctx)` → `EvaluatorResult`.
        - Log в `AgentExecutionLog` с `evaluatorName`.
        - Если `proposedAction` существует AND cooldown не active → создать `AgentProposal`.
    f. Запись summary в `AgentExecutionLog`.
4. **On error**: записать в `AgentExecutionLog` с error; admin-alert; не блокировать другие evaluators.
5. **Final**: response.statusUrl можно poll'ить для прогресса (returns `{ runId, status, completedEvaluators, totalEvaluators, createdProposals }`).

## Idempotency

Multiple parallel calls с одинаковым `(period, date)` → второй detect'ит first running run (через advisory-lock или Payload check), отвечает `409 Conflict` с `existingRunId`. Без двойного запуска.

## Tests

`apps/web/src/app/api/cron/agent-daily-review/tests/`:
- Auth: без CRON_SECRET → 401.
- Kill-switch off: agentEnabled=false → 503 с message.
- API down (401 от Метрики) → log + alert, не создаёт proposals.
- Cooldown active → 0 new proposals от того же evaluator+target.
- Dry-run: evaluators run, но AgentProposals.count() не меняется.
- Idempotency: parallel calls → один run executes.

## Operator visibility

После каждого scheduled-run в admin dashboard `/admin/agent-activity` появляется entry:
- Date, runId, duration, evaluatorsRun, proposalsCreated, status (success/partial/failed).
- Click — раскрывает execution log (filtered by runId).

В v1 (on-demand) — оператор видит результат сразу в CLI-output + новые AgentProposals.
