import "server-only";

/**
 * Cart totals computation (052 data-model §1).
 *
 * Pure function — used in beforeChange hook and in repository for response shaping.
 */

export interface CartItemForTotals {
  qty: number;
  priceAtAdd?: number | null;
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  knownPriceCount: number;
  unknownPriceCount: number;
}

export function computeTotals(items: readonly CartItemForTotals[]): CartTotals {
  let itemCount = 0;
  let subtotal = 0;
  let knownPriceCount = 0;
  let unknownPriceCount = 0;

  for (const item of items ?? []) {
    const qty = Number.isFinite(item.qty) ? Math.max(0, Math.floor(item.qty)) : 0;
    itemCount += qty;

    if (typeof item.priceAtAdd === "number" && Number.isFinite(item.priceAtAdd)) {
      subtotal += item.priceAtAdd * qty;
      knownPriceCount += 1;
    } else {
      unknownPriceCount += 1;
    }
  }

  // Round subtotal to 2 decimals to avoid float drift
  subtotal = Math.round(subtotal * 100) / 100;

  return { itemCount, subtotal, knownPriceCount, unknownPriceCount };
}
