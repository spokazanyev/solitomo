/**
 * Shared link sets for the header "Документы" dropdown / mobile menu /
 * /legal/ landing card-grid.
 *
 * Two groups:
 *  1. Product docs — паспорта, сертификаты, каталог PDF. Live under /documents/.
 *  2. Legal docs — оферта, политики. Live under /legal/ (spec 057, moved out
 *     of /info/ during the IA cleanup).
 *
 * Keeping these together so the same "Документы" header item can surface
 * both: visually separated by a divider, but conceptually a single namespace.
 */

export const productDocLinks = [
  { href: "/documents/", label: "Документы для тендеров" },
  { href: "/documents/certificates/", label: "Сертификаты" },
  { href: "/documents/catalog/", label: "Каталог в PDF" },
] as const;

export const legalDocLinks = [
  { href: "/legal/offer/", label: "Публичная оферта" },
  { href: "/legal/privacy/", label: "Политика конфиденциальности" },
  { href: "/legal/pd-policy/", label: "Политика обработки ПДн" },
  { href: "/legal/terms/", label: "Пользовательское соглашение" },
] as const;
