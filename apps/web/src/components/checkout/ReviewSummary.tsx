"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";

export interface ReviewSummaryItem {
  sku: string;
  name: string;
  quantity: number;
  price: number | null;
  lineTotal?: number | null;
}

export interface ReviewSummaryData {
  customer: {
    fullName?: string;
    email?: string;
    phone?: string;
  };
  address: {
    label: string; // "Москва, ул. Тверская, 7, кв. 12"
  };
  delivery: {
    providerLabel: string; // "СДЭК · до двери"
    etaLabel?: string; // "2–3 рабочих дня"
    cost: number;
  };
  items: ReviewSummaryItem[];
  totals: {
    subtotal: number;
    vat?: number;
    deliveryCost: number;
    total: number;
  };
  vatRate?: number;
}

interface Props {
  data: ReviewSummaryData;
  submitting?: boolean;
  errorMessage?: string | null;
  onFinalize: (params: { acceptMarketingMessenger: boolean }) => void;
  onEditDelivery: () => void;
  onEditAddress?: () => void;
  onEditCustomer?: () => void;
}

function formatPrice(amount: number | null | undefined) {
  if (typeof amount !== "number") return "—";
  return new Intl.NumberFormat("ru-RU", {
    currency: "RUB",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

export function ReviewSummary({
  data,
  submitting = false,
  errorMessage,
  onFinalize,
  onEditDelivery,
  onEditAddress,
  onEditCustomer,
}: Props) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptMessenger, setAcceptMessenger] = useState(false);

  const disabled = !acceptedTerms || submitting;

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Получатель</h2>
            {onEditCustomer ? (
              <button
                type="button"
                className="text-xs text-sky-700 hover:underline"
                onClick={onEditCustomer}
              >
                изменить
              </button>
            ) : null}
          </div>
          <div className="mt-3 text-sm leading-6 text-slate-700">
            {data.customer.fullName ? <p className="font-medium text-slate-950">{data.customer.fullName}</p> : null}
            {data.customer.phone ? <p>{data.customer.phone}</p> : null}
            {data.customer.email ? <p>{data.customer.email}</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Доставка</h2>
            <button
              type="button"
              className="text-xs text-sky-700 hover:underline"
              onClick={onEditDelivery}
            >
              изменить
            </button>
          </div>
          <div className="mt-3 text-sm leading-6 text-slate-700">
            <p className="font-medium text-slate-950">{data.delivery.providerLabel}</p>
            {data.delivery.etaLabel ? <p>Срок: {data.delivery.etaLabel}</p> : null}
            <p>Стоимость: {formatPrice(data.delivery.cost)}</p>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Адрес</h2>
          {onEditAddress ? (
            <button
              type="button"
              className="text-xs text-sky-700 hover:underline"
              onClick={onEditAddress}
            >
              изменить
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-700">{data.address.label}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Позиции ({data.items.length})
        </h2>
        <ul className="mt-3 grid gap-3">
          {data.items.map((item, idx) => (
            <li
              className="grid gap-1 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
              key={`${item.sku || "item"}-${idx}`}
            >
              <p className="font-mono text-xs text-slate-500">{item.sku}</p>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-slate-950">{item.name}</p>
                <p className="text-sm text-slate-700">
                  {item.quantity} шт × {formatPrice(item.price ?? null)}
                </p>
              </div>
              {item.lineTotal != null ? (
                <p className="text-right text-xs text-slate-500">{formatPrice(item.lineTotal)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Итого</h2>
        <dl className="mt-3 grid gap-2 text-sm text-slate-700">
          <div className="flex justify-between">
            <dt>Подытог</dt>
            <dd>{formatPrice(data.totals.subtotal)}</dd>
          </div>
          {typeof data.totals.vat === "number" && data.totals.vat > 0 ? (
            <div className="flex justify-between text-xs text-slate-500">
              <dt>в т.ч. НДС {data.vatRate ? Math.round(data.vatRate * 100) : 20}%</dt>
              <dd>{formatPrice(data.totals.vat)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>Доставка ({data.delivery.providerLabel})</dt>
            <dd>{formatPrice(data.totals.deliveryCost)}</dd>
          </div>
          <hr className="my-2 border-slate-200" />
          <div className="flex justify-between text-base font-semibold text-slate-950">
            <dt>К оплате</dt>
            <dd>{formatPrice(data.totals.total)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
          />
          <span>
            Согласен с{" "}
            <a className="text-sky-700 hover:underline" href="/policy/offer/" target="_blank" rel="noreferrer">
              офертой
            </a>{" "}
            и{" "}
            <a className="text-sky-700 hover:underline" href="/policy/privacy/" target="_blank" rel="noreferrer">
              обработкой персональных данных
            </a>
            .
          </span>
        </label>
        <label className="mt-3 flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
            checked={acceptMessenger}
            onChange={(e) => setAcceptMessenger(e.target.checked)}
          />
          <span>Хочу получать уведомления о статусе заказа в мессенджере.</span>
        </label>

        {errorMessage ? (
          <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-900">{errorMessage}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="text-sm text-slate-600 hover:text-slate-900"
            onClick={onEditDelivery}
          >
            ← Назад
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-sky-700 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
            disabled={disabled}
            onClick={() => onFinalize({ acceptMarketingMessenger: acceptMessenger })}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? "Готовим оплату…" : "Перейти к оплате"}
            {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        </div>
      </section>
    </div>
  );
}
