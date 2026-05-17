# Data Model: SEO Site Structure

## SEO Route

Fields:

- `path`: canonical URL path with trailing slash.
- `type`: `home`, `catalog`, `solution`, `knowledge`, `b2b`, `document`, `company`.
- `h1`: visible page heading.
- `title`: metadata title.
- `description`: metadata description.
- `demandCluster`: semantic or business cluster.
- `priority`: sitemap priority.
- `changeFrequency`: sitemap change frequency.
- `indexable`: search-indexation flag.
- `keywords`: target phrase group.
- `summary`: implementation/content guidance.
- `cta`: primary conversion action.

## Landing Matrix Row

Fields:

- URL.
- Page type.
- Demand cluster.
- Primary phrases.
- Search intent.
- Content blocks.
- Internal links.
- Schema type.
- Status.

## Canonical Rule

Fields:

- Route pattern.
- Indexability.
- Canonical target.
- Sitemap inclusion.
- Robots behavior.

## Structured Data Rule

Fields:

- Page type.
- Required schema.
- Source fields.
- Validation notes.

## Deferred Product Page

Fields:

- Product slug.
- Product title.
- Category relation.
- Product schema fields.
- Offer fields.
- Image and document fields.

Deferred until product import and catalog collections are implemented.
