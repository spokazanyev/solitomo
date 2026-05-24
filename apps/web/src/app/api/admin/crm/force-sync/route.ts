import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { buildOrderSnapshot } from "@/lib/lifecycle/order-snapshot";
import { processCrmEvent } from "@/lib/crm/twenty/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config: configPromise });
  const auth = await payload.auth({ headers: await headers() });
  if (!auth.user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { orderId?: string };
  if (!body.orderId) return NextResponse.json({ code: "INVALID_REQUEST" }, { status: 400 });
  const doc = (await payload.findByID({ collection: "orders", id: body.orderId })) as unknown as Record<string, unknown>;
  const snapshot = buildOrderSnapshot(doc);
  const result = await processCrmEvent({
    eventId: `force:${body.orderId}:${Date.now()}`,
    kind: "order.paid",
    at: new Date().toISOString(),
    emittedAt: new Date().toISOString(),
    order: snapshot,
  });
  return NextResponse.json(result);
}
