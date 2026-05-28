/**
 * POST /api/cron/test-lifecycle?orderId=<id>
 *
 * ВРЕМЕННЫЙ диагностический endpoint (062 follow-up) — прогоняет весь цикл
 * доменных событий legal-заказа и сразу обрабатывает очередь уведомлений,
 * чтобы проверить отправку писем end-to-end на проде.
 *
 * Эмитит последовательно: order.invoice_issued → order.paid →
 * shipment.created → shipment.delivered → order.completed. После каждого
 * emit подписчик 049 ставит notification-jobs; в конце вызываем
 * processNotificationQueue (тот же путь, что и cron/notifications).
 *
 * Авторизация: header `Authorization: Bearer ${CRON_SECRET}`.
 *
 * TODO (DEFERRED): удалить этот endpoint после верификации цикла писем.
 */

import { NextResponse, type NextRequest } from "next/server";
import configPromise from "@payload-config";
import { getPayload } from "payload";

import { emitDomainEvent, registerCoreSubscribers } from "@/lib/lifecycle/events";
import { buildOrderSnapshot } from "@/lib/lifecycle/order-snapshot";
import { processNotificationQueue } from "@/lib/notifications/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

// Полный happy-path жизненного цикла legal-заказа → письма по матрице 049.
const CYCLE = [
  { kind: "order.invoice_issued", note: "T-002 клиент + T-102 менеджер" },
  { kind: "order.paid", note: "T-001 клиент + T-101 менеджер" },
  { kind: "shipment.created", note: "T-003 клиент" },
  { kind: "shipment.delivered", note: "T-005 клиент" },
  { kind: "order.completed", note: "T-008 клиент" },
] as const;

async function run(orderId: string) {
  const payload = await getPayload({ config: configPromise });

  // В route-контексте module-state подписчиков может быть изолирован от
  // payload onInit (Next бандлит chunks отдельно). Регистрируем явно —
  // идемпотентно (guard'ы в самих register*Subscriber).
  await registerCoreSubscribers();

  const order = (await payload.findByID({
    collection: "orders",
    id: orderId,
  })) as unknown as Record<string, unknown>;

  const snapshot = buildOrderSnapshot(order);
  const suffix = Date.now().toString(36); // уникальный suffix против dedup между прогонами

  const emitted: Array<{ kind: string; note: string }> = [];
  for (const step of CYCLE) {
    await emitDomainEvent({
      kind: step.kind,
      order: snapshot,
      eventIdSuffix: suffix,
      context:
        step.kind === "order.paid"
          ? { statusFrom: "awaiting_payment", statusTo: "paid" }
          : undefined,
    });
    emitted.push({ kind: step.kind, note: step.note });
  }

  // Обрабатываем очередь (отправка через Unisender Go).
  const queue = await processNotificationQueue();

  // Сводка jobs по этому заказу.
  const jobs = await payload.find({
    collection: "notification-jobs",
    where: { entityId: { equals: String(order.id) } },
    limit: 100,
    sort: "-createdAt",
  });
  const jobSummary = (jobs.docs as unknown as Array<Record<string, unknown>>).map((j) => ({
    template: j.template,
    event: j.event,
    recipient: j.recipient,
    status: j.status,
    skipReason: j.skipReason,
    lastError: j.lastError,
  }));

  return {
    orderId: String(order.id),
    customerEmail: (order.customer as { email?: string } | undefined)?.email,
    emitted,
    queue,
    jobs: jobSummary,
    at: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const orderId = req.nextUrl.searchParams.get("orderId");
  if (!orderId) return NextResponse.json({ error: "orderId query param required" }, { status: 400 });
  try {
    return NextResponse.json(await run(orderId));
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? String(err) },
      { status: 500 },
    );
  }
}
