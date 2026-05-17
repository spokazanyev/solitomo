"use client";

import { ArrowRight, Loader2, Receipt } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { clearCartItems, getCartTotal, useRfqCartItems } from "@/components/rfq/RfqCart";
import { pushEvent } from "@/lib/analytics/data-layer";

const DELIVERY_OPTIONS = [
  { value: "cdek", label: "СДЭК" },
  { value: "boxberry", label: "Boxberry" },
  { value: "russian-post", label: "Почта России" },
  { value: "tc", label: "Транспортной компанией" },
  { value: "pickup", label: "Самовывоз" },
];

function formatPrice(amount: number) {
  return new Intl.NumberFormat("ru-RU", {
    currency: "RUB",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

export function InvoiceCheckoutForm() {
  const items = useRfqCartItems();
  const { total, knownCount, unknownCount } = getCartTotal(items);
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [inn, setInn] = useState("");
  const [kpp, setKpp] = useState("");
  const [ogrn, setOgrn] = useState("");
  const [legalAddress, setLegalAddress] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [delivery, setDelivery] = useState("cdek");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) return;
    pushEvent("add_shipping_info", { checkout_type: "legal" });
  }, [items.length]);

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <h2 className="text-2xl font-semibold text-slate-950">Корзина пуста</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Добавьте позиции, прежде чем выписывать счёт.</p>
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
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "legal",
          items: items.map((item) => ({
            sku: item.sku,
            name: item.name,
            slug: item.slug,
            quantity: Number.parseInt(item.quantity, 10) || 1,
            price: item.price ?? null,
          })),
          customer: {
            fullName,
            email,
            phone,
            companyName,
            inn,
            kpp,
            ogrn,
            legalAddress,
          },
          delivery: {
            method: delivery,
            address: deliveryAddress,
            city: deliveryCity,
          },
          sourcePage: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Не удалось создать заказ");
      }

      const data = (await res.json()) as { id: string; publicToken?: string };

      pushEvent("invoice_requested", {
        order_id: data.id,
        value: total,
        currency: "RUB",
        items: items.map((item) => ({
          item_id: item.sku,
          item_name: item.name,
          quantity: Number.parseInt(item.quantity, 10) || 1,
          price: item.price ?? undefined,
        })),
      });

      clearCartItems();
      router.push(`/cart/order/${data.publicToken ?? data.id}/?type=invoice`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ошибка отправки");
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-8 lg:grid-cols-[1fr_360px]" onSubmit={handleSubmit}>
      <section className="grid gap-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Receipt className="h-4 w-4 text-sky-700" />
            Реквизиты юрлица
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Наименование компании *
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                onChange={(event) => setCompanyName(event.target.value)}
                required
                type="text"
                value={companyName}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              ИНН *
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                inputMode="numeric"
                onChange={(event) => setInn(event.target.value)}
                pattern="[0-9]{10,12}"
                required
                type="text"
                value={inn}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              КПП
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                inputMode="numeric"
                onChange={(event) => setKpp(event.target.value)}
                type="text"
                value={kpp}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              ОГРН
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                inputMode="numeric"
                onChange={(event) => setOgrn(event.target.value)}
                type="text"
                value={ogrn}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600 md:col-span-2">
              Юридический адрес
              <textarea
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                onChange={(event) => setLegalAddress(event.target.value)}
                rows={2}
                value={legalAddress}
              />
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-950">Контактное лицо</p>
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
              Телефон
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                onChange={(event) => setPhone(event.target.value)}
                type="tel"
                value={phone}
              />
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-950">Доставка</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Способ доставки фиксируется в счёте сразу. Отгрузка — после поступления оплаты.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Способ доставки
              <select
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:border-sky-600 focus:outline-none"
                onChange={(event) => setDelivery(event.target.value)}
                value={delivery}
              >
                {DELIVERY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Город
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                onChange={(event) => setDeliveryCity(event.target.value)}
                type="text"
                value={deliveryCity}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600 md:col-span-2">
              Адрес / ПВЗ
              <textarea
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                onChange={(event) => setDeliveryAddress(event.target.value)}
                rows={2}
                value={deliveryAddress}
              />
            </label>
          </div>
        </div>
      </section>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 lg:sticky lg:top-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Заказ</p>
        <ul className="mt-3 grid gap-2 text-sm text-slate-700">
          {items.map((item) => {
            const qty = Number.parseInt(item.quantity, 10) || 1;
            return (
              <li className="flex justify-between gap-3" key={item.sku || item.name}>
                <span className="min-w-0">
                  <span className="block truncate text-slate-950">{item.name}</span>
                  <span className="text-xs text-slate-500">{item.sku} · {qty} шт</span>
                </span>
                <span className="font-semibold text-slate-950">
                  {typeof item.price === "number" ? formatPrice(item.price * qty) : "По запросу"}
                </span>
              </li>
            );
          })}
        </ul>
        <hr className="my-4 border-slate-200" />
        <div className="flex items-end justify-between">
          <span className="text-sm text-slate-500">Итого:</span>
          <span className="text-2xl font-semibold text-slate-950">
            {knownCount > 0 ? formatPrice(total) : "По запросу"}
          </span>
        </div>
        {unknownCount > 0 ? (
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Часть позиций без цены — точная сумма будет в счёте.
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-900">{error}</p>
        ) : null}
        <button
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-700 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
          {submitting ? "Создаём заказ..." : "Выписать счёт"}
          {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
        </button>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          После создания заказа вы получите счёт по email. Заказ начнёт движение после поступления оплаты.
        </p>
      </aside>
    </form>
  );
}
