/**
 * POST /api/checkout/finalize-shipping
 *
 * FR-107 / FR-108: финализация выбранного тарифа перед оплатой.
 * Делает re-calc, сравнивает цены, фиксирует snapshot.
 */

import { NextResponse, type NextRequest } from "next/server";

import { loadSettings } from "@/lib/shipping/apiship/settings";
import { getShippingProvider } from "@/lib/shipping/registry";
import type { PriceSnapshot } from "@/lib/shipping/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  cartId: string;
  shippingOptionId: string;
  providerKey: string;
  tariffId?: number;
  pointId?: string;
  previousCost: number;
  // Для recalc — нужны items и address:
  items?: Array<{ sku: string; quantity: number; price: number; weight?: number; length?: number; width?: number; height?: number }>;
  address?: { countryCode: string; postalCode?: string; city?: string; addressString?: string };
}

export async function POST(req: NextRequest) {
  const accept = req.nextUrl.searchParams.get("accept") === "true";

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ code: "INVALID_JSON" }, { status: 400 });
  }
  if (!body.cartId || !body.shippingOptionId || !body.providerKey || body.previousCost == null) {
    return NextResponse.json({ code: "INVALID_REQUEST" }, { status: 400 });
  }

  const settings = await loadSettings();
  const tolerance = settings.lifecycle.priceMismatchTolerance;
  const provider = await getShippingProvider();

  // Если нет items/address — мы не можем сделать reверификацию; принимаем что есть
  let newCost: number | undefined;
  const cacheKey = `apiship:calc:${body.cartId}:${body.shippingOptionId}`;
  if (body.items && body.address) {
    try {
      const recalc = await provider.calculate({
        cartId: body.cartId,
        address: { ...body.address, countryCode: body.address.countryCode || "RU" },
        items: body.items,
      });
      const match = recalc.rates.find(
        (r) =>
          r.shippingOptionId === body.shippingOptionId &&
          r.providerKey === body.providerKey &&
          (body.tariffId == null || r.tariffId === body.tariffId),
      );
      if (!match) {
        return NextResponse.json(
          { code: "RATE_UNAVAILABLE", reason: "Тариф больше не доступен", message: "Выберите другой вариант" },
          { status: 409 },
        );
      }
      newCost = match.cost;
    } catch {
      // Если recalc провалился — продолжаем со старой ценой (graceful)
      newCost = body.previousCost;
    }
  }

  const finalCost = newCost ?? body.previousCost;
  const deltaAbs = Math.abs(finalCost - body.previousCost);
  const deltaPercent = body.previousCost > 0 ? (deltaAbs / body.previousCost) * 100 : 0;
  const withinTolerance =
    deltaAbs <= tolerance.absoluteR || deltaPercent <= tolerance.percent;

  if (newCost != null && !withinTolerance && !accept) {
    return NextResponse.json(
      {
        code: "PRICE_CHANGED",
        previousCost: body.previousCost,
        newCost,
        deltaAbsolute: deltaAbs,
        deltaPercent,
        message: "Цена доставки изменилась. Подтвердите или смените тариф.",
      },
      { status: 409 },
    );
  }

  const snapshot: PriceSnapshot = {
    cost: finalCost,
    currency: "RUB",
    capturedAt: new Date().toISOString(),
    sourceCacheKey: cacheKey,
    refreshCheckAt: new Date().toISOString(),
  };

  return NextResponse.json({ priceSnapshot: snapshot }, { status: 200 });
}
