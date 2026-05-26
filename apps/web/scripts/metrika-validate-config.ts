#!/usr/bin/env node --experimental-strip-types --no-warnings=ExperimentalWarning
/**
 * pnpm metrika:validate-config — non-mutating drift check (FR-365).
 *
 * Запускается в CI как pre-deploy gate. Exit code:
 * - 0 — конфигурация Метрики синхронна с metrika.config.ts
 * - 1 — drift detected (printable diff)
 * - 2 — ошибка инфраструктуры (env/network)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { metrikaConfig } from "../config/metrika.config.ts";
import { computeConfigDiff, summarizeDiff } from "../src/lib/analytics/agent/config-diff.ts";
import { FileAuditLogger } from "../src/lib/analytics/agent/audit-logger.ts";
import { MetrikaManagementClient } from "../src/lib/analytics/agent/metrika-management-client.ts";

import { loadAppEnv, assertEnv } from "./_lib/env-loader.mjs";

const __filename = fileURLToPath(import.meta.url);
const APPS_WEB_DIR = path.resolve(path.dirname(__filename), "..");
const PROJECT_ROOT = path.resolve(APPS_WEB_DIR, "..", "..");
const AUDIT_LOG_PATH = path.resolve(PROJECT_ROOT, "06-reports", "analytics", "agent-execution-log.jsonl");

async function main(): Promise<number> {
  console.log("=== Metrika validate-config (drift detection) ===\n");

  loadAppEnv(APPS_WEB_DIR);

  // Для read-only validation подойдёт YM_API_TOKEN ИЛИ YM_AGENT_TOKEN
  const token = process.env.YM_AGENT_TOKEN ?? process.env.YM_API_TOKEN;
  if (!token) {
    console.error("ERROR: ни YM_AGENT_TOKEN, ни YM_API_TOKEN не заданы в env");
    return 2;
  }
  assertEnv(["YM_COUNTER_ID"]);

  const audit = new FileAuditLogger(AUDIT_LOG_PATH);
  const client = new MetrikaManagementClient({
    token,
    counterId: process.env.YM_COUNTER_ID!,
    audit,
  });

  try {
    const counter = await client.getCounter();
    const existingGoals = await client.listGoals();
    const existingFilters = await client.listFilters();

    const diff = computeConfigDiff({
      config: metrikaConfig,
      existingGoals,
      existingFilters,
      existingCounter: {
        code_options: counter.code_options ?? {},
        webvisor: counter.webvisor ?? {},
      },
    });

    const driftPresent =
      diff.goalsToCreate.length > 0 ||
      diff.goalsToUpdate.length > 0 ||
      diff.filtersToCreate.length > 0 ||
      diff.filtersToUpdate.length > 0 ||
      diff.counterSettingsPatch !== null;

    console.log(summarizeDiff(diff));
    console.log("");

    if (driftPresent) {
      console.error("\n✗ DRIFT DETECTED — Metrika конфигурация не соответствует metrika.config.ts");
      console.error("  Запустите `pnpm metrika:apply-config --dry-run` для plan'а изменений.");
      return 1;
    }

    console.log("✓ No drift — конфигурация Metrika синхронна с metrika.config.ts");
    return 0;
  } catch (err) {
    console.error(`\nERROR: ${(err as Error).message}`);
    return 2;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("\nUnhandled error:", err);
    process.exit(2);
  });
