"use client";

import { ArrowRight, CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";

interface Props {
  orderId: string;
}

export function RetryPaymentButton({ orderId }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/yookassa/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, retry: true }),
      });
      const body = (await res.json().catch(() => ({}))) as { redirectUrl?: string; message?: string };
      if (res.ok && body.redirectUrl) {
        window.location.href = body.redirectUrl;
        return;
      }
      throw new Error(body.message || "Платёжный шлюз временно недоступен");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ошибка");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-900">{error}</p>
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
