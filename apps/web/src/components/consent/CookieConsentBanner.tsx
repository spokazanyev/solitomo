"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { loadAnalyticsFromConsent } from "@/lib/analytics/analytics-loader";
import {
  clearCookieConsent,
  readCookieConsent,
  setCookieConsent,
} from "@/lib/analytics/cookie-consent";

/**
 * Cookies consent banner (US6 / FR-5750..5755).
 *
 * Behaviour:
 *  - On mount reads `cookie_consent`. Missing → banner shown.
 *    "accepted" → silently load analytics. "declined" → silent.
 *  - "Принять" persists `accepted` + triggers analytics, hides banner.
 *  - "Отказаться" persists `declined`, hides banner, no analytics.
 *  - Listens to the global `cookie:reprompt` window event so the footer
 *    "Manage cookies" action can re-open the banner without a reload.
 *
 * Layout: bottom strip on mobile (≤768px per FR-5755),
 * floating bottom-right card on desktop.
 */
export function CookieConsentBanner() {
  // `visible` starts false → SSR + initial client render emit nothing → no hydration mismatch.
  // useEffect below promotes the banner to visible only when there's no recorded decision.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const current = readCookieConsent();
    if (current === "accepted") {
      loadAnalyticsFromConsent();
    } else if (current !== "declined") {
      // Intentional: we cannot read document.cookie during SSR, so the banner
      // is hidden until the client mount confirms there's no decision yet.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    }

    const onReprompt = () => {
      clearCookieConsent();
      setVisible(true);
    };
    window.addEventListener("cookie:reprompt", onReprompt);
    return () => {
      window.removeEventListener("cookie:reprompt", onReprompt);
    };
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    setCookieConsent("accepted");
    loadAnalyticsFromConsent();
    setVisible(false);
  };

  const handleDecline = () => {
    setCookieConsent("declined");
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Уведомление об использовании cookies"
      className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 p-4 text-white shadow-lg md:bottom-4 md:left-auto md:right-4 md:max-w-md md:rounded-lg"
    >
      <p className="text-sm leading-relaxed">
        Мы используем cookies для аналитики посещаемости. Подробнее — в{" "}
        <Link
          href="/info/pd-policy/"
          className="underline underline-offset-2 hover:text-emerald-300"
        >
          политике конфиденциальности
        </Link>
        .
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleAccept}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          Принять
        </button>
        <button
          type="button"
          onClick={handleDecline}
          className="rounded-md border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          Отказаться
        </button>
      </div>
    </div>
  );
}

export default CookieConsentBanner;
