# Contract: Yandex.Metrika Management API Client

**Spec**: [../spec.md](../spec.md) | **Requirements**: FR-360…FR-366, FR-380…FR-396 | **Research**: R17, R18

Контракт типизированного клиента `apps/web/src/lib/analytics/agent/metrika-management-client.ts` — единственная точка обращения к Yandex.Metrika Management API из agent-кода.

## Authentication

```typescript
const client = createMetrikaManagementClient({
  token: process.env.YM_AGENT_TOKEN,      // required
  counterId: process.env.YM_COUNTER_ID,    // required
  baseUrl: 'https://api-metrika.yandex.net/management/v1',
  userAgent: 'Soliton-AnalyticsAgent/1.0',
  rateLimit: { maxPerMinute: 100, backoff: 'exponential' }
})
```

При отсутствии `YM_AGENT_TOKEN` или `YM_COUNTER_ID` — клиент бросает ошибку при первом вызове (fail-fast).

## Read-only operations (без proposal)

Все следующие методы — read-only; могут вызываться agent'ом свободно (без AgentProposal) с записью в `AgentExecutionLog`:

```typescript
client.listGoals(): Promise<MetrikaGoal[]>
client.getGoal(id: number): Promise<MetrikaGoal>
client.listFilters(): Promise<MetrikaFilter[]>
client.getCounterSettings(): Promise<MetrikaCounterSettings>
client.getStatData(query: StatQuery): Promise<StatResponse>   // для evaluators
client.getCounterPermissions(): Promise<{ permission: 'edit' | 'view' | 'none' }>
```

## Mutating operations (требуют source-tag)

Все mutating-методы принимают **обязательный второй аргумент** `source`:

```typescript
type MutationSource =
  | { kind: 'proposal', proposalId: string }
  | { kind: 'config_apply', runId: string }
  | { kind: 'manual_admin', adminUserId: string }  // только для escape-hatch debug

client.createGoal(goal: MetrikaGoal, source: MutationSource): Promise<{ id: number }>
client.updateGoal(id: number, patch: Partial<MetrikaGoal>, source: MutationSource): Promise<void>
client.softDisableGoal(id: number, source: MutationSource): Promise<void>  // sets enabled=false
client.hardDeleteGoal(id: number, source: MutationSource & { confirmationFlag: true }): Promise<void>
client.createFilter(filter: MetrikaFilter, source: MutationSource): Promise<{ id: number }>
client.updateFilter(id: number, patch: Partial<MetrikaFilter>, source: MutationSource): Promise<void>
client.updateCounterSettings(settings: Partial<MetrikaCounterSettings>, source: MutationSource): Promise<void>
client.uploadOfflineConversions(csv: string, source: MutationSource): Promise<{ uploaded: number }>
```

**Invariant** (enforced на client-level): `hardDeleteGoal` требует `source.confirmationFlag === true`. Без него — throw `MetrikaSafetyError('Hard delete requires confirmation flag')`. Это второй layer защиты поверх FR-391.

## Audit-log Integration

Каждый вызов (read + mutating) **синхронно** записывается в `AgentExecutionLog` (Payload collection). Запись содержит:

- `timestamp`
- `endpoint` (без query-string секретов)
- `method`
- `requestParams` (без PII)
- `responseStatus`
- `durationMs`
- `proposalId` (если `source.kind === 'proposal'`)
- `configApplyRunId` (если `source.kind === 'config_apply'`)
- `evaluatorName` (если read-only call в рамках evaluator'а — передаётся через third arg)

## Rate-limiting + Backoff

- Hard limit: 100 calls/min, configurable in `AnalyticsSettings.agentReview.rateLimit`.
- При HTTP 429 от Метрики — exponential backoff: 1s, 2s, 4s, 8s (max 3 retry).
- При HTTP 5xx — same backoff.
- При circuit-breaker open (5+ consecutive failures за 5 минут) — клиент стопает, бросает `MetrikaCircuitBreakerError`, agent pauses (FR-395).

## Apply-config protocol (FR-361)

Конкретный workflow CLI `pnpm metrika:apply-config`:

1. **Validate config**: загрузить `metrika.config.ts`, run zod-schema validation, fail-early при invalid config.
2. **Generate runId**: UUID для всех вызовов этого прогона.
3. **List current state**: `client.listGoals()`, `listFilters()`, `getCounterSettings()`.
4. **Compute diff**:
   - For each goal в config: if name match — update if diff fields; else — create.
   - For each filter в config: same.
   - For counter settings: compare each field, generate patch.
   - For orphan-goals (в Метрике но нет в config) — log warning, не trogo (only soft-disable через AgentProposal).
5. **Dry-run output**: print plan as MD-table; exit if `--dry-run`.
6. **Execute**: каждое create/update — отдельный API-вызов с `source = { kind: 'config_apply', runId }`.
7. **Update goal-mapping.md**: после успеха — overwrite `06-reports/analytics/goal-mapping.md` через merge with фактическими Goal-ID; сохранить `business_meaning`, `owner`, `last_updated` колонки.
8. **Final summary**: print '✓ N goals created, M updated, K skipped (orphans); 0 errors'.

При **частичном failure** (например, 5 из 10 goals создались, потом API упал): записываем partial-state в `AgentExecutionLog` (с runId), возвращаем non-zero exit, оператор может перезапустить — idempotent upsert обеспечит ноль дублей.

## Smoke-tests

`apps/web/src/lib/analytics/agent/tests/metrika-client.test.ts`:

- Mock HTTP layer (через MSW или fetch-mock).
- Тест-кейсы:
  1. `createGoal` без source → throw error.
  2. `hardDeleteGoal` без confirmationFlag → throw.
  3. `createGoal` с valid source → один call с правильным URL и body, audit-log записан.
  4. Rate-limit: 101-й вызов в течение минуты → ждёт до окна.
  5. 429-response → 1 retry с 1s backoff → second-call success.
  6. 5+ 5xx подряд → CircuitBreakerError, дальнейшие calls fail-fast 60s.

`apps/web/src/lib/analytics/agent/tests/apply-config.test.ts`:

- Mock client + mock filesystem (`metrika.config.ts` + `goal-mapping.md`).
- Тест-кейсы:
  1. Apply на пустой счётчик: N create-calls, goal-mapping.md записан.
  2. Apply на счётчик-with-state-matching-config: 0 create/update calls.
  3. Apply с одним changed name: 1 update-call.
  4. Apply с orphan-goal в Метрике: warning logged, не trogo.
  5. `--dry-run`: 0 mutating calls.
  6. Partial-failure recovery: re-run после ошибки — idempotent.

## Reverse: export-config (FR-364)

`pnpm metrika:export-config --counter-id=<id> [--output=<path>]`:

1. List current state.
2. Convert API objects to MetrikaConfig-shape.
3. Generate TypeScript source с pretty-formatting (Prettier).
4. Если `--output` — write file; else — print to stdout.
5. Если файл уже существует — generate diff (через `git diff --no-index`), не overwrite без `--force`.

## Validate-config (FR-365)

`pnpm metrika:validate-config`:

- Read-only вызовы для diff Метрика vs config.
- При drift — exit 1 с printable diff.
- Запускается в CI (pre-deploy gate).
- Не делает mutating-операций.

## Error types

```typescript
class MetrikaError extends Error {}
class MetrikaAuthError extends MetrikaError {}       // 401/403
class MetrikaRateLimitError extends MetrikaError {}  // 429
class MetrikaSafetyError extends MetrikaError {}     // hard-delete без confirmation, etc.
class MetrikaCircuitBreakerError extends MetrikaError {}
class MetrikaValidationError extends MetrikaError {} // invalid config schema
```

Каждая категория ошибок имеет specific UI-message в admin-page для оператора.
