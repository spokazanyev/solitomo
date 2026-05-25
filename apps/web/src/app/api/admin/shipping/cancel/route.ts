import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { cancelShipmentForOrder } from "@/lib/shipping/admin-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config: configPromise });
  const auth = await payload.auth({ headers: await headers() });
  if (!auth.user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { orderId?: string; reason?: string };
  if (!body.orderId) return NextResponse.json({ code: "INVALID_REQUEST" }, { status: 400 });
  try {
    await cancelShipmentForOrder(body.orderId, body.reason);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ code: "FAILED", message: (err as Error).message }, { status: 500 });
  }
}
