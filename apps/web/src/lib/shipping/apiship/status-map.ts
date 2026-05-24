import type { ShipmentStatusCode } from "../types";

/**
 * Маппинг провайдерского статуса ApiShip → внутренний shipment.status.
 * Источник: specs/047-delivery-checkout-apiship/contracts/apiship-events.md
 */
export function mapApiShipStatus(raw: string | number): ShipmentStatusCode {
  const code = typeof raw === "string" ? raw.toLowerCase() : String(raw);
  switch (code) {
    case "1":
    case "new":
    case "2":
    case "accepted":
    case "label_ready":
      return "created";
    case "3":
    case "passed_to_carrier":
    case "4":
    case "5":
    case "in_transit":
      return "in_transit";
    case "6":
    case "at_point":
      return "at_point";
    case "7":
    case "delivered":
      return "delivered";
    case "8":
    case "returned":
      return "returned";
    case "9":
    case "cancelled":
      return "cancelled";
    case "10":
    case "error":
    case "label_failed":
      return "error";
    default:
      // Если код неизвестен — не понижаем статус, но и не выбираем «delivered».
      return "in_transit";
  }
}

export function isTerminalStatus(status: ShipmentStatusCode): boolean {
  return status === "delivered" || status === "cancelled" || status === "returned";
}

const RANK: Record<ShipmentStatusCode, number> = {
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

export function shouldUpgradeStatus(
  current: ShipmentStatusCode | undefined,
  next: ShipmentStatusCode,
): boolean {
  if (!current) return true;
  if (isTerminalStatus(current)) return false;
  return (RANK[next] ?? 0) >= (RANK[current] ?? 0);
}

export function mapShipmentToOrderStatus(
  shipment: ShipmentStatusCode,
  current: string,
): string | null {
  if (shipment === "in_transit" && current !== "shipped") return "shipped";
  if (shipment === "at_point" && current !== "shipped" && current !== "delivered") return "shipped";
  if (shipment === "delivered") return "delivered";
  if (shipment === "cancelled") return "cancelled";
  if (shipment === "returned") return "returned";
  return null;
}
