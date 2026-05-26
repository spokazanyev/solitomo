import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AnalyticsScripts } from "@/components/analytics/AnalyticsScripts";
import { CookieConsentBanner } from "@/components/consent/CookieConsentBanner";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getSiteUrl } from "@/lib/seo/seo-registry";
import "../globals.css";

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
      </body>
    </html>
  );
}
