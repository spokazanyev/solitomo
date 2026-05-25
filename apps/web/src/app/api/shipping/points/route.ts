import { NextResponse, type NextRequest } from "next/server";

import { getShippingProvider } from "@/lib/shipping/registry";
import type { PointsInput } from "@/lib/shipping/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: PointsInput;
  try {
    body = (await req.json()) as PointsInput;
  } catch {
    return NextResponse.json({ code: "INVALID_JSON" }, { status: 400 });
  }
  if (!body?.providerKey || !body?.city || !body?.cartId || !body?.shippingOptionId) {
    return NextResponse.json({ code: "INVALID_REQUEST" }, { status: 400 });
  }

  const provider = await getShippingProvider();
  if (!provider.getPickupPoints) {
    return NextResponse.json({ points: [] }, { status: 200 });
  }
  const points = await provider.getPickupPoints(body);
  return NextResponse.json({ points }, { status: 200 });
}
