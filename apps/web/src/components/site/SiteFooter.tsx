import { Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { ManageCookiesButton } from "@/components/site/ManageCookiesButton";
import { legalDocLinks } from "@/components/site/document-links";
import {
  getCompanyContacts,
  getPrimaryEmail,
  getPrimaryPhone,
} from "@/lib/company/get-company-contacts";
import { SITE_NAME, seoRoutes, type SeoRouteType } from "@/lib/seo/seo-registry";

// Source of truth for legal links is document-links.ts (shared with header dropdown).
const POLICY_LINKS = legalDocLinks;

function findRoute(path: string) {
  return seoRoutes.find((route) => route.path === path);
}

function routeLinks(paths: string[]) {
  return paths
    .map((path) => findRoute(path))
    .filter((route): route is NonNullable<ReturnType<typeof findRoute>> => Boolean(route));
}

function routeLinksByType(type: SeoRouteType, limit: number) {
  return seoRoutes
    .filter((route) => route.type === type && route.indexable)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

const catalogLinks = routeLinks([
  "/catalog/pdu/",
  "/catalog/pdu-uzip/",
  "/catalog/bloki-rozetok-19-1u/",
  "/catalog/iec-c13-c19/",
  "/catalog/schuko/",
  "/catalog/16a/",
  "/catalog/32a/",
]);

const solutionLinks = routeLinksByType("solution", 4);

const procurementLinks = routeLinks([
  "/b2b/",
  "/b2b/request-quote/",
  "/documents/",
  "/company/about/",
  "/company/contacts/",
]);

function FooterColumn({
  links,
  title,
}: {
  links: Array<{ h1: string; path: string }>;
  title: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      <nav className="mt-4 grid gap-2">
        {links.map((link) => (
          <Link
            className="text-sm leading-6 text-slate-600 transition hover:text-sky-800"
            href={link.path}
            key={link.path}
          >
            {link.h1}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function SiteFooter() {
  const primaryPhone = getPrimaryPhone();
  const primaryEmail = getPrimaryEmail();
  const contacts = getCompanyContacts();
  const legalLabel = contacts.legalNameFull ?? contacts.legalName;
  const requisitesParts = [legalLabel];
  if (contacts.inn) requisitesParts.push(`ИНН ${contacts.inn}`);
  if (contacts.ogrn) requisitesParts.push(`ОГРН ${contacts.ogrn}`);
  const requisitesLine = requisitesParts.join(" · ");

  return (
    <footer className="border-t border-slate-200 bg-white text-slate-700">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-10 md:px-10 lg:grid-cols-[1.1fr_2fr] lg:px-12">
        <div>
          <Link
            className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700"
            href="/"
          >
            {SITE_NAME}
          </Link>
          <p className="mt-4 max-w-md text-sm leading-7 text-slate-600">
            Российские PDU, блоки розеток 19 дюймов и сетевые фильтры с УЗИП
            для серверных шкафов, ЦОД и корпоративных закупок.
          </p>
          <div className="mt-5 grid gap-2 text-sm leading-6 text-slate-600">
            {primaryPhone ? (
              <a className="flex gap-2 hover:text-sky-800" href={`tel:${primaryPhone.tel}`}>
                <Phone className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
                {primaryPhone.value}
              </a>
            ) : null}
            {primaryEmail ? (
              <a className="flex gap-2 hover:text-sky-800" href={`mailto:${primaryEmail.value}`}>
                <Mail className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
                {primaryEmail.value}
              </a>
            ) : null}
            <div className="flex gap-2">
              <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
              КП, счет и документы для закупки подтверждаются по конкретной модели.
            </div>
            <div className="flex gap-2">
              <MapPin className="mt-1 h-4 w-4 shrink-0 text-sky-700" />
              Поставка по России согласуется в коммерческом предложении.
            </div>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          <FooterColumn links={catalogLinks} title="Каталог" />
          <FooterColumn links={solutionLinks} title="Подбор" />
          <FooterColumn links={procurementLinks} title="Закупка" />
        </div>
      </div>
      <div className="border-t border-slate-100">
        <div className="mx-auto grid w-full max-w-7xl gap-4 px-6 py-6 text-sm text-slate-600 md:px-10 lg:px-12">
          <nav
            aria-label="Юридические документы"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600"
          >
            {POLICY_LINKS.map((link, index) => (
              <span key={link.href} className="flex items-center gap-x-3">
                <Link href={link.href} className="underline-offset-2 hover:text-emerald-700 hover:underline">
                  {link.label}
                </Link>
                {index < POLICY_LINKS.length - 1 ? (
                  <span aria-hidden className="text-slate-300">·</span>
                ) : null}
              </span>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3" aria-label="Принимаем к оплате">
              <img src="/payment-logos/mir.svg" alt="Платёжная система МИР" width="48" height="24" />
              <img src="/payment-logos/visa.svg" alt="Visa" width="48" height="24" />
              <img src="/payment-logos/mastercard.svg" alt="Mastercard" width="48" height="24" />
              <img src="/payment-logos/sbp.svg" alt="Система быстрых платежей" width="48" height="24" />
            </div>
            <ManageCookiesButton />
          </div>
          {requisitesLine ? (
            <p className="text-xs leading-6 text-slate-500">{requisitesLine}</p>
          ) : null}
        </div>
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4 text-xs text-slate-500 md:px-10 lg:px-12">
          <span>© 2026 Солитон</span>
          <span>Заявки принимаются через КП; онлайн-оплата и доставка согласуются отдельно.</span>
        </div>
      </div>
    </footer>
  );
}
