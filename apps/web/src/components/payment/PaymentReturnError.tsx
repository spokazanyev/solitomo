import { AlertCircle } from "lucide-react";
import Link from "next/link";

import { resolvePaymentError } from "./payment-error-strings";

interface Props {
  status: 403 | 404 | 500;
  message?: string;
}

/**
 * Error-state UI (056 FR-5605). 3 variants: 403 / 404 / 5xx.
 * Pure Server Component-friendly (no client hooks).
 */
export function PaymentReturnError({ status, message }: Props) {
  let errorCode: string;
  if (status === 403) errorCode = "FORBIDDEN";
  else if (status === 404) errorCode = "ORDER_NOT_FOUND";
  else errorCode = "INTERNAL_ERROR";

  const errorStrings = resolvePaymentError(errorCode);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center">
      <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
        <AlertCircle className="h-10 w-10 text-slate-600" aria-hidden="true" />
      </div>

      <h1 className="mb-3 text-3xl font-semibold tracking-tight text-slate-950">
        {errorStrings.title}
      </h1>
      <p className="mb-8 text-slate-600">{message || errorStrings.description}</p>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href={errorStrings.ctaHref || "/"}
          className="inline-flex items-center gap-2 rounded-md bg-sky-700 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
        >
          {errorStrings.ctaLabel}
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
