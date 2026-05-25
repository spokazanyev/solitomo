/**
 * Shared "Покупателям" menu links (spec 057, US2).
 *
 * Used by:
 *  - `SiteHeader` — desktop hover-dropdown.
 *  - `HeaderMobileMenu` — mobile accordion section.
 *  - `BuyerInfoNav` (static-pages) shares the same six slugs/labels in sidebar form.
 *
 * The three remaining legal docs (privacy, pd-policy, terms) live in the footer.
 */
export const buyerInfoLinks = [
  { href: "/info/payment/", label: "Оплата" },
  { href: "/info/delivery/", label: "Доставка" },
  { href: "/info/return/", label: "Возврат" },
  { href: "/info/warranty/", label: "Гарантия" },
  { href: "/info/offer/", label: "Оферта" },
  { href: "/info/faq/", label: "FAQ" },
] as const;

export type BuyerInfoLink = (typeof buyerInfoLinks)[number];
