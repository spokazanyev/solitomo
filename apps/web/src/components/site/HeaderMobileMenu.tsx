"use client";

import { Menu, Phone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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
          {navItems.map((item) => (
            <Link
              className="flex h-12 items-center rounded-md px-3 text-base font-medium text-slate-800 hover:bg-slate-100 hover:text-sky-800"
              href={item.href}
              key={item.href}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
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
