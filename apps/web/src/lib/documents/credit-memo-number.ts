import "server-only";

/**
 * Atomic credit-memo number generator (053 FR-5324, US5).
 *
 * Format: CM-YYYY-NNNN (mirrors RT/SO pattern from 051/053).
 * Per-year Postgres SEQUENCE. Used for legal-entity returns where a
 * корректировочный счёт-фактура (КСФ) is required by НК РФ ст. 169.
 */

import { sql } from "@payloadcms/db-postgres";
import type { Payload } from "payload";

import { getBusinessYear, formatSequence } from "../lifecycle/client-number";

export const CREDIT_MEMO_REGEX = /^CM-\d{4}-\d{4,}$/;

export function creditMemoSequenceNameFor(year: number): string {
  // M2 fix: defensive year validation before SQL interpolation
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Invalid year for sequence name: ${year}`);
  }
  return `credit_memos_seq_${year}`;
}

export interface CreditMemoNumberResult {
  creditMemoNumber: string;
  sequenceValue: number;
  year: number;
}

export async function generateCreditMemoNumber(
  payload: Payload,
  now: Date = new Date(),
): Promise<CreditMemoNumberResult> {
  const year = getBusinessYear(now);
  const seqName = creditMemoSequenceNameFor(year);

  const db = (payload.db as unknown as {
    drizzle: { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> };
  }).drizzle;

  await db.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS ${seqName} START 1`));
  const result = await db.execute(sql.raw(`SELECT nextval('${seqName}') AS seq`));
  const seqValue = Number(result.rows[0]?.seq);

  if (!seqValue || seqValue < 1) {
    throw new Error(`Invalid sequence value from ${seqName}: ${seqValue}`);
  }

  return {
    creditMemoNumber: `CM-${year}-${formatSequence(seqValue)}`,
    sequenceValue: seqValue,
    year,
  };
}
