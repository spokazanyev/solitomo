/**
 * GET/POST /api/cron/payments-expire (055 US7, T062-T068).
 *
 * Three responsibilities (FR-5580..5585, R7, R8):
 *   1. expireStaleOrders — Orders в pending_payment старше paymentRetryWindowMin → GET ЮKassa → expired
 *   2. reconcileLostWebhooks — те же Orders, если ЮKassa succeeded → reconcile как webhook
 *   3. retryCaptureAttempts — Orders с captureAttempts[].nextRetryAt ≤ now → re-call capture
 *   4. prunePaymentEvents — PaymentEvents.receivedAt < now - 90d → delete
 *
 * Все защищено pg_try_advisory_lock (R8). CRON_SECRET header required.
 */

import { timingSafeEqual } from "node:crypto";

import { sql } from "@payloadcms/db-postgres";
import { NextResponse, type NextRequest } from "next/server";
import { getPayload, type Payload } from "payload";
import configPromise from "@payload-config";

import { emitDomainEvent } from "@/lib/payments/../lifecycle/events";
import { loadPaymentSettings } from "@/lib/payments/settings";
import {
  capturePayment,
  getPayment as ykGetPayment,
  YooKassaClientError,
  YooKassaNetworkError,
} from "@/lib/payments/yookassa-client";
import {
  cancelExhaustedCapture,
  computeNextRetryAt,
  reconcilePaymentSucceeded,
} from "@/lib/payments/yookassa-webhook-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADVISORY_LOCK_KEY = 552_000_001; // 055 cron lock (must not collide with other crons)
const BATCH_LIMIT = 100; // FR-5585
const PAYMENT_EVENTS_RETENTION_DAYS = 90; // FR-5572

interface DrizzleResult {
  rows?: Array<Record<string, unknown>>;
  [index: number]: Record<string, unknown>;
}

interface CronResult {
  expired: number;
  reconciled: number;
  captureRetried: number;
  captureExhausted: number;
  paymentEventsPruned: number;
  errors: number;
  skipped?: boolean;
}

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  const got = req.headers.get("authorization") ?? "";
  const expectedHeader = `Bearer ${expected}`;
  if (got.length !== expectedHeader.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expectedHeader));
  } catch {
    return false;
  }
}

async function tryAcquireLock(payload: Payload): Promise<boolean> {
  const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<DrizzleResult> } }).drizzle;
  const result = await db.execute(sql.raw(`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS locked`));
  const row = (result.rows?.[0] ?? (result as unknown as Record<string, unknown>[])[0]) as { locked?: boolean } | undefined;
  return Boolean(row?.locked);
}

async function releaseLock(payload: Payload): Promise<void> {
  const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<DrizzleResult> } }).drizzle;
  try {
    await db.execute(sql.raw(`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[payments-expire] advisory_unlock failed:", err);
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return run(req);
}
export async function POST(req: NextRequest): Promise<NextResponse> {
  return run(req);
}

async function run(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = await getPayload({ config: configPromise });
  const acquired = await tryAcquireLock(payload);
  if (!acquired) {
    return NextResponse.json({ ok: true, skipped: true } as CronResult & { ok: true });
  }

  const result: CronResult = {
    expired: 0,
    reconciled: 0,
    captureRetried: 0,
    captureExhausted: 0,
    paymentEventsPruned: 0,
    errors: 0,
  };

  try {
    const settings = await loadPaymentSettings();
    if (!settings.enabled) {
      return NextResponse.json({ ok: true, skipped: true, reason: "settings_disabled" });
    }

    await expireStaleOrders(payload, settings.paymentRetryWindowMin, result);
    await retryCaptureAttempts(payload, result);
    await prunePaymentEvents(payload, result);

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[payments-expire] failed:", err);
    return NextResponse.json({ ok: false, error: String(err), ...result }, { status: 500 });
  } finally {
    await releaseLock(payload);
  }
}

// --- expire + reconcile ------------------------------------------------------

interface OrderForExpire {
  id: string;
  clientNumber?: string;
  status?: string;
  payment?: {
    providerRef?: string;
    providerStatus?: string;
    createdAt?: string;
  } | null;
}

async function expireStaleOrders(
  payload: Payload,
  retryWindowMin: number,
  result: CronResult,
): Promise<void> {
  const threshold = new Date(Date.now() - retryWindowMin * 60_000).toISOString();
  const found = await payload
    .find({
      collection: "orders",
      where: {
        and: [
          { status: { equals: "pending_payment" } },
          { "payment.providerRef": { exists: true } },
          { "payment.createdAt": { less_than: threshold } },
        ],
      },
      limit: BATCH_LIMIT,
      depth: 0,
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[payments-expire] find stale orders failed:", err);
      result.errors++;
      return { docs: [] as OrderForExpire[] };
    });

  for (const orderDoc of found.docs as OrderForExpire[]) {
    const providerRef = orderDoc.payment?.providerRef;
    if (!providerRef) continue;
    try {
      const yk = await ykGetPayment(providerRef);
      const status = yk.data.status;
      if (status === "canceled") {
        await payload.update({
          collection: "orders",
          id: orderDoc.id,
          data: {
            status: "expired",
            payment: { ...(orderDoc.payment ?? {}), providerStatus: "canceled" },
          },
          context: { paymentWebhookVerified: true },
        });
        await emitDomainEvent({
          kind: "payment.expired",
          order: { id: orderDoc.id, clientNumber: orderDoc.clientNumber, status: "expired" },
          context: { payment: { providerRef } },
          eventIdSuffix: `${orderDoc.id}:cron-expired`,
        });
        await emitDomainEvent({
          kind: "order.expired",
          order: { id: orderDoc.id, clientNumber: orderDoc.clientNumber, status: "expired" },
          context: { statusFrom: orderDoc.status, statusTo: "expired" },
          eventIdSuffix: `${orderDoc.id}:cron-order-expired`,
        });
        result.expired++;
      } else if (status === "succeeded") {
        // Reconcile lost webhook
        await reconcilePaymentSucceeded(`cron:${orderDoc.id}:${Date.now()}`, { id: orderDoc.id }, yk.data);
        result.reconciled++;
      }
      // Else status pending / waiting_for_capture — leave as is, cron picks up next run
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[payments-expire] reconcile failed for ${orderDoc.id}:`, err instanceof Error ? err.message : err);
      result.errors++;
    }
  }
}

// --- capture retry -----------------------------------------------------------

interface OrderForCaptureRetry {
  id: string;
  clientNumber?: string;
  payment?: {
    providerRef?: string;
    providerStatus?: string;
    amount?: number;
    captureAttempts?: Array<{
      attemptedAt?: string;
      nextRetryAt?: string;
      exhausted?: boolean;
      error?: string;
    }>;
  } | null;
}

async function retryCaptureAttempts(payload: Payload, result: CronResult): Promise<void> {
  const now = new Date().toISOString();
  // We need Orders in pending_payment + providerStatus=authorized + has captureAttempts not exhausted
  const found = await payload
    .find({
      collection: "orders",
      where: {
        and: [
          { status: { equals: "pending_payment" } },
          { "payment.providerStatus": { equals: "authorized" } },
        ],
      },
      limit: BATCH_LIMIT,
      depth: 0,
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[payments-expire] find capture-retry candidates failed:", err);
      result.errors++;
      return { docs: [] as OrderForCaptureRetry[] };
    });

  for (const orderDoc of found.docs as OrderForCaptureRetry[]) {
    const attempts = orderDoc.payment?.captureAttempts ?? [];
    const last = attempts[attempts.length - 1];
    if (!last) continue; // no previous attempt → not our case (initial capture handled in handler)
    if (last.exhausted) continue;
    if (!last.nextRetryAt || last.nextRetryAt > now) continue; // not yet
    const providerRef = orderDoc.payment?.providerRef;
    if (!providerRef) continue;
    const amount = orderDoc.payment?.amount ?? 0;

    try {
      await capturePayment(
        providerRef,
        amount > 0 ? { amount: { value: amount.toFixed(2), currency: "RUB" } } : {},
        { idempotencyKey: `${orderDoc.id}:capture` },
      );
      // Success — clear attempts; actual mutation handled by webhook payment.succeeded
      result.captureRetried++;
    } catch (err) {
      const errorMsg = err instanceof YooKassaClientError || err instanceof YooKassaNetworkError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
      const errorCode = err instanceof YooKassaClientError ? err.providerCode : undefined;

      const nextRetryAt = computeNextRetryAt(attempts.length);
      const newAttempt = {
        attemptedAt: new Date().toISOString(),
        error: errorMsg.slice(0, 500),
        errorCode,
        nextRetryAt: nextRetryAt?.toISOString(),
        exhausted: nextRetryAt == null,
      };
      await payload
        .update({
          collection: "orders",
          id: orderDoc.id as never,
          data: {
            payment: { ...(orderDoc.payment ?? {}), captureAttempts: [...attempts, newAttempt] } as never,
          },
          context: { paymentWebhookVerified: true },
        })
        .catch(() => undefined);

      if (nextRetryAt == null) {
        // Exhausted — cancel auth + Order=cancelled
        await cancelExhaustedCapture(orderDoc.id, providerRef, orderDoc.clientNumber);
        result.captureExhausted++;
      }
    }
  }
}

// --- PaymentEvents retention prune ------------------------------------------

async function prunePaymentEvents(payload: Payload, result: CronResult): Promise<void> {
  const cutoff = new Date(Date.now() - PAYMENT_EVENTS_RETENTION_DAYS * 24 * 60 * 60_000).toISOString();
  try {
    // Use Payload delete with where clause (limit is per-call default)
    const found = await payload.find({
      collection: "paymentEvents",
      where: { receivedAt: { less_than: cutoff } },
      limit: BATCH_LIMIT,
      depth: 0,
    });
    for (const doc of found.docs as unknown as Array<{ id: string | number }>) {
      await payload
        .delete({ collection: "paymentEvents", id: doc.id as never, context: { cronPrune: true } as never })
        .catch(() => undefined);
      result.paymentEventsPruned++;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[payments-expire] prune failed:", err);
    result.errors++;
  }
}
