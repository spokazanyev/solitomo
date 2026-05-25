/**
 * GET/POST /api/cron/pickup-reminder
 *
 * Запускается каждый час (FR-4930). Находит shipments в статусе `at_point`
 * с pickupExpiresAt в окне [now+22h, now+26h] (24±2ч) и для которых ещё не
 * отправлено напоминание T-007.
 *
 * Создаёт `notification-jobs` напрямую (не через emitDomainEvent), потому что
 * это cron-only событие, не имеющее естественного триггера от провайдера.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { buildOrderSnapshot } from "@/lib/lifecycle/order-snapshot";
import { dedupKey, findExistingByDedupKey } from "@/lib/notifications/dedup";
import { logError, logInfo } from "@/lib/notifications/logger";
import { pickupReminderRule } from "@/lib/notifications/matrix";
import type { NotificationJobPayload } from "@/lib/notifications/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

async function run() {
  const p = await getPayload({ config: configPromise });
  const now = Date.now();
  const lowerBound = new Date(now + 22 * 60 * 60 * 1000).toISOString();
  const upperBound = new Date(now + 26 * 60 * 60 * 1000).toISOString();

  const orders = await p.find({
    collection: "orders",
    where: {
      and: [
        { "shipment.status": { equals: "at_point" } },
        { "delivery.pickupExpiresAt": { greater_than_equal: lowerBound } },
        { "delivery.pickupExpiresAt": { less_than_equal: upperBound } },
      ],
    },
    limit: 100,
  });

  let scanned = 0;
  let queued = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of orders.docs as unknown as Array<Record<string, unknown>>) {
    scanned++;
    try {
      const snapshot = buildOrderSnapshot(doc);
      const customerEmail = snapshot.customer?.email;
      if (!customerEmail) {
        skipped++;
        continue;
      }
      // emailValid?
      const emailValid = (snapshot.customer as { emailValid?: boolean } | undefined)?.emailValid;
      if (emailValid === false) {
        skipped++;
        continue;
      }
      const key = dedupKey({
        orderId: snapshot.id,
        event: "shipment.pickup_reminder_24h",
        channel: pickupReminderRule.channel,
        recipient: customerEmail,
        at: new Date().toISOString(),
      });
      const existing = await findExistingByDedupKey(key);
      if (existing) {
        skipped++;
        continue;
      }
      const payload: NotificationJobPayload = {
        order: snapshot,
        event: {
          // matrix.event для рендера, но мы помечаем в job как pickup_reminder_24h
          kind: "shipment.at_point",
          at: new Date().toISOString(),
          message: "pickup_reminder_24h",
        },
      };
      await p.create({
        collection: "notification-jobs",
        data: {
          notificationId: `${snapshot.id}:shipment.pickup_reminder_24h:${pickupReminderRule.template}:${customerEmail.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40)}`,
          orderId: Number(snapshot.id),
          event: "shipment.pickup_reminder_24h",
          channel: pickupReminderRule.channel,
          template: pickupReminderRule.template,
          recipient: customerEmail,
          scheduledAt: new Date().toISOString(),
          nextAttemptAt: new Date().toISOString(),
          status: "queued",
          attempt: 0,
          payload: payload as unknown as Record<string, unknown>,
          dedupKey: key,
        },
      });
      queued++;
      logInfo("pickup-reminder", "queued", { orderId: snapshot.id });
    } catch (err) {
      errors++;
      logError("pickup-reminder", "failed for order", err);
    }
  }
  return { scanned, queued, skipped, errors, at: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(await run());
}
