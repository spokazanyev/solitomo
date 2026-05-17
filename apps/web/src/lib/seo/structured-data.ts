import { getCompanyContacts } from "@/lib/company/get-company-contacts";
import { getSiteUrl, SITE_NAME, type SeoRoute } from "./seo-registry";

type ItemListProduct = {
  h1: string;
  slug: string;
  sku: string;
};

type FaqItem = {
  answer: string;
  question: string;
};

function isPlaceholder(value: string) {
  return !value || value.startsWith("TODO(owner)");
}

function compactJsonLd<T>(input: T): T {
  if (Array.isArray(input)) {
    const compacted = input
      .map((item) => compactJsonLd(item))
      .filter((item) => item !== undefined && item !== "" && !(Array.isArray(item) && item.length === 0));
    return compacted as unknown as T;
  }
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const compacted = compactJsonLd(value);
      if (compacted === undefined || compacted === "" || compacted === null) continue;
      if (Array.isArray(compacted) && compacted.length === 0) continue;
      if (typeof compacted === "object" && !Array.isArray(compacted) && Object.keys(compacted).length === 0) continue;
      out[key] = compacted;
    }
    return out as T;
  }
  return input;
}

export function createBreadcrumbJsonLd(route: SeoRoute) {
  const siteUrl = getSiteUrl();
  const segments = route.path.split("/").filter(Boolean);
  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: SITE_NAME,
      item: `${siteUrl}/`,
    },
    ...segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join("/")}/`;
      return {
        "@type": "ListItem",
        position: index + 2,
        name: segment,
        item: `${siteUrl}${path}`,
      };
    }),
  ];

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

export function createOrganizationJsonLd() {
  const contacts = getCompanyContacts();
  const siteUrl = getSiteUrl();

  const phone = contacts.phones.find((p) => p.isPrimary) ?? contacts.phones[0];
  const email = contacts.emails.find((e) => e.isPrimary) ?? contacts.emails[0];
  const addressLine = !isPlaceholder(contacts.legalAddress)
    ? contacts.legalAddress
    : !isPlaceholder(contacts.actualAddress)
      ? contacts.actualAddress
      : undefined;

  const contactPoint = contacts.phones
    .map((p) => ({
      "@type": "ContactPoint",
      contactType: p.label || "Sales",
      telephone: p.tel,
      availableLanguage: ["Russian"],
    }))
    .filter((point) => point.telephone);

  return compactJsonLd({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: ["Soliton"],
    legalName: isPlaceholder(contacts.legalName) ? undefined : contacts.legalName,
    url: siteUrl,
    logo: `${siteUrl}/brand/logo.svg`,
    image: `${siteUrl}/brand/logo.svg`,
    description:
      "Российский производитель PDU и блоков розеток для серверных шкафов, стоек и ЦОД.",
    foundingDate: isPlaceholder(contacts.foundingDate) ? undefined : contacts.foundingDate,
    telephone: phone?.tel,
    email: email?.value,
    address: addressLine
      ? {
          "@type": "PostalAddress",
          streetAddress: addressLine,
          addressCountry: "RU",
        }
      : undefined,
    contactPoint,
    sameAs: contacts.socials.map((s) => s.url),
  });
}

export function createLocalBusinessJsonLd() {
  const contacts = getCompanyContacts();
  if (!contacts.publishLocalBusiness || !contacts.geo) return null;
  const siteUrl = getSiteUrl();

  const phone = contacts.phones.find((p) => p.isPrimary) ?? contacts.phones[0];
  const address = !isPlaceholder(contacts.actualAddress)
    ? contacts.actualAddress
    : contacts.legalAddress;

  return compactJsonLd({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: SITE_NAME,
    url: siteUrl,
    telephone: phone?.tel,
    address: !isPlaceholder(address)
      ? {
          "@type": "PostalAddress",
          streetAddress: address,
          addressCountry: "RU",
        }
      : undefined,
    geo: {
      "@type": "GeoCoordinates",
      latitude: contacts.geo.latitude,
      longitude: contacts.geo.longitude,
    },
    openingHours: contacts.openingHours,
  });
}

export function createItemListJsonLd(route: SeoRoute, products: ItemListProduct[]) {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: route.h1,
    url: `${siteUrl}${route.path}`,
    numberOfItems: products.length,
    itemListElement: products.slice(0, 24).map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${siteUrl}/product/${product.slug}/`,
      name: product.h1,
      identifier: product.sku,
    })),
  };
}

export function createFaqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
