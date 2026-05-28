import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import configPromise from "@payload-config";
import { getPayload } from "payload";

export const metadata: Metadata = {
  title: "Заказ",
  description: "Статус заказа Солитон",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
};

function formatPrice(amount: number | null | undefined) {
  if (typeof amount !== "number") return "—";
  return new Intl.NumberFormat("ru-RU", {
    currency: "RUB",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  new: { label: "Новый", tone: "bg-slate-100 text-slate-800" },
  pending_payment: { label: "Ожидает оплаты картой", tone: "bg-amber-100 text-amber-900" },
  awaiting_payment: { label: "Ожидает оплаты по счёту", tone: "bg-amber-100 text-amber-900" },
  paid: { label: "Оплачен", tone: "bg-emerald-100 text-emerald-900" },
  fulfilling: { label: "В обработке", tone: "bg-sky-100 text-sky-900" },
  shipped: { label: "Отправлен", tone: "bg-sky-100 text-sky-900" },
  delivered: { label: "Доставлен", tone: "bg-emerald-100 text-emerald-900" },
  cancelled: { label: "Отменён", tone: "bg-rose-100 text-rose-900" },
  expired: { label: "Просрочен", tone: "bg-rose-100 text-rose-900" },
};

export default async function OrderPage({ params }: PageProps) {
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
      // fallback: try by id
      try {
        order = (await payload.findByID({ collection: "orders", id: token })) as unknown as Record<string, unknown>;
      } catch {
        order = null;
      }
    }
  } catch (error) {
    console.error("[order page] read failed", error);
  }

  if (!order) {
    notFound();
  }

  const o = order as {
    id: string;
    type: string;
    status: string;
    customerLabel?: string;
    items?: Array<{ sku?: string; name?: string; quantity?: number; price?: number | null; lineTotal?: number | null }>;
    totals?: { subtotal?: number; vat?: number; deliveryCost?: number; total?: number };
    customer?: { fullName?: string; email?: string; phone?: string; companyName?: string; inn?: string };
    delivery?: { channel?: string; method?: string; providerName?: string; address?: string; city?: string };
    invoice?: { number?: string; pdfUrl?: string };
    createdAt: string;
  };
  const statusInfo = STATUS_LABELS[o.status] ?? { label: o.status, tone: "bg-slate-100 text-slate-800" };
  // 064: человекочитаемая подпись доставки по каналу (а не сырой method/код).
  const deliveryLabel =
    o.delivery?.channel === "pickup"
      ? "Самовывоз"
      : o.delivery?.channel === "own_carrier"
        ? "Транспортной компанией покупателя"
        : o.delivery?.providerName || o.delivery?.method || "Служба доставки";

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="mx-auto w-full max-w-4xl px-6 py-8 md:px-10 lg:px-12">
        <nav className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
          <Link href="/">Главная</Link>
          <span>/</span>
          <span className="text-slate-700">Заказ</span>
        </nav>
        <header className="mt-6">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusInfo.tone}`}
          >
            {statusInfo.label}
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            Заказ № {String(o.id).slice(-6).toUpperCase()}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Создан {new Date(o.createdAt).toLocaleString("ru-RU")}
          </p>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Позиции</h2>
            <ul className="mt-3 grid gap-3">
              {(o.items ?? []).map((item, idx) => (
                <li className="grid gap-1 border-b border-slate-100 pb-3 last:border-0 last:pb-0" key={`${item.sku ?? "item"}-${idx}`}>
                  <p className="font-mono text-xs text-slate-500">{item.sku}</p>
                  <p className="text-sm font-semibold text-slate-950">{item.name}</p>
                  <p className="text-xs text-slate-600">
                    {item.quantity} шт × {formatPrice(item.price ?? null)} = {formatPrice(item.lineTotal ?? null)}
                  </p>
                </li>
              ))}
            </ul>
            <hr className="my-4 border-slate-200" />
            <dl className="grid gap-2 text-sm text-slate-700">
              <div className="flex justify-between"><dt>Сумма позиций</dt><dd>{formatPrice(o.totals?.subtotal ?? null)}</dd></div>
              <div className="flex justify-between"><dt>Доставка</dt><dd>{formatPrice(o.totals?.deliveryCost ?? 0)}</dd></div>
              <div className="flex justify-between text-base font-semibold text-slate-950"><dt>Итого</dt><dd>{formatPrice(o.totals?.total ?? null)}</dd></div>
            </dl>
          </div>

          <aside className="grid gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Покупатель</h3>
              <div className="mt-3 text-sm leading-6 text-slate-700">
                {o.customer?.companyName ? <p className="font-semibold text-slate-950">{o.customer.companyName}</p> : null}
                {o.customer?.inn ? <p className="text-xs text-slate-500">ИНН {o.customer.inn}</p> : null}
                {o.customer?.fullName ? <p className="mt-1">{o.customer.fullName}</p> : null}
                {o.customer?.email ? <p>{o.customer.email}</p> : null}
                {o.customer?.phone ? <p>{o.customer.phone}</p> : null}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Доставка</h3>
              <div className="mt-3 text-sm leading-6 text-slate-700">
                <p>{deliveryLabel}</p>
                {o.delivery?.city ? <p>{o.delivery.city}</p> : null}
                {o.delivery?.address ? <p>{o.delivery.address}</p> : null}
              </div>
            </div>
            {o.type === "legal" ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50/40 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-sky-800">Счёт</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Счёт будет отправлен на {o.customer?.email ?? "указанный email"}.
                </p>
                <Link
                  className="mt-3 inline-flex items-center gap-2 rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
                  href={`/api/invoice/${o.id}`}
                  target="_blank"
                >
                  Скачать PDF счёта
                </Link>
              </div>
            ) : null}
          </aside>
        </section>

        <section className="mt-10 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">Что дальше</h2>
          {o.type === "legal" ? (
            <ol className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 md:grid-cols-3">
              <li>1. Получите счёт по email и оплатите по реквизитам.</li>
              <li>2. После поступления оплаты статус заказа меняется на «Оплачен».</li>
              <li>3. Менеджер запускает отгрузку выбранным способом доставки.</li>
            </ol>
          ) : (
            <ol className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 md:grid-cols-3">
              <li>1. Подтверждение оплаты придёт на ваш email.</li>
              <li>2. Менеджер свяжется для уточнения деталей доставки.</li>
              <li>3. Трек-номер появится в этом заказе после отгрузки.</li>
            </ol>
          )}
        </section>
      </section>
    </div>
  );
}
