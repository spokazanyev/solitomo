/**
 * Diff engine для apply-config:
 * сравнение `metrika.config.ts` vs live Metrika state.
 *
 * Алгоритм match-by-name (FR-361):
 * - For each goal/filter in config:
 *   - Если name match найден в live state → check if fields differ → update
 *   - Если match не найден → create
 * - For each goal/filter в live state, не имеющие match в config:
 *   - → orphan (FR-391: НЕ hard-delete, только warning или soft-disable через AgentProposal)
 */
import type { ExistingFilter, ExistingGoal } from "./metrika-management-client.ts";
import type {
  ConfigDiff,
  MetrikaConfig,
  MetrikaCounterSettings,
  MetrikaFilter,
  MetrikaGoal,
} from "./types.ts";

export function computeConfigDiff(args: {
  config: MetrikaConfig;
  existingGoals: ExistingGoal[];
  existingFilters: ExistingFilter[];
  existingCounter?: {
    code_options?: Record<string, unknown>;
    webvisor?: Record<string, unknown>;
  };
}): ConfigDiff {
  const { config, existingGoals, existingFilters, existingCounter } = args;

  const diff: ConfigDiff = {
    goalsToCreate: [],
    goalsToUpdate: [],
    goalsOrphan: [],
    filtersToCreate: [],
    filtersToUpdate: [],
    filtersOrphan: [],
    counterSettingsPatch: null,
  };

  // ---------- Goals ----------
  const configGoalNames = new Set(config.goals.map((g) => g.name));

  for (const configGoal of config.goals) {
    const existing = existingGoals.find((eg) => eg.name === configGoal.name);

    if (!existing) {
      diff.goalsToCreate.push(configGoal);
      continue;
    }

    if (goalNeedsUpdate(existing, configGoal)) {
      diff.goalsToUpdate.push({
        existing: { id: existing.id, name: existing.name },
        updated: configGoal,
      });
    }
  }

  // Orphans — goals в Metrike, отсутствующие в config
  for (const existing of existingGoals) {
    if (!configGoalNames.has(existing.name) && !existing.name.startsWith("[DISABLED] ")) {
      diff.goalsOrphan.push({ id: existing.id, name: existing.name });
    }
  }

  // ---------- Filters ----------
  const configFilterNames = new Set(config.filters.map((f) => f.name));

  for (const configFilter of config.filters) {
    const existing = existingFilters.find((ef) => ef.name === configFilter.name);

    if (!existing) {
      diff.filtersToCreate.push(configFilter);
      continue;
    }

    if (filterNeedsUpdate(existing, configFilter)) {
      diff.filtersToUpdate.push({
        existing: { id: existing.id, name: existing.name },
        updated: configFilter,
      });
    }
  }

  for (const existing of existingFilters) {
    if (!configFilterNames.has(existing.name)) {
      diff.filtersOrphan.push({ id: existing.id, name: existing.name });
    }
  }

  // ---------- Counter Settings ----------
  diff.counterSettingsPatch = computeCounterSettingsPatch(
    config.counterSettings,
    existingCounter,
  );

  return diff;
}

function goalNeedsUpdate(existing: ExistingGoal, target: MetrikaGoal): boolean {
  if (existing.type !== target.type) return true;
  if (Boolean(existing.is_retargeting) !== Boolean(target.isRetargeting)) return true;

  const existingConditions = JSON.stringify(existing.conditions ?? []);
  const targetConditions = JSON.stringify(target.conditions ?? []);
  if (existingConditions !== targetConditions) return true;

  return false;
}

function filterNeedsUpdate(existing: ExistingFilter, target: MetrikaFilter): boolean {
  if (existing.attr !== target.attr) return true;
  if (existing.type !== target.type) return true;
  if (existing.value !== target.value) return true;
  return false;
}

function computeCounterSettingsPatch(
  target: MetrikaCounterSettings,
  existing?: { code_options?: Record<string, unknown>; webvisor?: Record<string, unknown> },
): Partial<MetrikaCounterSettings> | null {
  if (!existing) return target; // нет данных → применяем всё

  const patch: Partial<MetrikaCounterSettings> = {};
  const codeOpts = existing.code_options ?? {};
  const webvisor = existing.webvisor ?? {};

  // Metrika API: counter.code_options.in_one_line — first-party cookies
  const liveFPC = Boolean((codeOpts as { in_one_line?: boolean }).in_one_line);
  if (liveFPC !== target.firstPartyCookies) {
    patch.firstPartyCookies = target.firstPartyCookies;
  }

  const liveATB = Boolean((codeOpts as { accurate_track_bounce?: boolean }).accurate_track_bounce);
  if (liveATB !== target.accurateTrackBounce) {
    patch.accurateTrackBounce = target.accurateTrackBounce;
  }

  const liveTL = Boolean((codeOpts as { track_links?: boolean }).track_links);
  if (liveTL !== target.trackLinks) {
    patch.trackLinks = target.trackLinks;
  }

  const liveCM = Boolean((codeOpts as { clickmap?: boolean }).clickmap);
  if (liveCM !== target.clickmap) {
    patch.clickmap = target.clickmap;
  }

  // Webvisor: API возвращает webvisor.urls — '' значит включён на всех URL
  const wvLive = webvisor as { urls?: string; forms?: boolean };
  const liveWVEnabled = wvLive.urls !== "off";
  if (liveWVEnabled !== target.webvisor.enabled) {
    if (!patch.webvisor) patch.webvisor = { ...target.webvisor };
  }
  const liveFormsEnabled = Boolean(wvLive.forms);
  if (liveFormsEnabled !== (target.webvisor.formCapturing !== "disabled")) {
    if (!patch.webvisor) patch.webvisor = { ...target.webvisor };
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Human-readable summary diff'а для вывода в CLI.
 */
export function summarizeDiff(diff: ConfigDiff): string {
  const lines: string[] = [];
  lines.push(`Goals:    create=${diff.goalsToCreate.length}, update=${diff.goalsToUpdate.length}, orphan=${diff.goalsOrphan.length}`);
  lines.push(`Filters:  create=${diff.filtersToCreate.length}, update=${diff.filtersToUpdate.length}, orphan=${diff.filtersOrphan.length}`);
  lines.push(`Counter settings patch: ${diff.counterSettingsPatch ? "needed" : "no changes"}`);

  if (diff.goalsToCreate.length > 0) {
    lines.push("");
    lines.push("Goals to create:");
    for (const g of diff.goalsToCreate) lines.push(`  + ${g.name} (${g.type})`);
  }

  if (diff.goalsToUpdate.length > 0) {
    lines.push("");
    lines.push("Goals to update:");
    for (const g of diff.goalsToUpdate) lines.push(`  ~ ${g.existing.name} (id=${g.existing.id})`);
  }

  if (diff.goalsOrphan.length > 0) {
    lines.push("");
    lines.push("Goals orphan (в Metrika, нет в config — НЕ удаляются автоматически, FR-391):");
    for (const g of diff.goalsOrphan) lines.push(`  ? ${g.name} (id=${g.id})`);
  }

  if (diff.filtersToCreate.length > 0) {
    lines.push("");
    lines.push("Filters to create:");
    for (const f of diff.filtersToCreate) lines.push(`  + ${f.name}`);
  }

  if (diff.filtersOrphan.length > 0) {
    lines.push("");
    lines.push("Filters orphan (в Metrika, нет в config — НЕ удаляются автоматически, FR-391):");
    for (const f of diff.filtersOrphan) {
      const displayName = f.name && f.name !== "undefined" ? f.name : "<built-in / без имени>";
      lines.push(`  ? ${displayName} (id=${f.id})`);
    }
  }

  if (diff.counterSettingsPatch) {
    lines.push("");
    lines.push("Counter settings to apply:");
    for (const [k, v] of Object.entries(diff.counterSettingsPatch)) {
      lines.push(`  ~ ${k} → ${JSON.stringify(v)}`);
    }
  }

  return lines.join("\n");
}
