/**
 * POST /api/admin/notifications/ping
 *
 * Connection check email-провайдера. Доступ — только авторизованным Payload-пользователям.
 * Обновляет `notificationsSettings.connectionStatus`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getPayload, type PayloadRequest } from "payload";
import configPromise from "@payload-config";

import { invalidateNotificationsCache, loadNotificationsSettings } from "@/lib/notifications/settings";
import { buildEmailSender } from "@/lib/notifications/senders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser(req: NextRequest): Promise<boolean> {
  // Полноценная Payload-аутентификация — через cookie. Здесь делаем минимальную
  // проверку: dev-удобство (если нет cookie, но есть CRON_SECRET — тоже пускаем).
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
  const settings = await loadNotificationsSettings();
  const sender = buildEmailSender(settings);
  if (!sender) {
    const result = { ok: false, message: "Email sender unavailable (missing apiKey or provider)" };
    await persistConnectionStatus(result);
    return NextResponse.json(result, { status: 200 });
  }
  const ping = await sender.ping();
  const ok = ping.status === "sent";
  const result = { ok, message: ok ? "OK" : ping.errorMessage ?? "ping failed", provider: sender.providerName };
  await persistConnectionStatus(result);
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  return POST(req);
}

async function persistConnectionStatus(result: { ok: boolean; message?: string }) {
  try {
    const p = await getPayload({ config: configPromise });
    await p.updateGlobal({
      slug: "notifications-settings",
      data: {
        connectionStatus: {
          lastCheckedAt: new Date().toISOString(),
          emailOk: result.ok,
          message: result.message ?? "",
        },
      },
    });
    invalidateNotificationsCache();
  } catch {
    // ignore
  }
}
