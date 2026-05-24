/**
 * GET/POST /api/cron/stuck-alerts
 *
 * Каждые 6 часов (FR-4931): находит заказы, чей статус не меняется дольше
 * `apiShipSettings.lifecycle.stuckThresholdHours` для соответствующего статуса,
 * и эмитит доменное событие `order.stuck`. Подписчик 049 создаст T-104
 * (manager email) автоматически.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { emitDomainEvent } from "@/lib/lifecycle/events";
import { buildOrderSnapshot } from "@/lib/lifecycle/order-snapshot";
import { logError, logInfo } from "@/lib/notifications/logger";
import { loadSettings as loadApiShipSettings } from "@/lib/shipping/apiship/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

const STATUSES_TO_CHECK = ["paid", "fulfilling", "shipped", "delivered"] as const;
type CheckedStatus = (typeof STATUSES_TO_CHECK)[number];

function thresholdHours(status: CheckedStatus, cfg: Record<string, number | undefined>): number {
  if (status === "paid") return cfg.paid ?? 48;
  if (status === "fulfilling") return cfg.fulfilling ?? 48;
  if (status === "shipped") return cfg.shipped ?? 72;
  // delivered → at_point threshold (используем как обобщающий)
  return cfg.atPoint ?? 96;
}

async function run() {
  const apiShipSettings = await loadApiShipSettings();
  const stuckCfg = (apiShipSettings.lifecycle.stuckThresholdHours ?? {}) as Record<string, number | undefined>;
  const p = await getPayload({ config: configPromise });
  const now = Date.now();

  let scanned = 0;
  let emitted = 0;
  let errors = 0;

  for (const status of STATUSES_TO_CHECK) {
    const hours = thresholdHours(status, stuckCfg);
    const threshold = new Date(now - hours * 60 * 60 * 1000).toISOString();
    try {
      const result = await p.find({
        collection: "orders",
        where: {
          and: [
            { status: { equals: status } },
            { updatedAt: { less_than: threshold } },
          ],
        },
        limit: 50,
      });
      for (const doc of result.docs as unknown as Array<Record<string, unknown>>) {
        scanned++;
        try {
          const snapshot = buildOrderSnapshot(doc);
          await emitDomainEvent({
            kind: "order.stuck",
            order: snapshot,
            context: { meta: { stuckSince: doc.updatedAt, thresholdHours: hours } },
            eventIdSuffix: `stuck-${Math.floor(now / (6 * 60 * 60 * 1000))}`,
          });
          emitted++;
          logInfo("stuck-alerts", "emitted order.stuck", { id: snapshot.id, status });
        } catch (err) {
          errors++;
          logError("stuck-alerts", "failed to emit", err);
        }
      }
    } catch (err) {
      errors++;
      logError("stuck-alerts", `query failed for status=${status}`, err);
    }
  }
  return { scanned, emitted, errors, at: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(await run());
}
