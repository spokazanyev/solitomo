/**
 * GET / PATCH /api/preferences/[token]
 *
 * Публичный endpoint для управления marketingOptIn / messengerOptIn заказа.
 * Идентификация — через `Order.publicToken`. Анонимизированный доступ.
 * FR-4950, FR-4952.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findOrderByToken(token: string) {
  if (!token || token.length < 6) return null;
  const p = await getPayload({ config: configPromise });
  const res = await p.find({
    collection: "orders",
    where: { publicToken: { equals: token } },
    limit: 1,
  });
  return (res.docs[0] as unknown as Record<string, unknown> | undefined) ?? null;
}

interface RouteCtx {
  params: Promise<{ token: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const order = await findOrderByToken(token);
  if (!order) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({
    token,
    marketingOptIn: Boolean(order.marketingOptIn),
    messengerOptIn: Boolean(order.messengerOptIn),
    emailMasked: maskEmail((order.customer as { email?: string } | undefined)?.email),
  });
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const order = await findOrderByToken(token);
  if (!order) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  let body: { marketingOptIn?: boolean; messengerOptIn?: boolean; newEmail?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ code: "BAD_REQUEST" }, { status: 400 });
  }
  const update: Record<string, unknown> = {};
  if (typeof body.marketingOptIn === "boolean") update.marketingOptIn = body.marketingOptIn;
  if (typeof body.messengerOptIn === "boolean") update.messengerOptIn = body.messengerOptIn;
  if (typeof body.newEmail === "string" && /.+@.+\..+/.test(body.newEmail)) {
    const customer = ((order.customer as unknown as Record<string, unknown> | undefined) ?? {}) as unknown as Record<string, unknown>;
    update.customer = { ...customer, email: body.newEmail, emailValid: true };
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ code: "BAD_REQUEST", message: "no changes" }, { status: 400 });
  }
  try {
    const p = await getPayload({ config: configPromise });
    await p.update({ collection: "orders", id: String(order.id), data: update });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ code: "ERROR", message: (err as Error).message }, { status: 500 });
  }
}

function maskEmail(email: string | undefined | null): string {
  if (!email) return "";
  const at = email.indexOf("@");
  if (at < 0) return "***";
  const domain = email.slice(at + 1);
  return `***@${domain}`;
}
