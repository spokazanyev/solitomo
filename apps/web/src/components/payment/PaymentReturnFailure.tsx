"use client";

import { XCircle } from "lucide-react";
import Link from "next/link";

import { RetryPaymentButton } from "@/components/checkout/RetryPaymentButton";

interface Props {
  reason: "cancelled" | "expired";
  retryAvailable: boolean;
  orderId: string | number;
  orderPublicToken?: string;
  amountRub?: number;
}

/**
 * Failure-state UI (056 FR-5625). Retry-button shown if retryAvailable.
 */
export function PaymentReturnFailure({
  reason,
  retryAvailable,
  orderId,
  orderPublicToken,
  amountRub,
}: Props) {
  const title = reason === "expired" ? "Заказ аннулирован" : "Платёж не прошёл";
  const description =
    reason === "expired"
      ? "Время на оплату истекло. Заказ автоматически аннулирован, но корзина сохранена."
      : "Возможно, не хватило средств или банк отклонил операцию. Попробуйте другой способ оплаты.";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mx-auto max-w-2xl px-4 py-12 text-center"
    >
      <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
        <XCircle className="h-10 w-10 text-rose-600" aria-hidden="true" />
      </div>

      <h1 className="mb-3 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
      <p className="mb-8 text-slate-600">{description}</p>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {retryAvailable ? (
          <RetryPaymentButton
            orderId={String(orderId)}
            orderPublicToken={orderPublicToken}
            amountRub={amountRub}
          />
        ) : null}
        <Link
          href="/cart/"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
        >
          {reason === "expired" ? "Оформить новый заказ" : "Вернуться в корзину"}
        </Link>
        <Link
          href="/catalog/"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
        >
          В каталог
        </Link>
      </div>
    </div>
  );
}
