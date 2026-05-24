import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ReviewClient } from "@/components/checkout/ReviewClient";
import type { ReviewSummaryData } from "@/components/checkout/ReviewSummary";
import { readDraftOrder } from "@/lib/checkout/draft-order";

export const metadata: Metadata = {
  title: "Проверьте заказ",
  description: "Подтверждение состава заказа перед оплатой картой.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/cart/checkout/physical/review/" },
};

export const dynamic = "force-dynamic";

const VAT_RATE = 0.2;

export default async function PhysicalCheckoutReviewPage() {
  const draft = await readDraftOrder();

  if (!draft || draft.type !== "physical") {
    redirect("/cart/checkout/physical/?review=missing");
  }

  const items = draft.items.map((item) => {
    const price = typeof item.price === "number" ? item.price : null;
    return {
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      price,
      lineTotal: price != null ? price * item.quantity : null,
    };
  });

  const subtotal = items.reduce((sum, i) => sum + (i.lineTotal ?? 0), 0);
  const deliveryCost = draft.rate.cost;
  const total = subtotal + deliveryCost;
  const vat = Math.round((subtotal * VAT_RATE) / (1 + VAT_RATE));

  const addressLabel =
    draft.address.query ||
    [draft.address.city, draft.address.street, draft.address.house, draft.address.flat]
      .filter(Boolean)
      .join(", ");

  const providerLabel = `${draft.rate.providerName ?? draft.rate.providerKey}${
    draft.rate.tariffName ? " · " + draft.rate.tariffName : ""
  }${draft.rate.pickupType === 2 && draft.rate.pointAddress ? " · ПВЗ" : ""}`;

  const data: ReviewSummaryData = {
    customer: draft.customer,
    address: {
      label:
        draft.rate.pickupType === 2 && draft.rate.pointAddress
          ? `${draft.rate.pointAddress} (ПВЗ ${draft.rate.pointId ?? ""})`.trim()
          : addressLabel || "Адрес не указан",
    },
    delivery: {
      providerLabel,
      etaLabel:
        draft.rate.etaMinDays && draft.rate.etaMaxDays
          ? `${draft.rate.etaMinDays}–${draft.rate.etaMaxDays} рабочих дня`
          : undefined,
      cost: deliveryCost,
    },
    items,
    totals: {
      subtotal,
      vat,
      deliveryCost,
      total,
    },
    vatRate: VAT_RATE,
  };

  const finalizeBody = {
    cartId: draft.cartId,
    shippingOptionId: draft.rate.shippingOptionId,
    providerKey: draft.rate.providerKey,
    tariffId: draft.rate.tariffId,
    pointId: draft.rate.pointId,
    previousCost: draft.rate.cost,
    items: draft.items
      .filter((i): i is typeof i & { price: number } => typeof i.price === "number")
      .map((i) => ({ sku: i.sku, quantity: i.quantity, price: i.price })),
    address: {
      countryCode: "RU",
      postalCode: draft.address.postalCode,
      city: draft.address.city,
      addressString: draft.address.query,
    },
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="mx-auto w-full max-w-5xl px-6 py-8 md:px-10 lg:px-12">
        <nav className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
          <Link href="/">Главная</Link>
          <span>/</span>
          <Link href="/cart/">Корзина</Link>
          <span>/</span>
          <Link href="/cart/checkout/physical/">Оплата картой</Link>
          <span>/</span>
          <span className="text-slate-700">Проверка</span>
        </nav>
        <header className="mt-6 mb-8">
          <p className="mb-3 inline-flex rounded-md bg-sky-50 px-3 py-1 text-sm font-medium text-sky-800">
            Шаг 2 из 2
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            Проверьте заказ
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Перед оплатой убедитесь, что данные верны. После нажатия «Перейти к оплате»
            мы зафиксируем стоимость доставки и перенаправим вас на форму ЮKassa.
          </p>
        </header>
        <ReviewClient data={data} finalizeBody={finalizeBody} />
      </section>
    </div>
  );
}
