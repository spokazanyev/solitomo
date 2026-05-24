import "server-only";

/**
 * Cart item merge logic (052 data-model §7a).
 *
 * Two contexts:
 *   1. mergeItems(existing, incoming) — used in PATCH op=mergeItems to add/update items
 *   2. mergeCarts(source, target) — used in US6 anonymous→logged-in merge (054 stub)
 *
 * Merge rules per SKU:
 *   - qty: sum, capped at 9999
 *   - priceAtAdd: from latest addedAt
 *   - name/image/slug: from target (Cu)
 *   - warning: reset to "none"
 */

export interface CartItem {
  sku: string;
  name: string;
  qty: number;
  priceAtAdd?: number | null;
  addedAt: string;
  productId?: string;
  slug?: string;
  image?: string;
  warning?: "none" | "removed" | "price_changed" | "stock_low";
}

const MAX_QTY = 9999;

/**
 * Merge incoming items into existing items by SKU.
 *
 * For each incoming item:
 *  - If SKU exists in existing → sum qty (capped), update priceAtAdd from latest addedAt
 *  - If SKU is new → append
 *
 * Returns a new array, does not mutate inputs.
 */
export function mergeItems(
  existing: readonly CartItem[],
  incoming: readonly CartItem[],
): CartItem[] {
  const map = new Map<string, CartItem>();
  for (const item of existing) {
    map.set(item.sku, { ...item });
  }

  for (const item of incoming) {
    const prev = map.get(item.sku);
    if (!prev) {
      map.set(item.sku, {
        ...item,
        qty: Math.min(MAX_QTY, Math.max(1, item.qty)),
        warning: "none",
      });
      continue;
    }

    // Sum qty, capped
    const newQty = Math.min(MAX_QTY, prev.qty + item.qty);

    // priceAtAdd from latest addedAt
    const prevTs = new Date(prev.addedAt).getTime();
    const newTs = new Date(item.addedAt).getTime();
    const priceAtAdd =
      newTs >= prevTs && item.priceAtAdd != null ? item.priceAtAdd : prev.priceAtAdd;

    map.set(item.sku, {
      ...prev,
      qty: newQty,
      priceAtAdd,
      addedAt: newTs >= prevTs ? item.addedAt : prev.addedAt,
      // Use incoming snapshot for name/slug/image if newer
      name: newTs >= prevTs ? item.name : prev.name,
      slug: newTs >= prevTs ? item.slug : prev.slug,
      image: newTs >= prevTs ? item.image : prev.image,
      productId: item.productId ?? prev.productId,
      warning: "none",
    });
  }

  return Array.from(map.values());
}

/**
 * Replace items entirely (setItems op).
 * Validates each item structure and caps qty.
 */
export function setItems(incoming: readonly CartItem[]): CartItem[] {
  return incoming.map((item) => ({
    ...item,
    qty: Math.min(MAX_QTY, Math.max(1, item.qty)),
    warning: item.warning ?? "none",
  }));
}

/**
 * Remove item by SKU. Returns a new array.
 */
export function removeItem(items: readonly CartItem[], sku: string): CartItem[] {
  return items.filter((i) => i.sku !== sku);
}

/**
 * Set quantity for one item by SKU. Returns a new array.
 * No-op if SKU not found.
 */
export function setQuantity(items: readonly CartItem[], sku: string, qty: number): CartItem[] {
  const capped = Math.min(MAX_QTY, Math.max(1, qty));
  return items.map((item) => (item.sku === sku ? { ...item, qty: capped } : item));
}

/**
 * Placeholder for full cart merge — implemented in 054.
 * Signature is fixed here as the 054 contract (FR-5227b).
 */
export function mergeCarts(
  _source: { items: CartItem[] },
  _target: { items: CartItem[] },
): never {
  throw new Error("mergeCarts not implemented in 052 — pending 054 (Customer Account)");
}
