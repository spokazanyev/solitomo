# Data Model: Homepage B2B Trust

## HomeProofMetric

Defined in `apps/web/src/lib/seo/template-content.ts`.

- `label`: compact visible value.
- `text`: proof/support explanation.

## HomeUseCase

- `title`: use-case heading.
- `text`: short routing explanation.
- `href`: target page.

## B2BTrustPoint

Plain-text item describing a corporate buying need.

## Real Product References

Homepage pulls featured products from `getCatalogProducts("/catalog/iec-c13-c19/")`.

Used for:

- hero product visual;
- featured product cards;
- product links.
