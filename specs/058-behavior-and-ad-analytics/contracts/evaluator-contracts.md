# Contract: Evaluator Suite (Agent Analysis)

**Spec**: [../spec.md](../spec.md) | **Requirements**: FR-370…FR-376 | **Research**: R19

Каждый evaluator — самостоятельный модуль `apps/web/src/lib/analytics/agent/evaluators/<name>.ts`, реализующий единый интерфейс:

```typescript
interface Evaluator {
  name: string
  description: string
  enabled: boolean              // из AnalyticsSettings.agentReview.enabledEvaluators
  cooldownDays: number          // default 7 (override per-evaluator)
  schedule: 'daily' | 'weekly'  // когда запускается

  run(ctx: EvaluatorContext): Promise<EvaluatorResult>
}

interface EvaluatorContext {
  metrika: MetrikaManagementClient  // read-only methods
  payload: PayloadAPI                // local API for orders/carts queries
  config: MetrikaConfig              // current metrika.config.ts
  date: Date                         // target date (for daily) or week-end (for weekly)
  period: 'day' | 'week'
  baseline: { /* 7-day или 4-week */ } // computed historical baseline
}

interface EvaluatorResult {
  severity: 'info' | 'warning' | 'critical'
  summary: string                   // 1-line summary
  evidence: Record<string, unknown> // data snapshot
  proposedAction?: {                // если требуется action — будет создан AgentProposal
    type: AgentProposalType
    action: 'create' | 'update' | 'delete' | 'soft-disable'
    targetPath: string
    payload: Record<string, unknown>
    reasoning: string
    expectedImpact?: string
  }
}
```

## Evaluators v1.1 (6 daily + 4 weekly = 10 total)

### Daily evaluators (FR-371)

#### 1. `funnel_drop_off`

**Reads**: Stat API funnel data for goals из metrika.config.ts compositeGoals.

**Logic**:
```typescript
for each step in checkoutFunnel:
  conversionRateToday = step.conversions / step.entries
  conversionRate7DayAvg = avg(last 7 days, excluding today)
  delta = conversionRateToday - conversionRate7DayAvg

  if abs(delta) > 0.20 AND step.entries >= 10:
    severity = delta < 0 ? 'critical' : 'info'
    propose investigate_funnel_drop with evidence={step, delta, conversionRates}
```

#### 2. `qualified_visit_rate`

**Logic**:
```typescript
share = qualifiedVisitsToday / totalVisitsToday

if share < 0.05:
  propose adjust_qualified_visit_threshold {newDuration: 15, newDepth: 2}  // smother
elif share > 0.90:
  propose adjust_qualified_visit_threshold {newDuration: 60, newDepth: 3}  // stricter
```

#### 3. `source_quality`

**Logic**: Compare top-10 channels today vs 7-day-avg. New channel >10% или lost channel >50% → `propose_investigate_source_change`.

#### 4. `zero_result_searches`

**Logic**: Group `search_no_results` events by `search_term` за день. Если term has >5 occurrences AND not in known-handled list → `propose_consider_new_content` с evidence top-N terms.

#### 5. `roas_deviation`

**Logic** (only если Я.Директ-cost data доступна):
```typescript
for each campaign:
  roas = revenue / cost
  if roas < 1 AND campaign.active AND last7Days has consistent data:
    propose review_campaign with evidence={campaign, roas, trend}
```

#### 6. `data_quality`

**Logic**:
```typescript
jsErrorRate = jsErrorEvents / pageViews
404Rate = page404Events / pageViews
consentDeclineRate = consentDeclined / consentBannerShown

for each rate:
  if rate > 7DayAvg * 1.5:
    propose investigate_data_quality_drop
```

### Weekly evaluators (FR-374)

#### 7. `drift_detector`

См. R20. **Один** proposal со всем diff'ом.

#### 8. `missing_goal`

**Logic**: Прогон `events.ts` helpers vs `metrika.config.ts.goals`. Считает занят-event'ы за неделю через Stat API. Если event >20 раз/неделя AND нет goal с conditions matching этому event → `propose_create_missing_goal` с suggested goal spec.

#### 9. `unused_segment`

**Logic**: для каждого filter в config Stat-API возвращает visit-count за 4 недели. Если 0 → `propose_remove_unused_segment` (soft-disable + retain history).

#### 10. `correlated_events`

**Logic** (наивный):
```typescript
for each pair (eventA, eventB):
  pairFrequency = count(sessions with both A and B)
  if pairFrequency > 0.30 * count(sessions with A) AND no composite goal exists:
    propose consider_composite_goal {steps: [A, B]}
```

## Tests

`apps/web/src/lib/analytics/agent/tests/evaluators/<name>.test.ts`:
- For each evaluator — fixture-based test:
  - Input: mock Stat API response + mock baseline.
  - Output: assert specific `EvaluatorResult` shape.
- Negative tests: input below threshold → severity=info, no proposal.
- Positive tests: input above threshold → expected proposedAction.

## Adding new evaluators (v1.2+)

1. Создать `apps/web/src/lib/analytics/agent/evaluators/<name>.ts` exporting `Evaluator`.
2. Зарегистрировать в `evaluator-registry.ts`.
3. Добавить в default `AnalyticsSettings.agentReview.enabledEvaluators` (или оставить opt-in).
4. Написать tests.
5. Обновить operator-guide.md с описанием нового сигнала.
