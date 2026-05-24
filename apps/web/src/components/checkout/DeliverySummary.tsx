"use client";

import { ArrowRight, CreditCard, Loader2 } from "lucide-react";

import type { SelectedRate } from "./DeliveryBlock";

export interface SummaryItem {
  sku: string;
  name: string;
  quantity: number;
  price: number | null;
  lineTotal?: number | null;
}

interface Props {
  items: SummaryItem[];
  selectedRate: SelectedRate | null;
  vatRate?: number; // 0.20 = 20%
  submitting?: boolean;
  errorMessage?: string | null;
  onCheckout: () => void;
}

function formatPrice(amount: number | null | undefined) {
  if (typeof amount !== "number") return "—";
  return new Intl.NumberFormat("ru-RU", {
    currency: "RUB",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

export function DeliverySummary({
  items,
  selectedRate,
  vatRate = 0.2,
  submitting = false,
  errorMessage,
  onCheckout,
}: Props) {
  const knownItems = items.filter((i) => typeof i.price === "number");
  const subtotal = knownItems.reduce(
    (sum, item) => sum + (item.price ?? 0) * item.quantity,
    0,
  );
  const deliveryCost = selectedRate?.rate.cost ?? 0;
  // НДС: для физлица учтён внутри subtotal — выделяем расчётно
  const vat = vatRate > 0 ? Math.round((subtotal * vatRate) / (1 + vatRate)) : 0;
  const total = subtotal + deliveryCost;

  const disabled = submitting || !selectedRate || knownItems.length === 0;

  return (
    <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 lg:sticky lg:top-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Ваш заказ</p>
      <ul className="mt-4 grid gap-2 text-sm text-slate-700">
        {items.slice(0, 5).map((item) => (
          <li className="flex justify-between gap-3" key={item.sku || item.name}>
            <span className="min-w-0 truncate">{item.name}</span>
            <span className="text-xs text-slate-500">× {item.quantity}</span>
          </li>
        ))}
        {items.length > 5 ? (
          <li className="text-xs text-slate-500">и ещё {items.length - 5} позиций...</li>
        ) : null}
      </ul>

      <hr className="my-4 border-slate-200" />

      <dl className="grid gap-2 text-sm text-slate-700">
        <div className="flex justify-between">
          <dt>Подытог</dt>
          <dd>{formatPrice(subtotal)}</dd>
        </div>
        {vatRate > 0 ? (
          <div className="flex justify-between text-xs text-slate-500">
            <dt>в т.ч. НДС {Math.round(vatRate * 100)}%</dt>
            <dd>{formatPrice(vat)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt>
            Доставка
            {selectedRate ? (
              <span className="ml-1 block text-xs text-slate-500">
                {selectedRate.rate.providerName ?? selectedRate.rate.providerKey}
                {selectedRate.rate.tariffName ? ` · ${selectedRate.rate.tariffName}` : ""}
              </span>
            ) : null}
          </dt>
          <dd>{selectedRate ? formatPrice(deliveryCost) : <span className="text-slate-400">—</span>}</dd>
        </div>
      </dl>

      <hr className="my-4 border-slate-200" />

      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-slate-700">Итого</span>
        <span className="text-2xl font-semibold text-slate-950">{formatPrice(total)}</span>
      </div>

      {errorMessage ? (
        <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-900">
          {errorMessage}
        </p>
      ) : null}

      <button
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-700 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
        disabled={disabled}
        onClick={onCheckout}
        type="button"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {submitting ? "Подготавливаем…" : "Перейти к оплате"}
        {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
      </button>

      {!selectedRate ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">Выберите вариант доставки выше.</p>
      ) : (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          На следующем шаге вы сможете проверить заказ перед оплатой.
        </p>
      )}
    </aside>
  );
}
