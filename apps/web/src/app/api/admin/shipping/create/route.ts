import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { createShipmentForOrder } from "@/lib/shipping/admin-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Минимальная проверка авторизации через Payload session
  const headersList = await headers();
  const payload = await getPayload({ config: configPromise });
  const auth = await payload.auth({ headers: headersList });
  if (!auth.user) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }
  let body: { orderId?: string };
  try {
    body = (await req.json()) as { orderId?: string };
  } catch {
    return NextResponse.json({ code: "INVALID_JSON" }, { status: 400 });
  }
  if (!body.orderId) {
    return NextResponse.json({ code: "INVALID_REQUEST" }, { status: 400 });
  }
  try {
    const info = await createShipmentForOrder(body.orderId);
    return NextResponse.json(info, { status: 200 });
  } catch (err) {
    const status = (err as Error).message.includes("Уже есть активное") ? 409 : 422;
    return NextResponse.json({ code: "FAILED", message: (err as Error).message }, { status });
  }
}
