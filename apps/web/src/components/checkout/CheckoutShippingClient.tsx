"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useRfqCartItems } from "@/components/rfq/RfqCart";

import { DeliveryBlock, type SelectedRate } from "./DeliveryBlock";
import { DeliverySummary, type SummaryItem } from "./DeliverySummary";

interface Props {
  cartId: string;
  // optional pre-filled customer for sticky checkout. UI for customer fields
  // живёт в существующем PhysicalCheckoutForm — здесь только delivery + summary.
  customer?: {
    fullName?: string;
    email?: string;
    phone?: string;
  };
}

/**
 * Wrapper для шага «Доставка» чекаута физлица.
 * Объединяет DeliveryBlock (выбор адреса/тарифа) и DeliverySummary
 * (правая колонка с итогом + кнопка «К оплате»).
 *
 * При нажатии «К оплате»:
 * 1) POST /api/checkout/draft с черновиком (HTTP-only cookie),
 * 2) redirect на /cart/checkout/physical/review/.
 */
export function CheckoutShippingClient({ cartId, customer }: Props) {
  const router = useRouter();
  const cartItems = useRfqCartItems();
  const [selectedRate, setSelectedRate] = useState<SelectedRate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summaryItems = useMemo<SummaryItem[]>(
    () =>
      cartItems.map((item) => {
        const qty = Number.parseInt(item.quantity, 10) || 1;
        const price = typeof item.price === "number" ? item.price : null;
        return {
          sku: item.sku,
          name: item.name,
          quantity: qty,
          price,
          lineTotal: price != null ? price * qty : null,
        };
      }),
    [cartItems],
  );

  // items для расчёта тарифа (только с числовой ценой)
  const calcItems = useMemo(
    () =>
      summaryItems
        .filter((i) => typeof i.price === "number")
        .map((i) => ({ sku: i.sku, quantity: i.quantity, price: i.price as number })),
    [summaryItems],
  );

  async function handleCheckout() {
    if (!selectedRate || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const draftBody = {
        cartId,
        type: "physical" as const,
        items: cartItems.map((item) => ({
          sku: item.sku,
          name: item.name,
          slug: item.slug,
          quantity: Number.parseInt(item.quantity, 10) || 1,
          price: typeof item.price === "number" ? item.price : null,
        })),
        customer: customer ?? {},
        address: {
          query: "", // адрес также живёт в DeliveryBlock; полная нормализация будет на странице с формой получателя
        },
        rate: {
          shippingOptionId: selectedRate.rate.shippingOptionId,
          providerKey: selectedRate.rate.providerKey,
          providerName: selectedRate.rate.providerName,
          tariffId: selectedRate.rate.tariffId,
          tariffName: selectedRate.rate.tariffName,
          deliveryType: selectedRate.rate.deliveryType,
          pickupType: selectedRate.rate.pickupType,
          cost: selectedRate.rate.cost,
          etaMinDays: selectedRate.rate.etaMinDays,
          etaMaxDays: selectedRate.rate.etaMaxDays,
          pointId: selectedRate.pointId,
          pointAddress: selectedRate.pointAddress,
        },
        createdAt: new Date().toISOString(),
      };

      const res = await fetch("/api/checkout/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftBody),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(data.message || data.error || "Не удалось сохранить черновик заказа");
      }
      router.push("/cart/checkout/physical/review/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ошибка отправки");
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section className="grid gap-6">
        <DeliveryBlock cartId={cartId} items={calcItems} onSelect={setSelectedRate} />
      </section>
      <DeliverySummary
        items={summaryItems}
        selectedRate={selectedRate}
        submitting={submitting}
        errorMessage={error}
        onCheckout={handleCheckout}
      />
    </div>
  );
}
