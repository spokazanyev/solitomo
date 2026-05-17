import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { RfqForm } from "@/components/RfqForm";

export const metadata: Metadata = {
  title: "Запрос коммерческого предложения",
  description:
    "Отправьте позиции из корзины на коммерческое предложение — менеджер подготовит КП с документами и сроком поставки.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/cart/checkout/quote/" },
};

export default function CartQuotePage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="mx-auto w-full max-w-7xl px-6 py-8 md:px-10 lg:px-12">
        <nav className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
          <Link href="/">Главная</Link>
          <span>/</span>
          <Link href="/cart/">Корзина</Link>
          <span>/</span>
          <span className="text-slate-700">Запрос КП</span>
        </nav>
        <header className="mt-6 mb-10">
          <p className="mb-3 inline-flex rounded-md bg-sky-50 px-3 py-1 text-sm font-medium text-sky-800">
            Запрос КП
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            Коммерческое предложение по позициям корзины
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Заполните контактные данные — позиции из корзины уже подставлены. После отправки
            менеджер подготовит КП с документами, сроком и условиями поставки.
          </p>
        </header>
        <Suspense
          fallback={
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Загрузка формы...
            </div>
          }
        >
          <RfqForm />
        </Suspense>
      </section>
    </div>
  );
}
