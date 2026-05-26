"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  /**
   * pointId уже ранее выбранного ПВЗ (если есть) — подсвечивается при открытии,
   * чтобы пользователь видел свой предыдущий выбор и мог его поменять.
   */
  initialPointId?: string;
  /** Применить выбор и закрыть форму (вызывается только при нажатии «Выбрать»). */
  onSelect: (point: PickupPoint) => void;
  /** Закрыть форму без изменений («Отмена», ✕, Escape, клик по фону). */
  onClose: () => void;
}

/** Public API key — used only to decide whether to show the map panel. */
const YMAPS_KEY = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "";

const PIN_DEFAULT = "#2563eb"; // blue-600
const PIN_SELECTED = "#16a34a"; // green-600

/** Русское склонение «пункт / пункта / пунктов». */
function pluralizePoints(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "пункт";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "пункта";
  return "пунктов";
}

export function PointSelector({
  open,
  cartId,
  shippingOptionId,
  providerKey,
  city,
  initialPointId,
  onSelect,
  onClose,
}: Props) {
  const [points, setPoints] = useState<PickupPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPointId ?? null,
  );
  const [query, setQuery] = useState("");
  const [mobileTab, setMobileTab] = useState<"list" | "map">("list");

  const mapContainerRef = useRef<HTMLDivElement>(null);

  /** Live ref so the Escape-key handler always closes the *current* modal. */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  /** Map instance + marker DOM nodes — looked up by pointId for re-styling. */
  const mapInstanceRef = useRef<YMapInstance | null>(null);
  const markersRef = useRef<Map<string, HTMLDivElement>>(new Map());

  /** List-item DOM refs — used to scroll the selected row into view. */
  const listItemRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  // ── Detect when the layout-level Yandex Maps script is ready ───────────
  // The <Script strategy="afterInteractive"> in (site)/layout.tsx loads the
  // API independently of this component's lifecycle. We poll window.ymaps3
  // until it appears (typically within 1-2 seconds of page hydration).
  useEffect(() => {
    if (typeof window !== "undefined" && window.ymaps3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScriptReady(true);
      return;
    }
    const interval = setInterval(() => {
      if (window.ymaps3) {
        setScriptReady(true);
        clearInterval(interval);
      }
    }, 150);
    return () => clearInterval(interval);
  }, []);

  // ── Fetch pickup points when modal opens ────────────────────────────────
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // Initial selection — preserve the previously chosen point (if any) so the
    // user can see his prior pick when reopening, and edit it.
    setSelectedId(initialPointId ?? null);
    setQuery("");
    setMobileTab("list");
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
    // initialPointId намеренно вне deps — он используется только для начального
    // снимка состояния при открытии модалки. Реакция на его изменение посреди
    // работы пользователя сбросила бы превью-выбор, что нарушит UX.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cartId, shippingOptionId, providerKey, city]);

  // ── Filtered points based on search query ──────────────────────────────
  const filteredPoints = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return points;
    return points.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        p.address.toLowerCase().includes(q),
    );
  }, [points, query]);

  // ── Initialise / destroy Yandex Maps instance ──────────────────────────
  // Re-runs only when the set of points changes (not on selection / mobile-tab
  // toggles) so the map is preserved across UI interactions.
  useEffect(() => {
    if (!open || !scriptReady || !mapContainerRef.current) return;

    type PtWithCoords = PickupPoint & { lat: number; lon: number };
    const pts = points.filter(
      (p): p is PtWithCoords =>
        typeof p.lat === "number" && typeof p.lon === "number",
    );
    if (!pts.length) return;

    const container = mapContainerRef.current;
    // Snapshot the markers Map for cleanup — appeases the exhaustive-deps lint
    // rule about ref values potentially changing before cleanup runs.
    const markers = markersRef.current;
    let inst: YMapInstance | null = null;
    let mounted = true;

    void (async () => {
      try {
        await window.ymaps3!.ready;
        if (!mounted || !container.isConnected) return;

        const ymaps3 = window.ymaps3!;
        // Center on the centroid of all points so the cluster is visible by default.
        const cx = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.lat, 0) / pts.length;

        inst = new ymaps3.YMap(container, {
          location: { center: [cx, cy], zoom: 11 },
        });
        inst.addChild(new ymaps3.YMapDefaultSchemeLayer({}));
        inst.addChild(new ymaps3.YMapDefaultFeaturesLayer({}));

        mapInstanceRef.current = inst;
        markers.clear();

        for (const pt of pts) {
          const el = document.createElement("div");
          Object.assign(el.style, {
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            background: PIN_DEFAULT,
            border: "2px solid #fff",
            boxShadow: "0 2px 6px rgba(0,0,0,.35)",
            cursor: "pointer",
            transition: "transform .12s ease, background .12s ease",
          });
          el.title = pt.name ?? pt.address;

          el.addEventListener("pointerenter", () => {
            if (el.dataset.selected !== "1") el.style.transform = "scale(1.3)";
          });
          el.addEventListener("pointerleave", () => {
            if (el.dataset.selected !== "1") el.style.transform = "";
          });
          el.addEventListener("click", () => {
            // Только превью: подсветить пин + позиционировать список.
            // Применение выбора (вызов onSelect) — по кнопке «Выбрать» в footer.
            setSelectedId(pt.pointId);
          });

          markers.set(pt.pointId, el);

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
      mapInstanceRef.current = null;
      markers.clear();
    };
  }, [open, scriptReady, points]);

  // ── Re-style pins + recenter when selection changes ─────────────────────
  useEffect(() => {
    // Reset previously highlighted pins
    markersRef.current.forEach((el, id) => {
      if (id === selectedId) {
        el.style.background = PIN_SELECTED;
        el.style.transform = "scale(1.45)";
        el.style.zIndex = "10";
        el.dataset.selected = "1";
      } else {
        el.style.background = PIN_DEFAULT;
        el.style.transform = "";
        el.style.zIndex = "";
        el.dataset.selected = "0";
      }
    });

    if (!selectedId) return;
    const pt = points.find((p) => p.pointId === selectedId);
    if (pt?.lat != null && pt?.lon != null && mapInstanceRef.current) {
      mapInstanceRef.current.setLocation({
        center: [pt.lon, pt.lat],
        zoom: 15,
        duration: 400,
      });
    }

    // Scroll the corresponding list item into view (smoothly)
    const li = listItemRefs.current.get(selectedId);
    if (li) li.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId, points]);

  // ── Close on Escape ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // ── Lock body scroll while modal is open ────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ── List-click handler — только превью (применяет «Выбрать» в footer) ──
  const handleListSelect = useCallback((pt: PickupPoint) => {
    setSelectedId(pt.pointId);
  }, []);

  // ── Confirm / cancel ────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (!selectedId) return;
    const pt = points.find((p) => p.pointId === selectedId);
    if (pt) {
      onSelect(pt);
      onClose();
    }
  }, [selectedId, points, onSelect, onClose]);

  if (!open) return null;

  const pointsCount = points.length;
  const filteredCount = filteredPoints.length;
  const selectedPoint = selectedId
    ? points.find((p) => p.pointId === selectedId)
    : null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-2 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Выбор пункта выдачи в городе ${city}`}
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[900px] w-full max-w-[1600px] flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <h3 className="truncate font-semibold">
              Выбор пункта выдачи · {city}
            </h3>
            {!loading && pointsCount > 0 && (
              <span className="hidden text-sm font-normal text-slate-500 sm:inline">
                {filteredCount === pointsCount
                  ? `${pointsCount} ${pluralizePoints(pointsCount)}`
                  : `${filteredCount} из ${pointsCount}`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile tab switcher — карта на мобильном теперь доступна */}
            <div className="flex overflow-hidden rounded-md border border-slate-300 md:hidden">
              <button
                type="button"
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  mobileTab === "list"
                    ? "bg-sky-600 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setMobileTab("list")}
              >
                Список
              </button>
              <button
                type="button"
                className={`border-l border-slate-300 px-3 py-1 text-xs font-medium transition-colors ${
                  mobileTab === "map"
                    ? "bg-sky-600 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setMobileTab("map")}
              >
                Карта
              </button>
            </div>

            <button
              type="button"
              aria-label="Закрыть"
              className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              onClick={onClose}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body: sidebar + map ──────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1">
          {/* ─── Sidebar (list + search) ─── */}
          <div
            className={`flex w-full flex-col border-slate-200 md:w-96 md:border-r ${
              mobileTab !== "list" ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Search input */}
            <div className="border-b border-slate-200 p-3">
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по адресу или названию…"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 pl-8 text-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <svg
                  className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
            </div>

            {/* Scrollable list */}
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {loading && (
                <p className="text-sm text-slate-500">Загрузка ПВЗ…</p>
              )}
              {!loading && pointsCount === 0 && (
                <p className="text-sm text-slate-600">
                  В радиусе нет пунктов выбранного провайдера. Попробуйте другой
                  тариф.
                </p>
              )}
              {!loading && pointsCount > 0 && filteredCount === 0 && (
                <p className="text-sm text-slate-600">
                  Ничего не найдено по запросу «{query}».
                </p>
              )}

              <ul className="space-y-2">
                {filteredPoints.map((p) => (
                  <li
                    key={p.pointId}
                    ref={(el) => {
                      if (el) listItemRefs.current.set(p.pointId, el);
                      else listItemRefs.current.delete(p.pointId);
                    }}
                    className={`cursor-pointer rounded border p-3 text-sm transition-colors ${
                      p.pointId === selectedId
                        ? "border-sky-500 bg-sky-50 shadow-sm"
                        : "border-slate-200 hover:border-sky-400 hover:bg-slate-50"
                    }`}
                    onClick={() => handleListSelect(p)}
                  >
                    <div className="font-medium text-slate-900">
                      {p.name ?? p.pointId}
                    </div>
                    <div className="mt-0.5 text-slate-600">{p.address}</div>
                    {p.workHours && (
                      <div className="mt-1 text-xs text-slate-500">
                        {p.workHours}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ─── Map panel ─── */}
          <div
            className={`relative flex-1 ${
              mobileTab !== "map" ? "hidden md:block" : "block"
            }`}
          >
            {/* ymaps3 renders into this div */}
            <div ref={mapContainerRef} className="absolute inset-0" />

            {/* Loading overlay — shown while the layout script is still initialising */}
            {YMAPS_KEY && !scriptReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-sm text-slate-500">
                Загрузка карты…
              </div>
            )}

            {/* No-key fallback */}
            {!YMAPS_KEY && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-sm text-slate-400">
                Карта недоступна
              </div>
            )}
          </div>
        </div>

        {/* ── Footer: текущий выбор + кнопки «Отмена» / «Выбрать» ──────── */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0 flex-1 text-sm">
            {selectedPoint ? (
              <div>
                <div className="font-medium text-slate-900">
                  Выбран: {selectedPoint.name ?? selectedPoint.pointId}
                </div>
                <div className="truncate text-xs text-slate-600">
                  {selectedPoint.address}
                </div>
              </div>
            ) : (
              <span className="text-slate-500">
                Выберите пункт выдачи в списке или на карте
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedPoint}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Выбрать
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
