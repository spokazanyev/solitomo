"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PriceMismatchModal } from "./PriceMismatchModal";
import { ReviewSummary, type ReviewSummaryData } from "./ReviewSummary";

interface Props {
  data: ReviewSummaryData;
  finalizeBody: {
    cartId: string;
    shippingOptionId: string;
    providerKey: string;
    tariffId?: number;
    pointId?: string;
    previousCost: number;
    items?: Array<{ sku: string; quantity: number; price: number }>;
    address?: { countryCode: string; postalCode?: string; city?: string; addressString?: string };
  };
}

export function ReviewClient({ data, finalizeBody }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mismatchOpen, setMismatchOpen] = useState(false);
  const [mismatch, setMismatch] = useState<{ previousCost: number; newCost: number } | null>(null);

  async function callFinalize(accept: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      const url = accept
        ? "/api/checkout/finalize-shipping?accept=true"
        : "/api/checkout/finalize-shipping";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalizeBody),
      });

      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as {
          code?: string;
          previousCost?: number;
          newCost?: number;
        };
        if (data.code === "PRICE_CHANGED" && data.newCost != null && data.previousCost != null) {
          setMismatch({ previousCost: data.previousCost, newCost: data.newCost });
          setMismatchOpen(true);
          setSubmitting(false);
          return;
        }
        if (data.code === "RATE_UNAVAILABLE") {
          router.push("/cart/checkout/physical/?rate=expired");
          return;
        }
        throw new Error("Не удалось зафиксировать цену доставки");
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message || "Ошибка финализации доставки");
      }

      // Успех: snapshot записан в Order (FR-107). Создаём платёж.
      const payRes = await fetch("/api/payment/yookassa/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId: finalizeBody.cartId }),
      });
      if (!payRes.ok) {
        // Mock-режим: ЮKassa может ещё не быть подключена. Падать «мягко» —
        // показываем ошибку без потери snapshot.
        const body = (await payRes.json().catch(() => ({}))) as { message?: string; redirectUrl?: string };
        if (body.redirectUrl) {
          window.location.href = body.redirectUrl;
          return;
        }
        throw new Error(body.message || "Платёжный шлюз временно недоступен");
      }
      const payBody = (await payRes.json()) as { redirectUrl?: string };
      if (payBody.redirectUrl) {
        window.location.href = payBody.redirectUrl;
        return;
      }
      // fallback на страницу заказа (mock-режим)
      router.push("/cart/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ошибка");
      setSubmitting(false);
    }
  }

  return (
    <>
      <ReviewSummary
        data={data}
        submitting={submitting}
        errorMessage={error}
        onFinalize={() => callFinalize(false)}
        onEditDelivery={() => router.push("/cart/checkout/physical/")}
        onEditAddress={() => router.push("/cart/checkout/physical/")}
        onEditCustomer={() => router.push("/cart/checkout/physical/")}
      />
      <PriceMismatchModal
        open={mismatchOpen}
        previousCost={mismatch?.previousCost ?? 0}
        newCost={mismatch?.newCost ?? 0}
        onAccept={() => {
          setMismatchOpen(false);
          void callFinalize(true);
        }}
        onChangeRate={() => {
          setMismatchOpen(false);
          router.push("/cart/checkout/physical/?rate=expired");
        }}
        onCancel={() => {
          setMismatchOpen(false);
          setSubmitting(false);
        }}
      />
    </>
  );
}
