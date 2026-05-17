import type { Metadata } from "next";
import Link from "next/link";

import { InvoiceCheckoutForm } from "@/components/cart/InvoiceCheckoutForm";

export const metadata: Metadata = {
  title: "Выписать счёт юрлицу",
  description:
    "Заполните реквизиты компании — выпишем счёт на оплату. Доставка фиксируется в счёте, отгрузка после поступления оплаты.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/cart/checkout/invoice/" },
};

export default function InvoiceCheckoutPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="mx-auto w-full max-w-7xl px-6 py-8 md:px-10 lg:px-12">
        <nav className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
          <Link href="/">Главная</Link>
          <span>/</span>
          <Link href="/cart/">Корзина</Link>
          <span>/</span>
          <span className="text-slate-700">Счёт для юрлица</span>
        </nav>
        <header className="mt-6 mb-10">
          <p className="mb-3 inline-flex rounded-md bg-sky-50 px-3 py-1 text-sm font-medium text-sky-800">
            Счёт для юрлица
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            Выписать счёт на оплату
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Заполните реквизиты компании и выберите способ доставки. После создания заказа на email
            придёт счёт. Заказ начнёт движение после поступления оплаты.
          </p>
        </header>
        <InvoiceCheckoutForm />
      </section>
    </div>
  );
}
