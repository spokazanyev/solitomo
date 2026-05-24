import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import configPromise from "@payload-config";
import { getPayload } from "payload";

import { ReviewForm } from "@/components/order/ReviewForm";

export const metadata: Metadata = {
  title: "Оцените покупку",
  description: "Оставьте отзыв о заказе Солитон.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

export default async function OrderReviewPage({ params }: PageProps) {
  const { token } = await params;

  let order: Record<string, unknown> | null = null;
  let alreadySubmitted = false;
  try {
    const payload = await getPayload({ config: configPromise });
    const result = await payload.find({
      collection: "orders",
      where: { publicToken: { equals: token } },
      limit: 1,
    });
    order = (result.docs[0] as unknown as Record<string, unknown>) ?? null;
    if (!order) {
      try {
        order = (await payload.findByID({ collection: "orders", id: token })) as unknown as Record<string, unknown>;
      } catch {
        order = null;
      }
    }
    // Если есть отметка о ранее оставленном отзыве — показываем «спасибо» вместо формы.
    // Возможные шейпы: order.review.submittedAt | order-reviews collection lookup.
    if (order) {
      const oRecord = order as { review?: { submittedAt?: string } };
      if (oRecord.review?.submittedAt) alreadySubmitted = true;
    }
  } catch (error) {
    console.error("[order review page] read failed", error);
  }

  if (!order) {
    notFound();
  }

  const o = order as { id: string; publicToken?: string };
  const shortId = String(o.id).slice(-6).toUpperCase();

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="mx-auto w-full max-w-2xl px-6 py-8 md:px-10 lg:px-12">
        <nav className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
          <Link href="/">Главная</Link>
          <span>/</span>
          <Link href={`/cart/order/${o.publicToken ?? o.id}/`}>Заказ</Link>
          <span>/</span>
          <span className="text-slate-700">Отзыв</span>
        </nav>
        <header className="mt-6 mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            Оцените покупку № {shortId}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Уделите минуту и расскажите, как прошёл заказ. Это поможет нам стать лучше.
          </p>
        </header>

        {alreadySubmitted ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
            <h2 className="text-lg font-semibold">Спасибо, отзыв уже получен.</h2>
            <p className="mt-2 text-sm leading-6">
              Мы уже учли ваш отзыв. Если нужно что-то добавить — напишите менеджеру.
            </p>
          </section>
        ) : (
          <ReviewForm token={token} />
        )}
      </section>
    </div>
  );
}
