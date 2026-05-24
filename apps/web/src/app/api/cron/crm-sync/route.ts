/**
 * GET/POST /api/cron/crm-sync
 *
 * Обработчик очереди crm-sync-jobs. Раз в минуту:
 *  1. Берёт jobs со status=queued AND nextAttemptAt<=now()
 *  2. Помечает in_progress
 *  3. processCrmEvent
 *  4. success / failed (retry с экспоненциальным backoff'ом, до maxAttempts)
 */

import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { loadTwentySettings } from "@/lib/crm/twenty/settings";
import { processCrmEvent } from "@/lib/crm/twenty/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

async function run() {
  const settings = await loadTwentySettings();
  if (!settings.enabled) return { processed: 0, success: 0, failed: 0 };

  const payload = await getPayload({ config: configPromise });
  const now = new Date().toISOString();
  const result = await payload.find({
    collection: "crm-sync-jobs",
    where: {
      and: [
        { status: { equals: "queued" } },
        {
          or: [{ nextAttemptAt: { less_than_equal: now } }, { nextAttemptAt: { exists: false } }],
        },
      ],
    },
    limit: 25,
    sort: "createdAt",
  });

  let success = 0;
  let failed = 0;

  for (const doc of result.docs as unknown as Array<Record<string, unknown>>) {
    const id = String(doc.id);
    const attempt = Number(doc.attempt ?? 0);
    await payload.update({
      collection: "crm-sync-jobs",
      id,
      data: { status: "in_progress", lastAttemptAt: new Date().toISOString() },
    });
    try {
      const eventPayload = doc.payload as Parameters<typeof processCrmEvent>[0];
      const res = await processCrmEvent(eventPayload);
      if (res.status === "success") {
        await payload.update({
          collection: "crm-sync-jobs",
          id,
          data: { status: "success", attempt: attempt + 1, twentyRef: res.twentyRef },
        });
        success++;
      } else {
        const nextAttempt = attempt + 1;
        const isFinal = nextAttempt >= settings.retry.maxAttempts;
        const delaySec =
          settings.retry.baseDelaySec * Math.pow(2, attempt) * (0.5 + Math.random());
        await payload.update({
          collection: "crm-sync-jobs",
          id,
          data: {
            status: isFinal ? "failed" : "queued",
            attempt: nextAttempt,
            errorMessage: res.errorMessage,
            nextAttemptAt: new Date(Date.now() + delaySec * 1000).toISOString(),
          },
        });
        failed++;
      }
    } catch (err) {
      const nextAttempt = attempt + 1;
      const isFinal = nextAttempt >= settings.retry.maxAttempts;
      await payload.update({
        collection: "crm-sync-jobs",
        id,
        data: {
          status: isFinal ? "failed" : "queued",
          attempt: nextAttempt,
          errorMessage: (err as Error).message,
          nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
        },
      });
      failed++;
    }
  }

  return { processed: result.docs.length, success, failed };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(await run());
}
