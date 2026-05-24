/**
 * POST /api/admin/notifications/resend
 *
 * Body: { notificationId: string }
 *
 * Сбрасывает терминальный статус (sent/failed/skipped) → status=queued, attempt=0.
 * Cron-runner подхватит и пошлёт повторно.
 *
 * FR-4942.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getPayload, type PayloadRequest } from "payload";
import configPromise from "@payload-config";

import { resendNotification } from "@/lib/notifications/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  try {
    const p = await getPayload({ config: configPromise });
    const result = await p.auth({ headers: req.headers } as unknown as PayloadRequest);
    return Boolean(result.user);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireUser(req))) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }
  let body: { notificationId?: string };
  try {
    body = (await req.json()) as { notificationId?: string };
  } catch {
    return NextResponse.json({ code: "BAD_REQUEST", message: "invalid json" }, { status: 400 });
  }
  if (!body.notificationId) {
    return NextResponse.json({ code: "BAD_REQUEST", message: "notificationId required" }, { status: 400 });
  }
  const result = await resendNotification(body.notificationId);
  if (!result.ok) {
    return NextResponse.json({ code: "ERROR", message: result.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, notificationId: body.notificationId });
}
