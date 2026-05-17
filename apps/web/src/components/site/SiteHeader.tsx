import { Phone } from "lucide-react";
import Link from "next/link";

import { RfqCartLink } from "@/components/rfq/RfqCart";
import { getPrimaryPhone } from "@/lib/company/get-company-contacts";
import { SITE_NAME } from "@/lib/seo/seo-registry";

const navItems = [
  { href: "/catalog/pdu/", label: "Каталог" },
  { href: "/b2b/custom-pdu/", label: "Под заказ" },
  { href: "/knowledge/kak-vybrat-pdu/", label: "База знаний" },
  { href: "/documents/", label: "Документы" },
  { href: "/company/about/", label: "Компания" },
];

export function SiteHeader() {
  const phone = getPrimaryPhone();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4 md:px-10 lg:px-12">
        <Link
          href="/"
          className="text-2xl font-bold uppercase tracking-[0.14em] text-sky-700"
        >
          {SITE_NAME}
        </Link>
        <nav
          aria-label="Главная навигация"
          className="hidden flex-wrap items-center justify-end gap-4 text-sm text-slate-600 lg:flex"
        >
          {navItems.map((item) => (
            <Link className="hover:text-sky-800" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {phone ? (
            <a
              className="hidden items-center gap-2 text-sm font-semibold text-slate-700 hover:text-sky-800 md:inline-flex"
              href={`tel:${phone.tel}`}
            >
              <Phone className="h-4 w-4" />
              {phone.value}
            </a>
          ) : null}
          <RfqCartLink />
        </div>
      </div>
      <nav
        aria-label="Главная навигация (компактная)"
        className="mx-auto flex w-full max-w-7xl gap-4 overflow-x-auto px-6 pb-3 text-sm text-slate-600 md:px-10 lg:hidden lg:px-12"
      >
        {navItems.map((item) => (
          <Link className="whitespace-nowrap hover:text-sky-800" href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
