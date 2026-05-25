/**
 * Polling configuration constants (056 T005).
 *
 * Source: specs/056-yookassa-frontend-integration/data-model.md §2 + FR-5622.
 * OQ-5 resolved: hardcode 2 sec × 30 attempts = 60 sec total.
 */

export const PAYMENT_POLLING_CONFIG = {
  intervalMs: 2_000,
  maxAttempts: 30,
  /** Terminal Order.status — polling stops on transition. */
  terminalStates: ["paid", "cancelled", "expired", "refunded"] as const,
} as const;

export type TerminalState = (typeof PAYMENT_POLLING_CONFIG.terminalStates)[number];

export function isTerminalState(status: string): boolean {
  return (PAYMENT_POLLING_CONFIG.terminalStates as readonly string[]).includes(status);
}
