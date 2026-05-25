import "server-only";

/**
 * Paid-order immutability guard.
 *
 * After first payment (wasEverPaid = payment.paidAt != null), certain fields
 * are frozen to preserve financial integrity. Attempts to mutate them are
 * blocked with a detailed violation list.
 *
 * Source: specs/051-order-numbering-and-immutability
 * Data model: specs/051-order-numbering-and-immutability/data-model.md §4
 * FR-5106, FR-5107, FR-5108.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImmutabilityCheckResult {
  /** Whether the mutation is allowed. */
  allowed: boolean;
  /** List of field paths that were attempted to be changed but are frozen. */
  violations: string[];
}

// ─── Always-mutable whitelist (FR-5107) ───────────────────────────────────────
//
// These fields are ALWAYS allowed to change, even after payment.
// Everything NOT in this list AND NOT in frozenFields is also allowed
// (we use a frozen-fields approach, not a whitelist-only approach).
//
// The whitelist is documented here for reference but the actual check is
// "if the field is in FROZEN_FIELDS, block it; otherwise allow it."

/**
 * Fields that are frozen after wasEverPaid = true.
 * Matches data-model.md §4 and lifecycle §13.5.
 *
 * Uses dot-notation for nested paths. Array fields use the base path
 * (e.g. "items" covers all items[].* changes).
 */
const FROZEN_FIELDS: readonly string[] = [
  // Order items — changing quantity/price breaks accounting
  "items",
  // Totals snapshot — locked by payment
  "totals.subtotal",
  "totals.vat",
  "totals.total",
  // Delivery price snapshot from 047 FR-107
  "delivery.priceSnapshot",
  "delivery.priceSnapshot.cost",
  "delivery.priceSnapshot.currency",
  "delivery.priceSnapshot.capturedAt",
  "delivery.priceSnapshot.sourceCacheKey",
  "delivery.priceSnapshot.refreshCheckAt",
  // Customer email — invoice was issued to this address
  "customer.email",
  // Client number — locked after payment
  "clientNumber",
];

/**
 * Expanded set of frozen field prefixes for efficient prefix matching.
 * "items" matches "items", "items[0]", "items[0].price", etc.
 */
const FROZEN_PREFIXES = FROZEN_FIELDS.map((f) => f + ".");

// ─── Deep equality ────────────────────────────────────────────────────────────

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => key in bObj && deepEqual(aObj[key], bObj[key]));
  }

  return false;
}

// ─── Field extraction ─────────────────────────────────────────────────────────

/**
 * Get a nested value from an object by dot-notation path.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Check if a dot-notation path is actually present (explicitly set) in the data object.
 * Walks the object level by level. For a path like "delivery.priceSnapshot",
 * checks that data.delivery exists AND data.delivery.priceSnapshot exists.
 * Returns false for partial updates that don't include the frozen sub-path.
 *
 * For top-level fields (no dots), checks `fieldPath in data`.
 */
function isPathPresent(obj: Record<string, unknown>, path: string): boolean {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return false;
    if (!(part in (current as Record<string, unknown>))) return false;
    current = (current as Record<string, unknown>)[part];
  }
  return true;
}

/**
 * Check if a field path is frozen.
 * A path is frozen if it exactly matches a frozen field,
 * or if any frozen field is a prefix of it.
 */
function isFrozenField(fieldPath: string): boolean {
  // Exact match
  if (FROZEN_FIELDS.includes(fieldPath)) return true;
  // Prefix match: "items" freezes "items[0].price"
  for (const prefix of FROZEN_PREFIXES) {
    if (fieldPath.startsWith(prefix)) return true;
  }
  // Reverse: fieldPath="items" should match frozen "items"
  // Already covered by exact match above
  return false;
}

// ─── Main check ───────────────────────────────────────────────────────────────

/**
 * Check whether a mutation to a paid order is allowed.
 *
 * @param data - The incoming update data (partial order).
 * @param originalDoc - The current order document from DB.
 * @param operation - "create" | "update". Only "update" is checked.
 * @returns ImmutabilityCheckResult with violations list.
 */
export function checkPaidImmutability(
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown>,
  operation: string,
): ImmutabilityCheckResult {
  // Only check on update operations
  if (operation !== "update") {
    return { allowed: true, violations: [] };
  }

  // wasEverPaid: the point-of-no-return is the first payment
  const payment = originalDoc.payment as Record<string, unknown> | undefined;
  const paidAt = payment?.paidAt;
  if (!paidAt) {
    return { allowed: true, violations: [] };
  }

  const violations: string[] = [];

  for (const frozenPath of FROZEN_FIELDS) {
    // Skip sub-paths that are covered by a parent (e.g. "delivery.priceSnapshot.cost"
    // is redundant if "delivery.priceSnapshot" is also in the list)
    const parentCovered = FROZEN_FIELDS.some(
      (f) => f !== frozenPath && frozenPath.startsWith(f + "."),
    );
    if (parentCovered) continue;

    // Check if the frozen path is actually present in the update data.
    // Walk the data object along the path — if any intermediate key is missing,
    // the caller is NOT trying to change this field (partial update).
    if (!isPathPresent(data, frozenPath)) continue;

    const oldValue = getNestedValue(originalDoc, frozenPath);
    const newValue = getNestedValue(data, frozenPath);

    // Compare values
    if (!deepEqual(oldValue, newValue)) {
      violations.push(frozenPath);
    }
  }

  return {
    allowed: violations.length === 0,
    violations,
  };
}

/**
 * Determine if an order has ever been paid.
 * This is the canonical wasEverPaid check — used by the beforeChange hook.
 *
 * Point-of-no-return = payment.paidAt != null. Never resets.
 */
export function wasEverPaid(doc: Record<string, unknown>): boolean {
  const payment = doc.payment as Record<string, unknown> | undefined;
  return payment?.paidAt != null;
}

/**
 * List of frozen field paths (exported for documentation/testing).
 */
export { FROZEN_FIELDS };
