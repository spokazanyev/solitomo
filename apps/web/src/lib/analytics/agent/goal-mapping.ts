/**
 * goal-mapping.md updater (FR-363).
 *
 * После успешного apply-config обновляем `06-reports/analytics/goal-mapping.md`
 * фактическими Metrika Goal-ID. Существующие строки (business_meaning/owner/...)
 * сохраняются — merge by event_name.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import type { MetrikaGoal } from "./types.ts";

export interface GoalMappingRow {
  eventName: string;
  metrikaGoalId: number | null;
  ga4EventName: string;
  businessMeaning: string;
  owner: string;
  lastUpdated: string;
}

/**
 * Парсит существующий goal-mapping.md (если есть) в массив rows.
 * Если файла нет — возвращает [].
 */
export async function parseGoalMapping(filePath: string): Promise<GoalMappingRow[]> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const rows: GoalMappingRow[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      // Skip headers, separators
      if (!line.trim().startsWith("|")) continue;
      if (line.includes("---")) continue;
      if (line.toLowerCase().includes("event_name")) continue;

      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      if (cells.length < 6) continue;

      const [eventName, metrikaIdRaw, ga4EventName, businessMeaning, owner, lastUpdated] = cells;
      if (!eventName) continue;
      const metrikaId = parseInt(metrikaIdRaw ?? "", 10);
      rows.push({
        eventName,
        metrikaGoalId: Number.isFinite(metrikaId) ? metrikaId : null,
        ga4EventName: ga4EventName ?? eventName,
        businessMeaning: businessMeaning ?? "",
        owner: owner ?? "",
        lastUpdated: lastUpdated ?? "",
      });
    }
    return rows;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/**
 * Builds new goal-mapping.md content:
 * - For each goal в config: lookup в existingRows by eventName (= goal.name normalized)
 *   - Если найден: merge (сохраняем businessMeaning/owner; updates metrikaGoalId)
 *   - Если не найден: создаём новую строку с данными из config
 * - existingRows, у которых нет соответствия в config — preserved (orphans),
 *   с пометкой [ORPHAN] в lastUpdated.
 */
export function buildGoalMapping(args: {
  goalsWithIds: Array<{ goal: MetrikaGoal; metrikaId: number }>;
  existingRows: GoalMappingRow[];
}): string {
  const { goalsWithIds, existingRows } = args;
  const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const finalRows: GoalMappingRow[] = [];
  const consumedExistingNames = new Set<string>();

  for (const { goal, metrikaId } of goalsWithIds) {
    const eventName = goalNameToEventName(goal.name);
    const existing = existingRows.find((r) => r.eventName === eventName);

    finalRows.push({
      eventName,
      metrikaGoalId: metrikaId,
      ga4EventName: existing?.ga4EventName ?? eventName,
      businessMeaning: goal.businessMeaning || existing?.businessMeaning || "",
      owner: goal.owner || existing?.owner || "",
      lastUpdated: now,
    });

    if (existing) consumedExistingNames.add(existing.eventName);
  }

  // Preserve orphan rows (existed в MD but не в config) с маркером
  for (const row of existingRows) {
    if (consumedExistingNames.has(row.eventName)) continue;
    finalRows.push({
      ...row,
      lastUpdated: `${row.lastUpdated} [ORPHAN]`,
    });
  }

  return renderGoalMappingMd(finalRows, now);
}

function goalNameToEventName(goalName: string): string {
  // "Add to Cart" → "add_to_cart"; "RFQ Submit" → "rfq_submit"
  return goalName
    .toLowerCase()
    .replace(/\[disabled\]\s*/i, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function renderGoalMappingMd(rows: GoalMappingRow[], generatedDate: string): string {
  const header = `# Goal Mapping — Yandex.Metrika

**Generated**: ${generatedDate} by \`pnpm metrika:apply-config\` (FR-292, FR-363).

**ВНИМАНИЕ**: этот файл — output \`metrika:apply-config\` CLI. Не редактировать руками
для метрика-ID (они синхронизируются автоматически). Редактировать можно только
\`businessMeaning\` и \`owner\` — эти колонки сохраняются при следующем apply через merge.

Source-of-truth для самой конфигурации Metrika — \`apps/web/config/metrika.config.ts\`.

| event_name | metrika_goal_id | ga4_event_name | business_meaning | owner | last_updated |
|---|---|---|---|---|---|`;

  const lines = rows.map((r) => {
    const id = r.metrikaGoalId !== null ? String(r.metrikaGoalId) : "—";
    return `| ${r.eventName} | ${id} | ${r.ga4EventName} | ${r.businessMeaning} | ${r.owner} | ${r.lastUpdated} |`;
  });

  return [header, ...lines, ""].join("\n");
}

/**
 * Atomic write — пишет во временный файл, потом rename.
 */
export async function writeGoalMapping(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, content, "utf-8");
  await fs.rename(tmp, filePath);
}
