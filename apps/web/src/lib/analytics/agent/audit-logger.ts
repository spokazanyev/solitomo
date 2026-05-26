/**
 * Audit logger для FR-375. Запись каждого вызова Metrika API в AgentExecutionLog.
 *
 * Поддерживает два режима:
 * - In-memory (для CLI / tests без Payload context) — пишет в JSONL-файл на диск
 * - Payload-mode (для admin operations) — пишет в коллекцию `agent-execution-log`
 *
 * FR-396 invariant: каждая mutating-запись имеет ровно один из источников:
 * proposalId | configApplyRunId | manual_admin.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import type { MutationSource } from "./types.ts";

export interface AuditLogEntry {
  timestamp: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  requestParams?: Record<string, unknown>;
  responseStatus: number;
  responseBodySummary?: string;
  durationMs: number;
  errorMessage?: string;
  proposalId?: string;
  configApplyRunId?: string;
  evaluatorName?: string;
  manualAdminUserId?: string;
  userAgent: string;
  source?: MutationSource; // для mutating; undefined для read-only
}

export interface AuditLogger {
  log(entry: AuditLogEntry): Promise<void>;
  /**
   * FR-396 invariant check.
   * Возвращает true если все mutating-записи имеют легитимный source.
   */
  validateInvariant(): Promise<{ valid: boolean; violations: AuditLogEntry[] }>;
}

/**
 * In-memory + JSONL-file logger. Используется в CLI-скриптах (apply-config etc.).
 *
 * Файл: `06-reports/analytics/agent-execution-log.jsonl` (git-ignored,
 * для local debug + grep-friendly audit).
 */
export class FileAuditLogger implements AuditLogger {
  private readonly entries: AuditLogEntry[] = [];
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async log(entry: AuditLogEntry): Promise<void> {
    this.entries.push(entry);

    // Append JSONL — без блокировок, file append safe для single-process
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(this.filePath, JSON.stringify(entry) + "\n", "utf-8");
  }

  /**
   * FR-396: каждая mutating-запись (POST/PUT/PATCH/DELETE) должна иметь
   * proposalId ИЛИ configApplyRunId ИЛИ manualAdminUserId.
   */
  async validateInvariant(): Promise<{ valid: boolean; violations: AuditLogEntry[] }> {
    const violations = this.entries.filter((e) => {
      const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(e.method);
      if (!isMutating) return false;
      const hasSource = e.proposalId || e.configApplyRunId || e.manualAdminUserId;
      return !hasSource;
    });

    return { valid: violations.length === 0, violations };
  }

  /**
   * Test-only: in-memory entries
   */
  getEntries(): readonly AuditLogEntry[] {
    return this.entries;
  }
}

/**
 * Helper: build entry from common params + MutationSource.
 */
export function buildAuditEntry(args: {
  endpoint: string;
  method: AuditLogEntry["method"];
  requestParams?: Record<string, unknown>;
  responseStatus: number;
  durationMs: number;
  errorMessage?: string;
  source?: MutationSource;
  evaluatorName?: string;
  userAgent: string;
  responseBodySummary?: string;
}): AuditLogEntry {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    endpoint: args.endpoint,
    method: args.method,
    responseStatus: args.responseStatus,
    durationMs: args.durationMs,
    userAgent: args.userAgent,
  };
  if (args.requestParams !== undefined) entry.requestParams = args.requestParams;
  if (args.errorMessage !== undefined) entry.errorMessage = args.errorMessage;
  if (args.evaluatorName !== undefined) entry.evaluatorName = args.evaluatorName;
  if (args.responseBodySummary !== undefined) entry.responseBodySummary = args.responseBodySummary;

  if (args.source) {
    entry.source = args.source;
    if (args.source.kind === "proposal") entry.proposalId = args.source.proposalId;
    else if (args.source.kind === "config_apply") entry.configApplyRunId = args.source.runId;
    else if (args.source.kind === "manual_admin") entry.manualAdminUserId = args.source.adminUserId;
  }

  return entry;
}
