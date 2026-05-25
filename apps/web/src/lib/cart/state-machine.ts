import "server-only";

/**
 * Cart state machine (052 data-model §3).
 *
 * Allowed transitions:
 *   active     → active | abandoned | converted | expired | merged
 *   abandoned  → active | abandoned | converted | expired | merged
 *   converted  → converted | active (conditional: Order cancelled/expired before paid, FR-5223a)
 *   expired    → expired | active (admin-only)
 *   merged     → merged
 */

export type CartStatus = "active" | "abandoned" | "converted" | "expired" | "merged";

const TRANSITIONS: Record<CartStatus, ReadonlySet<CartStatus>> = {
  active: new Set<CartStatus>(["active", "abandoned", "converted", "expired", "merged"]),
  abandoned: new Set<CartStatus>(["active", "abandoned", "converted", "expired", "merged"]),
  converted: new Set<CartStatus>(["converted", "active"]),
  expired: new Set<CartStatus>(["expired", "active"]),
  merged: new Set<CartStatus>(["merged"]),
};

export interface TransitionContext {
  /** True if the converted→active transition is authorized by Order cancellation/expiry (FR-5223a). */
  recoverFromConverted?: boolean;
  /** True if the expired→active transition is performed by an admin (FR-5223, admin-only). */
  adminRestore?: boolean;
}

export function canTransition(
  from: CartStatus,
  to: CartStatus,
  ctx: TransitionContext = {},
): boolean {
  const allowed = TRANSITIONS[from];
  if (!allowed) return false;
  if (!allowed.has(to)) return false;

  // Special-case guards
  if (from === "converted" && to === "active" && !ctx.recoverFromConverted) {
    return false;
  }
  if (from === "expired" && to === "active" && !ctx.adminRestore) {
    return false;
  }
  return true;
}

export function assertTransition(
  from: CartStatus,
  to: CartStatus,
  ctx: TransitionContext = {},
): void {
  if (!canTransition(from, to, ctx)) {
    throw new Error(`Invalid cart status transition: ${from} → ${to}`);
  }
}

/** Terminal statuses (cannot transition out — except admin/recovery cases). */
export const TERMINAL_STATUSES: ReadonlySet<CartStatus> = new Set(["merged"]);

/** Statuses that block mutation via public API. */
export const MUTATION_BLOCKED_STATUSES: ReadonlySet<CartStatus> = new Set([
  "converted",
  "expired",
  "merged",
]);

export function isMutationBlocked(status: CartStatus): boolean {
  return MUTATION_BLOCKED_STATUSES.has(status);
}
