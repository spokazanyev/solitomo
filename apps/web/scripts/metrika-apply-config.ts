#!/usr/bin/env node --experimental-strip-types --no-warnings=ExperimentalWarning
/**
 * pnpm metrika:apply-config — реконсильирует metrika.config.ts с live Metrika-счётчиком.
 *
 * Спека 058:
 * - FR-361: idempotent upsert-by-name
 * - FR-362: --dry-run / --scope / --force
 * - FR-363: auto-update goal-mapping.md
 * - FR-396 invariant: каждая mutating-операция → AgentExecutionLog с runId
 *
 * Использование:
 *   pnpm metrika:apply-config --dry-run
 *   pnpm metrika:apply-config
 *   pnpm metrika:apply-config --scope=goals
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { metrikaConfig } from "../config/metrika.config.ts";
import { computeConfigDiff, summarizeDiff } from "../src/lib/analytics/agent/config-diff.ts";
import { buildGoalMapping, parseGoalMapping, writeGoalMapping } from "../src/lib/analytics/agent/goal-mapping.ts";
import { FileAuditLogger } from "../src/lib/analytics/agent/audit-logger.ts";
import { MetrikaManagementClient } from "../src/lib/analytics/agent/metrika-management-client.ts";
import { MetrikaError } from "../src/lib/analytics/agent/safety.ts";
import type { MutationSource } from "../src/lib/analytics/agent/types.ts";

import { loadAppEnv, assertEnv } from "./_lib/env-loader.mjs";

const __filename = fileURLToPath(import.meta.url);
const APPS_WEB_DIR = path.resolve(path.dirname(__filename), "..");
const PROJECT_ROOT = path.resolve(APPS_WEB_DIR, "..", "..");
const REPORTS_DIR = path.resolve(PROJECT_ROOT, "06-reports", "analytics");
const GOAL_MAPPING_PATH = path.resolve(REPORTS_DIR, "goal-mapping.md");
const AUDIT_LOG_PATH = path.resolve(REPORTS_DIR, "agent-execution-log.jsonl");

interface CliArgs {
  dryRun: boolean;
  counterIdOverride: string | null;
  scope: "goals" | "filters" | "settings" | "all";
  force: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false, counterIdOverride: null, scope: "all", force: false };
  for (const arg of argv.slice(2)) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--force") args.force = true;
    else if (arg.startsWith("--counter-id=")) args.counterIdOverride = arg.slice("--counter-id=".length);
    else if (arg.startsWith("--scope=")) {
      const scope = arg.slice("--scope=".length);
      if (!["goals", "filters", "settings", "all"].includes(scope)) {
        throw new Error(`Invalid --scope=${scope}; allowed: goals | filters | settings | all`);
      }
      args.scope = scope as CliArgs["scope"];
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}\nUse --help for usage.`);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`
pnpm metrika:apply-config — применить metrika.config.ts к Yandex.Metrika счётчику.

Опции:
  --dry-run                Показать план изменений без mutating-операций.
  --counter-id=<id>        Override YM_COUNTER_ID из env.
  --scope=<goals|filters|settings|all>  Применить только часть конфигурации (default: all).
  --force                  (зарезервировано для будущего расширения).
  --help, -h               Показать справку.

Окружение (apps/web/.env.local):
  YM_AGENT_TOKEN     Token с counter-management scope (FR-390).
  YM_COUNTER_ID      ID Metrika-счётчика.

Артефакты:
  06-reports/analytics/goal-mapping.md       Output (FR-363).
  06-reports/analytics/agent-execution-log.jsonl   Audit (FR-375).
`);
}

async function main(): Promise<number> {
  console.log("\n=== Metrika apply-config ===\n");

  const cli = parseArgs(process.argv);

  // Load env
  loadAppEnv(APPS_WEB_DIR);
  assertEnv(["YM_AGENT_TOKEN"]);
  const counterId = cli.counterIdOverride ?? process.env.YM_COUNTER_ID;
  if (!counterId) {
    console.error("ERROR: YM_COUNTER_ID не задан в env и не передан через --counter-id");
    return 1;
  }

  const runId = randomUUID();
  const source: MutationSource = { kind: "config_apply", runId };
  console.log(`Counter ID: ${counterId}`);
  console.log(`Run ID:     ${runId}`);
  console.log(`Dry run:    ${cli.dryRun ? "YES" : "NO"}`);
  console.log(`Scope:      ${cli.scope}\n`);

  const audit = new FileAuditLogger(AUDIT_LOG_PATH);
  const client = new MetrikaManagementClient({
    token: process.env.YM_AGENT_TOKEN!,
    counterId,
    audit,
    dryRun: cli.dryRun,
  });

  // Health check
  console.log("→ Health check (GET counter)...");
  let counter: Awaited<ReturnType<typeof client.getCounter>>;
  try {
    counter = await client.getCounter();
  } catch (err) {
    console.error(`FAIL: cannot fetch counter info: ${(err as Error).message}`);
    return 1;
  }
  console.log(`  OK: '${counter.name}' (${counter.site}) permission='${counter.permission}'\n`);

  if (counter.permission !== "own" && counter.permission !== "edit") {
    console.error(
      `FAIL: token has permission='${counter.permission}'; required 'own' or 'edit' for mutating operations.`,
    );
    return 1;
  }

  // List current state
  console.log("→ Fetching current state (goals + filters)...");
  const existingGoals = await client.listGoals();
  const existingFilters = await client.listFilters();
  console.log(`  Found: ${existingGoals.length} goals, ${existingFilters.length} filters\n`);

  // Compute diff
  console.log("→ Computing diff...");
  const diff = computeConfigDiff({
    config: metrikaConfig,
    existingGoals,
    existingFilters,
    existingCounter: {
      code_options: counter.code_options ?? {},
      webvisor: counter.webvisor ?? {},
    },
  });

  console.log("\n=== Diff Plan ===");
  console.log(summarizeDiff(diff));
  console.log("");

  if (cli.dryRun) {
    console.log("(dry-run: ни одна mutating-операция не выполнена)\n");
    return 0;
  }

  // Confirm: для non-empty changes — спросить (если интерактивный TTY)
  const totalChanges =
    diff.goalsToCreate.length +
    diff.goalsToUpdate.length +
    diff.filtersToCreate.length +
    diff.filtersToUpdate.length +
    (diff.counterSettingsPatch ? 1 : 0);

  if (totalChanges === 0) {
    console.log("✓ No changes to apply — конфигурация уже синхронна.\n");
    return 0;
  }

  console.log(`Applying ${totalChanges} change(s)...\n`);

  // ---------- Apply ----------
  const createdGoalsWithIds: Array<{ goal: (typeof diff.goalsToCreate)[0]; metrikaId: number }> = [];

  if (cli.scope === "goals" || cli.scope === "all") {
    for (const goal of diff.goalsToCreate) {
      try {
        console.log(`  + create goal: ${goal.name}`);
        const { id } = await client.createGoal(goal, source);
        createdGoalsWithIds.push({ goal, metrikaId: id });
      } catch (err) {
        console.error(`    FAIL: ${(err as Error).message}`);
      }
    }
    for (const update of diff.goalsToUpdate) {
      try {
        console.log(`  ~ update goal: ${update.existing.name} (id=${update.existing.id})`);
        await client.updateGoal(update.existing.id, update.updated, source);
      } catch (err) {
        console.error(`    FAIL: ${(err as Error).message}`);
      }
    }
  }

  if (cli.scope === "filters" || cli.scope === "all") {
    for (const filter of diff.filtersToCreate) {
      try {
        console.log(`  + create filter: ${filter.name}`);
        await client.createFilter(filter, source);
      } catch (err) {
        console.error(`    FAIL: ${(err as Error).message}`);
      }
    }
    for (const update of diff.filtersToUpdate) {
      try {
        console.log(`  ~ update filter: ${update.existing.name} (id=${update.existing.id})`);
        await client.updateFilter(update.existing.id, update.updated, source);
      } catch (err) {
        console.error(`    FAIL: ${(err as Error).message}`);
      }
    }
  }

  if ((cli.scope === "settings" || cli.scope === "all") && diff.counterSettingsPatch) {
    try {
      console.log("  ~ update counter settings");
      await client.updateCounterSettings(diff.counterSettingsPatch, source);
    } catch (err) {
      console.error(`    FAIL: ${(err as Error).message}`);
    }
  }

  // ---------- Update goal-mapping.md ----------
  if (createdGoalsWithIds.length > 0 || diff.goalsToUpdate.length > 0) {
    console.log("\n→ Updating goal-mapping.md...");
    const existingRows = await parseGoalMapping(GOAL_MAPPING_PATH);

    // Включаем все goals из config (с фактическими ID — из созданных или existing)
    const allGoalsWithIds: Array<{ goal: (typeof metrikaConfig.goals)[0]; metrikaId: number }> = [];

    // Refresh existing goals after creation for accurate IDs
    const refreshedGoals = await client.listGoals();
    for (const configGoal of metrikaConfig.goals) {
      const existing = refreshedGoals.find((g) => g.name === configGoal.name);
      if (existing) {
        allGoalsWithIds.push({ goal: configGoal, metrikaId: existing.id });
      }
    }

    const md = buildGoalMapping({ goalsWithIds: allGoalsWithIds, existingRows });
    await writeGoalMapping(GOAL_MAPPING_PATH, md);
    console.log(`  OK: ${GOAL_MAPPING_PATH}`);
  }

  // ---------- FR-396 invariant check ----------
  const { valid, violations } = await audit.validateInvariant();
  if (!valid) {
    console.error(`\n⚠ FR-396 invariant VIOLATION: ${violations.length} mutating-вызовов без source.`);
    return 2;
  }

  console.log("\n✓ apply-config completed.");
  console.log(`  Audit-log: ${AUDIT_LOG_PATH}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("\nUnhandled error:", err);
    if (err instanceof MetrikaError) {
      console.error(`  Type: ${err.name}`);
    }
    process.exit(1);
  });
