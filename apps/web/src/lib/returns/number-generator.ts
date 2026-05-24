import "server-only";

/**
 * Atomic return-number generator (053 FR-5302).
 *
 * Format: RT-YYYY-NNNN (zero-padded to 4 digits, no padding at n ≥ 10000).
 * Uses per-year Postgres SEQUENCE for gap-free concurrent-safe numbering,
 * mirroring the 051 client-number pattern.
 */

import { sql } from "@payloadcms/db-postgres";
import type { Payload } from "payload";

import { getBusinessYear, formatSequence } from "../lifecycle/client-number";

export interface GenerateReturnNumberOptions {
  now?: Date;
  prefix?: string;
  maxRetries?: number;
}

export interface ReturnNumberResult {
  returnNumber: string;
  sequenceValue: number;
  year: number;
  sequenceName: string;
}

export const RETURN_NUMBER_REGEX = /^RT-\d{4}-\d{4,}$/;

export function returnSequenceNameFor(year: number): string {
  // M2 fix: defensive guard — never interpolate non-numeric content into SQL.
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Invalid year for sequence name: ${year}`);
  }
  return `returns_seq_${year}`;
}

export async function generateReturnNumber(
  payload: Payload,
  options: GenerateReturnNumberOptions = {},
): Promise<ReturnNumberResult> {
  const prefix = options.prefix ?? "RT";
  const maxRetries = options.maxRetries ?? 3;
  const now = options.now ?? new Date();
  const year = getBusinessYear(now);
  const seqName = returnSequenceNameFor(year);

  const db = (payload.db as unknown as {
    drizzle: { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> };
  }).drizzle;

  // Lazy-create sequence (idempotent)
  await db.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS ${seqName} START 1`));

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await db.execute(sql.raw(`SELECT nextval('${seqName}') AS seq`));
      const seqValue = Number(result.rows[0]?.seq);

      if (!seqValue || seqValue < 1) {
        throw new Error(`Invalid sequence value from ${seqName}: ${seqValue}`);
      }

      const returnNumber = `${prefix}-${year}-${formatSequence(seqValue)}`;
      return { returnNumber, sequenceValue: seqValue, year, sequenceName: seqName };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const pgCode = (err as { code?: string })?.code;
      if (pgCode !== "23505") throw lastError;

      const jitter = 10 + Math.random() * 40;
      await new Promise((resolve) => setTimeout(resolve, jitter));
      // eslint-disable-next-line no-console
      console.warn(
        `[return-number] Retry ${attempt + 1}/${maxRetries} on ${seqName}`,
      );
    }
  }

  // eslint-disable-next-line no-console
  console.error(
    `[return-number] ReturnNumberGenerationFailed: exhausted ${maxRetries} retries`,
  );
  throw lastError ?? new Error(`Failed to generate return number after ${maxRetries} retries`);
}
