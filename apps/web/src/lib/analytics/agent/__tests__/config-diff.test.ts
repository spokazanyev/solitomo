/**
 * Tests для config-diff reconciliation engine.
 */
import { describe, expect, it } from "vitest";

import { computeConfigDiff, summarizeDiff } from "../config-diff.ts";
import type { ExistingFilter, ExistingGoal } from "../metrika-management-client.ts";
import type { MetrikaConfig } from "../types.ts";

const minimalConfig: MetrikaConfig = {
  goals: [
    {
      name: "Purchase",
      type: "action",
      conditions: [{ type: "exact", url: "purchase" }],
      isRetargeting: true,
      enabled: true,
      businessMeaning: "Оплата успешна",
      owner: "test@example.com",
    },
  ],
  compositeGoals: [],
  filters: [
    {
      name: "Legal entity",
      attr: "ym:s:paramsLevel1",
      type: "equal",
      value: "legal_entity",
      enabled: true,
      businessMeaning: "B2B",
    },
  ],
  counterSettings: {
    firstPartyCookies: true,
    webvisor: { enabled: true, enabledV2: true, formCapturing: "enabled_with_masks" },
    accurateTrackBounce: true,
    trackLinks: true,
    clickmap: true,
    informer: false,
  },
};

describe("computeConfigDiff — goals", () => {
  it("creates new goal when no match exists", () => {
    const diff = computeConfigDiff({
      config: minimalConfig,
      existingGoals: [],
      existingFilters: [],
    });
    expect(diff.goalsToCreate).toHaveLength(1);
    expect(diff.goalsToCreate[0]!.name).toBe("Purchase");
    expect(diff.goalsToUpdate).toHaveLength(0);
  });

  it("no update when existing goal matches", () => {
    const existing: ExistingGoal[] = [
      {
        id: 42,
        name: "Purchase",
        type: "action",
        conditions: [{ type: "exact", url: "purchase" }],
        is_retargeting: true,
      },
    ];

    const diff = computeConfigDiff({ config: minimalConfig, existingGoals: existing, existingFilters: [] });
    expect(diff.goalsToCreate).toHaveLength(0);
    expect(diff.goalsToUpdate).toHaveLength(0);
  });

  it("updates when type or conditions differ", () => {
    const existing: ExistingGoal[] = [
      {
        id: 42,
        name: "Purchase",
        type: "url", // отличается от config 'event_target'
        conditions: [{ type: "exact", url: "/success" }],
      },
    ];

    const diff = computeConfigDiff({ config: minimalConfig, existingGoals: existing, existingFilters: [] });
    expect(diff.goalsToUpdate).toHaveLength(1);
    expect(diff.goalsToUpdate[0]!.existing.id).toBe(42);
  });

  it("detects orphan goal (в Metrika, нет в config)", () => {
    const existing: ExistingGoal[] = [
      { id: 42, name: "Purchase", type: "action", conditions: [{ type: "exact", url: "purchase" }], is_retargeting: true },
      { id: 99, name: "Random Old Goal", type: "url", conditions: [] },
    ];

    const diff = computeConfigDiff({ config: minimalConfig, existingGoals: existing, existingFilters: [] });
    expect(diff.goalsToCreate).toHaveLength(0);
    expect(diff.goalsOrphan).toHaveLength(1);
    expect(diff.goalsOrphan[0]!.name).toBe("Random Old Goal");
  });

  it("ignores [DISABLED]-prefixed goals в orphan list (это soft-disabled)", () => {
    const existing: ExistingGoal[] = [
      { id: 42, name: "Purchase", type: "action", conditions: [{ type: "exact", url: "purchase" }], is_retargeting: true },
      { id: 99, name: "[DISABLED] Old Goal", type: "url", conditions: [] },
    ];

    const diff = computeConfigDiff({ config: minimalConfig, existingGoals: existing, existingFilters: [] });
    expect(diff.goalsOrphan).toHaveLength(0);
  });
});

describe("computeConfigDiff — filters", () => {
  it("creates new filter when no match", () => {
    const diff = computeConfigDiff({ config: minimalConfig, existingGoals: [], existingFilters: [] });
    expect(diff.filtersToCreate).toHaveLength(1);
    expect(diff.filtersToCreate[0]!.name).toBe("Legal entity");
  });

  it("updates filter when value differs", () => {
    const existing: ExistingFilter[] = [
      { id: 100, name: "Legal entity", attr: "ym:s:paramsLevel1", type: "equal", value: "WRONG_VALUE" },
    ];
    const diff = computeConfigDiff({ config: minimalConfig, existingGoals: [], existingFilters: existing });
    expect(diff.filtersToUpdate).toHaveLength(1);
  });

  it("no update when filter identical", () => {
    const existing: ExistingFilter[] = [
      { id: 100, name: "Legal entity", attr: "ym:s:paramsLevel1", type: "equal", value: "legal_entity" },
    ];
    const diff = computeConfigDiff({ config: minimalConfig, existingGoals: [], existingFilters: existing });
    expect(diff.filtersToUpdate).toHaveLength(0);
  });

  it("detects orphan filters", () => {
    const existing: ExistingFilter[] = [
      { id: 100, name: "Legal entity", attr: "ym:s:paramsLevel1", type: "equal", value: "legal_entity" },
      { id: 200, name: "Some old filter", attr: "ym:s:foo", type: "equal", value: "bar" },
    ];
    const diff = computeConfigDiff({ config: minimalConfig, existingGoals: [], existingFilters: existing });
    expect(diff.filtersOrphan).toHaveLength(1);
    expect(diff.filtersOrphan[0]!.id).toBe(200);
  });
});

describe("computeConfigDiff — counter settings (v1: всегда null, Forever-Manual ops)", () => {
  it("ВСЕГДА возвращает null — counter-settings managed manually через UI Я.Метрики (v1)", () => {
    // Даже если фактическое состояние сильно отличается от target — patch=null.
    // Counter-settings deferred до v1.1 (research correct API field names).
    const diff = computeConfigDiff({
      config: minimalConfig,
      existingGoals: [],
      existingFilters: [],
      existingCounter: {
        code_options: { in_one_line: false, accurate_track_bounce: false, track_links: false, clickmap: false },
        webvisor: { urls: "off" },
      },
    });
    expect(diff.counterSettingsPatch).toBeNull();
  });

  it("возвращает null даже без existingCounter (v1: всё manual)", () => {
    const diff = computeConfigDiff({ config: minimalConfig, existingGoals: [], existingFilters: [] });
    expect(diff.counterSettingsPatch).toBeNull();
  });
});

describe("summarizeDiff", () => {
  it("includes counts in output", () => {
    const diff = computeConfigDiff({
      config: minimalConfig,
      existingGoals: [],
      existingFilters: [],
    });
    const summary = summarizeDiff(diff);
    expect(summary).toContain("Goals:");
    expect(summary).toContain("create=1");
    expect(summary).toContain("Purchase");
    expect(summary).toContain("Legal entity");
  });

  it("substitutes <built-in / без имени> for filters with falsy name", () => {
    const diff = computeConfigDiff({
      config: minimalConfig,
      existingGoals: [],
      existingFilters: [{ id: 67526739, name: "" as unknown as string, attr: "x", type: "equal", value: "y" }],
    });
    const summary = summarizeDiff(diff);
    expect(summary).toContain("<built-in");
  });
});
