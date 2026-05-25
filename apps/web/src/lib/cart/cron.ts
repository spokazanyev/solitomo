import "server-only";

/**
 * Cart cleanup cron (052 FR-5224, FR-5225, T022).
 *
 * Three sweeps:
 *  1. active → abandoned    (lastActivityAt < now - abandonmentDelayMin, default 60min)
 *  2. active|abandoned → expired (lastActivityAt < now - expiryDays, default 30d)
 *  3. expired hard-delete    (lastActivityAt < now - hardDeleteDays, default 90d)
 *
 * Each transition fires a domain event via the carts collection afterChange hook,
 * which 049's notification subscriber picks up to enqueue T-010 (cart abandoned email).
 *
 * H4 fix: Postgres advisory lock prevents overlapping invocations; iterates with
 * `hasMore` until all eligible carts are processed (capped by MAX_ITERATIONS).
 *
 * M7 fix: per-iteration carts processed in concurrency-limited Promise.all batches
 * so subscriber fan-out doesn't sequentially block on n×3 DB writes.
 */

import { sql } from "@payloadcms/db-postgres";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { hardDelete, updateCart } from "./repository";

const ABANDONMENT_DELAY_MIN = Number(process.env.CART_ABANDONMENT_DELAY_MIN ?? 60);
const EXPIRY_DAYS = Number(process.env.CART_EXPIRY_DAYS ?? 30);
const HARD_DELETE_DAYS = Number(process.env.CART_HARD_DELETE_DAYS ?? 90);

const BATCH_SIZE = 100;
const MAX_ITERATIONS = 100; // hard cap: 100 × 100 = 10 000 carts/run
const CONCURRENCY = 10;

// Advisory lock key — stable 32-bit int unique to this cron type.
// Chosen as a memorable number; never collides with PG internal lock IDs (those use higher bits).
const ADVISORY_LOCK_KEY_NUM = 52_5272_72;

export interface CartsCleanupResult {
  abandoned: number;
  expired: number;
  hardDeleted: number;
  errors: number;
  iterations: number;
  hasMore: boolean;
  /** True if another run already held the advisory lock and this run was skipped. */
  skipped?: boolean;
}

interface DrizzleResult {
  rows?: Array<Record<string, unknown>>;
  [index: number]: Record<string, unknown>;
}

async function tryAcquireLock(payload: import("payload").Payload): Promise<boolean> {
  const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<DrizzleResult> } }).drizzle;
  const result = await db.execute(sql.raw(`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY_NUM}) AS locked`));
  const row = (result.rows?.[0] ?? (result as unknown as Record<string, unknown>[])[0]) as
    | { locked?: boolean }
    | undefined;
  return Boolean(row?.locked);
}

async function releaseLock(payload: import("payload").Payload): Promise<void> {
  const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<DrizzleResult> } }).drizzle;
  try {
    await db.execute(sql.raw(`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY_NUM})`));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[carts-cleanup] advisory_unlock failed:", err);
  }
}

/** Run an async fn over items with bounded concurrency (M7). */
async function processBatch<T>(
  items: readonly T[],
  fn: (item: T) => Promise<void>,
  concurrency: number = CONCURRENCY,
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        await fn(items[idx]!);
        ok++;
      } catch (err) {
        failed++;
        // eslint-disable-next-line no-console
        console.error("[carts-cleanup] item failed:", err);
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return { ok, failed };
}

export async function runCartsCleanup(): Promise<CartsCleanupResult> {
  const payload = await getPayload({ config: configPromise });

  // H4: advisory lock — refuse overlapping runs
  const acquired = await tryAcquireLock(payload);
  if (!acquired) {
    return {
      abandoned: 0,
      expired: 0,
      hardDeleted: 0,
      errors: 0,
      iterations: 0,
      hasMore: false,
      skipped: true,
    };
  }

  let abandoned = 0;
  let expired = 0;
  let hardDeleted = 0;
  let errors = 0;
  let iterations = 0;
  let hasMore = false;

  try {
    const now = Date.now();
    const abandonmentThreshold = new Date(now - ABANDONMENT_DELAY_MIN * 60 * 1000).toISOString();
    const expiryThreshold = new Date(now - EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const hardDeleteThreshold = new Date(now - HARD_DELETE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // ── 1. active → abandoned ─────────────────────────────────────────────────
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      iterations++;
      const result = await payload.find({
        collection: "carts" as never,
        where: {
          and: [
            { status: { equals: "active" } },
            { lastActivityAt: { less_than: abandonmentThreshold } },
            { synthetic: { not_equals: true } },
          ],
        },
        limit: BATCH_SIZE,
      });
      if (result.docs.length === 0) break;

      const ids = (result.docs as unknown as Array<{ id: string }>).map((d) => String(d.id));
      const { ok, failed } = await processBatch(ids, async (id) => {
        await updateCart(payload, id, {
          status: "abandoned",
          abandonedAt: new Date().toISOString(),
        });
      });
      abandoned += ok;
      errors += failed;

      if (result.docs.length < BATCH_SIZE) break;
      if (i === MAX_ITERATIONS - 1) hasMore = true;
    }

    // ── 2. active|abandoned → expired ─────────────────────────────────────────
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      iterations++;
      const result = await payload.find({
        collection: "carts" as never,
        where: {
          and: [
            { status: { in: ["active", "abandoned"] } },
            { lastActivityAt: { less_than: expiryThreshold } },
          ],
        },
        limit: BATCH_SIZE,
      });
      if (result.docs.length === 0) break;

      const ids = (result.docs as unknown as Array<{ id: string }>).map((d) => String(d.id));
      const { ok, failed } = await processBatch(ids, async (id) => {
        await updateCart(payload, id, { status: "expired" });
      });
      expired += ok;
      errors += failed;

      if (result.docs.length < BATCH_SIZE) break;
      if (i === MAX_ITERATIONS - 1) hasMore = true;
    }

    // ── 3. expired → hard delete (GDPR) ───────────────────────────────────────
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      iterations++;
      const result = await payload.find({
        collection: "carts" as never,
        where: {
          and: [
            { status: { equals: "expired" } },
            { lastActivityAt: { less_than: hardDeleteThreshold } },
          ],
        },
        limit: BATCH_SIZE,
      });
      if (result.docs.length === 0) break;

      const ids = (result.docs as unknown as Array<{ id: string }>).map((d) => String(d.id));
      const { ok, failed } = await processBatch(ids, async (id) => {
        await hardDelete(payload, id);
      });
      hardDeleted += ok;
      errors += failed;

      if (result.docs.length < BATCH_SIZE) break;
      if (i === MAX_ITERATIONS - 1) hasMore = true;
    }
  } catch (err) {
    errors++;
    // eslint-disable-next-line no-console
    console.error("[carts-cleanup] fatal error:", err);
  } finally {
    await releaseLock(payload);
  }

  return { abandoned, expired, hardDeleted, errors, iterations, hasMore };
}
