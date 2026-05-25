/**
 * POST /api/admin/returns/[id]/refund (053 T033, FR-5313, FR-5318).
 *
 * Transitions Return `received` → `refunded`.
 *
 * Flow:
 *   - refundMethod=card-original → call YooKassa createRefund (idempotent)
 *   - refundMethod=bank-transfer/other → record manualConfirmation
 * Then append to Order.payment.refunds[] and set status=refunded.
 */

import { NextResponse, type NextRequest } from "next/server";

import { loadAdminContext } from "@/lib/returns/admin-helpers";
import { returnError } from "@/lib/returns/api-utils";
import { createRefund } from "@/lib/payments/yookassa-refunds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  manualConfirmation?: {
    paymentDoc?: string;
    bankAccount?: string;
    bik?: string;
    recipientName?: string;
    purpose?: string;
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loaded = await loadAdminContext(id);
  if (!loaded.ok) return loaded.response;
  const { payload, returnDoc, user } = loaded.ctx;

  const body = (await req.json().catch(() => ({}))) as Body;

  // Status guard — only received → refunded is valid
  if (returnDoc.status !== "received") {
    return returnError(
      409,
      "invalid_transition",
      `Cannot refund: return status=${returnDoc.status}, expected received`,
    );
  }

  // Load order for paymentId + payment.refunds[] update
  const order = (await payload.findByID({
    collection: "orders",
    id: returnDoc.orderId,
  })) as unknown as Record<string, unknown>;

  const payment = (order.payment as Record<string, unknown> | undefined) ?? {};
  const providerRef = typeof payment.providerRef === "string" ? payment.providerRef : null;

  let refundProviderRef: string | undefined;
  let refundStatus: "succeeded" | "pending" | "canceled" = "succeeded";

  if (returnDoc.refundMethod === "card-original") {
    if (!providerRef) {
      return returnError(
        409,
        "yookassa_error",
        "Order has no paymentId — use bank-transfer instead",
      );
    }
    try {
      const refund = await createRefund({
        paymentId: providerRef,
        amount: returnDoc.refundAmount,
        description: `Возврат по заказу ${returnDoc.orderNumberSnapshot ?? returnDoc.orderId}`,
        idempotencyKey: `${returnDoc.id}:refund`,
      });
      refundProviderRef = refund.id;
      refundStatus = refund.status;
    } catch (err) {
      const message = (err as Error)?.message ?? String(err);
      payload.logger.error(`[returns:refund] YooKassa failed: ${message}`);
      // Don't transition — let manager retry or switch to manual
      return returnError(409, "yookassa_error", message);
    }
  } else {
    // bank-transfer / other — require manual confirmation fields
    if (
      !body.manualConfirmation?.paymentDoc?.trim() &&
      returnDoc.refundMethod === "bank-transfer"
    ) {
      return returnError(
        400,
        "validation_failed",
        "manualConfirmation.paymentDoc required for bank-transfer",
      );
    }
  }

  // H3 fix: atomic Order + Return update via Payload transaction.
  // If either update fails, both roll back — no orphaned refund records.
  // (We've already called YooKassa above; the idempotency key protects against
  // double-spend on retry.)
  const existingRefunds = Array.isArray(payment.refunds)
    ? (payment.refunds as Array<Record<string, unknown>>)
    : [];

  // H3 fix part 2: dedup by providerRefundId to handle concurrent clicks.
  const providerRefundId = refundProviderRef ?? `manual:${returnDoc.id}`;
  if (existingRefunds.some((r) => r.providerRefundId === providerRefundId)) {
    payload.logger.warn(
      `[returns:refund] refund ${providerRefundId} already in Order.payment.refunds[] — skipping duplicate append`,
    );
  }

  const newRefundEntry = {
    providerRefundId,
    returnId: returnDoc.id,
    amount: returnDoc.refundAmount,
    refundedAt: new Date().toISOString(),
    providerStatus: refundStatus,
  };

  const transactionID = await payload.db.beginTransaction?.();
  try {
    // 1. Append to Order.payment.refunds[] (unless already present)
    if (!existingRefunds.some((r) => r.providerRefundId === providerRefundId)) {
      await payload.update({
        collection: "orders",
        id: returnDoc.orderId,
        data: {
          payment: { ...payment, refunds: [...existingRefunds, newRefundEntry] },
        } as never,
        context: { skipImmutability: true } as never,
        ...(transactionID ? { req: { transactionID } as never } : {}),
      });
    }

    // 2. Transition Return to refunded
    const data: Record<string, unknown> = {
      status: "refunded",
      refundProviderRef,
    };
    if (returnDoc.refundMethod !== "card-original") {
      data.manualRefundConfirmation = {
        byUser: Number(user.id),
        at: new Date().toISOString(),
        paymentDoc: body.manualConfirmation?.paymentDoc,
        bankAccount: body.manualConfirmation?.bankAccount,
        bik: body.manualConfirmation?.bik,
        recipientName: body.manualConfirmation?.recipientName,
        purpose: body.manualConfirmation?.purpose,
      };
    }
    const updated = await payload.update({
      collection: "returns" as never,
      id,
      data: data as never,
      ...(transactionID ? { req: { transactionID } as never } : {}),
    });

    if (transactionID) await payload.db.commitTransaction?.(transactionID);
    return NextResponse.json(updated);
  } catch (err) {
    if (transactionID) await payload.db.rollbackTransaction?.(transactionID);
    const message = (err as Error)?.message ?? String(err);
    if (message.includes("forbidden transition")) {
      return returnError(409, "invalid_transition", message);
    }
    payload.logger.error(`[returns:refund] transaction failed: ${message}`);
    return returnError(500, "validation_failed", "Refund recording failed");
  }
}
