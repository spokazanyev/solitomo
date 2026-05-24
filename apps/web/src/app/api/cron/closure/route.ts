/**
 * GET/POST /api/cron/closure
 * Запускается раз в час (Vercel Cron / external scheduler).
 *
 * FR-901..905: автозакрытие заказов в `delivered` → `completed`
 * по истечении closureWindowDays при отсутствии disputeFlag.
 *
 * Также прогоняет expire-cron для pending_payment / awaiting_payment.
 *
 * Авторизация: header `Authorization: Bearer ${CRON_SECRET}`.
 */

import { NextResponse, type NextRequest } from "next/server";

import { runClosureCron, runExpireCron } from "@/lib/lifecycle/closure";
import { purgeExpiredCalculations } from "@/lib/shipping/apiship/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // dev: позволяем без секрета
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

async function run() {
  const closure = await runClosureCron();
  const expire = await runExpireCron();
  const purged = await purgeExpiredCalculations();
  return { closure, expire, purgedCalculations: purged, at: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const result = await run();
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const result = await run();
  return NextResponse.json(result);
}
