/**
 * Status machine для orders.status.
 * Источник: order-lifecycle-spec.md §2.1.
 *
 * Запрещённые переходы блокируются hook'ом Orders.beforeChange.
 */

export type OrderStatus =
  | "new"
  | "draft"
  | "pending_payment"
  | "awaiting_payment"
  | "paid"
  | "fulfilling"
  | "shipped"
  | "delivered"
  | "completed"
  | "returned"
  | "cancelled"
  | "expired";

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  new: ["draft", "pending_payment", "awaiting_payment", "cancelled"],
  draft: ["pending_payment", "awaiting_payment", "cancelled"],
  pending_payment: ["paid", "pending_payment", "expired", "cancelled"],
  awaiting_payment: ["paid", "expired", "cancelled"],
  paid: ["fulfilling", "shipped", "cancelled"],
  fulfilling: ["shipped", "delivered", "cancelled"],
  shipped: ["delivered", "returned", "cancelled"],
  delivered: ["completed", "returned"],
  // 053: completed → delivered allowed under reopenAuthorized (partial return after closure)
  // 053: completed → returned allowed under reopenAuthorized (full return after closure)
  completed: ["completed", "delivered", "returned"],
  returned: ["returned"],
  cancelled: ["cancelled"],
  expired: ["expired"],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export interface TransitionContext {
  reopenAuthorized?: boolean;
}

export function assertTransition(
  from: OrderStatus,
  to: OrderStatus,
  ctx: TransitionContext = {},
): void {
  // Guard: leaving completed requires explicit reopenAuthorized (FR-905, FR-5316)
  if (from === "completed" && to !== "completed" && !ctx.reopenAuthorized) {
    throw new Error(
      "Запрещён переход из completed без явного «Реоткрыть сделку» (FR-905).",
    );
  }
  // Guard: leaving returned requires explicit reopenAuthorized
  if (from === "returned" && to !== "returned" && !ctx.reopenAuthorized) {
    throw new Error(
      "Запрещён переход из returned без явного «Реоткрыть сделку».",
    );
  }
  if (!canTransition(from, to)) {
    throw new Error(`Запрещённый переход статуса: ${from} → ${to}`);
  }
}
