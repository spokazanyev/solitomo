import "server-only";

import { getPayload } from "payload";
import configPromise from "@payload-config";

import { ApiShipProvider } from "./apiship/provider";
import { emitDomainEvent } from "../lifecycle/events";
import { buildOrderSnapshot } from "../lifecycle/order-snapshot";
import type { OrderForShipment, ShipmentInfo } from "./types";

interface OrderItemsRaw {
  sku?: string;
  name?: string;
  quantity?: number;
  price?: number;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
}

function orderForShipmentFromDoc(doc: Record<string, unknown>): OrderForShipment {
  const customer = (doc.customer ?? {}) as OrderForShipment["customer"];
  const delivery = (doc.delivery ?? {}) as Partial<OrderForShipment["delivery"]> & {
    addressNormalized?: OrderForShipment["delivery"]["address"];
    priceSnapshot?: { cost?: number };
  };
  const totals = (doc.totals ?? {}) as { subtotal?: number; vat?: number; total?: number };
  const rawItems = (doc.items ?? []) as OrderItemsRaw[];

  return {
    id: String(doc.id),
    publicToken: typeof doc.publicToken === "string" ? doc.publicToken : undefined,
    customer,
    delivery: {
      provider: (delivery.provider as OrderForShipment["delivery"]["provider"]) ?? "apiship",
      providerKey: String(delivery.providerKey ?? ""),
      tariffId: Number(delivery.tariffId ?? 0),
      deliveryType: ((Number(delivery.deliveryType) || 1) as 1 | 2),
      pickupType: ((Number(delivery.pickupType) || 1) as 1 | 2),
      pointId: typeof delivery.pointId === "string" ? delivery.pointId : undefined,
      pointAddress: typeof delivery.pointAddress === "string" ? delivery.pointAddress : undefined,
      address: (delivery.addressNormalized as OrderForShipment["delivery"]["address"]) ?? undefined,
      city: typeof delivery.city === "string" ? delivery.city : undefined,
      cost: Number(delivery.cost ?? delivery.priceSnapshot?.cost ?? 0),
    },
    items: rawItems.map((it) => ({
      sku: String(it.sku ?? ""),
      name: it.name,
      quantity: Number(it.quantity ?? 1),
      price: Number(it.price ?? 0),
      weight: it.weight,
      length: it.length,
      width: it.width,
      height: it.height,
    })),
    totals: {
      subtotal: Number(totals.subtotal ?? 0),
      vat: Number(totals.vat ?? 0),
      total: Number(totals.total ?? 0),
    },
  };
}

export async function createShipmentForOrder(orderId: string): Promise<ShipmentInfo> {
  const provider = await ApiShipProvider.create();
  if (!provider) {
    throw new Error("ApiShip provider not enabled. Включите интеграцию в Globals → Доставка / ApiShip.");
  }
  const payload = await getPayload({ config: configPromise });
  const doc = (await payload.findByID({ collection: "orders", id: orderId })) as unknown as Record<string, unknown>;
  if (!doc) throw new Error(`Order ${orderId} not found`);

  const status = String(doc.status ?? "");
  if (!["paid", "fulfilling"].includes(status)) {
    throw new Error(`Order in status ${status} — недопустим для создания отправления.`);
  }
  const shipment = (doc.shipment ?? {}) as { status?: string };
  if (shipment.status && !["none", "error", "pending_label", "pending"].includes(shipment.status)) {
    throw new Error(`Уже есть активное отправление (status=${shipment.status}).`);
  }

  const orderForShip = orderForShipmentFromDoc(doc);
  const info = await provider.createShipment(orderForShip);

  const updated = await payload.update({
    collection: "orders",
    id: orderId,
    data: {
      status: "fulfilling",
      shipment: {
        providerOrderId: info.providerOrderId,
        trackingNumber: info.trackingNumber,
        trackingUrl: info.trackingUrl,
        labelUrl: info.labelUrl,
        waybillUrl: info.waybillUrl,
        status: info.status,
        createdAt: info.createdAt,
        events: [],
        lastSyncedAt: new Date().toISOString(),
      },
    } as unknown as Record<string, unknown>,
  });

  const snapshot = buildOrderSnapshot(updated as unknown as Record<string, unknown>);
  await emitDomainEvent({
    kind: "shipment.created",
    order: snapshot,
    context: { trackingNumber: info.trackingNumber, trackingUrl: info.trackingUrl },
  });

  return info;
}

export async function cancelShipmentForOrder(orderId: string, reason?: string): Promise<void> {
  const provider = await ApiShipProvider.create();
  if (!provider) throw new Error("ApiShip provider not enabled.");
  const payload = await getPayload({ config: configPromise });
  const doc = (await payload.findByID({ collection: "orders", id: orderId })) as unknown as Record<string, unknown>;
  if (!doc) throw new Error(`Order ${orderId} not found`);
  const shipment = (doc.shipment ?? {}) as { providerOrderId?: string };
  const providerOrderId = Number(shipment.providerOrderId ?? 0);
  if (!providerOrderId) throw new Error("Нет providerOrderId — нечего отменять.");

  await provider.cancelByProviderOrderId(providerOrderId);

  await payload.update({
    collection: "orders",
    id: orderId,
    data: {
      shipment: {
        ...((doc.shipment ?? {}) as unknown as Record<string, unknown>),
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        errorMessage: reason,
      },
    } as unknown as Record<string, unknown>,
  });
}

export async function getShipmentDocument(orderId: string, kind: "label" | "waybill"): Promise<string> {
  const provider = await ApiShipProvider.create();
  if (!provider) throw new Error("ApiShip provider not enabled.");
  const payload = await getPayload({ config: configPromise });
  const doc = (await payload.findByID({ collection: "orders", id: orderId })) as unknown as Record<string, unknown>;
  const shipment = (doc.shipment ?? {}) as { providerOrderId?: string };
  const providerOrderId = Number(shipment.providerOrderId ?? 0);
  if (!providerOrderId) throw new Error("Нет providerOrderId");
  return kind === "label"
    ? provider.getLabelUrl(providerOrderId)
    : provider.getWaybillUrl(providerOrderId);
}

export async function refreshTrackingForOrder(orderId: string): Promise<{ trackingNumber: string; trackingUrl: string }> {
  const provider = await ApiShipProvider.create();
  if (!provider) throw new Error("ApiShip provider not enabled.");
  const payload = await getPayload({ config: configPromise });
  const doc = (await payload.findByID({ collection: "orders", id: orderId })) as unknown as Record<string, unknown>;
  const shipment = (doc.shipment ?? {}) as { providerOrderId?: string };
  const providerOrderId = Number(shipment.providerOrderId ?? 0);
  if (!providerOrderId) throw new Error("Нет providerOrderId");
  const info = await provider.pullTracking(providerOrderId);
  await payload.update({
    collection: "orders",
    id: orderId,
    data: {
      shipment: {
        ...((doc.shipment ?? {}) as unknown as Record<string, unknown>),
        trackingNumber: info.trackingNumber,
        trackingUrl: info.trackingUrl,
        lastSyncedAt: new Date().toISOString(),
      },
    } as unknown as Record<string, unknown>,
  });
  return info;
}
