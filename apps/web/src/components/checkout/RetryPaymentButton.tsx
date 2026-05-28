"use client";

import { ArrowRight, CreditCard, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

import { pushPaymentIntentEvent } from "@/components/payment/datalayer-events";
import { resolvePaymentError } from "@/components/payment/payment-error-strings";
import { trackPaymentRetry } from "@/lib/analytics/events";

interface Props {
  orderId: string;
  /** Optional: для INVALID_ORDER_STATUS redirect (056 FR-5606). */
  orderPublicToken?: string;
  /** Optional: для dataLayer payment_intent event (056 FR-5630 funnel). */
  amountRub?: number;
}

/**
 * RetryPaymentButton (056 US2, FR-5602/5606).
 *
 * Calls /api/payment/yookassa/create без retryNonce — backend reuse
 * existing idempotenceKey + returns same confirmationUrl для уже-pending
 * payment (055 FR-5510).
 */
export function RetryPaymentButton({ orderId, orderPublicToken, amountRub }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 058 T034 + FR-016: счётчик повторных попыток оплаты в течение сессии
  const attemptCountRef = useRef(0);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    try {
      // dataLayer funnel event (FR-5630)
      if (typeof amountRub === "number") {
        pushPaymentIntentEvent({ order_id: orderId, value: amountRub, currency: "RUB" });
      }

      // 058 T034: payment_retry event (FR-016). attempt_number начинается с 1.
      attemptCountRef.current += 1;
      trackPaymentRetry({ transactionId: orderId, attemptNumber: attemptCountRef.current });

      const res = await fetch("/api/payment/yookassa/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      if (res.status === 409) {
        // FR-5606: Order уже paid/expired — redirect на Order page без error
        const target = orderPublicToken ? `/cart/order/${orderPublicToken}/` : "/cart/";
        window.location.assign(target);
        return;
      }

      const body = (await res.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
        confirmationUrl?: string;
      };

      if (res.ok && body.confirmationUrl) {
        // FR-5604: assign (allows browser back)
        window.location.assign(body.confirmationUrl);
        return;
      }

      const friendly = resolvePaymentError(body.code);
      throw new Error(friendly.description || body.message || "Платёжный шлюз временно недоступен");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ошибка");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error ? (
        <p
          role="alert"
          className="rounded-md bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-900"
        >
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md bg-sky-700 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
        disabled={submitting}
        onClick={handleClick}
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {submitting ? "Создаём сессию…" : "Оплатить снова"}
        {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
      </button>
    </div>
  );
}
