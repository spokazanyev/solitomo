"use client";

import { ChevronDown, Menu, Phone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { buyerInfoLinks } from "@/components/site/buyer-info-links";
import { MobileDrawer } from "@/components/site/MobileDrawer";

type NavItem = {
  href: string;
  label: string;
};

type HeaderMobileMenuProps = {
  navItems: NavItem[];
  phone?: {
    tel: string;
    value: string;
  } | null;
};

export function HeaderMobileMenu({ navItems, phone }: HeaderMobileMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-controls="site-mobile-menu"
        aria-expanded={open}
        aria-label="Открыть меню"
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:border-sky-500 hover:text-sky-800 lg:hidden"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Menu className="h-5 w-5" />
      </button>
      <MobileDrawer
        onClose={() => setOpen(false)}
        open={open}
        side="right"
        title="Меню"
      >
        <nav aria-label="Главное меню" className="grid gap-1">
          {navItems.map((item) => {
            const link = (
              <Link
                className="flex h-12 items-center rounded-md px-3 text-base font-medium text-slate-800 hover:bg-slate-100 hover:text-sky-800"
                href={item.href}
                key={item.href}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            );
            if (item.href !== "/company/about/") {
              return link;
            }
            // Insert "Покупателям" accordion before "Компания".
            return (
              <div key="buyer-info-and-company" className="contents">
                <details className="group rounded-md">
                  <summary className="flex h-12 cursor-pointer items-center justify-between rounded-md px-3 text-base font-medium text-slate-800 hover:bg-slate-100 hover:text-sky-800 [&::-webkit-details-marker]:hidden">
                    <span>Покупателям</span>
                    <ChevronDown
                      aria-hidden="true"
                      className="h-4 w-4 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <ul className="mt-1 grid gap-0.5 pb-1">
                    {buyerInfoLinks.map((l) => (
                      <li key={l.href}>
                        <Link
                          className="flex h-10 items-center rounded-md pl-8 pr-3 text-sm text-slate-700 hover:bg-slate-100 hover:text-sky-800"
                          href={l.href}
                          onClick={() => setOpen(false)}
                        >
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
                {link}
              </div>
            );
          })}
        </nav>
        {phone ? (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <a
              className="flex h-12 items-center gap-3 rounded-md px-3 text-base font-semibold text-slate-800 hover:bg-slate-100 hover:text-sky-800"
              href={`tel:${phone.tel}`}
              onClick={() => setOpen(false)}
            >
              <Phone className="h-5 w-5 text-sky-700" />
              {phone.value}
            </a>
          </div>
        ) : null}
      </MobileDrawer>
    </>
  );
}
