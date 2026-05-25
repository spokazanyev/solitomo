/**
 * POST /api/webhooks/apiship
 *
 * FR-401..406: webhook ApiShip с HMAC-валидацией, идемпотентностью, защитой от out-of-order.
 */

import crypto from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import type { Order } from "@/payload-types";
import { emitDomainEvent } from "@/lib/lifecycle/events";
import { buildOrderSnapshot } from "@/lib/lifecycle/order-snapshot";
import { loadSettings } from "@/lib/shipping/apiship/settings";
import {
  isTerminalStatus,
  mapApiShipStatus,
  mapShipmentToOrderStatus,
  shouldUpgradeStatus,
} from "@/lib/shipping/apiship/status-map";
import type { ShipmentStatusCode } from "@/lib/shipping/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WebhookEvent {
  eventId?: string;
  orderId?: number | string;
  status?: string | number;
  statusText?: string;
  at?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  payload?: unknown;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const settings = await loadSettings();
  const secret = settings.webhookSecret || process.env.APISHIP_WEBHOOK_SECRET || "";

  const sigHeader = req.headers.get("x-apiship-signature") ?? "";
  const valid = verifySignature(raw, sigHeader, secret);
  if (!valid) {
    return NextResponse.json({ ok: false, code: "INVALID_SIGNATURE" }, { status: 401 });
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(raw) as WebhookEvent;
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const eventId = String(event.eventId ?? req.headers.get("x-apiship-event-id") ?? "");
  if (!eventId) {
    return NextResponse.json({ ok: false, code: "MISSING_EVENT_ID" }, { status: 400 });
  }

  const providerOrderId = String(event.orderId ?? "");
  if (!providerOrderId) {
    return NextResponse.json({ ok: false, code: "MISSING_ORDER_ID" }, { status: 400 });
  }

  const newStatus: ShipmentStatusCode = mapApiShipStatus(event.status ?? "");
  const at = String(event.at ?? new Date().toISOString());

  const payload = await getPayload({ config: configPromise });
  const found = await payload.find({
    collection: "orders",
    where: { "shipment.providerOrderId": { equals: providerOrderId } },
    limit: 1,
  });
  const order = found.docs[0] as unknown as Record<string, unknown> | undefined;
  if (!order) {
    return NextResponse.json({ ok: true, code: "ORDER_NOT_FOUND" }, { status: 200 });
  }

  const shipment = (order.shipment ?? {}) as { status?: ShipmentStatusCode; events?: Array<{ eventId: string }> };
  const existingEvents = Array.isArray(shipment.events) ? shipment.events : [];
  if (existingEvents.some((e) => e.eventId === eventId)) {
    return NextResponse.json({ ok: true, code: "DUPLICATE" }, { status: 200 });
  }

  const previousShipmentStatus = shipment.status ?? "none";
  const upgrade = shouldUpgradeStatus(previousShipmentStatus as ShipmentStatusCode, newStatus);

  const newEvent = {
    eventId,
    providerStatus: String(event.status ?? ""),
    internalStatus: newStatus,
    at,
    receivedAt: new Date().toISOString(),
    message: event.statusText ?? "",
    raw: event,
  };

  const orderStatusUpdate = upgrade
    ? mapShipmentToOrderStatus(newStatus, String(order.status ?? ""))
    : null;

  const shipmentUpdate = {
    ...((order.shipment ?? {}) as unknown as Record<string, unknown>),
    status: upgrade ? newStatus : previousShipmentStatus,
    events: [...existingEvents, newEvent],
    trackingNumber: event.trackingNumber ?? shipment["trackingNumber" as keyof typeof shipment],
    trackingUrl: event.trackingUrl ?? shipment["trackingUrl" as keyof typeof shipment],
    lastSyncedAt: new Date().toISOString(),
  } as unknown as Order["shipment"];

  const updated = await payload.update({
    collection: "orders",
    id: String(order.id),
    data: {
      shipment: shipmentUpdate,
      ...(orderStatusUpdate ? { status: orderStatusUpdate as Order["status"] } : {}),
      ...(newStatus === "delivered" ? { deliveredAt: new Date().toISOString() } : {}),
    },
  });

  // Эмитим события только при upgrade и не для duplicate
  if (upgrade && !isTerminalStatus(previousShipmentStatus as ShipmentStatusCode)) {
    const snapshot = buildOrderSnapshot(updated as unknown as Record<string, unknown>);
    const kindMap: Partial<Record<ShipmentStatusCode, "shipment.created" | "shipment.in_transit" | "shipment.at_point" | "shipment.delivered" | "shipment.returned" | "shipment.error" | "shipment.courier_today">> = {
      created: "shipment.created",
      pending_label: "shipment.created",
      in_transit: "shipment.in_transit",
      at_point: "shipment.at_point",
      delivered: "shipment.delivered",
      returned: "shipment.returned",
      error: "shipment.error",
    };
    const kind = kindMap[newStatus];
    if (kind) {
      await emitDomainEvent({
        kind,
        order: snapshot,
        at,
        eventIdSuffix: eventId,
        context: {
          providerStatus: event.status,
          trackingNumber: event.trackingNumber,
          trackingUrl: event.trackingUrl,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

function verifySignature(raw: string, header: string, secret: string): boolean {
  if (!secret || !header) return false;
  const [scheme, hex] = header.split("=");
  if (scheme !== "sha256" || !hex) return false;
  try {
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (hex.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hex, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
