"use client";

import { useEffect, useState } from "react";

interface PickupPoint {
  pointId: string;
  providerKey: string;
  name?: string;
  address: string;
  workHours?: string;
  lat?: number;
  lon?: number;
}

interface Props {
  open: boolean;
  cartId: string;
  shippingOptionId: string;
  providerKey: string;
  city: string;
  onSelect: (point: PickupPoint) => void;
  onClose: () => void;
}

export function PointSelector({ open, cartId, shippingOptionId, providerKey, city, onSelect, onClose }: Props) {
  const [points, setPoints] = useState<PickupPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/shipping/points", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartId, shippingOptionId, providerKey, city }),
        });
        const data = (await res.json()) as { points: PickupPoint[] };
        if (!cancelled) setPoints(data.points ?? []);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, cartId, shippingOptionId, providerKey, city]);

  if (!open) return null;

  // TODO: Подключить Яндекс.Карты v3 JS API через <Script> + ymaps3.ready.
  // Сейчас — только список ПВЗ. Карта — в следующей итерации (требует API key).
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="font-semibold">Выбор пункта выдачи · {city}</h3>
          <button type="button" className="text-slate-500 hover:text-slate-700" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          <div className="max-h-[60vh] overflow-auto">
            {loading && <p className="text-sm text-slate-500">Загрузка ПВЗ…</p>}
            {!loading && points.length === 0 && (
              <p className="text-sm text-slate-600">
                В радиусе нет пунктов выбранного провайдера. Попробуйте другой тариф.
              </p>
            )}
            <ul className="space-y-2">
              {points.map((p) => (
                <li
                  key={p.pointId}
                  className="cursor-pointer rounded border border-slate-200 p-3 text-sm hover:border-sky-500"
                  onClick={() => onSelect(p)}
                >
                  <div className="font-medium">{p.name ?? p.pointId}</div>
                  <div className="text-slate-600">{p.address}</div>
                  {p.workHours && <div className="text-xs text-slate-500">{p.workHours}</div>}
                </li>
              ))}
            </ul>
          </div>
          <div className="hidden min-h-[400px] items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 md:flex">
            Карта (Яндекс.Карты v3) — TODO: подключить с YANDEX_MAPS_API_KEY
            <div className="mt-2 text-[10px]">© Я.Карты · © Яндекс</div>
          </div>
        </div>
      </div>
    </div>
  );
}
