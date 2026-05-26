import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { AnalyticsScripts } from "@/components/analytics/AnalyticsScripts";
import { CookieConsentBanner } from "@/components/consent/CookieConsentBanner";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getSiteUrl } from "@/lib/seo/seo-registry";
import "../globals.css";

// Yandex Maps v3 JS API — loaded site-wide so it is available before the
// PointSelector modal opens. NEXT_PUBLIC_* vars are baked in at build time.
// Using afterInteractive: loads as soon as the page hydrates, non-blocking.
const YMAPS_KEY = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
const YMAPS_SRC = YMAPS_KEY
  ? `https://api-maps.yandex.ru/v3/?apikey=${YMAPS_KEY}&lang=ru_RU`
  : "";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0369a1",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Солитон | Российские PDU и блоки распределения питания",
    template: "%s | Солитон",
  },
  description:
    "Российские PDU и блоки розеток 19 дюймов для серверных шкафов, стоек, ЦОД, проектных поставок и B2B-закупок.",
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          className="absolute left-2 top-2 z-50 -translate-y-16 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition focus:translate-y-0"
          href="#main"
        >
          Перейти к содержимому
        </a>
        <AnalyticsScripts />
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </div>
        <CookieConsentBanner />
        {/* Yandex Maps v3 — preloaded here so PointSelector finds window.ymaps3
            ready as soon as the user reaches the checkout map step. */}
        {YMAPS_SRC && (
          <Script src={YMAPS_SRC} strategy="afterInteractive" />
        )}
      </body>
    </html>
  );
}
