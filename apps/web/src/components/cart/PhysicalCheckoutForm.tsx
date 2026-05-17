"use client";

import { ArrowRight, CreditCard, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { clearCartItems, getCartTotal, useRfqCartItems } from "@/components/rfq/RfqCart";
import { pushEvent } from "@/lib/analytics/data-layer";

const DELIVERY_OPTIONS = [
  { value: "cdek", label: "СДЭК" },
  { value: "boxberry", label: "Boxberry" },
  { value: "russian-post", label: "Почта России" },
  { value: "pickup", label: "Самовывоз" },
];

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
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [delivery, setDelivery] = useState("cdek");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    setSubmitting(true);

    try {
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
          delivery: { method: delivery, city, address },
          sourcePage: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Не удалось создать заказ");
      }

      const data = (await res.json()) as { id: string; publicToken?: string };

      // Создание платежа в ЮKassa (заглушка) — TODO(owner): подключить /api/payment/yookassa/create
      // с реальными YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY. Сейчас просто прокидываем на success-страницу
      // с пометкой "оплата в режиме mock".
      pushEvent("purchase", {
        transaction_id: data.id,
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
      router.push(`/cart/order/${data.publicToken ?? data.id}/?type=physical&pay=mock`);
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
          <p className="text-sm font-semibold text-slate-950">Доставка</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Способ
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
              Город *
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                onChange={(event) => setCity(event.target.value)}
                required
                type="text"
                value={city}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600 md:col-span-2">
              Адрес / ПВЗ *
              <textarea
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-600 focus:outline-none"
                onChange={(event) => setAddress(event.target.value)}
                required
                rows={2}
                value={address}
              />
            </label>
          </div>
        </div>

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
          {knownCount > 0 ? formatPrice(total) : "Цена по запросу"}
        </p>
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
