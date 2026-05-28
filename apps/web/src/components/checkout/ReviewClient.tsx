"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { pushPaymentIntentEvent } from "@/components/payment/datalayer-events";
import { resolvePaymentError } from "@/components/payment/payment-error-strings";

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
  /**
   * Full payload for POST /api/orders (создание Order перед платежом, FR-5607).
   * Передаётся из Server Component parent'а — содержит всё что нужно
   * для конверсии Cart → Order, без зависимости от display-shape (ReviewSummaryData).
   */
  orderPayload: {
    type: "physical";
    items: Array<{ sku: string; name: string; quantity: number; price: number | null }>;
    customer: {
      fullName?: string;
      email?: string;
      phone?: string;
      companyName?: string;
      inn?: string;
      kpp?: string;
    };
    delivery: {
      // 064: канал доставки (closed) + открытый перевозчик + блок ApiShip
      channel?: "pickup" | "service" | "own_carrier";
      method?: string;
      address?: string;
      city?: string;
      cost?: number;
      provider?: string;
      providerKey?: string;
      providerName?: string;
      tariffId?: number;
      deliveryType?: string;
      pickupType?: string;
      pointId?: string;
      pointAddress?: string;
      etaMinDays?: number;
      etaMaxDays?: number;
      addressNormalized?: Record<string, unknown>;
    };
    sourcePage?: string;
  };
  /** Cart token cookie value (for /api/orders payload). */
  cartToken: string;
}

/**
 * Re-export для backward compat. Phase-step labels для UI feedback в submitting state.
 */
const SUBMIT_STEPS = {
  finalizing: "Фиксируем стоимость доставки…",
  creatingOrder: "Создаём заказ…",
  creatingPayment: "Подключаемся к ЮKassa…",
  redirecting: "Переходим к оплате…",
} as const;

type SubmitStep = keyof typeof SUBMIT_STEPS | null;

export function ReviewClient({ data, finalizeBody, orderPayload, cartToken }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<SubmitStep>(null);
  const [error, setError] = useState<string | null>(null);
  const [mismatchOpen, setMismatchOpen] = useState(false);
  const [mismatch, setMismatch] = useState<{ previousCost: number; newCost: number } | null>(null);
  // 057 FR-5735: capture the form state at first submit so the PRICE_CHANGED
  // retry path (which re-enters callFinalize from PriceMismatchModal.onAccept)
  // re-uses the same consent value instead of defaulting to `true`.
  const [pendingFinalize, setPendingFinalize] = useState<
    { consent: boolean; acceptMarketingMessenger: boolean } | null
  >(null);

  async function callFinalize(accept: boolean) {
    const finalize = pendingFinalize ?? { consent: false, acceptMarketingMessenger: false };
    setSubmitting(true);
    setSubmitStep("finalizing");
    setError(null);
    try {
      // Step 1: finalize-shipping → snapshot
      const url = accept
        ? "/api/checkout/finalize-shipping?accept=true"
        : "/api/checkout/finalize-shipping";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalizeBody),
      });

      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as {
          code?: string;
          previousCost?: number;
          newCost?: number;
        };
        if (body.code === "PRICE_CHANGED" && body.newCost != null && body.previousCost != null) {
          setMismatch({ previousCost: body.previousCost, newCost: body.newCost });
          setMismatchOpen(true);
          setSubmitting(false);
          setSubmitStep(null);
          return;
        }
        if (body.code === "RATE_UNAVAILABLE") {
          router.push("/cart/checkout/physical/?rate=expired");
          return;
        }
        throw new Error("Не удалось зафиксировать цену доставки");
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message || "Ошибка финализации доставки");
      }

      // Step 2 (056 FR-5607): create Order via existing POST /api/orders.
      // Use full orderPayload prop assembled in Server Component (contains
      // raw draft data that ReviewSummaryData doesn't expose).
      setSubmitStep("creatingOrder");
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...orderPayload, cartToken, consent: finalize.consent }),
      });
      if (!orderRes.ok) {
        const body = (await orderRes.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message || "Не удалось создать заказ");
      }
      const orderBody = (await orderRes.json()) as { order?: { id: string | number; totals?: { total?: number } } };
      const orderId = orderBody.order?.id;
      if (orderId == null) {
        throw new Error("Заказ создан, но id не получен");
      }

      // FR-5630 / funnel: dataLayer payment_intent event
      pushPaymentIntentEvent({
        order_id: orderId,
        value: orderBody.order?.totals?.total ?? 0,
        currency: "RUB",
      });

      // Step 3 (FR-5601): create payment session in ЮKassa
      setSubmitStep("creatingPayment");
      const retryNonce = crypto.randomUUID();
      const payRes = await fetch("/api/payment/yookassa/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, retryNonce }),
      });

      if (payRes.status === 409) {
        // FR-5606: INVALID_ORDER_STATUS — Order уже paid/expired; не показываем ошибку, редирект на Order page
        const orderForToken = (await orderRes.json().catch(() => ({}))) as {
          order?: { publicToken?: string };
        };
        const publicToken = orderForToken.order?.publicToken;
        if (publicToken) {
          router.push(`/cart/order/${publicToken}/`);
          return;
        }
        router.push("/cart/");
        return;
      }

      if (!payRes.ok) {
        const body = (await payRes.json().catch(() => ({}))) as { code?: string; message?: string };
        const friendly = resolvePaymentError(body.code);
        throw new Error(friendly.description || body.message || "Платёжный шлюз временно недоступен");
      }

      const payBody = (await payRes.json()) as { confirmationUrl?: string };
      if (!payBody.confirmationUrl) {
        throw new Error("Ссылка на оплату не получена");
      }

      // FR-5604: window.location.assign (allows browser back)
      setSubmitStep("redirecting");
      window.location.assign(payBody.confirmationUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ошибка");
      setSubmitting(false);
      setSubmitStep(null);
    }
  }

  const submittingLabel = submitStep ? SUBMIT_STEPS[submitStep] : undefined;

  return (
    <>
      <ReviewSummary
        data={data}
        submitting={submitting}
        errorMessage={error ? `${error}${submittingLabel ? ` (${submittingLabel})` : ""}` : null}
        onFinalize={({ consent, acceptMarketingMessenger }) => {
          setPendingFinalize({ consent, acceptMarketingMessenger });
          void callFinalize(false);
        }}
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
          setSubmitStep(null);
        }}
      />
    </>
  );
}
