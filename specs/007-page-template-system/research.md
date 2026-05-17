# Research: Page Template System

Дата: 2026-05-15.

## Internal Inputs

- `02-page-design/page-types.md`
- `07-build-specifications/ui-design-system-spec.md`
- `07-build-specifications/copywriting-and-positioning-spec.md`
- `07-build-specifications/seo-landing-matrix.md`
- `07-build-specifications/seo-technical-spec.md`

## Decisions

### D1. Use Intent-Based Templates

Decision: template selection follows `SeoRoute.type`.

Reason: SEO registry already encodes the intent layer. Using it avoids route-specific duplication.

### D2. Use Static Template Content Now

Decision: add `template-content.ts` with reusable filter groups, product placeholders, trust signals, knowledge links, document needs, and process steps.

Reason: Product import/CMS content is not available yet, but templates need realistic sections for design and future content briefs.

### D3. Keep One Shared Shell

Decision: keep `SeoLandingPage` as shell for metadata/JSON-LD/header/breadcrumbs and delegate body content to page-type templates.

Reason: SEO behavior remains centralized while page-type layouts can evolve independently.

### D4. Use Icons Sparingly

Decision: add `lucide-react` and use icons in command/action/context elements.

Reason: The UI spec calls for practical icon use in controls and B2B technical navigation without decorative SVGs.
