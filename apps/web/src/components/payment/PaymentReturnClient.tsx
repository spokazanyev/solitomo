"use client";

import { useEffect, useRef, useState } from "react";

import {
  isPurchaseAlreadyFired,
  markPurchaseFired,
  pushPurchaseEvent,
} from "./datalayer-events";
import { PaymentReturnError } from "./PaymentReturnError";
import { PaymentReturnFailure } from "./PaymentReturnFailure";
import { PaymentReturnProcessing } from "./PaymentReturnProcessing";
import { PaymentReturnSuccess } from "./PaymentReturnSuccess";
import {
  isTerminalState,
  PAYMENT_POLLING_CONFIG,
} from "./payment-polling-config";
import type {
  PaymentReturnProps,
  PaymentReturnState,
  PaymentStatusResponse,
} from "./types";

/**
 * PaymentReturnClient (056 US3, FR-5622).
 *
 * Polling state machine: initial SSR state → polling (2s × 30 attempts) →
 * terminal state (success/failure/processing-timeout) → fire dataLayer
 * purchase event on success (once).
 */
export function PaymentReturnClient(props: PaymentReturnProps) {
  const [state, setState] = useState<PaymentReturnState>(() =>
    deriveInitialState(props),
  );
  const tickCountRef = useRef(0);
  const purchaseFiredRef = useRef(false);

  // Fire dataLayer purchase on success (anti-double-fire via sessionStorage + ref).
  // Review-fix R-01: skip event if clientNumber is empty (race: webhook arrived
  // before 051 client-number-generator) — avoid polluting analytics with empty
  // transaction_id. Effect retries on next state change once clientNumber filled.
  useEffect(() => {
    if (state.kind !== "success") return;
    if (!state.clientNumber) return;
    if (purchaseFiredRef.current) return;
    if (isPurchaseAlreadyFired(props.orderId)) {
      purchaseFiredRef.current = true;
      return;
    }
    pushPurchaseEvent({
      transaction_id: state.clientNumber,
      value: props.amountRub ?? 0,
      currency: "RUB",
      payment_type: props.paymentType,
      items: (props.items ?? []).map((it) => ({
        item_id: String(it.sku ?? "unknown"),
        item_name: String(it.title ?? "unknown"),
        price: Number(it.price ?? 0),
        quantity: Number(it.quantity ?? 1),
      })),
    });
    markPurchaseFired(props.orderId);
    purchaseFiredRef.current = true;
  }, [state, props]);

  // Polling effect (FR-5622, FR-5623)
  useEffect(() => {
    if (state.kind !== "polling") return;
    if (tickCountRef.current >= PAYMENT_POLLING_CONFIG.maxAttempts) {
      setState({ kind: "processing_pending" });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      tickCountRef.current += 1;
      try {
        const tokenQuery = props.pollingTokenParam
          ? `?token=${encodeURIComponent(props.pollingTokenParam)}`
          : "";
        const res = await fetch(
          `/api/orders/${encodeURIComponent(String(props.orderId))}/payment-status${tokenQuery}`,
        );
        if (res.status === 403) {
          if (!cancelled) setState({ kind: "error", status: 403 });
          return;
        }
        if (res.status === 404) {
          if (!cancelled) setState({ kind: "error", status: 404 });
          return;
        }
        if (!res.ok) {
          if (!cancelled) setState({ kind: "error", status: 500 });
          return;
        }
        const body = (await res.json()) as PaymentStatusResponse;
        if (cancelled) return;

        const next = mapResponseToState(body, props);
        if (next.kind === "polling") {
          setState({
            kind: "polling",
            tickCount: tickCountRef.current,
            lastChecked: new Date(),
          });
        } else {
          setState(next);
        }
      } catch {
        // Network error mid-polling — продолжаем (ticks counter защищает от infinite loop)
        if (!cancelled) {
          setState({
            kind: "polling",
            tickCount: tickCountRef.current,
            lastChecked: new Date(),
          });
        }
      }
    }, PAYMENT_POLLING_CONFIG.intervalMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state, props]);

  if (state.kind === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-auto max-w-2xl px-4 py-12 text-center"
      >
        <div className="animate-pulse text-slate-600">Загружаем статус платежа…</div>
      </div>
    );
  }

  if (state.kind === "polling") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-auto max-w-2xl px-4 py-12 text-center"
      >
        <div className="inline-flex items-center gap-3 text-slate-700">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-sky-700 border-t-transparent" />
          <span>Идёт проверка платежа… ({state.tickCount}/{PAYMENT_POLLING_CONFIG.maxAttempts})</span>
        </div>
      </div>
    );
  }

  if (state.kind === "success") {
    return (
      <PaymentReturnSuccess
        clientNumber={state.clientNumber}
        receiptStatus={state.receiptStatus}
        paidAt={state.paidAt}
        amount={state.amount}
        paymentType={state.paymentType}
        publicToken={props.publicToken}
      />
    );
  }

  if (state.kind === "failure") {
    return (
      <PaymentReturnFailure
        reason={state.reason}
        retryAvailable={state.retryAvailable}
        orderId={props.orderId}
        orderPublicToken={props.publicToken}
        amountRub={props.amountRub}
      />
    );
  }

  if (state.kind === "processing_pending") {
    return <PaymentReturnProcessing clientNumber={props.clientNumber} />;
  }

  // state.kind === "error"
  return (
    <PaymentReturnError
      status={state.status as 403 | 404 | 500}
      message={state.message}
    />
  );
}

function deriveInitialState(props: PaymentReturnProps): PaymentReturnState {
  // If SSR already saw terminal state — no polling needed
  if (props.initialStatus === "paid") {
    return {
      kind: "success",
      clientNumber: props.clientNumber ?? "",
      receiptStatus: props.receiptStatus ?? null,
      paidAt: props.paidAt ?? new Date().toISOString(),
      amount: props.amountRub,
      paymentType: props.paymentType,
    };
  }
  if (props.initialStatus === "cancelled") {
    return { kind: "failure", reason: "cancelled", retryAvailable: false };
  }
  if (props.initialStatus === "expired") {
    return { kind: "failure", reason: "expired", retryAvailable: false };
  }
  if (props.initialStatus === "refunded") {
    // Refunded = post-paid state; treat as success-ish for UI display
    return {
      kind: "success",
      clientNumber: props.clientNumber ?? "",
      receiptStatus: props.receiptStatus ?? null,
      paidAt: props.paidAt ?? new Date().toISOString(),
      amount: props.amountRub,
      paymentType: props.paymentType,
    };
  }
  // pending_payment / awaiting_payment / other → start polling
  return { kind: "polling", tickCount: 0, lastChecked: new Date() };
}

function mapResponseToState(
  body: PaymentStatusResponse,
  props: PaymentReturnProps,
): PaymentReturnState {
  if (body.orderStatus === "paid") {
    return {
      kind: "success",
      clientNumber: body.clientNumber ?? props.clientNumber ?? "",
      receiptStatus: body.receiptStatus,
      paidAt: body.paidAt ?? new Date().toISOString(),
      amount: props.amountRub,
      paymentType: props.paymentType,
    };
  }
  if (body.orderStatus === "cancelled") {
    return { kind: "failure", reason: "cancelled", retryAvailable: body.retryAvailable };
  }
  if (body.orderStatus === "expired") {
    return { kind: "failure", reason: "expired", retryAvailable: false };
  }
  if (isTerminalState(body.orderStatus)) {
    // refunded — display as success
    return {
      kind: "success",
      clientNumber: body.clientNumber ?? props.clientNumber ?? "",
      receiptStatus: body.receiptStatus,
      paidAt: body.paidAt ?? new Date().toISOString(),
      amount: props.amountRub,
      paymentType: props.paymentType,
    };
  }
  // Continue polling
  return { kind: "polling", tickCount: 0, lastChecked: new Date() };
}
