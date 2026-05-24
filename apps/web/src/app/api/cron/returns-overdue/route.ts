/**
 * GET/POST /api/cron/returns-overdue (053 T052, FR-5340).
 *
 * Critical for ст. 22 Закона 2300-1: refund deadline is 10 calendar days from
 * the customer's request. This cron scans Returns whose `requestedAt` is older
 * than 10 days but whose status is not `refunded` (or terminal), and emits
 * `return.overdue` → T-108 to manager.
 *
 * Idempotency: tracked by Return.history entries with reason="overdue_alert"
 * to avoid spamming the same overdue alert multiple times.
 *
 * Authorization: Bearer ${CRON_SECRET}.
 */

import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";
import { getPayload, type Payload } from "payload";
import configPromise from "@payload-config";

import { buildReturnSnapshot, emitReturnEvent } from "@/lib/returns/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OVERDUE_DAYS = 10;

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }
  // M6 fix: constant-time compare avoids timing-attack surface on CRON_SECRET
  const got = req.headers.get("authorization") ?? "";
  const expectedHeader = `Bearer ${expected}`;
  if (got.length !== expectedHeader.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expectedHeader));
  } catch {
    return false;
  }
}

interface RunResult {
  scanned: number;
  alerted: number;
  skipped: number;
  errors: number;
  at: string;
}

async function run(): Promise<RunResult> {
  const payload: Payload = await getPayload({ config: configPromise });
  const threshold = new Date(Date.now() - OVERDUE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let scanned = 0;
  let alerted = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const result = await payload.find({
      collection: "returns" as never,
      where: {
        and: [
          { status: { in: ["requested", "approved", "received"] } },
          { requestedAt: { less_than: threshold } },
        ],
      },
      limit: 200,
    });

    scanned = result.docs.length;

    for (const doc of result.docs as unknown as Array<Record<string, unknown>>) {
      try {
        // Skip if already alerted (check history)
        const history = Array.isArray(doc.history)
          ? (doc.history as Array<{ reason?: string }>)
          : [];
        const alreadyAlerted = history.some(
          (h) => typeof h.reason === "string" && h.reason.startsWith("overdue_alert"),
        );
        if (alreadyAlerted) {
          skipped++;
          continue;
        }

        // C3 fix: enrich snapshot with order email/clientNumber (T-108 is manager-only,
        // but consistency matters and other return.* templates need customer email).
        let customerEmail: string | undefined;
        let orderClientNumber: string | undefined;
        const orderId =
          typeof doc.orderId === "string"
            ? doc.orderId
            : typeof doc.orderId === "number"
              ? String(doc.orderId)
              : undefined;
        if (orderId) {
          try {
            const order = (await payload.findByID({
              collection: "orders",
              id: orderId,
            })) as unknown as Record<string, unknown>;
            customerEmail = (order.customer as { email?: string } | undefined)?.email;
            if (typeof order.clientNumber === "string") orderClientNumber = order.clientNumber;
          } catch {
            // Continue with undefined enrichment
          }
        }

        // Emit return.overdue (049 matrix routes to T-108 manager)
        const snapshot = buildReturnSnapshot(doc, { customerEmail, orderClientNumber });
        await emitReturnEvent("return.overdue", snapshot, {
          meta: { overdueDays: OVERDUE_DAYS, requestedAt: doc.requestedAt },
        });

        // Append history marker so we don't repeat the alert
        const newHistory = [
          ...history,
          {
            at: new Date().toISOString(),
            fromStatus: doc.status,
            toStatus: doc.status,
            reason: `overdue_alert:${new Date().toISOString().slice(0, 10)}`,
          },
        ];
        // M7 fix: pass skipAggregateRecompute so Returns.afterChange doesn't
        // re-run recomputeOrderReturnAggregates for what is just an audit-log append.
        await payload.update({
          collection: "returns" as never,
          id: String(doc.id),
          data: { history: newHistory } as never,
          context: { skipAggregateRecompute: true } as never,
        });

        alerted++;
      } catch (err) {
        errors++;
        // eslint-disable-next-line no-console
        console.error("[returns-overdue] item failed:", doc.id, err);
      }
    }
  } catch (err) {
    errors++;
    // eslint-disable-next-line no-console
    console.error("[returns-overdue] query failed:", err);
  }

  return { scanned, alerted, skipped, errors, at: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(await run());
}
