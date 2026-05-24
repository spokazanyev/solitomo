/**
 * POST /api/orders/[token]/review
 *
 * Принимает публичный отзыв клиента после закрытия сделки (S13).
 * В этой итерации (047) сохранение — заглушка: запись в `Order.history`
 * с типизированной заметкой. Полная коллекция `order-reviews` появится
 * в спеке 049-customer-notifications.
 *
 * Контракт:
 * - 200 { ok: true } — успех
 * - 404 — заказ не найден
 * - 409 { code: "ALREADY_SUBMITTED" } — отзыв уже оставлен
 * - 422 — невалидные данные
 */

import { NextResponse, type NextRequest } from "next/server";
import configPromise from "@payload-config";
import { getPayload } from "payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  rating?: number;
  likedMost?: string;
  improvements?: string;
  publish?: boolean;
}

const REVIEW_HISTORY_NOTE_PREFIX = "[review]";

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ code: "INVALID_JSON" }, { status: 400 });
  }

  const rating = Number.parseInt(String(body.rating ?? ""), 10);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ code: "INVALID_RATING" }, { status: 422 });
  }
  const likedMost = String(body.likedMost ?? "").slice(0, 2000);
  const improvements = String(body.improvements ?? "").slice(0, 2000);
  const publish = Boolean(body.publish);

  const payload = await getPayload({ config: configPromise });
  let order: Record<string, unknown> | null = null;
  try {
    const result = await payload.find({
      collection: "orders",
      where: { publicToken: { equals: token } },
      limit: 1,
    });
    order = (result.docs[0] as unknown as Record<string, unknown>) ?? null;
    if (!order) {
      try {
        order = (await payload.findByID({
          collection: "orders",
          id: token,
        })) as unknown as Record<string, unknown>;
      } catch {
        order = null;
      }
    }
  } catch (err) {
    console.error("[orders/review] find failed", err);
  }

  if (!order) {
    return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  }

  const o = order as { id: string; history?: Array<{ note?: string }> };

  // Проверка «уже оставлен» — по наличию записи с префиксом [review] в history.
  if ((o.history ?? []).some((h) => h?.note?.startsWith(REVIEW_HISTORY_NOTE_PREFIX))) {
    return NextResponse.json({ code: "ALREADY_SUBMITTED" }, { status: 409 });
  }

  const reviewNote = {
    rating,
    likedMost,
    improvements,
    publish,
    submittedAt: new Date().toISOString(),
  };

  try {
    await payload.update({
      collection: "orders",
      id: o.id,
      data: {
        history: [
          ...(o.history ?? []),
          {
            at: new Date().toISOString(),
            from: "review",
            to: "review",
            note: `${REVIEW_HISTORY_NOTE_PREFIX} ${JSON.stringify(reviewNote)}`,
          },
        ],
      },
    });
  } catch (err) {
    console.error("[orders/review] update failed", err);
    return NextResponse.json({ code: "WRITE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
