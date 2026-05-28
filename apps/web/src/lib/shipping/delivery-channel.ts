/**
 * 064 — Развязка «канал доставки» (closed) и «перевозчик» (open).
 *
 * `channel` — закрытый набор {pickup, service, own_carrier}, единственный драйвер
 * поведения заказа (стоимость, примечания, блок перевозчика). Перевозчик —
 * открытый `providerKey` + человекочитаемое `providerName` (источник — ApiShip).
 *
 * Чистые функции, без I/O — тестируются юнитами (см. __tests__/delivery-channel.test.ts).
 */
import { providerNameFromKey } from "./apiship/mappers";

export type DeliveryChannel = "pickup" | "service" | "own_carrier";

const CHANNELS: readonly DeliveryChannel[] = ["pickup", "service", "own_carrier"];

export function isDeliveryChannel(value: unknown): value is DeliveryChannel {
  return typeof value === "string" && CHANNELS.includes(value as DeliveryChannel);
}

/**
 * Источник истины — присланный `channel`. При его отсутствии/невалидности —
 * вывод из полей тела (страховка для прямых API-клиентов и legacy-тела):
 *  - method "pickup"/"own_carrier"/"tc" → соответствующий канал;
 *  - наличие providerKey/tariffId или непустого method → service;
 *  - иначе безопасный fallback pickup (cost=0).
 */
export function normalizeDeliveryChannel(input: {
  channel?: string | null;
  providerKey?: string | null;
  tariffId?: number | null;
  method?: string | null;
}): DeliveryChannel {
  if (isDeliveryChannel(input.channel)) return input.channel;

  const method = (input.method ?? "").trim();
  if (method === "pickup") return "pickup";
  if (method === "own_carrier" || method === "tc") return "own_carrier";

  const hasCarrier =
    Boolean((input.providerKey ?? "").trim()) || input.tariffId != null;
  if (hasCarrier) return "service";
  if (method) return "service"; // старый фронт слал method = providerKey

  return "pickup";
}

/**
 * FR-006: человекочитаемое имя службы. Приоритет:
 *   присланное имя → providerNameFromKey(code) → код → «служба доставки».
 * Никогда не возвращает пустую строку.
 */
export function resolveProviderName(
  providerName: string | null | undefined,
  providerKey: string | null | undefined,
): string {
  const name = (providerName ?? "").trim();
  if (name) return name;

  const key = (providerKey ?? "").trim();
  if (key && key !== "unknown") {
    return providerNameFromKey(key) ?? key;
  }

  return "служба доставки";
}
