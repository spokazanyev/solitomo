"use client";

interface Props {
  open: boolean;
  previousCost: number;
  newCost: number;
  onAccept: () => void;
  onChangeRate: () => void;
  onCancel: () => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    currency: "RUB",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(n);
}

export function PriceMismatchModal({ open, previousCost, newCost, onAccept, onChangeRate, onCancel }: Props) {
  if (!open) return null;
  const delta = newCost - previousCost;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-950">Стоимость доставки изменилась</h3>
        <div className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Было:</span>
            <span className="font-medium">{fmt(previousCost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Стало:</span>
            <span className="font-semibold text-slate-950">
              {fmt(newCost)} <span className="text-xs text-slate-500">({delta > 0 ? "+" : ""}{fmt(delta)})</span>
            </span>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Цена доставки была пересчитана перевозчиком. Это нормально и происходит редко.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100" onClick={onChangeRate}>
            Сменить тариф
          </button>
          <button type="button" className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100" onClick={onCancel}>
            Отменить
          </button>
          <button type="button" className="rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800" onClick={onAccept}>
            Принять новую цену
          </button>
        </div>
      </div>
    </div>
  );
}
