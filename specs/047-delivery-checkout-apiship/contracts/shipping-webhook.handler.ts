/**
 * Контрактный референс webhook-роута ApiShip.
 *
 * Источник: 047-delivery-checkout-apiship.
 * Конечная реализация — apps/web/src/app/api/webhooks/apiship/route.ts
 *
 * Поведение:
 *  1. Читаем сырое тело (нужно для проверки HMAC).
 *  2. Проверяем подпись `X-Apiship-Signature: sha256=<hex>`.
 *  3. Парсим JSON.
 *  4. Идемпотентность по eventId (де-дупликация в shipment.events).
 *  5. Маппим status → internal.
 *  6. Обновляем Order.shipment, при необходимости поднимаем orders.status.
 *  7. Логируем в shipping-logs (с маской ПДн).
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getPayload } from "payload";
import config from "@payload-config";
import { mapApiShipStatus } from "../../../apps/web/src/lib/shipping/apiship/status-map";
import { logRequest, logError } from "../../../apps/web/src/lib/shipping/apiship/logger";

export const runtime = "nodejs";        // crypto только в node-runtime
export const dynamic = "force-dynamic"; // ни в коем случае не кэшировать

export async function POST(req: NextRequest) {
  const raw = await req.text();

  const secret = process.env.APISHIP_WEBHOOK_SECRET ?? "";
  const sigHeader = req.headers.get("x-apiship-signature") ?? "";
  const valid = verifySignature(raw, sigHeader, secret);
  if (!valid) {
    await logError("webhook.invalid_signature", { sigHeader });
    return NextResponse.json({ ok: false, code: "INVALID_SIGNATURE" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch (err) {
    await logError("webhook.invalid_payload", { err });
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const eventId = String(event.eventId ?? req.headers.get("x-apiship-event-id") ?? "");
  if (!eventId) {
    await logError("webhook.missing_event_id", {});
    return NextResponse.json({ ok: false, code: "MISSING_EVENT_ID" }, { status: 400 });
  }

  const providerOrderId = String(event.orderId ?? "");
  const status = mapApiShipStatus(event.status);
  const at = String(event.at ?? new Date().toISOString());

  const payload = await getPayload({ config });

  // 1. Найти Order по providerOrderId
  const found = await payload.find({
    collection: "orders",
    where: { "shipment.providerOrderId": { equals: providerOrderId } },
    limit: 1,
  });
  const order = found.docs[0];
  if (!order) {
    await logError("webhook.order_not_found", { providerOrderId, eventId });
    // Возвращаем 200, чтобы ApiShip не ретраил вечно. Сохраняем событие отдельно.
    return NextResponse.json({ ok: true, code: "ORDER_NOT_FOUND" }, { status: 200 });
  }

  // 2. Идемпотентность: если eventId уже есть — выходим.
  const existingEvents: any[] = (order as any).shipment?.events ?? [];
  if (existingEvents.some((e) => e.eventId === eventId)) {
    return NextResponse.json({ ok: true, code: "DUPLICATE" }, { status: 200 });
  }

  // 3. Защита от out-of-order: если в shipment.status уже терминальный delivered/cancelled,
  //    а пришёл «более ранний» статус — не понижаем.
  const newEvent = {
    eventId,
    providerStatus: String(event.status),
    internalStatus: status,
    at,
    receivedAt: new Date().toISOString(),
    message: event.statusText ?? "",
    raw: event,
  };

  const shouldUpgradeStatus = computeStatusUpgrade((order as any).shipment?.status, status);

  // 4. Решение по orders.status
  const orderStatusUpdate = mapShipmentToOrderStatus(status, (order as any).status);

  await payload.update({
    collection: "orders",
    id: order.id,
    data: {
      shipment: {
        ...((order as any).shipment ?? {}),
        status: shouldUpgradeStatus ? status : (order as any).shipment?.status,
        events: [...existingEvents, newEvent],
        trackingNumber: event.trackingNumber ?? (order as any).shipment?.trackingNumber,
        trackingUrl:    event.trackingUrl    ?? (order as any).shipment?.trackingUrl,
        lastSyncedAt: new Date().toISOString(),
      },
      ...(orderStatusUpdate ? { status: orderStatusUpdate } : {}),
    },
  });

  await logRequest("webhook.applied", { eventId, providerOrderId, status });
  return NextResponse.json({ ok: true });
}

// ---------- helpers ----------

function verifySignature(raw: string, header: string, secret: string): boolean {
  if (!secret) return false;
  if (!header) return false;
  const [scheme, hex] = header.split("=");
  if (scheme !== "sha256" || !hex) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return safeEqual(hex, expected);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

const SHIPMENT_RANK: Record<string, number> = {
  none: 0,
  pending: 1,
  created: 2,
  pending_label: 3,
  in_transit: 4,
  at_point: 5,
  delivered: 6,
  returned: 7,
  cancelled: 8,
  error: 9,
};

function computeStatusUpgrade(curr: string | undefined, next: string): boolean {
  if (!curr) return true;
  if (curr === "delivered" || curr === "cancelled" || curr === "returned") return false;
  return (SHIPMENT_RANK[next] ?? 0) >= (SHIPMENT_RANK[curr] ?? 0);
}

function mapShipmentToOrderStatus(shipment: string, current: string): string | null {
  if (shipment === "in_transit" && current !== "shipped") return "shipped";
  if (shipment === "delivered") return "delivered";
  if (shipment === "cancelled") return "cancelled";
  return null;
}
