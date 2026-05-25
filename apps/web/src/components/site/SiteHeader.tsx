import { ChevronDown, Phone } from "lucide-react";
import Link from "next/link";

import { HeaderMobileMenu } from "@/components/site/HeaderMobileMenu";
import { buyerInfoLinks } from "@/components/site/buyer-info-links";
import { legalDocLinks, productDocLinks } from "@/components/site/document-links";
import { RfqCartLink } from "@/components/rfq/RfqCart";
import { getPrimaryPhone } from "@/lib/company/get-company-contacts";
import { SITE_NAME } from "@/lib/seo/seo-registry";

const navItems = [
  { href: "/catalog/pdu/", label: "Каталог" },
  { href: "/b2b/custom-pdu/", label: "Под заказ" },
  { href: "/knowledge/kak-vybrat-pdu/", label: "База знаний" },
  // `/documents/` is rendered as a dropdown (product docs + legal docs)
  // — see the special-case branch in the JSX below.
  { href: "/documents/", label: "Документы" },
  { href: "/company/about/", label: "Компания" },
];

export function SiteHeader() {
  const phone = getPrimaryPhone();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-10 md:py-4 lg:px-12">
        <Link
          href="/"
          className="text-xl font-bold uppercase tracking-[0.14em] text-sky-700 md:text-2xl"
        >
          {SITE_NAME}
        </Link>
        <nav
          aria-label="Главная навигация"
          className="hidden flex-wrap items-center justify-end gap-4 text-sm text-slate-600 lg:flex"
        >
          {navItems.map((item) => {
            const link = (
              <Link className="hover:text-sky-800" href={item.href} key={item.href}>
                {item.label}
              </Link>
            );

            // Special case: "/documents/" renders as a dropdown with product
            // docs on top and legal docs below a divider. Both share the same
            // top-level concept of "documents", but live under different URL
            // namespaces (/documents/* and /legal/*) — the dropdown is the
            // single discovery point for everything users colloquially call
            // a "document".
            if (item.href === "/documents/") {
              return (
                <span key="documents-dropdown" className="group relative">
                  <button
                    aria-expanded="false"
                    aria-haspopup="true"
                    className="inline-flex items-center gap-1 hover:text-sky-800 focus:outline-none focus-visible:text-sky-800"
                    type="button"
                  >
                    Документы
                    <ChevronDown
                      aria-hidden="true"
                      className="h-3.5 w-3.5 transition-transform group-hover:rotate-180 group-focus-within:rotate-180"
                    />
                  </button>
                  <div
                    aria-label="Документы"
                    className="invisible absolute right-0 top-full z-40 min-w-[260px] rounded-md border border-slate-200 bg-white pb-2 pt-2 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                  >
                    <p className="px-4 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Продуктовые
                    </p>
                    <ul>
                      {productDocLinks.map((l) => (
                        <li key={l.href}>
                          <Link
                            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-sky-800"
                            href={l.href}
                          >
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <hr className="my-2 border-slate-200" />
                    <p className="px-4 pb-1 pt-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Юридические
                    </p>
                    <ul>
                      {legalDocLinks.map((l) => (
                        <li key={l.href}>
                          <Link
                            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-sky-800"
                            href={l.href}
                          >
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </span>
              );
            }

            if (item.href !== "/company/about/") {
              return link;
            }
            // Insert "Покупателям" dropdown before "Компания".
            return (
              <span key="buyer-info-and-company" className="flex items-center gap-4">
                <span className="group relative">
                  <button
                    aria-expanded="false"
                    aria-haspopup="true"
                    className="inline-flex items-center gap-1 hover:text-sky-800 focus:outline-none focus-visible:text-sky-800"
                    type="button"
                  >
                    Покупателям
                    <ChevronDown
                      aria-hidden="true"
                      className="h-3.5 w-3.5 transition-transform group-hover:rotate-180 group-focus-within:rotate-180"
                    />
                  </button>
                  <ul
                    aria-label="Покупателям"
                    // No `mt-*` gap between button and dropdown — even 4px of
                    // empty space breaks the CSS-only hover (mouse exits the
                    // group hit-area while crossing). The visual "breathing
                    // room" is recreated via `pt-2` *inside* the ul, which
                    // belongs to the hover hit-area.
                    className="invisible absolute right-0 top-full z-40 min-w-[200px] rounded-md border border-slate-200 bg-white pb-2 pt-2 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                  >
                    {buyerInfoLinks.map((l) => (
                      <li key={l.href}>
                        <Link
                          className="block px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-sky-800"
                          href={l.href}
                        >
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </span>
                {link}
              </span>
            );
          })}
        </nav>
        <div className="flex items-center gap-1.5 md:gap-2">
          {phone ? (
            <>
              <a
                aria-label={`Позвонить: ${phone.value}`}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 hover:text-sky-800 md:hidden"
                href={`tel:${phone.tel}`}
              >
                <Phone className="h-5 w-5" />
              </a>
              <a
                className="hidden items-center gap-2 text-sm font-semibold text-slate-700 hover:text-sky-800 md:inline-flex"
                href={`tel:${phone.tel}`}
              >
                <Phone className="h-4 w-4" />
                {phone.value}
              </a>
            </>
          ) : null}
          <RfqCartLink />
          <HeaderMobileMenu
            navItems={navItems}
            phone={phone ? { tel: phone.tel, value: phone.value } : null}
          />
        </div>
      </div>
    </header>
  );
}
