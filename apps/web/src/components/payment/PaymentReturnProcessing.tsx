"use client";

import { Clock3 } from "lucide-react";
import Link from "next/link";

interface Props {
  clientNumber?: string;
}

/**
 * Processing-pending UI (056 FR-5626).
 *
 * Финальный state после polling timeout (60 сек) когда webhook ещё не пришёл.
 * Customer уйдёт с page; cron-reconciliation (055 US7) подберёт через 5 мин,
 * customer получит email-подтверждение.
 */
export function PaymentReturnProcessing({ clientNumber }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto max-w-2xl px-4 py-12 text-center"
    >
      <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <Clock3 className="h-10 w-10 text-amber-600" aria-hidden="true" />
      </div>

      <h1 className="mb-3 text-3xl font-semibold tracking-tight text-slate-950">
        Платёж обрабатывается
      </h1>
      <p className="mb-2 text-slate-600">
        Подтверждение от банка может прийти с небольшой задержкой.
      </p>
      <p className="mb-8 text-slate-600">
        Мы пришлём email{clientNumber ? ` по заказу ${clientNumber}` : ""} в течение 5-10 минут,
        как только подтвердим оплату.
      </p>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md bg-sky-700 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
        >
          На главную
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
