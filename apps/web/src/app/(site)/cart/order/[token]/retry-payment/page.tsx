import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import configPromise from "@payload-config";
import { getPayload } from "payload";

import { RetryPaymentButton } from "@/components/checkout/RetryPaymentButton";

export const metadata: Metadata = {
  title: "Повторная оплата",
  description: "Повторная попытка оплаты заказа Солитон.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

function formatPrice(amount: number | null | undefined) {
  if (typeof amount !== "number") return "—";
  return new Intl.NumberFormat("ru-RU", {
    currency: "RUB",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

function diffMinutes(future: string | undefined | null): number | null {
  if (!future) return null;
  const t = new Date(future).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 60000);
}

export default async function RetryPaymentPage({ params }: PageProps) {
  const { token } = await params;

  let order: Record<string, unknown> | null = null;
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
        order = (await payload.findByID({
          collection: "orders",
          id: token,
        })) as unknown as Record<string, unknown>;
      } catch {
        order = null;
      }
    }
  } catch (error) {
    console.error("[retry-payment] read failed", error);
  }

  if (!order) {
    notFound();
  }

  const o = order as {
    id: string;
    status: string;
    paymentRetryUntil?: string | null;
    publicToken?: string;
    items?: Array<{ sku?: string; name?: string; quantity?: number; price?: number | null; lineTotal?: number | null }>;
    totals?: { subtotal?: number; deliveryCost?: number; total?: number };
    delivery?: { providerKey?: string; tariffName?: string; method?: string };
  };

  // Допустимые статусы для retry: pending_payment.
  // Иначе — redirect на страницу заказа.
  if (o.status !== "pending_payment") {
    redirect(`/cart/order/${o.publicToken ?? o.id}/`);
  }

  const minutesLeft = diffMinutes(o.paymentRetryUntil ?? null);
  if (o.paymentRetryUntil && minutesLeft != null && minutesLeft <= 0) {
    redirect("/cart/?error=order-expired");
  }

  const providerLabel = [o.delivery?.providerKey, o.delivery?.tariffName].filter(Boolean).join(" · ");

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="mx-auto w-full max-w-3xl px-6 py-8 md:px-10 lg:px-12">
        <nav className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
          <Link href="/">Главная</Link>
          <span>/</span>
          <Link href={`/cart/order/${o.publicToken ?? o.id}/`}>Заказ</Link>
          <span>/</span>
          <span className="text-slate-700">Повторная оплата</span>
        </nav>
        <header className="mt-6 mb-8">
          <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
            Ожидает оплаты
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            Заказ № {String(o.id).slice(-6).toUpperCase()} — повторная оплата
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Предыдущая попытка оплаты не была завершена. Сумма заказа и стоимость доставки
            зафиксированы.
            {minutesLeft != null ? (
              <>
                {" "}Снимок цены действителен ещё{" "}
                <strong className="text-slate-900">~{Math.max(0, minutesLeft)} мин</strong>.
              </>
            ) : null}
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Сводка</h2>
          <ul className="mt-3 grid gap-2 text-sm text-slate-700">
            {(o.items ?? []).map((item, idx) => (
              <li className="flex justify-between gap-3" key={`${item.sku ?? "item"}-${idx}`}>
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="text-xs text-slate-500">
                  {item.quantity} шт × {formatPrice(item.price ?? null)}
                </span>
              </li>
            ))}
          </ul>
          <hr className="my-4 border-slate-200" />
          <dl className="grid gap-2 text-sm text-slate-700">
            <div className="flex justify-between">
              <dt>Подытог</dt>
              <dd>{formatPrice(o.totals?.subtotal ?? null)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Доставка{providerLabel ? ` · ${providerLabel}` : ""}</dt>
              <dd>{formatPrice(o.totals?.deliveryCost ?? 0)}</dd>
            </div>
            <hr className="my-2 border-slate-200" />
            <div className="flex justify-between text-base font-semibold text-slate-950">
              <dt>Итого</dt>
              <dd>{formatPrice(o.totals?.total ?? null)}</dd>
            </div>
          </dl>
        </section>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Link
            href={`/cart/order/${o.publicToken ?? o.id}/`}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← К заказу
          </Link>
          <RetryPaymentButton orderId={String(o.id)} />
        </div>
      </section>
    </div>
  );
}
