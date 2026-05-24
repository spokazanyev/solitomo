/**
 * POST /api/shipping/calculate
 * Источник: specs/047-delivery-checkout-apiship/contracts/shipping-api.openapi.yaml
 */

import { NextResponse, type NextRequest } from "next/server";

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
    const provider = await getShippingProvider();
    const result = await provider.calculate(body);
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
