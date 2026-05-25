"use client";

import { useEffect, useState } from "react";

import { AddressForm, type AddressFormValue } from "./AddressForm";
import { PointSelector } from "./PointSelector";

interface ShippingRate {
  shippingOptionId: string;
  providerKey: string;
  providerName?: string;
  tariffId?: number;
  tariffName?: string;
  deliveryType: 1 | 2;
  pickupType: 1 | 2;
  cost: number;
  etaMinDays: number;
  etaMaxDays: number;
  badges?: Array<"cheapest" | "fastest" | "recommended">;
}

interface CartItem {
  sku: string;
  quantity: number;
  price: number;
}

export interface SelectedRate {
  rate: ShippingRate;
  pointId?: string;
  pointAddress?: string;
}

function fmt(amount: number) {
  return new Intl.NumberFormat("ru-RU", {
    currency: "RUB",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

export function DeliveryBlock({
  cartId,
  items,
  onSelect,
  address: externalAddress,
}: {
  cartId: string;
  items: CartItem[];
  onSelect: (rate: SelectedRate | null) => void;
  /**
   * Если адрес передан снаружи (например, единый AddressForm выше в форме),
   * блок не рендерит свой `<AddressForm>` — только список тарифов.
   * Если не передан — fallback на внутренний адрес для standalone-использования.
   */
  address?: AddressFormValue;
}) {
  const [internalAddress, setInternalAddress] = useState<AddressFormValue>({ query: "" });
  const address = externalAddress ?? internalAddress;
  const showOwnAddressForm = externalAddress === undefined;
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pointByRate, setPointByRate] = useState<Record<string, { pointId: string; pointAddress: string }>>({});
  const [pointSelectorFor, setPointSelectorFor] = useState<ShippingRate | null>(null);
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!address.isValid || !address.city) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRates([]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(null);
      onSelect(null);
      return;
    }
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/shipping/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cartId,
            address: {
              countryCode: "RU",
              postalCode: address.postalCode,
              city: address.city,
              region: address.region,
              addressString: address.query,
            },
            items,
          }),
        });
        if (!res.ok) {
          if (!cancelled) {
            setRates([]);
            setWarnings(["Расчёт временно недоступен. Менеджер уточнит стоимость."]);
          }
          return;
        }
        const data = (await res.json()) as { rates: ShippingRate[]; warnings?: string[] };
        if (cancelled) return;
        setRates(data.rates);
        setWarnings(data.warnings ?? []);
        setSelectedId(null);
        onSelect(null);
      } catch {
        if (!cancelled) {
          setRates([]);
          setWarnings(["Расчёт временно недоступен."]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [address.isValid, address.city, address.postalCode, address.query, address.region, cartId, items, onSelect]);

  function rateId(r: ShippingRate) {
    return r.shippingOptionId + ":" + (r.tariffId ?? "") + ":" + r.providerKey;
  }

  function selectRate(rate: ShippingRate) {
    const id = rateId(rate);
    setSelectedId(id);
    // Для тарифа «в ПВЗ» (deliveryType=2) обязательно требуется выбранный pointId.
    if (rate.deliveryType === 2) {
      const point = pointByRate[id];
      if (!point) {
        setPointSelectorFor(rate);
        onSelect(null);
        return;
      }
      onSelect({ rate, pointId: point.pointId, pointAddress: point.pointAddress });
    } else {
      onSelect({ rate });
    }
  }

  function handlePointSelected(point: { pointId: string; address: string }) {
    if (!pointSelectorFor) return;
    const id = rateId(pointSelectorFor);
    const next = { ...pointByRate, [id]: { pointId: point.pointId, pointAddress: point.address } };
    setPointByRate(next);
    setSelectedId(id);
    onSelect({ rate: pointSelectorFor, pointId: point.pointId, pointAddress: point.address });
    setPointSelectorFor(null);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-950">Доставка</h2>
      {showOwnAddressForm && (
        <div className="mt-4">
          <AddressForm value={address} onChange={setInternalAddress} />
        </div>
      )}
      {!address.isValid && !showOwnAddressForm && (
        <p className="mt-3 text-sm text-slate-500">
          Введите адрес выше — варианты доставки появятся автоматически.
        </p>
      )}
      {address.isValid && (
        <div className="mt-6 space-y-2">
          {loading && <p className="text-sm text-slate-500">Рассчитываем варианты доставки…</p>}
          {!loading && warnings.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm leading-5 text-amber-900">
              <strong className="font-semibold">⚠ Стоимость доставки уточняется.</strong>
              <p className="mt-1">{warnings.join(" ")}</p>
            </div>
          )}
          {rates.map((r) => {
            const id = rateId(r);
            const selected = id === selectedId;
            const isPoint = r.deliveryType === 2;
            const isPickupSelf = r.providerKey === "pickup";
            const chosenPoint = pointByRate[id];
            return (
              <div
                key={id}
                className={`rounded-md border ${selected ? "border-sky-600 bg-sky-50" : "border-slate-200"}`}
              >
                <button
                  type="button"
                  onClick={() => selectRate(r)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-950">
                      {r.providerName ?? r.providerKey}
                      {r.tariffName ? ` · ${r.tariffName}` : ""}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        {isPickupSelf ? "🏬 Самовывоз" : isPoint ? "📍 В пункт выдачи" : "🚪 Курьером до двери"}
                      </span>
                      <span>{r.etaMinDays}–{r.etaMaxDays} рабочих дн.</span>
                      {r.badges?.includes("cheapest") && (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Дешевле всех
                        </span>
                      )}
                      {r.badges?.includes("fastest") && (
                        <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                          Быстрее всех
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <div className="text-base font-semibold text-slate-950">
                      {isPickupSelf
                        ? "Бесплатно"
                        : r.cost > 0
                          ? fmt(r.cost)
                          : "По запросу"}
                    </div>
                  </div>
                </button>
                {isPoint && !isPickupSelf && (
                  <div className="border-t border-slate-200 px-4 py-2 text-xs">
                    {chosenPoint ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-slate-700">
                          📍 {chosenPoint.pointAddress}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 text-sky-700 hover:underline"
                          onClick={() => setPointSelectorFor(r)}
                        >
                          сменить
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="text-sky-700 hover:underline"
                        onClick={() => setPointSelectorFor(r)}
                      >
                        Выбрать пункт выдачи →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {pointSelectorFor && (
        <PointSelector
          open
          cartId={cartId}
          shippingOptionId={pointSelectorFor.shippingOptionId}
          providerKey={pointSelectorFor.providerKey}
          city={address.city ?? ""}
          onSelect={(p) => handlePointSelected({ pointId: p.pointId, address: p.address })}
          onClose={() => setPointSelectorFor(null)}
        />
      )}
    </section>
  );
}
