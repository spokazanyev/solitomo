/**
 * Shared "Покупателям" menu links (spec 057, US2).
 *
 * Used by:
 *  - `SiteHeader` — desktop hover-dropdown.
 *  - `HeaderMobileMenu` — mobile accordion section.
 *
 * The 4 versioned legal documents (offer, privacy, pd-policy, terms) moved
 * to /legal/* and are linked from the footer + each /info/* page's sidebar
 * (`BuyerInfoNav`). They're intentionally absent from the header menu —
 * "Покупателям" is for operational info only.
 */
export const buyerInfoLinks = [
  { href: "/info/payment/", label: "Оплата" },
  { href: "/info/delivery/", label: "Доставка" },
  { href: "/info/return/", label: "Возврат" },
  { href: "/info/warranty/", label: "Гарантия" },
  { href: "/info/faq/", label: "FAQ" },
] as const;

export type BuyerInfoLink = (typeof buyerInfoLinks)[number];
