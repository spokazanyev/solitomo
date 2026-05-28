/**
 * Tests for FileAuditLogger + FR-396 invariant validator.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildAuditEntry, FileAuditLogger } from "../audit-logger.ts";
import type { MutationSource } from "../types.ts";

describe("FileAuditLogger", () => {
  let tmpDir: string;
  let logPath: string;
  let logger: FileAuditLogger;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "audit-test-"));
    logPath = path.join(tmpDir, "agent-execution-log.jsonl");
    logger = new FileAuditLogger(logPath);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("appends entries to JSONL file", async () => {
    await logger.log(
      buildAuditEntry({
        endpoint: "/counter/123",
        method: "GET",
        responseStatus: 200,
        durationMs: 100,
        userAgent: "Soliton-AnalyticsAgent/1.0",
      }),
    );
    await logger.log(
      buildAuditEntry({
        endpoint: "/counter/123/goals",
        method: "GET",
        responseStatus: 200,
        durationMs: 150,
        userAgent: "Soliton-AnalyticsAgent/1.0",
      }),
    );

    const content = readFileSync(logPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);

    const e0 = JSON.parse(lines[0]!);
    expect(e0.endpoint).toBe("/counter/123");
    expect(e0.method).toBe("GET");
    expect(e0.userAgent).toMatch(/^Soliton-AnalyticsAgent\//);
  });

  it("preserves entries in-memory for testing", async () => {
    await logger.log(
      buildAuditEntry({
        endpoint: "/x",
        method: "GET",
        responseStatus: 200,
        durationMs: 1,
        userAgent: "Soliton-AnalyticsAgent/1.0",
      }),
    );
    expect(logger.getEntries()).toHaveLength(1);
  });
});

describe("FR-396 invariant validator", () => {
  let tmpDir: string;
  let logger: FileAuditLogger;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "audit-inv-"));
    logger = new FileAuditLogger(path.join(tmpDir, "log.jsonl"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("passes when all mutating calls have source", async () => {
    const source: MutationSource = { kind: "config_apply", runId: "r-1" };
    await logger.log(
      buildAuditEntry({
        endpoint: "/counter/1/goals",
        method: "POST",
        responseStatus: 200,
        durationMs: 50,
        userAgent: "Soliton-AnalyticsAgent/1.0",
        source,
      }),
    );

    const result = await logger.validateInvariant();
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("passes when all calls are read-only (no source needed)", async () => {
    await logger.log(
      buildAuditEntry({
        endpoint: "/counter/1",
        method: "GET",
        responseStatus: 200,
        durationMs: 50,
        userAgent: "Soliton-AnalyticsAgent/1.0",
      }),
    );

    const result = await logger.validateInvariant();
    expect(result.valid).toBe(true);
  });

  it("FAILS when mutating call missing source (FR-396 violation)", async () => {
    // Симулируем violation — создаём entry напрямую без source
    await logger.log({
      timestamp: new Date().toISOString(),
      endpoint: "/counter/1/goals",
      method: "POST",
      responseStatus: 200,
      durationMs: 50,
      userAgent: "Soliton-AnalyticsAgent/1.0",
      // НЕТ proposalId, configApplyRunId, manualAdminUserId — violation
    });

    const result = await logger.validateInvariant();
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]!.method).toBe("POST");
  });

  it("classifies all mutating methods (POST/PUT/PATCH/DELETE)", async () => {
    const ts = new Date().toISOString();
    const ua = "Soliton-AnalyticsAgent/1.0";

    // Безымянные mutating calls — должны быть отловлены
    await logger.log({ timestamp: ts, endpoint: "/x", method: "POST", responseStatus: 200, durationMs: 1, userAgent: ua });
    await logger.log({ timestamp: ts, endpoint: "/y", method: "PUT", responseStatus: 200, durationMs: 1, userAgent: ua });
    await logger.log({ timestamp: ts, endpoint: "/z", method: "PATCH", responseStatus: 200, durationMs: 1, userAgent: ua });
    await logger.log({ timestamp: ts, endpoint: "/w", method: "DELETE", responseStatus: 200, durationMs: 1, userAgent: ua });

    // GET с пустым source — НЕ violation
    await logger.log({ timestamp: ts, endpoint: "/r", method: "GET", responseStatus: 200, durationMs: 1, userAgent: ua });

    const result = await logger.validateInvariant();
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(4); // POST/PUT/PATCH/DELETE
  });
});

describe("buildAuditEntry", () => {
  it("sets proposalId from proposal-source", () => {
    const entry = buildAuditEntry({
      endpoint: "/x",
      method: "POST",
      responseStatus: 200,
      durationMs: 10,
      userAgent: "Soliton-AnalyticsAgent/1.0",
      source: { kind: "proposal", proposalId: "prop-99" },
    });
    expect(entry.proposalId).toBe("prop-99");
    expect(entry.configApplyRunId).toBeUndefined();
  });

  it("sets configApplyRunId from config_apply-source", () => {
    const entry = buildAuditEntry({
      endpoint: "/x",
      method: "POST",
      responseStatus: 200,
      durationMs: 10,
      userAgent: "Soliton-AnalyticsAgent/1.0",
      source: { kind: "config_apply", runId: "run-42" },
    });
    expect(entry.configApplyRunId).toBe("run-42");
    expect(entry.proposalId).toBeUndefined();
  });

  it("omits source fields for read-only call", () => {
    const entry = buildAuditEntry({
      endpoint: "/x",
      method: "GET",
      responseStatus: 200,
      durationMs: 10,
      userAgent: "Soliton-AnalyticsAgent/1.0",
    });
    expect(entry.proposalId).toBeUndefined();
    expect(entry.configApplyRunId).toBeUndefined();
    expect(entry.source).toBeUndefined();
  });
});
