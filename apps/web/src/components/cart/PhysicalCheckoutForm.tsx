"use client";

import { ArrowRight, CreditCard, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AddressForm, type AddressFormValue } from "@/components/checkout/AddressForm";
import { DeliveryBlock, type SelectedRate } from "@/components/checkout/DeliveryBlock";
import { clearCartItems, getCartTotal, useRfqCartItems } from "@/components/rfq/RfqCart";
import { pushEvent } from "@/lib/analytics/data-layer";

function formatPrice(amount: number) {
  return new Intl.NumberFormat("ru-RU", {
    currency: "RUB",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

export function PhysicalCheckoutForm() {
  const items = useRfqCartItems();
  const { total, knownCount, unknownCount } = getCartTotal(items);
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState<AddressFormValue>({ query: "" });
  const [selectedRate, setSelectedRate] = useState<SelectedRate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cartId = useMemo(() => {
    if (typeof window === "undefined") return "anon";
    let id = window.localStorage.getItem("soliton-cart-id");
    if (!id) {
      id = `cart_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      window.localStorage.setItem("soliton-cart-id", id);
    }
    return id;
  }, []);

  const itemsForShipping = useMemo(
    () =>
      items.map((item) => ({
        sku: item.sku,
        quantity: Number.parseInt(item.quantity, 10) || 1,
        price: item.price ?? 0,
      })),
    [items],
  );

  useEffect(() => {
    if (items.length === 0) return;
    pushEvent("add_payment_info", { checkout_type: "physical" });
  }, [items.length]);

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <h2 className="text-2xl font-semibold text-slate-950">Корзина пуста</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Добавьте позиции, прежде чем переходить к оплате.</p>
        <Link
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          href="/catalog/pdu/"
        >
          Открыть каталог
        </Link>
      </section>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (knownCount === 0) {
      setError("В корзине только позиции без цены — оплата картой невозможна. Запросите КП.");
      return;
    }
    if (!selectedRate) {
      setError("Выберите способ доставки.");
      return;
    }
    if (!address.isValid) {
      setError("Выберите адрес из подсказок DaData.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const rate = selectedRate.rate;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "physical",
          items: items.map((item) => ({
            sku: item.sku,
            name: item.name,
            slug: item.slug,
            quantity: Number.parseInt(item.quantity, 10) || 1,
            price: item.price ?? null,
          })),
          customer: { fullName, email, phone },
          delivery: {
            method: rate.providerKey,
            city: address.city,
            address: address.query,
            provider: rate.providerKey?.startsWith("fallback_") ? "fallback" : "apiship",
            providerKey: rate.providerKey,
            tariffId: rate.tariffId,
            deliveryType: String(rate.deliveryType),
            pickupType: String(rate.pickupType),
            pointId: selectedRate.pointId,
            pointAddress: selectedRate.pointAddress,
            cost: rate.cost,
            etaMinDays: rate.etaMinDays,
            etaMaxDays: rate.etaMaxDays,
            addressNormalized: {
              postalCode: address.postalCode,
              city: address.city,
              region: address.region,
              street: address.street,
              house: address.house,
              flat: address.flat,
              kladrId: address.kladrId,
              fiasId: address.fiasId,
              isValid: address.isValid,
            },
          },
          sourcePage: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Не удалось создать заказ");
      }

      const data = (await res.json()) as { id: string; publicToken?: string };

      // 056 FR-5603: Order created — теперь create payment session и redirect на ЮKassa.
      // Анти-pattern (TODO mock из 037) удалён: реальный backend 055 готов.
      // NOTE: `purchase` dataLayer event перенесён на /payment/return success-state
      // (FR-5630) — fires only when payment actually succeeds, not when form submits.
      // Здесь используем `payment_intent` для funnel measurement.
      pushEvent("payment_intent" as never, {
        order_id: data.id,
        value: total,
        currency: "RUB",
      });

      // Create payment session
      const retryNonce =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const payRes = await fetch("/api/payment/yookassa/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: data.id, retryNonce }),
      });

      if (payRes.status === 409) {
        // Order уже в paid/expired — redirect на Order page
        router.push(`/cart/order/${data.publicToken ?? data.id}/`);
        return;
      }

      if (!payRes.ok) {
        const errBody = (await payRes.json().catch(() => ({}))) as { code?: string; message?: string };
        throw new Error(errBody.message || "Платёжный шлюз временно недоступен");
      }

      const payBody = (await payRes.json()) as { confirmationUrl?: string };
      if (!payBody.confirmationUrl) {
        throw new Error("Ссылка на оплату не получена");
      }

      clearCartItems();
      // FR-5604: window.location.assign (allows browser back)
      window.location.assign(payBody.confirmationUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ошибка отправки");
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-8 lg:grid-cols-[1fr_360px]" onSubmit={handleSubmit}>
      <section className="grid gap-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-950">Контактные данные</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              ФИО *
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                onChange={(event) => setFullName(event.target.value)}
                required
                type="text"
                value={fullName}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Email *
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Телефон *
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                onChange={(event) => setPhone(event.target.value)}
                required
                type="tel"
                value={phone}
              />
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-950">Адрес</p>
          <div className="mt-4">
            <AddressForm value={address} onChange={setAddress} />
            {address.isValid && (
              <p className="mt-2 text-xs text-emerald-700">
                Адрес подтверждён DaData
                {address.postalCode ? ` · индекс ${address.postalCode}` : ""}
              </p>
            )}
          </div>
        </div>

        <DeliveryBlock cartId={cartId} items={itemsForShipping} onSelect={setSelectedRate} address={address} />

        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-5 text-sm leading-6 text-amber-900">
          <strong className="font-semibold">Оплата в режиме mock.</strong> Интеграция с
          платёжным шлюзом ЮKassa подключается отдельно (см. <code>deferred-content-track.md</code>,
          раздел 15). Сейчас при отправке формы создаётся заказ и происходит переход на страницу
          подтверждения, как если бы оплата уже прошла.
        </div>
      </section>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 lg:sticky lg:top-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">К оплате</p>
        <p className="mt-2 text-3xl font-semibold text-slate-950">
          {knownCount > 0 ? formatPrice(total + (selectedRate?.rate.cost ?? 0)) : "Цена по запросу"}
        </p>
        {selectedRate ? (
          <p className="mt-1 text-xs text-slate-600">
            Товары: {formatPrice(total)} ·{" "}
            {selectedRate.rate.providerKey === "pickup"
              ? "Самовывоз бесплатно"
              : selectedRate.rate.cost > 0
                ? `Доставка: ${formatPrice(selectedRate.rate.cost)}`
                : "Доставка по запросу — уточнит менеджер"}
          </p>
        ) : (
          <p className="mt-1 text-xs text-amber-700">Выберите способ доставки, чтобы увидеть итог.</p>
        )}
        {unknownCount > 0 && knownCount > 0 ? (
          <p className="mt-1 text-xs leading-5 text-rose-700">
            {unknownCount} {unknownCount === 1 ? "позиция" : "позиции"} без цены — оплата картой не сработает, нужен КП.
          </p>
        ) : null}
        <ul className="mt-4 grid gap-2 text-sm text-slate-700">
          {items.slice(0, 5).map((item) => {
            const qty = Number.parseInt(item.quantity, 10) || 1;
            return (
              <li className="flex justify-between gap-3" key={item.sku || item.name}>
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="text-xs text-slate-500">× {qty}</span>
              </li>
            );
          })}
          {items.length > 5 ? (
            <li className="text-xs text-slate-500">и ещё {items.length - 5} позиций...</li>
          ) : null}
        </ul>
        {error ? (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-900">{error}</p>
        ) : null}
        <button
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-700 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {submitting ? "Создаём заказ..." : "Перейти к оплате"}
          {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
        </button>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          После реальной интеграции ЮKassa здесь будет переход на защищённую форму оплаты картой.
        </p>
      </aside>
    </form>
  );
}
