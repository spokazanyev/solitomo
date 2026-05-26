import Link from "next/link";

type NavLink = {
  slug: string;
  href: string;
  label: string;
  description?: string;
};

const BUYER_INFO_LINKS: NavLink[] = [
  { slug: "payment", href: "/info/payment/", label: "Оплата", description: "Карта, СБП, по счёту" },
  { slug: "delivery", href: "/info/delivery/", label: "Доставка", description: "СДЭК, Boxberry, ТК" },
  { slug: "return", href: "/info/return/", label: "Возврат", description: "14 дней / по ГК" },
  { slug: "warranty", href: "/info/warranty/", label: "Гарантия", description: "12 месяцев" },
  { slug: "faq", href: "/info/faq/", label: "FAQ", description: "Частые вопросы" },
];

const LEGAL_LINKS: NavLink[] = [
  { slug: "offer", href: "/legal/offer/", label: "Публичная оферта" },
  { slug: "privacy", href: "/legal/privacy/", label: "Политика конфиденциальности" },
  { slug: "pd-policy", href: "/legal/pd-policy/", label: "Политика обработки ПДн" },
  { slug: "terms", href: "/legal/terms/", label: "Пользовательское соглашение" },
];

type Section = "info" | "legal";

type Props = {
  currentSlug?: string;
  /** Which section the active link belongs to — drives accent + group title weight. */
  currentSection?: Section;
};

/**
 * Shared sidebar nav for /info/* and /legal/* pages.
 *
 * Two visual blocks rendered side-by-side as a single card:
 *   1. "Покупателям" — 5 operational pages (payment / delivery / return /
 *      warranty / faq). Each item has a one-line description for
 *      scannability.
 *   2. "Юридические документы" — 4 versioned legal docs (offer / privacy /
 *      pd-policy / terms).
 *
 * Active item shows a sky-600 left accent bar + sky-50 background — two
 * signals at once for low-vision contrast. The block title of the active
 * section is also bumped a half-step in colour to anchor the user.
 */
export function BuyerInfoNav({ currentSlug, currentSection = "info" }: Props) {
  const renderLink = (link: NavLink, dense: boolean, section: Section) => {
    const isActive = currentSection === section && currentSlug === link.slug;
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
    <nav aria-label="Покупателям и документы" className="rounded-lg border border-slate-200 bg-white p-4">
      <h2
        className={[
          "mb-3 px-3 text-xs font-semibold uppercase tracking-wide",
          currentSection === "info" ? "text-sky-700" : "text-slate-500",
        ].join(" ")}
      >
        Покупателям
      </h2>
      <ul className="space-y-0.5">
        {BUYER_INFO_LINKS.map((link) => renderLink(link, false, "info"))}
      </ul>

      <h2
        className={[
          "mb-2 mt-5 px-3 text-xs font-semibold uppercase tracking-wide",
          currentSection === "legal" ? "text-sky-700" : "text-slate-500",
        ].join(" ")}
      >
        Юридические документы
      </h2>
      <ul className="space-y-0.5">
        {LEGAL_LINKS.map((link) => renderLink(link, true, "legal"))}
      </ul>
    </nav>
  );
}
