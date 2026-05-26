/**
 * POST /api/shipping/calculate
 * Источник: specs/047-delivery-checkout-apiship/contracts/shipping-api.openapi.yaml
 * 060: server-side enrichment — подмешиваем физпараметры из products каталога
 *      в items перед передачей в provider (см. specs/060/.../shipping-calculate-request.md).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { getShippingProvider } from "@/lib/shipping/registry";
import type { CalculationInput } from "@/lib/shipping/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: CalculationInput;
  try {
    body = (await req.json()) as CalculationInput;
  } catch {
    return NextResponse.json({ code: "INVALID_JSON", message: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.cartId || !body?.address?.countryCode || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { code: "INVALID_REQUEST", message: "cartId, address.countryCode, items[] required" },
      { status: 400 },
    );
  }

  try {
    // 060: server-side lookup физических параметров товаров по SKU из корзины.
    // Один запрос в Payload (Postgres) на всю корзину — без N+1.
    const enrichedItems = await enrichItemsWithPhysical(body.items);

    const provider = await getShippingProvider();
    const result = await provider.calculate({ ...body, items: enrichedItems });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[shipping/calculate]", err);
    return NextResponse.json(
      { code: "UNAVAILABLE", message: "Расчёт временно недоступен" },
      { status: 503 },
    );
  }
}

/**
 * 060: для каждого items[i] подтягивает физические параметры из products.
 * Если SKU не найден или поля пустые — оставляет undefined, mapper подставит
 * defaults из apiship-settings (backward compatibility, FR-012).
 */
async function enrichItemsWithPhysical(
  items: CalculationInput["items"],
): Promise<CalculationInput["items"]> {
  const skus = items.map((i) => i.sku).filter(Boolean);
  if (skus.length === 0) return items;

  const payload = await getPayload({ config: configPromise });
  const products = await payload.find({
    collection: "products",
    where: { sku: { in: skus } },
    depth: 0,
    limit: 100,
    pagination: false,
  });

  // Map sku → physicalPackaging для O(1) lookup
  type PhysGroup = {
    weightGrams?: number | null;
    lengthMm?: number | null;
    widthMm?: number | null;
    heightMm?: number | null;
  } | null;
  const bySku = new Map<string, PhysGroup>();
  for (const p of products.docs) {
    const phys = (p as { sku?: string; physicalPackaging?: PhysGroup }).physicalPackaging ?? null;
    const key = (p as { sku?: string }).sku;
    if (typeof key === "string") bySku.set(key, phys);
  }

  return items.map((item) => {
    const phys = bySku.get(item.sku);
    if (!phys) return item;
    return {
      ...item,
      weightGrams: item.weightGrams ?? (typeof phys.weightGrams === "number" ? phys.weightGrams : undefined),
      lengthMm: item.lengthMm ?? (typeof phys.lengthMm === "number" ? phys.lengthMm : undefined),
      widthMm: item.widthMm ?? (typeof phys.widthMm === "number" ? phys.widthMm : undefined),
      heightMm: item.heightMm ?? (typeof phys.heightMm === "number" ? phys.heightMm : undefined),
    };
  });
}
