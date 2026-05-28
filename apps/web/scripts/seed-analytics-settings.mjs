/**
 * Seed AnalyticsSettings global (058 T011).
 *
 * Defaults для свежего деплоя. Идемпотентный — повторный запуск не ломает
 * существующую конфигурацию (только заполняет null-поля). Owner может потом
 * редактировать через Payload Admin.
 *
 * Запуск: pnpm seed:analytics-settings
 */
import { getPayload } from "payload";
import config from "@payload-config";

const DEFAULTS = {
  activation: {
    serverHitsEnabled: true,
    webvisorEnabled: true,
    qualifiedVisitGoalEnabled: true,
    agentEnabled: true,
    agentSchedulerEnabled: false, // v1: off; v1.1 включит cron
  },
  agentReview: {
    schedule: "0 9 * * *",
    timezone: "Europe/Moscow",
    enabledEvaluators: [
      "funnel_drop_off",
      "qualified_visit_rate",
      "source_quality",
      "zero_result_searches",
      "roas_deviation",
      "data_quality",
    ],
    cooldownDays: 7,
    rateLimit: {
      maxApiCallsPerMinute: 100,
      backoffOnRateLimit: true,
    },
  },
  qualifiedVisit: {
    minDurationSeconds: 30,
    minPageDepth: 2,
    excludeBounce: true,
  },
  brandKeywords: [{ keyword: "soliton" }, { keyword: "солитон" }, { keyword: "pdumarket" }],
};

async function main() {
  const payload = await getPayload({ config });

  const existing = await payload.findGlobal({ slug: "analytics-settings" });

  // Merge: keep existing user-edited values; fill nulls only
  const merged = {
    activation: { ...DEFAULTS.activation, ...(existing.activation ?? {}) },
    agentReview: { ...DEFAULTS.agentReview, ...(existing.agentReview ?? {}) },
    qualifiedVisit: { ...DEFAULTS.qualifiedVisit, ...(existing.qualifiedVisit ?? {}) },
    brandKeywords:
      Array.isArray(existing.brandKeywords) && existing.brandKeywords.length > 0
        ? existing.brandKeywords
        : DEFAULTS.brandKeywords,
  };

  await payload.updateGlobal({
    slug: "analytics-settings",
    data: merged,
    context: { skipAnalyticsSettingsAudit: true },
  });

  console.log("✓ AnalyticsSettings seeded:");
  console.log("  - activation.agentEnabled =", merged.activation.agentEnabled);
  console.log("  - agentReview.enabledEvaluators =", merged.agentReview.enabledEvaluators.length, "items");
  console.log("  - qualifiedVisit thresholds =", merged.qualifiedVisit);
  console.log("  - brandKeywords =", merged.brandKeywords.length, "items");

  process.exit(0);
}

main().catch((err) => {
  console.error("seed-analytics-settings failed:", err);
  process.exit(1);
});
