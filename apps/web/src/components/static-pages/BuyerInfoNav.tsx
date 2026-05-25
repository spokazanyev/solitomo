import Link from "next/link";

type NavLink = {
  slug: string;
  href: string;
  label: string;
};

const LINKS: NavLink[] = [
  { slug: "payment", href: "/info/payment/", label: "Оплата" },
  { slug: "delivery", href: "/info/delivery/", label: "Доставка" },
  { slug: "return", href: "/info/return/", label: "Возврат" },
  { slug: "warranty", href: "/info/warranty/", label: "Гарантия" },
  { slug: "offer", href: "/info/offer/", label: "Оферта" },
  { slug: "faq", href: "/info/faq/", label: "FAQ" },
];

type Props = {
  currentSlug?: string;
};

/**
 * Sidebar nav rendered on every `/info/*` page (spec 057, US1).
 *
 * Six visible links — the three remaining legal docs (privacy, pd-policy,
 * terms) are reachable via the footer + cross-links inside policy bodies.
 */
export function BuyerInfoNav({ currentSlug }: Props) {
  return (
    <nav aria-label="Покупателям">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Покупателям
      </h2>
      <ul className="space-y-1.5 text-sm">
        {LINKS.map((link) => {
          const isActive = currentSlug === link.slug;
          return (
            <li key={link.slug}>
              <Link
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "block rounded-md px-2 py-1.5 font-semibold text-emerald-700"
                    : "block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100 hover:text-emerald-700"
                }
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
