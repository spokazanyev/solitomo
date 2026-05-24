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
 */

import { getPayload } from "payload";
import configPromise from "@payload-config";

import { hardDelete, updateCart } from "./repository";

const ABANDONMENT_DELAY_MIN = Number(process.env.CART_ABANDONMENT_DELAY_MIN ?? 60);
const EXPIRY_DAYS = Number(process.env.CART_EXPIRY_DAYS ?? 30);
const HARD_DELETE_DAYS = Number(process.env.CART_HARD_DELETE_DAYS ?? 90);

export interface CartsCleanupResult {
  abandoned: number;
  expired: number;
  hardDeleted: number;
  errors: number;
}

export async function runCartsCleanup(): Promise<CartsCleanupResult> {
  const payload = await getPayload({ config: configPromise });
  const now = Date.now();

  const abandonmentThreshold = new Date(now - ABANDONMENT_DELAY_MIN * 60 * 1000).toISOString();
  const expiryThreshold = new Date(now - EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const hardDeleteThreshold = new Date(now - HARD_DELETE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let abandoned = 0;
  let expired = 0;
  let hardDeleted = 0;
  let errors = 0;

  // ── 1. active → abandoned ───────────────────────────────────────────────────
  try {
    const result = await payload.find({
      collection: "carts" as never,
      where: {
        and: [
          { status: { equals: "active" } },
          { lastActivityAt: { less_than: abandonmentThreshold } },
        ],
      },
      limit: 500,
    });
    for (const doc of result.docs as unknown as Array<{ id: string }>) {
      try {
        await updateCart(payload, String(doc.id), {
          status: "abandoned",
          abandonedAt: new Date().toISOString(),
        });
        abandoned++;
      } catch (err) {
        errors++;
        // eslint-disable-next-line no-console
        console.error("[carts-cleanup] abandon failed:", doc.id, err);
      }
    }
  } catch (err) {
    errors++;
    // eslint-disable-next-line no-console
    console.error("[carts-cleanup] abandonment query failed:", err);
  }

  // ── 2. active|abandoned → expired ───────────────────────────────────────────
  try {
    const result = await payload.find({
      collection: "carts" as never,
      where: {
        and: [
          { status: { in: ["active", "abandoned"] } },
          { lastActivityAt: { less_than: expiryThreshold } },
        ],
      },
      limit: 500,
    });
    for (const doc of result.docs as unknown as Array<{ id: string }>) {
      try {
        await updateCart(payload, String(doc.id), { status: "expired" });
        expired++;
      } catch (err) {
        errors++;
        // eslint-disable-next-line no-console
        console.error("[carts-cleanup] expire failed:", doc.id, err);
      }
    }
  } catch (err) {
    errors++;
    // eslint-disable-next-line no-console
    console.error("[carts-cleanup] expiry query failed:", err);
  }

  // ── 3. expired → hard delete (GDPR) ─────────────────────────────────────────
  try {
    const result = await payload.find({
      collection: "carts" as never,
      where: {
        and: [
          { status: { equals: "expired" } },
          { lastActivityAt: { less_than: hardDeleteThreshold } },
        ],
      },
      limit: 200,
    });
    for (const doc of result.docs as unknown as Array<{ id: string }>) {
      try {
        await hardDelete(payload, String(doc.id));
        hardDeleted++;
      } catch (err) {
        errors++;
        // eslint-disable-next-line no-console
        console.error("[carts-cleanup] hard-delete failed:", doc.id, err);
      }
    }
  } catch (err) {
    errors++;
    // eslint-disable-next-line no-console
    console.error("[carts-cleanup] hard-delete query failed:", err);
  }

  return { abandoned, expired, hardDeleted, errors };
}
