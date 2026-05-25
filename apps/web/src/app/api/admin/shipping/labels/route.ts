import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { getShipmentDocument } from "@/lib/shipping/admin-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config: configPromise });
  const auth = await payload.auth({ headers: await headers() });
  if (!auth.user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    orderId?: string;
    document?: "label" | "waybill";
  };
  if (!body.orderId || !body.document)
    return NextResponse.json({ code: "INVALID_REQUEST" }, { status: 400 });
  try {
    const url = await getShipmentDocument(body.orderId, body.document);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ code: "FAILED", message: (err as Error).message }, { status: 500 });
  }
}
