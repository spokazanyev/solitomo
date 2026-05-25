import "server-only";

import { ApiShipProvider } from "./apiship/provider";
import { FallbackShippingProvider } from "./fallback/provider";
import type { ShippingProvider } from "./types";

let cached: ShippingProvider | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000;

export async function getShippingProvider(): Promise<ShippingProvider> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
  const apiship = await ApiShipProvider.create();
  cached = apiship ?? new FallbackShippingProvider();
  cachedAt = Date.now();
  return cached;
}

export function resetShippingProviderCache() {
  cached = null;
  cachedAt = 0;
}
