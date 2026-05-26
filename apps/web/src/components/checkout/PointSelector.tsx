"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Minimal Yandex Maps v3 typings ──────────────────────────────────────────
declare global {
  interface Window {
    ymaps3?: YMaps3NS;
  }
}

interface YMaps3NS {
  ready: Promise<void>;
  YMap: new (el: HTMLElement, opts: YMapOptions) => YMapInstance;
  YMapDefaultSchemeLayer: new (opts?: Record<string, unknown>) => YMapChild;
  YMapDefaultFeaturesLayer: new (opts?: Record<string, unknown>) => YMapChild;
  YMapMarker: new (props: YMapMarkerProps, el: HTMLElement) => YMapChild;
}

interface YMapOptions {
  location: { center: [number, number]; zoom: number };
}

interface YMapInstance {
  addChild(child: YMapChild): this;
  setLocation(opts: {
    center: [number, number];
    zoom: number;
    duration?: number;
  }): void;
  destroy(): void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface YMapChild {}

interface YMapMarkerProps {
  /** [longitude, latitude] — WGS-84, Yandex Maps v3 convention */
  coordinates: [number, number];
}
// ───────────────────────────────────────────────────────────────────────────

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

/** Public API key — safe to ship in the browser bundle. */
const YMAPS_KEY = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "";
const YMAPS_SRC = YMAPS_KEY
  ? `https://api-maps.yandex.ru/v3/?apikey=${YMAPS_KEY}&lang=ru_RU`
  : "";

export function PointSelector({
  open,
  cartId,
  shippingOptionId,
  providerKey,
  city,
  onSelect,
  onClose,
}: Props) {
  const [points, setPoints] = useState<PickupPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);

  /**
   * Always-current reference to the onSelect callback so map markers
   * never stale-close over an old prop value.
   */
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // ── Detect already-loaded ymaps3 on re-opens ────────────────────────────
  // When the parent unmounts <PointSelector> on close and remounts it on the
  // next open, the Script tag's onLoad won't fire again (script is already
  // in the document). We check window.ymaps3 directly on mount.
  useEffect(() => {
    if (typeof window !== "undefined" && window.ymaps3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScriptReady(true);
    }
  }, []);

  // ── Fetch pickup points when modal opens ────────────────────────────────
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setSelectedId(null);
    void (async () => {
      try {
        const res = await fetch("/api/shipping/points", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartId, shippingOptionId, providerKey, city }),
        });
        const data = (await res.json()) as { points: PickupPoint[] };
        if (!cancelled) setPoints(data.points ?? []);
      } catch {
        // network error — leave list empty, user sees the fallback message
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, cartId, shippingOptionId, providerKey, city]);

  // ── Initialise / destroy Yandex Maps instance ───────────────────────────
  useEffect(() => {
    if (!open || !scriptReady || !mapContainerRef.current) return;

    // Only plot points that have real coordinates
    type PtWithCoords = PickupPoint & { lat: number; lon: number };
    const pts = points.filter(
      (p): p is PtWithCoords =>
        typeof p.lat === "number" && typeof p.lon === "number",
    );
    if (!pts.length) return;

    const container = mapContainerRef.current;
    let inst: YMapInstance | null = null;
    let mounted = true;

    void (async () => {
      try {
        await window.ymaps3!.ready;

        // Guard: effect may have cleaned up while we awaited ready
        if (!mounted || !container.isConnected) return;

        const ymaps3 = window.ymaps3!;
        // ymaps3 uses [longitude, latitude] order (WGS-84)
        const center: [number, number] = [pts[0].lon, pts[0].lat];

        inst = new ymaps3.YMap(container, { location: { center, zoom: 12 } });
        inst.addChild(new ymaps3.YMapDefaultSchemeLayer({}));
        inst.addChild(new ymaps3.YMapDefaultFeaturesLayer({}));

        for (const pt of pts) {
          const el = document.createElement("div");
          Object.assign(el.style, {
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            background: "#2563eb",
            border: "2px solid #fff",
            boxShadow: "0 1px 4px rgba(0,0,0,.4)",
            cursor: "pointer",
            transition: "transform .1s",
          });
          el.title = pt.name ?? pt.address;

          el.addEventListener("pointerenter", () => {
            el.style.transform = "scale(1.35)";
          });
          el.addEventListener("pointerleave", () => {
            el.style.transform = "";
          });
          el.addEventListener("click", () => {
            setSelectedId(pt.pointId);
            onSelectRef.current(pt);
          });

          inst.addChild(
            new ymaps3.YMapMarker({ coordinates: [pt.lon, pt.lat] }, el),
          );
        }
      } catch {
        // map init failed — silently fall back to list-only mode
      }
    })();

    return () => {
      mounted = false;
      inst?.destroy();
    };
  }, [open, scriptReady, points]);

  // ── List-click handler ───────────────────────────────────────────────────
  const handleListSelect = useCallback(
    (pt: PickupPoint) => {
      setSelectedId(pt.pointId);
      onSelect(pt);
    },
    [onSelect],
  );

  return (
    <>
      {/* Load Yandex Maps v3 JS API lazily — only when a key is configured */}
      {YMAPS_SRC && (
        <Script
          src={YMAPS_SRC}
          strategy="lazyOnload"
          onLoad={() => setScriptReady(true)}
        />
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
            {/* ── Header ── */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="font-semibold">Выбор пункта выдачи · {city}</h3>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-700"
                onClick={onClose}
              >
                ✕
              </button>
            </div>

            {/* ── Body: list + map ── */}
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* List panel */}
              <div className="max-h-[60vh] overflow-auto p-4">
                {loading && (
                  <p className="text-sm text-slate-500">Загрузка ПВЗ…</p>
                )}
                {!loading && points.length === 0 && (
                  <p className="text-sm text-slate-600">
                    В радиусе нет пунктов выбранного провайдера. Попробуйте
                    другой тариф.
                  </p>
                )}
                <ul className="space-y-2">
                  {points.map((p) => (
                    <li
                      key={p.pointId}
                      className={`cursor-pointer rounded border p-3 text-sm transition-colors ${
                        p.pointId === selectedId
                          ? "border-sky-500 bg-sky-50"
                          : "border-slate-200 hover:border-sky-400"
                      }`}
                      onClick={() => handleListSelect(p)}
                    >
                      <div className="font-medium">{p.name ?? p.pointId}</div>
                      <div className="text-slate-600">{p.address}</div>
                      {p.workHours && (
                        <div className="text-xs text-slate-500">
                          {p.workHours}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Map panel (desktop only) */}
              <div className="relative hidden min-h-[480px] border-l border-slate-200 md:block">
                {/* ymaps3 renders into this div */}
                <div ref={mapContainerRef} className="absolute inset-0" />

                {/* Loading overlay — shown while script is still downloading */}
                {YMAPS_SRC && !scriptReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-sm text-slate-500">
                    Загрузка карты…
                  </div>
                )}

                {/* No-key fallback */}
                {!YMAPS_SRC && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-sm text-slate-400">
                    Карта недоступна
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
