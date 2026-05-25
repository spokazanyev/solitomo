/**
 * GET/POST /api/cron/notifications
 *
 * Запускается каждые ~30 секунд (Vercel Cron / external scheduler).
 * FR-4904, FR-4932.
 *
 * Авторизация: header `Authorization: Bearer ${CRON_SECRET}`.
 */

import { NextResponse, type NextRequest } from "next/server";

import { checkStuckQueue, processNotificationQueue } from "@/lib/notifications/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // dev: позволяем без секрета
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

async function run() {
  const result = await processNotificationQueue();
  const stuck = await checkStuckQueue().catch(() => ({ queued: 0, over: false }));
  return { ...result, stuck, at: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(await run());
}
