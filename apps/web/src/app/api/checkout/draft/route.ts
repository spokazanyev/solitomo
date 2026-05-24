/**
 * POST /api/checkout/draft  — записать черновик заказа в HTTP-only cookie
 * DELETE /api/checkout/draft — стереть черновик
 *
 * Используется клиентским CheckoutShippingClient перед redirect-ом на /review/.
 */

import { NextResponse, type NextRequest } from "next/server";

import { clearDraftOrder, writeDraftOrder, type DraftOrder } from "@/lib/checkout/draft-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: DraftOrder;
  try {
    body = (await req.json()) as DraftOrder;
  } catch {
    return NextResponse.json({ code: "INVALID_JSON" }, { status: 400 });
  }
  if (!body?.cartId || !body?.rate || !body?.items?.length) {
    return NextResponse.json({ code: "INVALID_REQUEST" }, { status: 400 });
  }
  const draft: DraftOrder = {
    ...body,
    createdAt: new Date().toISOString(),
  };
  await writeDraftOrder(draft);
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE() {
  await clearDraftOrder();
  return NextResponse.json({ ok: true }, { status: 200 });
}
