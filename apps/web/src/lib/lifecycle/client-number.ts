import "server-only";

/**
 * Atomic client-number generator for orders.
 *
 * Uses PG SEQUENCE (per-year) for gap-free, concurrent-safe numbering.
 * Format: SO-YYYY-NNNN (padStart to 4 digits, no padding at n ≥ 10000).
 *
 * Source: specs/051-order-numbering-and-immutability
 * Contracts: specs/051-order-numbering-and-immutability/contracts/clientNumber-generator.ts
 * FR-5101, FR-5103.
 */

import { sql } from "@payloadcms/db-postgres";
import type { Payload } from "payload";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface GenerateClientNumberOptions {
  /**
   * Logical "now". Defaults to `new Date()`.
   * Used only to determine the year component.
   */
  now?: Date;
  /**
   * Prefix — fixed as "SO" in MVP. Left extensible for future b2b/b2c split.
   */
  prefix?: string;
  /**
   * Max retries on unique-constraint collision (sequence ↔ table desync guard).
   * Defaults to 3.
   */
  maxRetries?: number;
}

export interface ClientNumberResult {
  /** Ready-to-use number, e.g. "SO-2026-0142". */
  clientNumber: string;
  /** Raw sequence counter, e.g. 142. */
  sequenceValue: number;
  /** Year component. */
  year: number;
  /** PG sequence name used. */
  sequenceName: string;
}

// ─── Pure helpers (exported for tests + backfill) ─────────────────────────────

/**
 * Extract year in the given TZ. Default: Europe/Moscow.
 * Exported for tests and the backfill script so the year component is consistent.
 */
export function getBusinessYear(date: Date, tz: string = "Europe/Moscow"): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
    }).format(date),
  );
}

/** @deprecated Use getBusinessYear instead */
export const getMoscowYear = (date: Date): number => getBusinessYear(date, "Europe/Moscow");

/**
 * Format sequence counter to N-digit representation with auto-expansion.
 *
 * formatSequence(1)     === "0001"
 * formatSequence(142)   === "0142"
 * formatSequence(9999)  === "9999"
 * formatSequence(10000) === "10000"  // FR-5103
 */
export function formatSequence(n: number): string {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Invalid sequence value: ${n}`);
  }
  return n < 10000 ? String(n).padStart(4, "0") : String(n);
}

/**
 * PG sequence name for a given year.
 *
 * sequenceNameFor(2026) === "order_seq_2026"
 */
export function sequenceNameFor(year: number): string {
  return `order_seq_${year}`;
}

/**
 * Regex for validating clientNumber format.
 * Used in tests and in the reissue-guard hook.
 */
export const CLIENT_NUMBER_REGEX = /^SO-\d{4}-\d{4,}$/;

// ─── Sequence cache (M6: avoid repeated CREATE SEQUENCE IF NOT EXISTS) ────────

const knownSequences = new Set<string>();

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * Generate the next clientNumber atomically via PG SEQUENCE.
 *
 * Must be called within a Payload context (payload.db.drizzle available).
 * Lazy-creates the sequence for the year if it doesn't exist (C5).
 * Retries on unique-constraint collision up to maxRetries times with jitter (H6).
 *
 * @throws {Error} if unable to generate after maxRetries.
 */
export async function generateClientNumber(
  payload: Payload,
  options: GenerateClientNumberOptions = {},
): Promise<ClientNumberResult> {
  const prefix = options.prefix ?? "SO";
  const maxRetries = options.maxRetries ?? 3;
  const now = options.now ?? new Date();
  const year = getBusinessYear(now);

  // Guard against non-integer or unreasonable year values (H4: SQL injection prevention)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Invalid business year: ${year}. Expected integer between 2000 and 2100.`);
  }

  const seqName = sequenceNameFor(year);

  // Access the drizzle instance from Payload's postgres adapter
  const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> } }).drizzle;

  // Lazy-create sequence (idempotent via IF NOT EXISTS, cached in-memory)
  if (!knownSequences.has(seqName)) {
    await db.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS ${seqName} START 1`));
    knownSequences.add(seqName);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Atomic nextval — PG guarantees unique values across concurrent calls
      const result = await db.execute(sql.raw(`SELECT nextval('${seqName}') AS seq`));
      const seqValue = Number(result.rows[0]?.seq);

      if (!seqValue || seqValue < 1) {
        throw new Error(`Invalid sequence value from ${seqName}: ${seqValue}`);
      }

      const clientNumber = `${prefix}-${year}-${formatSequence(seqValue)}`;

      return {
        clientNumber,
        sequenceValue: seqValue,
        year,
        sequenceName: seqName,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Only retry on unique constraint violations (23505 = unique_violation in PG)
      const pgCode = (err as { code?: string })?.code;
      if (pgCode !== "23505") {
        throw lastError;
      }

      // Jitter before retry: 10-50ms random delay
      const jitter = 10 + Math.random() * 40;
      await new Promise((resolve) => setTimeout(resolve, jitter));

      // eslint-disable-next-line no-console
      console.warn(
        `[client-number] Retry ${attempt + 1}/${maxRetries} after unique constraint collision on ${seqName}`,
      );
    }
  }

  // All retries exhausted
  // eslint-disable-next-line no-console
  console.error(
    `[client-number] OrderNumberGenerationFailed: exhausted ${maxRetries} retries for ${seqName}`,
  );
  throw lastError ?? new Error(`Failed to generate client number after ${maxRetries} retries`);
}
