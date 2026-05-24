import "server-only";

/**
 * Cart ETag helper (052 H3 fix).
 *
 * Generates a stable ETag from a cart's identifying fields. Used as the value
 * of the `ETag` response header on GET and as the expected value for the
 * `If-Match` request header on PATCH.
 *
 * NOTE: This provides server-side optimistic concurrency at the **application**
 * level: the route reads cart, compares If-Match to current ETag, then updates.
 * There is still a race window between read and update because Payload's local
 * API has no native conditional update. For strict atomicity, wrap the read+
 * update in a Postgres transaction with `SELECT ... FOR UPDATE` — deferred to a
 * follow-up if observed conflict rates warrant it.
 */

import { createHash } from "node:crypto";

import type { CartRecord } from "./repository";

/**
 * Compute ETag for a cart. Format: `W/"<sha256-16>"` (weak ETag, per RFC 7232).
 *
 * Inputs:
 *   - cart.id (stable)
 *   - cart.updatedAt (changes on every write)
 *
 * Output is 20 chars including quotes — fits well within HTTP header size limits.
 */
export function computeCartETag(cart: Pick<CartRecord, "id" | "updatedAt">): string {
  const digest = createHash("sha256")
    .update(`${cart.id}:${cart.updatedAt}`)
    .digest("hex")
    .slice(0, 16);
  return `W/"${digest}"`;
}

/**
 * Compare an `If-Match` header value to a cart's current ETag.
 *
 * Accepts:
 *   - Exact ETag match: `W/"abc123..."` === `W/"abc123..."`
 *   - Bare digest: `abc123...` matches if computed digest equals (legacy compatibility)
 *   - Wildcard: `*` always matches (per RFC 7232 §3.1)
 *
 * Returns false otherwise.
 */
export function matchesETag(ifMatch: string | null, currentETag: string): boolean {
  if (!ifMatch) return false;
  const trimmed = ifMatch.trim();
  if (trimmed === "*") return true;
  if (trimmed === currentETag) return true;
  // Accept bare digest without quotes for clients that strip them
  const bareDigest = currentETag.replace(/^W\/"|"$/g, "");
  if (trimmed === bareDigest) return true;
  // Accept strong-form for clients that don't send W/ prefix
  if (trimmed === `"${bareDigest}"`) return true;
  return false;
}
