import "server-only";

/**
 * Return state machine (053 data-model §4).
 *
 * Lifecycle:
 *   requested → approved → received → refunded
 *   requested → rejected | cancelled
 *   approved  → rejected | cancelled
 *   received  → rejected
 *
 * Terminal: refunded, rejected, cancelled.
 *
 * FR-5306, FR-5307, FR-5314.
 */

export type ReturnStatus =
  | "requested"
  | "approved"
  | "received"
  | "refunded"
  | "rejected"
  | "cancelled";

const ALLOWED: Record<ReturnStatus, ReadonlySet<ReturnStatus>> = {
  requested: new Set<ReturnStatus>(["requested", "approved", "rejected", "cancelled"]),
  approved: new Set<ReturnStatus>(["approved", "received", "rejected", "cancelled"]),
  received: new Set<ReturnStatus>(["received", "refunded", "rejected"]),
  refunded: new Set<ReturnStatus>(["refunded"]),
  rejected: new Set<ReturnStatus>(["rejected"]),
  cancelled: new Set<ReturnStatus>(["cancelled"]),
};

export const TERMINAL: ReadonlySet<ReturnStatus> = new Set(["refunded", "rejected", "cancelled"]);

/** Statuses that count as "open" (active dispute). FR-5310a. */
export const OPEN_STATUSES: ReadonlySet<ReturnStatus> = new Set([
  "requested",
  "approved",
  "received",
]);

export function canTransition(from: ReturnStatus, to: ReturnStatus): boolean {
  const allowed = ALLOWED[from];
  return allowed?.has(to) ?? false;
}

export class ReturnInvalidTransitionError extends Error {
  constructor(public from: ReturnStatus, public to: ReturnStatus) {
    super(`Return: forbidden transition ${from} → ${to}`);
    this.name = "ReturnInvalidTransitionError";
  }
}

export class ReturnMissingReasonError extends Error {
  constructor() {
    super("Return: statusReason is required when rejecting");
    this.name = "ReturnMissingReasonError";
  }
}

/**
 * Validate a state transition and throw on violation.
 * FR-5314: rejection requires a non-empty `statusReason`.
 */
export function assertTransition(
  from: ReturnStatus,
  to: ReturnStatus,
  statusReason?: string | null,
): void {
  if (from === to) return;
  if (!canTransition(from, to)) {
    throw new ReturnInvalidTransitionError(from, to);
  }
  if (to === "rejected" && !statusReason?.trim()) {
    throw new ReturnMissingReasonError();
  }
}

export function isTerminal(status: ReturnStatus): boolean {
  return TERMINAL.has(status);
}

export function isOpen(status: ReturnStatus): boolean {
  return OPEN_STATUSES.has(status);
}
