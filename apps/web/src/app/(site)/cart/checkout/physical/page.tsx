import type { Metadata } from "next";
import Link from "next/link";

import { PhysicalCheckoutForm } from "@/components/cart/PhysicalCheckoutForm";

export const metadata: Metadata = {
  title: "Оплата как физлицо",
  description: "Оформление заказа PDU и блоков розеток Солитон с оплатой картой онлайн.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/cart/checkout/physical/" },
};

export default function PhysicalCheckoutPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="mx-auto w-full max-w-7xl px-6 py-8 md:px-10 lg:px-12">
        <nav className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
          <Link href="/">Главная</Link>
          <span>/</span>
          <Link href="/cart/">Корзина</Link>
          <span>/</span>
          <span className="text-slate-700">Оплата как физлицо</span>
        </nav>
        <header className="mt-6 mb-10">
          <p className="mb-3 inline-flex rounded-md bg-sky-50 px-3 py-1 text-sm font-medium text-sky-800">
            Оплата картой онлайн
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            Покупка как физлицо
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Укажите контактные данные и адрес доставки. После подтверждения заказа произойдёт переход
            на форму оплаты картой.
          </p>
        </header>
        <PhysicalCheckoutForm />
      </section>
    </div>
  );
}
