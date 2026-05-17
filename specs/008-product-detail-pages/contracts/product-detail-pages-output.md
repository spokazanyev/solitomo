# Contract: Product Detail Pages Output

## Route Contract

`GET /product/{slug}/`

Expected:

- `200` for known product slugs.
- Next.js `notFound()` behavior for unknown slugs.
- Canonical path `/product/{slug}/`.

## Page Content Contract

Each product page must render:

- Product H1.
- SKU.
- Category label.
- Short description.
- Price display or quote fallback.
- Primary CTA to `/b2b/request-quote/`.
- Secondary compatibility/selection link.
- Product image or empty-image state.
- Characteristics block.
- Pre-order clarification checklist.
- Description block.
- Documents block.
- Related products block.

## Structured Data Contract

Each product page must include:

- `BreadcrumbList` JSON-LD.
- `Product` JSON-LD.
- `Offer` nested in `Product` only when numeric price exists.

`availability` must not be emitted until stock data exists.

## Sitemap Contract

`GET /sitemap.xml` must include:

- Existing static SEO URLs.
- One `/product/{slug}/` URL per normalized product.

Expected total after this feature: `102` URLs.
