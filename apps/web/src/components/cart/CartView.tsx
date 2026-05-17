"use client";

import { ArrowRight, CreditCard, FileText, Minus, Plus, Receipt, ShoppingCart, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import {
  getCartTotal,
  removeCartItem,
  setItemQuantity,
  useRfqCartItems,
} from "@/components/rfq/RfqCart";
import { pushEvent } from "@/lib/analytics/data-layer";

function formatPrice(amount: number) {
  return new Intl.NumberFormat("ru-RU", {
    currency: "RUB",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

export function CartView() {
  const items = useRfqCartItems();
  const { total, knownCount, unknownCount } = getCartTotal(items);

  useEffect(() => {
    if (items.length === 0) return;
    pushEvent("view_cart", {
      items: items.map((item) => ({
        item_id: item.sku,
        item_name: item.name,
        quantity: Number.parseInt(item.quantity, 10) || 1,
        price: item.price ?? undefined,
      })),
      value: total,
      currency: "RUB",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <ShoppingCart className="mx-auto h-10 w-10 text-slate-400" />
        <h2 className="mt-4 text-2xl font-semibold text-slate-950">Корзина пуста</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Откройте каталог и добавьте подходящие модели — затем оформите покупку, выпишите счёт или
          запросите коммерческое предложение.
        </p>
        <div className="mt-6">
          <Link
            className="inline-flex items-center gap-2 rounded-md bg-sky-700 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-800"
            href="/catalog/pdu/"
          >
            Открыть каталог
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section>
        <h2 className="text-lg font-semibold text-slate-950">В корзине {items.length} позиций</h2>
        <ul className="mt-4 grid gap-3">
          {items.map((item) => {
            const qty = Number.parseInt(item.quantity, 10) || 1;
            const lineTotal = typeof item.price === "number" ? item.price * qty : null;
            return (
              <li
                className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[96px_1fr_140px_160px] md:items-center"
                key={item.sku || item.name}
              >
                <div className="flex aspect-square items-center justify-center rounded-md border border-slate-100 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={item.name}
                    className="h-full w-full object-contain p-2"
                    decoding="async"
                    loading="lazy"
                    src={item.image || "/placeholders/pdu-silhouette.svg"}
                  />
                </div>
                <div>
                  <p className="font-mono text-xs text-slate-500">{item.sku}</p>
                  {item.slug ? (
                    <Link
                      className="mt-1 block text-sm font-semibold leading-6 text-slate-950 hover:text-sky-800"
                      href={`/product/${item.slug}/`}
                    >
                      {item.name}
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-950">{item.name}</p>
                  )}
                </div>
                <div className="flex items-center justify-start gap-2 md:justify-center">
                  <button
                    aria-label="Уменьшить количество"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:border-sky-500"
                    disabled={qty <= 1}
                    onClick={() => setItemQuantity(item.sku, qty - 1)}
                    type="button"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    aria-label="Количество"
                    className="h-8 w-12 rounded-md border border-slate-300 text-center text-sm font-semibold text-slate-800 focus:border-sky-600 focus:outline-none"
                    inputMode="numeric"
                    min={1}
                    onChange={(event) => {
                      const value = Number.parseInt(event.target.value, 10);
                      if (Number.isFinite(value) && value > 0) {
                        setItemQuantity(item.sku, value);
                      }
                    }}
                    type="number"
                    value={qty}
                  />
                  <button
                    aria-label="Увеличить количество"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:border-sky-500"
                    onClick={() => setItemQuantity(item.sku, qty + 1)}
                    type="button"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 md:flex-col md:items-end md:gap-1">
                  <div className="text-right">
                    {lineTotal !== null ? (
                      <p className="text-sm font-semibold text-slate-950">{formatPrice(lineTotal)}</p>
                    ) : (
                      <p className="text-sm font-semibold text-slate-500">Цена по запросу</p>
                    )}
                    {typeof item.price === "number" ? (
                      <p className="text-xs text-slate-500">{formatPrice(item.price)} × {qty}</p>
                    ) : null}
                  </div>
                  <button
                    aria-label="Удалить из корзины"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:border-rose-300 hover:text-rose-600"
                    onClick={() => removeCartItem(item.sku)}
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 lg:sticky lg:top-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Итого</h3>
        <p className="mt-2 text-3xl font-semibold text-slate-950">
          {knownCount > 0 ? formatPrice(total) : "Цена по запросу"}
        </p>
        {unknownCount > 0 && knownCount > 0 ? (
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {unknownCount} {unknownCount === 1 ? "позиция" : "позиции"} без цены — уточняем в КП.
          </p>
        ) : null}
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Доставка и итоговая стоимость рассчитываются на оформлении.
        </p>

        <div className="mt-6 grid gap-3">
          <Link
            className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-700 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-800"
            href="/cart/checkout/physical/"
            onClick={() =>
              pushEvent("begin_checkout", {
                checkout_type: "physical",
                value: total,
                currency: "RUB",
              })
            }
          >
            <CreditCard className="h-4 w-4" />
            Купить как физлицо
          </Link>
          <Link
            className="inline-flex items-center justify-center gap-2 rounded-md border border-sky-700 px-4 py-3 text-sm font-semibold text-sky-800 hover:bg-sky-50"
            href="/cart/checkout/invoice/"
            onClick={() =>
              pushEvent("begin_checkout", {
                checkout_type: "legal",
                value: total,
                currency: "RUB",
              })
            }
          >
            <Receipt className="h-4 w-4" />
            Выписать счёт юрлицу
          </Link>
          <Link
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-sky-700 hover:text-sky-800"
            href="/cart/checkout/quote/"
            onClick={() =>
              pushEvent("begin_checkout", {
                checkout_type: "quote",
                value: total,
                currency: "RUB",
              })
            }
          >
            <FileText className="h-4 w-4" />
            Запросить КП
          </Link>
        </div>

        <p className="mt-5 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          Юрлицу: способ доставки выбирается на оформлении и фиксируется в счёте. Заказ
          отгружается после поступления оплаты.
        </p>
      </aside>
    </div>
  );
}
