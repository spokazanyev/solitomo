/**
 * Tests для goal-mapping.md parser/builder/writer.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildGoalMapping, parseGoalMapping, writeGoalMapping } from "../goal-mapping.ts";
import type { MetrikaGoal } from "../types.ts";

const SAMPLE_GOAL: MetrikaGoal = {
  name: "Purchase",
  type: "action",
  conditions: [{ type: "exact", url: "purchase" }],
  isRetargeting: true,
  enabled: true,
  businessMeaning: "Оплата успешна",
  owner: "test@example.com",
};

describe("parseGoalMapping", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "gm-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns [] for non-existent file", async () => {
    const rows = await parseGoalMapping(path.join(tmpDir, "missing.md"));
    expect(rows).toEqual([]);
  });

  it("parses valid table", async () => {
    const file = path.join(tmpDir, "gm.md");
    writeFileSync(
      file,
      `# Goal Mapping

| event_name | metrika_goal_id | ga4_event_name | business_meaning | owner | last_updated |
|---|---|---|---|---|---|
| purchase | 12345 | purchase | Оплата успешна | owner@test.com | 2026-05-26 |
| rfq_submit | 12346 | rfq_submit | RFQ отправлен | owner@test.com | 2026-05-26 |
`,
      "utf-8",
    );

    const rows = await parseGoalMapping(file);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      eventName: "purchase",
      metrikaGoalId: 12345,
      businessMeaning: "Оплата успешна",
    });
    expect(rows[1]!.eventName).toBe("rfq_submit");
  });

  it("handles missing metrika_goal_id as null", async () => {
    const file = path.join(tmpDir, "gm.md");
    writeFileSync(
      file,
      `| event_name | metrika_goal_id | ga4_event_name | business_meaning | owner | last_updated |
|---|---|---|---|---|---|
| purchase | — | purchase | Оплата | o@x | 2026-05-26 |
`,
      "utf-8",
    );
    const rows = await parseGoalMapping(file);
    expect(rows[0]!.metrikaGoalId).toBeNull();
  });
});

describe("buildGoalMapping", () => {
  it("renders rows with merge-preservation", () => {
    const existingRows = [
      {
        eventName: "purchase",
        metrikaGoalId: null,
        ga4EventName: "purchase",
        businessMeaning: "OLD MEANING",
        owner: "old@x.com",
        lastUpdated: "2026-05-01",
      },
    ];

    const md = buildGoalMapping({
      goalsWithIds: [{ goal: SAMPLE_GOAL, metrikaId: 12345 }],
      existingRows,
    });

    expect(md).toContain("| purchase |");
    expect(md).toContain("12345"); // newly assigned ID
    expect(md).toContain(SAMPLE_GOAL.businessMeaning); // config-новый businessMeaning приоритет над existing
  });

  it("includes orphan rows from existing с маркером [ORPHAN]", () => {
    const existingRows = [
      {
        eventName: "old_event",
        metrikaGoalId: 99,
        ga4EventName: "old_event",
        businessMeaning: "Legacy",
        owner: "legacy@x",
        lastUpdated: "2026-04-01",
      },
    ];

    const md = buildGoalMapping({
      goalsWithIds: [{ goal: SAMPLE_GOAL, metrikaId: 12345 }],
      existingRows,
    });

    expect(md).toContain("old_event");
    expect(md).toContain("[ORPHAN]");
  });

  it("preserves owner и ga4_event_name из existing если в config пусто", () => {
    const goalWithEmptyOwner: MetrikaGoal = {
      ...SAMPLE_GOAL,
      owner: "",
    };
    const existingRows = [
      {
        eventName: "purchase",
        metrikaGoalId: null,
        ga4EventName: "purchase_v2",
        businessMeaning: "OLD",
        owner: "preserved@x.com",
        lastUpdated: "2026-04-01",
      },
    ];

    const md = buildGoalMapping({
      goalsWithIds: [{ goal: goalWithEmptyOwner, metrikaId: 7 }],
      existingRows,
    });
    expect(md).toContain("preserved@x.com");
    expect(md).toContain("purchase_v2");
  });

  it("normalizes goal name to event_name (snake_case)", () => {
    const md = buildGoalMapping({
      goalsWithIds: [
        { goal: { ...SAMPLE_GOAL, name: "Add to Cart" }, metrikaId: 1 },
        { goal: { ...SAMPLE_GOAL, name: "RFQ Submit" }, metrikaId: 2 },
      ],
      existingRows: [],
    });
    expect(md).toContain("| add_to_cart |");
    expect(md).toContain("| rfq_submit |");
  });
});

describe("writeGoalMapping (atomic)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "gm-write-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes content atomically to target path", async () => {
    const file = path.join(tmpDir, "out.md");
    await writeGoalMapping(file, "# Test\n");
    expect(readFileSync(file, "utf-8")).toBe("# Test\n");
  });

  it("creates parent directory if missing", async () => {
    const file = path.join(tmpDir, "nested", "dir", "out.md");
    await writeGoalMapping(file, "# X\n");
    expect(readFileSync(file, "utf-8")).toBe("# X\n");
  });

  it("overwrites existing file", async () => {
    const file = path.join(tmpDir, "out.md");
    writeFileSync(file, "OLD\n", "utf-8");
    await writeGoalMapping(file, "NEW\n");
    expect(readFileSync(file, "utf-8")).toBe("NEW\n");
  });
});

describe("round-trip parse → build → parse", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "gm-rt-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("preserves data integrity through round-trip", async () => {
    const file = path.join(tmpDir, "rt.md");

    // 1. Build initial
    const md1 = buildGoalMapping({
      goalsWithIds: [{ goal: SAMPLE_GOAL, metrikaId: 12345 }],
      existingRows: [],
    });
    await writeGoalMapping(file, md1);

    // 2. Parse it back
    const rows = await parseGoalMapping(file);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.eventName).toBe("purchase");
    expect(rows[0]!.metrikaGoalId).toBe(12345);
    expect(rows[0]!.businessMeaning).toBe(SAMPLE_GOAL.businessMeaning);

    // 3. Re-build с тем же data — должно быть стабильно (1 строка с purchase, без orphan-маркера)
    const md2 = buildGoalMapping({
      goalsWithIds: [{ goal: SAMPLE_GOAL, metrikaId: 12345 }],
      existingRows: rows,
    });
    // Считаем строки данных (start с '| purchase |') — должна быть одна
    const purchaseDataRows = md2
      .split("\n")
      .filter((l) => l.trim().startsWith("| purchase |"));
    expect(purchaseDataRows).toHaveLength(1);
    // И эта строка НЕ должна быть orphan (existing был consumed по match)
    expect(purchaseDataRows[0]).not.toContain("[ORPHAN]");
  });
});
