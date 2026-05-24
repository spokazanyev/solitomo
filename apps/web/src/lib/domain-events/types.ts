import type { Order } from "@/payload-types";

export type DomainEventKind =
  | "order.created"
  | "order.updated"
  | "order.status_changed"
  | "order.cancelled"
  | "cart.created"
  | "cart.updated"
  | "cart.abandoned"
  | "return.requested"
  | "return.approved"
  | "return.completed";

export interface DomainEventPayload {
  kind: DomainEventKind;
  order?: Order;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export type DomainEventHandler = (event: DomainEventPayload) => void | Promise<void>;
