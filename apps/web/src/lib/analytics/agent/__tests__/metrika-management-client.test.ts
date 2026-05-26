/**
 * Tests для MetrikaManagementClient.
 * Mock fetch — никаких реальных API-вызовов.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileAuditLogger } from "../audit-logger.ts";
import { MetrikaManagementClient } from "../metrika-management-client.ts";
import { MetrikaAuthError, MetrikaError, MetrikaSafetyError } from "../safety.ts";
import type { MutationSource } from "../types.ts";

const VALID_SOURCE: MutationSource = { kind: "config_apply", runId: "test-run-1" };

function makeClient(options: { fetchImpl: typeof fetch; dryRun?: boolean }) {
  const tmpDir = mkdtempSync(path.join(tmpdir(), "client-test-"));
  const audit = new FileAuditLogger(path.join(tmpDir, "log.jsonl"));
  vi.stubGlobal("fetch", options.fetchImpl);

  const client = new MetrikaManagementClient({
    token: "fake-token",
    counterId: "12345",
    audit,
    rateLimit: { maxPerMinute: 1000 }, // высокий, чтобы не мешать
    ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
  });

  return { client, audit, tmpDir };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("MetrikaManagementClient — constructor validation", () => {
  it("throws if token missing", () => {
    const audit = new FileAuditLogger("/tmp/unused");
    expect(() => new MetrikaManagementClient({ token: "", counterId: "1", audit })).toThrow(MetrikaError);
  });

  it("throws if counterId missing", () => {
    const audit = new FileAuditLogger("/tmp/unused");
    expect(() => new MetrikaManagementClient({ token: "t", counterId: "", audit })).toThrow(MetrikaError);
  });
});

describe("MetrikaManagementClient — read-only operations", () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  it("getCounter() returns parsed counter object", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ counter: { id: 12345, name: "test", site: "test.com", permission: "own" } }),
    })) as unknown as typeof fetch;

    const { client, tmpDir } = makeClient({ fetchImpl });
    cleanup = () => rmSync(tmpDir, { recursive: true, force: true });

    const counter = await client.getCounter();
    expect(counter.name).toBe("test");
    expect(counter.permission).toBe("own");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("listGoals() returns goals array", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 200,
      ok: true,
      text: async () =>
        JSON.stringify({
          goals: [{ id: 1, name: "Purchase", type: "action", conditions: [] }],
        }),
    })) as unknown as typeof fetch;

    const { client, tmpDir } = makeClient({ fetchImpl });
    cleanup = () => rmSync(tmpDir, { recursive: true, force: true });

    const goals = await client.listGoals();
    expect(goals).toHaveLength(1);
    expect(goals[0]!.name).toBe("Purchase");
  });
});

describe("MetrikaManagementClient — mutating operations", () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  it("createGoal() throws without MutationSource (FR-396 enforcement)", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const { client, tmpDir } = makeClient({ fetchImpl });
    cleanup = () => rmSync(tmpDir, { recursive: true, force: true });

    await expect(
      // @ts-expect-error — намеренно вызываем без source для тестирования runtime-check
      client.createGoal({ name: "x", type: "action", businessMeaning: "", owner: "" }, undefined),
    ).rejects.toBeInstanceOf(MetrikaSafetyError);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("createGoal() succeeds с valid source + audit-log contains proposalId", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ goal: { id: 999 } }),
    })) as unknown as typeof fetch;

    const { client, audit, tmpDir } = makeClient({ fetchImpl });
    cleanup = () => rmSync(tmpDir, { recursive: true, force: true });

    const source: MutationSource = { kind: "proposal", proposalId: "p-abc" };
    const result = await client.createGoal(
      {
        name: "Test",
        type: "action",
        conditions: [{ type: "exact", url: "test" }],
        businessMeaning: "",
        owner: "",
      },
      source,
    );

    expect(result.id).toBe(999);
    const entries = audit.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.proposalId).toBe("p-abc");
    expect(entries[0]!.method).toBe("POST");
  });

  it("hardDeleteGoal() throws без confirmationFlag (FR-391)", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const { client, tmpDir } = makeClient({ fetchImpl });
    cleanup = () => rmSync(tmpDir, { recursive: true, force: true });

    await expect(
      client.hardDeleteGoal(123, { kind: "proposal", proposalId: "p-1" }),
    ).rejects.toBeInstanceOf(MetrikaSafetyError);

    // Тоже с config_apply (не proposal)
    await expect(
      client.hardDeleteGoal(123, VALID_SOURCE),
    ).rejects.toBeInstanceOf(MetrikaSafetyError);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("hardDeleteGoal() succeeds с confirmationFlag", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 200,
      ok: true,
      text: async () => "{}",
    })) as unknown as typeof fetch;

    const { client, tmpDir } = makeClient({ fetchImpl });
    cleanup = () => rmSync(tmpDir, { recursive: true, force: true });

    await expect(
      client.hardDeleteGoal(123, {
        kind: "proposal",
        proposalId: "p-1",
        confirmationFlag: true,
      }),
    ).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe("MetrikaManagementClient — dry-run mode", () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  it("dry-run NOT calls fetch для mutating-operations", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const { client, audit, tmpDir } = makeClient({ fetchImpl, dryRun: true });
    cleanup = () => rmSync(tmpDir, { recursive: true, force: true });

    await client.createGoal(
      { name: "X", type: "action", businessMeaning: "", owner: "" },
      VALID_SOURCE,
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    // НО audit-log записал dry-run entry
    expect(audit.getEntries()).toHaveLength(1);
    expect(audit.getEntries()[0]!.responseBodySummary).toContain("dry-run");
  });

  it("dry-run STILL calls fetch для read-only operations", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ goals: [] }),
    })) as unknown as typeof fetch;
    const { client, tmpDir } = makeClient({ fetchImpl, dryRun: true });
    cleanup = () => rmSync(tmpDir, { recursive: true, force: true });

    await client.listGoals();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe("MetrikaManagementClient — error handling", () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  it("throws MetrikaAuthError on 401", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 401,
      ok: false,
      text: async () => "unauthorized",
    })) as unknown as typeof fetch;

    const { client, tmpDir } = makeClient({ fetchImpl });
    cleanup = () => rmSync(tmpDir, { recursive: true, force: true });

    await expect(client.listGoals()).rejects.toBeInstanceOf(MetrikaAuthError);
  });

  it("throws MetrikaAuthError on 403", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 403,
      ok: false,
      text: async () => "forbidden",
    })) as unknown as typeof fetch;

    const { client, tmpDir } = makeClient({ fetchImpl });
    cleanup = () => rmSync(tmpDir, { recursive: true, force: true });

    await expect(client.listGoals()).rejects.toBeInstanceOf(MetrikaAuthError);
  });

  it("records audit-log even on failure", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 500,
      ok: false,
      text: async () => "server error",
    })) as unknown as typeof fetch;

    const { client, audit, tmpDir } = makeClient({ fetchImpl });
    cleanup = () => rmSync(tmpDir, { recursive: true, force: true });

    await expect(client.listGoals()).rejects.toBeInstanceOf(MetrikaError);

    const entries = audit.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.responseStatus).toBe(500);
    expect(entries[0]!.errorMessage).toBeDefined();
  });
});

describe("MetrikaManagementClient — FR-396 invariant via audit", () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  it("каждая mutating-операция через клиент пишет audit с source", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ goal: { id: 1 }, filter: { id: 1 } }),
    })) as unknown as typeof fetch;

    const { client, audit, tmpDir } = makeClient({ fetchImpl });
    cleanup = () => rmSync(tmpDir, { recursive: true, force: true });

    // 3 mutating + 1 read
    await client.createGoal({ name: "G1", type: "action", businessMeaning: "", owner: "" }, VALID_SOURCE);
    await client.updateGoal(1, { name: "G1-new" }, VALID_SOURCE);
    await client.createFilter(
      { name: "F1", attr: "x", type: "equal", value: "y", businessMeaning: "" },
      VALID_SOURCE,
    );
    await client.listGoals();

    const result = await audit.validateInvariant();
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});
