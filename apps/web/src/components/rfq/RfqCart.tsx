"use client";

import { Check, Plus, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { trackAnalyticsEvent } from "@/lib/analytics/events";
import { trackAddToRfq } from "@/lib/analytics/data-layer";

export type RfqCartItem = {
  name: string;
  quantity: string;
  sku: string;
  price?: number | null;
  slug?: string;
  image?: string;
};

// Alias for spec 037 (Cart and Checkout). Keep RfqCartItem export for callers.
export type CartItem = RfqCartItem;

const STORAGE_KEY = "soliton-rfq-items";
const CART_CHANGED_EVENT = "soliton-rfq-cart-changed";

function hasBrowserStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function cleanItem(item: Partial<RfqCartItem>): RfqCartItem {
  const cleaned: RfqCartItem = {
    name: String(item.name ?? "").trim().slice(0, 240),
    quantity: String(item.quantity ?? "1").trim().slice(0, 40) || "1",
    sku: String(item.sku ?? "").trim().slice(0, 120),
  };
  if (typeof item.price === "number") cleaned.price = item.price;
  if (item.price === null) cleaned.price = null;
  if (typeof item.slug === "string" && item.slug.trim()) {
    cleaned.slug = item.slug.trim().slice(0, 200);
  }
  if (typeof item.image === "string" && item.image.trim()) {
    cleaned.image = item.image.trim().slice(0, 500);
  }
  return cleaned;
}

function itemKey(item: RfqCartItem) {
  return (item.sku || item.name).toLocaleLowerCase("ru-RU");
}

function dispatchCartChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT));
  }
}

export function mergeRfqItems(items: RfqCartItem[]) {
  const merged = new Map<string, RfqCartItem>();

  items.map(cleanItem).forEach((item) => {
    if (!item.sku && !item.name) {
      return;
    }

    const key = itemKey(item);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, item);
      return;
    }

    const existingQuantity = Number.parseInt(existing.quantity, 10);
    const nextQuantity = Number.parseInt(item.quantity, 10);

    merged.set(key, {
      name: existing.name || item.name,
      quantity: String(
        (Number.isFinite(existingQuantity) ? existingQuantity : 1) +
          (Number.isFinite(nextQuantity) ? nextQuantity : 1),
      ),
      sku: existing.sku || item.sku,
      price: existing.price ?? item.price,
      slug: existing.slug ?? item.slug,
      image: existing.image ?? item.image,
    });
  });

  return Array.from(merged.values()).slice(0, 50);
}

export function readRfqCartItems() {
  if (!hasBrowserStorage()) {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");

    if (!Array.isArray(parsed)) {
      return [];
    }

    return mergeRfqItems(parsed);
  } catch {
    return [];
  }
}

export function writeRfqCartItems(items: RfqCartItem[]) {
  if (!hasBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mergeRfqItems(items)));
  dispatchCartChanged();
}

export function addRfqCartItem(item: RfqCartItem) {
  const nextItems = mergeRfqItems([...readRfqCartItems(), item]);
  writeRfqCartItems(nextItems);
  return nextItems;
}

export function clearRfqCartItems() {
  if (!hasBrowserStorage()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  dispatchCartChanged();
}

export function setItemQuantity(sku: string, quantity: number) {
  const items = readRfqCartItems().map((item) =>
    item.sku === sku ? { ...item, quantity: String(Math.max(1, Math.floor(quantity))) } : item,
  );
  writeRfqCartItems(items);
  return items;
}

export function removeCartItem(sku: string) {
  const items = readRfqCartItems().filter((item) => item.sku !== sku);
  writeRfqCartItems(items);
  return items;
}

export function getCartTotal(items: RfqCartItem[]) {
  let known = 0;
  let knownCount = 0;
  let unknownCount = 0;
  for (const item of items) {
    const qty = Number.parseInt(item.quantity, 10) || 1;
    if (typeof item.price === "number") {
      known += item.price * qty;
      knownCount += 1;
    } else {
      unknownCount += 1;
    }
  }
  return { total: known, knownCount, unknownCount };
}

export function useRfqCartItems() {
  const [items, setItems] = useState<RfqCartItem[]>([]);

  useEffect(() => {
    function sync() {
      setItems(readRfqCartItems());
    }

    sync();
    window.addEventListener(CART_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(CART_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return items;
}

export function AddToRfqButton({
  className,
  item,
}: {
  className?: string;
  item: RfqCartItem;
}) {
  const [added, setAdded] = useState(false);

  function handleClick() {
    addRfqCartItem(item);
    trackAnalyticsEvent("add_to_cart", {
      brand: "Солитон",
      form_type: "rfq",
      product_id: item.sku,
      product_name: item.name,
      quantity: Number.parseInt(item.quantity, 10) || 1,
      sku: item.sku,
    });
    trackAddToRfq({
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <button
      className={
        className ??
        "inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-sky-700 px-4 text-sm font-semibold text-white hover:bg-sky-800"
      }
      onClick={handleClick}
      type="button"
    >
      {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      {added ? "В корзине" : "В корзину"}
    </button>
  );
}

export function RfqCartLink({ className }: { className?: string }) {
  const items = useRfqCartItems();
  const count = useMemo(
    () =>
      items.reduce((sum, item) => {
        const quantity = Number.parseInt(item.quantity, 10);
        return sum + (Number.isFinite(quantity) ? quantity : 1);
      }, 0),
    [items],
  );

  return (
    <Link
      aria-label={count > 0 ? `Корзина — ${count} позиций` : "Корзина"}
      className={
        className ??
        "relative inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:border-sky-500 hover:text-sky-800"
      }
      href="/cart/"
      title="Корзина"
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-700 px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

// Cart-named aliases for spec 037 (Cart and Checkout). Original Rfq-prefixed
// names remain exported for backward compatibility.
export const mergeCartItems = mergeRfqItems;
export const readCartItems = readRfqCartItems;
export const writeCartItems = writeRfqCartItems;
export const addCartItem = addRfqCartItem;
export const clearCartItems = clearRfqCartItems;
export const useCart = useRfqCartItems;
export const AddToCartButton = AddToRfqButton;
export const CartLink = RfqCartLink;
