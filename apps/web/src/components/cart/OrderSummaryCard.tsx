"use client";

/**
 * 061: Unified checkout summary card.
 *
 * Общая правая sticky-колонка для форм оформления заказа физлица и юрлица.
 * Юр-режим: заголовок «Заказ» + полный список с lineTotal + одна строка
 * «Итого:». Физ-режим (showDeliveryLine=true): дополнительно три строки
 * «Товары / Доставка / Итого к оплате».
 *
 * Принципиально: компонент чисто визуальный — никаких сетевых запросов,
 * никакой аналитики, никаких side-effects. Form-state и аналитические
 * события (см. spec 061 / contract CT-16) остаются в parent-формах. Этот
 * инвариант проверяется test-сьютом статически.
 */

import { ArrowRight, Loader2, type LucideIcon } from "lucide-react";
import type React from "react";

import { ConsentCheckbox } from "@/components/consent/ConsentCheckbox";
import type { RfqCartItem } from "@/components/rfq/RfqCart";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("ru-RU", {
    currency: "RUB",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

export interface OrderSummaryCardProps {
  /** Все позиции корзины — рендерятся без обрезки. */
  items: RfqCartItem[];
  /** Сумма товаров без доставки. Уже посчитана родителем через getCartTotal(). */
  total: number;
  /** Количество позиций с известной ценой. */
  knownCount: number;
  /** Количество позиций «по запросу». */
  unknownCount: number;

  /** true → блок «Товары / Доставка / Итого к оплате» (физ-режим). false/omit → одна строка «Итого:» (юр-режим). */
  showDeliveryLine?: boolean;
  /**
   * Стоимость доставки в рублях:
   *   null/undefined — не выбрана, показываем подсказку,
   *   0              — самовывоз, текст «Самовывоз — бесплатно»,
   *   >0             — обычная платная доставка.
   * Игнорируется если showDeliveryLine !== true.
   */
  deliveryCost?: number | null;
  /** Метка способа доставки: «СДЭК», «Boxberry», «Самовывоз»… */
  deliveryLabel?: string;

  // CTA
  ctaIcon: LucideIcon;
  ctaLabel: string;
  ctaLoadingLabel?: string;
  ctaHint: string;

  // Состояние
  loading: boolean;
  disabled: boolean;
  error: string | null;
  /** Опциональное предупреждение про unknown count — отображается только если unknownCount > 0. */
  unknownPaymentWarning?: string;

  // Согласие 152-ФЗ
  consent: boolean;
  onConsentChange: (next: boolean) => void;
}

export function OrderSummaryCard({
  items,
  total,
  knownCount,
  unknownCount,
  showDeliveryLine = false,
  deliveryCost = null,
  deliveryLabel,
  ctaIcon: CtaIcon,
  ctaLabel,
  ctaLoadingLabel = "Создаём заказ…",
  ctaHint,
  loading,
  disabled,
  error,
  unknownPaymentWarning,
  consent,
  onConsentChange,
}: OrderSummaryCardProps): React.ReactElement {
  const buttonDisabled = loading || disabled || !consent;

  // Grand total: товары + доставка (если в физ-режиме и выбрана), либо просто товары.
  const deliveryNumeric =
    showDeliveryLine && typeof deliveryCost === "number" ? deliveryCost : 0;
  const grandTotal = total + deliveryNumeric;
  const isGrandTotalUnknown = knownCount === 0;
  const grandTotalDisplay = isGrandTotalUnknown ? "По запросу" : formatPrice(grandTotal);

  return (
    <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 lg:sticky lg:top-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Заказ</p>

      {/* ── Список позиций ── */}
      <ul className="mt-3 grid gap-2 text-sm text-slate-700">
        {items.map((item) => {
          const qty = Number.parseInt(item.quantity, 10) || 1;
          const lineTotal =
            typeof item.price === "number" ? formatPrice(item.price * qty) : "По запросу";
          return (
            // grid + min-w-0 — единственный рабочий способ truncate в flex/grid-cell:
            // без min-w-0 длинное название не сжимается и выталкивает правую колонку.
            <li
              className="grid grid-cols-[1fr_auto] items-baseline gap-3"
              key={item.sku || item.name}
            >
              <span className="min-w-0">
                <span className="block truncate text-slate-950" title={item.name}>
                  {item.name}
                </span>
                <span className="text-xs text-slate-500">
                  {item.sku} · {qty} шт
                </span>
              </span>
              <span
                className={`whitespace-nowrap ${
                  typeof item.price === "number"
                    ? "font-semibold text-slate-950"
                    : "font-medium text-slate-600"
                }`}
              >
                {lineTotal}
              </span>
            </li>
          );
        })}
      </ul>

      <hr className="my-4 border-slate-200" />

      {/* ── Структура стоимости ── */}
      {showDeliveryLine ? (
        <div className="grid gap-1 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-slate-600">Товары:</span>
            <span className="font-semibold text-slate-950">
              {knownCount > 0 ? formatPrice(total) : "По запросу"}
            </span>
          </div>

          {deliveryCost === null || deliveryCost === undefined ? (
            <p className="mt-1 text-xs leading-5 text-amber-700">
              Стоимость доставки уточнится после выбора способа доставки.
            </p>
          ) : deliveryCost === 0 ? (
            <div className="flex items-baseline justify-between">
              <span className="text-slate-600">Доставка:</span>
              <span className="font-medium text-slate-700">Самовывоз — бесплатно</span>
            </div>
          ) : (
            <div className="flex items-baseline justify-between">
              <span className="text-slate-600">
                Доставка{deliveryLabel ? ` (${deliveryLabel})` : ""}:
              </span>
              <span className="font-semibold text-slate-950">{formatPrice(deliveryCost)}</span>
            </div>
          )}

          <div className="mt-2 flex items-end justify-between border-t border-slate-200 pt-3">
            <span className="text-sm text-slate-500">Итого к оплате:</span>
            <span className="text-2xl font-semibold text-slate-950">{grandTotalDisplay}</span>
          </div>
        </div>
      ) : (
        <div className="flex items-end justify-between">
          <span className="text-sm text-slate-500">Итого:</span>
          <span className="text-2xl font-semibold text-slate-950">{grandTotalDisplay}</span>
        </div>
      )}

      {/* ── Warning про unknown count (только если есть текст и unknown count > 0) ── */}
      {unknownPaymentWarning && unknownCount > 0 ? (
        <p className="mt-2 text-xs leading-5 text-rose-700">{unknownPaymentWarning}</p>
      ) : null}

      {/* ── Ошибка отправки формы ── */}
      {error ? (
        <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-900">
          {error}
        </p>
      ) : null}

      {/* ── Согласие 152-ФЗ ── */}
      <ConsentCheckbox className="mt-4" onChange={onConsentChange} value={consent} />

      {/* ── Кнопка действия ── */}
      <button
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-700 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={buttonDisabled}
        type="submit"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CtaIcon className="h-4 w-4" />}
        {loading ? ctaLoadingLabel : ctaLabel}
        {!loading ? <ArrowRight className="h-4 w-4" /> : null}
      </button>

      {/* ── Подпись под кнопкой ── */}
      <p className="mt-3 text-xs leading-5 text-slate-500">{ctaHint}</p>
    </aside>
  );
}
