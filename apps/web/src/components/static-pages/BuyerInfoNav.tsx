import Link from "next/link";

type NavLink = {
  slug: string;
  href: string;
  label: string;
  description?: string;
};

const PRIMARY_LINKS: NavLink[] = [
  { slug: "payment", href: "/info/payment/", label: "Оплата", description: "Карта, СБП, по счёту" },
  { slug: "delivery", href: "/info/delivery/", label: "Доставка", description: "СДЭК, Boxberry, ТК" },
  { slug: "return", href: "/info/return/", label: "Возврат", description: "14 дней / по ГК" },
  { slug: "warranty", href: "/info/warranty/", label: "Гарантия", description: "12 месяцев" },
  { slug: "offer", href: "/info/offer/", label: "Оферта" },
  { slug: "faq", href: "/info/faq/", label: "FAQ" },
];

const LEGAL_LINKS: NavLink[] = [
  { slug: "privacy", href: "/info/privacy/", label: "Политика конфиденциальности" },
  { slug: "pd-policy", href: "/info/pd-policy/", label: "Политика обработки ПДн" },
  { slug: "terms", href: "/info/terms/", label: "Пользовательское соглашение" },
];

type Props = {
  currentSlug?: string;
};

/**
 * Sidebar nav rendered on every `/info/*` page (spec 057, US1).
 *
 * Two visual groups:
 *   1. Primary — the 6 high-traffic pages (also surfaced in header dropdown).
 *      Each gets a one-line description for scannability.
 *   2. Legal — the three additional policy documents, deduplicated from the
 *      primary group so the sidebar isn't cluttered with similar names.
 *
 * Active item gets a sky-700 left accent bar (more distinctive than colour
 * alone — helps with low-vision contrast).
 */
export function BuyerInfoNav({ currentSlug }: Props) {
  const renderLink = (link: NavLink, dense: boolean) => {
    const isActive = currentSlug === link.slug;
    return (
      <li key={link.slug}>
        <Link
          href={link.href}
          aria-current={isActive ? "page" : undefined}
          className={[
            "group block rounded-md px-3 py-2 transition-colors",
            isActive
              ? "border-l-2 border-sky-600 bg-sky-50 pl-[10px] text-sky-900"
              : "border-l-2 border-transparent text-slate-700 hover:bg-slate-100 hover:text-sky-900",
            dense ? "text-sm" : "text-sm",
          ].join(" ")}
        >
          <span className={isActive ? "font-semibold" : "font-medium"}>{link.label}</span>
          {link.description ? (
            <span className="mt-0.5 block text-xs leading-tight text-slate-500 group-hover:text-slate-600">
              {link.description}
            </span>
          ) : null}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Покупателям" className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Покупателям
      </h2>
      <ul className="space-y-0.5">{PRIMARY_LINKS.map((link) => renderLink(link, false))}</ul>

      <h2 className="mb-2 mt-5 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Документы
      </h2>
      <ul className="space-y-0.5">{LEGAL_LINKS.map((link) => renderLink(link, true))}</ul>
    </nav>
  );
}
