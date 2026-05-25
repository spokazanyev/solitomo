import "server-only";

import { getPayload } from "payload";
import configPromise from "@payload-config";

import { emitDomainEvent } from "./events";
import { buildOrderSnapshot } from "./order-snapshot";
import { loadSettings } from "../shipping/apiship/settings";

export interface ClosureResult {
  scanned: number;
  closed: number;
  skipped: number;
  errors: number;
}

/**
 * Cron-задача: переводит заказы из `delivered` в `completed` после closureWindowDays
 * при отсутствии disputeFlag. FR-903, FR-904.
 */
export async function runClosureCron(): Promise<ClosureResult> {
  const settings = await loadSettings();
  const windowDays = settings.lifecycle.closureWindowDays;
  const threshold = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const p = await getPayload({ config: configPromise });

  let scanned = 0;
  let closed = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const result = await p.find({
      collection: "orders",
      where: {
        and: [
          { status: { equals: "delivered" } },
          {
            or: [
              { deliveredAt: { less_than: threshold } },
              { updatedAt: { less_than: threshold } },
            ],
          },
          { disputeFlag: { not_equals: true } },
        ],
      },
      limit: 100,
    });

    scanned = result.docs.length;

    for (const doc of result.docs as unknown as Array<Record<string, unknown>>) {
      try {
        if (doc.disputeFlag === true) {
          skipped++;
          continue;
        }
        const updated = await p.update({
          collection: "orders",
          id: String(doc.id),
          data: {
            status: "completed",
            closedAt: new Date().toISOString(),
          },
        });
        const snapshot = buildOrderSnapshot(updated as unknown as Record<string, unknown>);
        await emitDomainEvent({
          kind: "order.completed",
          order: snapshot,
          context: { statusFrom: "delivered", statusTo: "completed" },
        });
        closed++;
      } catch (err) {
        errors++;
        // eslint-disable-next-line no-console
        console.error("[closure] failed to close order", doc.id, err);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[closure] cron error", err);
    errors++;
  }

  return { scanned, closed, skipped, errors };
}

/**
 * Cron-задача: переводит заказы из `pending_payment` / `awaiting_payment` в `expired`
 * после paymentRetryWindowMin / invoiceExpiresDays.
 */
export async function runExpireCron(): Promise<{ expired: number; errors: number }> {
  const settings = await loadSettings();
  const p = await getPayload({ config: configPromise });
  const now = Date.now();
  const pendingThreshold = new Date(now - settings.lifecycle.paymentRetryWindowMin * 60 * 1000).toISOString();
  const invoiceThreshold = new Date(now - settings.lifecycle.invoiceExpiresDays * 24 * 60 * 60 * 1000).toISOString();

  let expired = 0;
  let errors = 0;

  try {
    const pending = await p.find({
      collection: "orders",
      where: {
        and: [
          { status: { equals: "pending_payment" } },
          {
            or: [
              { paymentRetryUntil: { less_than: new Date().toISOString() } },
              { updatedAt: { less_than: pendingThreshold } },
            ],
          },
        ],
      },
      limit: 100,
    });
    for (const doc of pending.docs as unknown as Array<Record<string, unknown>>) {
      try {
        const updated = await p.update({
          collection: "orders",
          id: String(doc.id),
          data: { status: "expired" },
        });
        const snapshot = buildOrderSnapshot(updated as unknown as Record<string, unknown>);
        await emitDomainEvent({
          kind: "order.expired",
          order: snapshot,
          context: { statusFrom: "pending_payment", statusTo: "expired" },
        });
        expired++;
      } catch {
        errors++;
      }
    }

    const invoices = await p.find({
      collection: "orders",
      where: {
        and: [
          { status: { equals: "awaiting_payment" } },
          { updatedAt: { less_than: invoiceThreshold } },
        ],
      },
      limit: 100,
    });
    for (const doc of invoices.docs as unknown as Array<Record<string, unknown>>) {
      try {
        const updated = await p.update({
          collection: "orders",
          id: String(doc.id),
          data: { status: "expired" },
        });
        const snapshot = buildOrderSnapshot(updated as unknown as Record<string, unknown>);
        await emitDomainEvent({
          kind: "order.expired",
          order: snapshot,
          context: { statusFrom: "awaiting_payment", statusTo: "expired" },
        });
        expired++;
      } catch {
        errors++;
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[expire] cron error", err);
    errors++;
  }

  return { expired, errors };
}
