"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

interface Props {
  clientNumber: string;
  receiptStatus: "pending" | "succeeded" | "canceled" | null;
  paidAt: string;
  amount?: number;
  paymentType?: "bank_card" | "sbp" | "yoo_money" | "sberbank";
  publicToken?: string;
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  bank_card: "Банковская карта",
  sbp: "СБП",
  yoo_money: "YooMoney-кошелёк",
  sberbank: "Сбербанк Онлайн",
};

/**
 * Success-state UI (056 FR-5624). ARIA-accessible.
 * Focus moves to primary CTA after mount (NFR-5604).
 */
export function PaymentReturnSuccess({
  clientNumber,
  receiptStatus,
  paidAt,
  amount,
  paymentType,
  publicToken,
}: Props) {
  const ctaRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // Focus primary CTA для keyboard-users
    ctaRef.current?.focus();
  }, []);

  const orderPageUrl = publicToken
    ? `/cart/order/${encodeURIComponent(publicToken)}/`
    : "/";

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto max-w-2xl px-4 py-12 text-center"
    >
      <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden="true" />
      </div>

      <h1 className="mb-3 text-3xl font-semibold tracking-tight text-slate-950">
        Заказ оплачен
      </h1>

      {clientNumber ? (
        <p className="mb-2 text-lg text-slate-700">
          Номер заказа: <b className="text-slate-950">{clientNumber}</b>
        </p>
      ) : null}

      {amount != null ? (
        <p className="mb-1 text-slate-600">
          Сумма: <b>{amount.toLocaleString("ru-RU")} ₽</b>
          {paymentType && PAYMENT_TYPE_LABELS[paymentType]
            ? ` · ${PAYMENT_TYPE_LABELS[paymentType]}`
            : ""}
        </p>
      ) : null}

      {paidAt ? (
        <p className="mb-6 text-sm text-slate-500">
          {new Date(paidAt).toLocaleString("ru-RU")}
        </p>
      ) : null}

      <div className="mb-8 rounded-md bg-sky-50 px-4 py-3 text-sm text-sky-900">
        {receiptStatus === "succeeded" ? (
          <>Чек 54-ФЗ отправлен на ваш email.</>
        ) : receiptStatus === "pending" ? (
          <>Чек 54-ФЗ обрабатывается. Придёт на email в течение 5-10 минут.</>
        ) : receiptStatus === "canceled" ? (
          <span className="inline-flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span>Фискальный чек не выдан, мы свяжемся с вами в течение часа.</span>
          </span>
        ) : (
          <>Подтверждение оплаты отправлено на ваш email.</>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          ref={ctaRef}
          href={orderPageUrl}
          className="inline-flex items-center gap-2 rounded-md bg-sky-700 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
        >
          Открыть заказ
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}
