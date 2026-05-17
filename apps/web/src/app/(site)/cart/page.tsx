import type { Metadata } from "next";
import Link from "next/link";

import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = {
  title: "Корзина",
  description: "Корзина PDU и блоков розеток Солитон. Оплатите картой как физлицо, выпишите счёт юрлицу или запросите коммерческое предложение.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/cart/" },
};

export default function CartPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="mx-auto w-full max-w-7xl px-6 py-8 md:px-10 lg:px-12">
        <nav className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
          <Link href="/">Главная</Link>
          <span>/</span>
          <span className="text-slate-700">Корзина</span>
        </nav>
        <header className="mt-6 mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            Корзина
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Соберите позиции из каталога и выберите удобный сценарий оформления.
          </p>
        </header>
        <CartView />
      </section>
    </div>
  );
}
