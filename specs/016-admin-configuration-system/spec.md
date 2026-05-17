# Feature Specification: Admin Configuration System

**Feature Branch**: `016-admin-configuration-system`

**Created**: 2026-05-15

**Status**: Draft

**Input**: The Payload admin currently contains only users and RFQ requests. Define what must be configurable in the admin panel so Soliton can operate the site as a real catalog, RFQ, SEO and content system without editing code for everyday business changes.

**Agent Requirement**: The admin must be designed so Codex can safely make agreed changes after dialogue with the site owner. This requires structured fields, stable identifiers, draft-first edits, validation scripts, preview URLs, diff summaries and audit logs.

## User Scenarios & Testing

### User Story 1 - Manager Processes RFQ Requests (Priority: P1)

As a sales manager, I want to open a submitted RFQ request, see structured line items, customer details, source page, UTM data, internal notes and status history, so I can process the request without reading raw JSON.

**Independent Test**: In Payload admin, a submitted RFQ displays line items as rows and allows changing status, priority, responsible manager and next action date.

### User Story 2 - Catalog Manager Edits Products (Priority: P1)

As a catalog manager, I want to edit product titles, descriptions, images, documents, technical attributes, publication status and RFQ settings from admin, so product cards and catalog listings can be maintained without developer work.

**Independent Test**: A product edited in admin changes the public `/product/[slug]/` page and Product schema.org data after rebuild or runtime fetch.

### User Story 3 - SEO Specialist Maintains Landing Pages (Priority: P1)

As an SEO specialist, I want to configure category pages, SEO landings, metadata, canonical URLs, indexing policy, FAQ and internal links, so search pages can be optimized without changing React components.

**Independent Test**: Updating a category or SEO landing in admin changes H1, intro, meta title, meta description, canonical, ItemList schema and related links on the public page.

### User Story 4 - Editor Maintains Site Content (Priority: P2)

As a content editor, I want to update knowledge articles, company pages, document pages and controlled content blocks through admin, so informational pages remain current and consistent with the site's design system.

**Independent Test**: An editor can publish a knowledge article with body, FAQ, related products and Article/FAQPage schema without adding a custom route.

### User Story 5 - Admin Maintains Global Settings (Priority: P2)

As an administrator, I want to configure contacts, footer links, analytics IDs, RFQ settings and SEO defaults in one place, so operational settings are not hard-coded.

**Independent Test**: Changing a global phone, email, analytics counter ID or RFQ success message updates the public site or scripts without code edits.

### User Story 6 - Codex Applies Owner-Approved Changes (Priority: P1)

As the site owner, I want to ask Codex to update a product, category, SEO landing, article or RFQ setting after discussing the change, so the agent can modify the site without requiring manual admin UI work from me.

**Independent Test**: Codex can locate a record by SKU, slug or title, create a draft change, run validations, show a diff and preview URL, then publish only after owner approval.

## Requirements

- **FR-001**: The admin MUST include improved `rfq-requests` with structured line items, statuses, manager fields, source data and UTM fields.
- **FR-002**: The admin MUST include `products` as the source of truth for public product pages, product listings, RFQ item handoff and Product schema.org.
- **FR-003**: Product records MUST support publication status, SKU, slug, title, H1, descriptions, price status, images, documents, category relations and normalized technical attributes.
- **FR-004**: Product records MUST include SEO fields: meta title, meta description, canonical, indexing policy, target queries and schema.org controls.
- **FR-005**: The admin MUST include `categories` for public catalog categories, SEO filter categories, hierarchy, filter presets, related pages and ItemList schema settings.
- **FR-006**: The admin MUST include controlled attribute collections or field definitions so filters and SEO pages do not depend on arbitrary text values.
- **FR-007**: The admin MUST include `media` and `documents` collections with product/category relations, public/private flags, alt text and document type classification.
- **FR-008**: The admin SHOULD include `pages`, `knowledge-articles` and `seo-landings` for content and SEO pages after catalog collections are stable.
- **FR-009**: The admin SHOULD include globals for site settings, RFQ settings, analytics settings and SEO/schema.org defaults.
- **FR-010**: Role-based access MUST prevent unauthenticated users from reading private admin data and MUST restrict destructive operations to admins.
- **FR-011**: Public pages MUST tolerate incomplete admin data with explicit fallbacks for price, stock, documents, images and low-confidence attributes.
- **FR-012**: Public schema.org output MUST remain valid when products, categories and SEO fields are edited in admin.
- **FR-013**: Admin configuration MUST preserve current robots/canonical safety: `/admin/`, `/api/` and parameter URLs remain closed from indexing.
- **FR-014**: Integration fields for MoySklad, payment and delivery MAY be added as dormant fields, but live synchronization is out of scope for this feature.
- **FR-015**: Implementation MUST pass lint, typecheck, build and smoke tests for admin, product page, catalog page and RFQ page.
- **FR-016**: Admin collections MUST use stable machine identifiers (`slug`, `sku`, `code`, `external_id`) so Codex can target records without relying on visual UI labels.
- **FR-017**: Admin-managed content MUST support draft/review/published states for products, categories, pages and SEO landings.
- **FR-018**: Codex-facing scripts MUST support dry-run and apply modes for imports, exports, validation and bulk changes.
- **FR-019**: Agent-initiated changes MUST write an audit log with actor, target record, before/after snapshot, diff summary, reason and approval status.
- **FR-020**: High-risk fields MUST require explicit owner approval before publication: prices, legal claims, certificates, registry data, payment settings, delivery settings, integration settings and production secrets.
- **FR-021**: Admin data MUST expose preview paths or deterministic public URLs so Codex can verify rendered output after changes.
- **FR-022**: Structured arrays MUST be used where Codex needs to edit repeatable data: RFQ items, attributes, FAQ, page blocks, internal links, documents and media.
- **FR-023**: Catalog filters MUST be configurable from admin: filter groups, filter fields, options, sort order, active state, category availability, counter behavior and indexability rules.
- **FR-024**: Adding or removing a filter field MUST NOT require React code changes when the field maps to an existing controlled attribute.
- **FR-025**: Filter counters MUST be computed from the currently available result set after selected filters are applied.
- **FR-026**: New filter fields MUST NOT automatically create indexable URLs; indexable filter pages require an explicit filter preset or SEO landing.

## Admin Sections

### Sales

Collections:

- `rfq-requests`

Configurable:

- request status;
- customer and contact fields;
- structured requested items;
- source page and campaign data;
- manager comments;
- assigned manager;
- next action date;
- quote status and close reason.

### Catalog

Collections:

- `products`;
- `categories`;
- `attribute-groups`;
- `attributes`;
- `attribute-options`.
- `filter-groups`;
- `filter-fields`;
- `filter-options`;
- `filter-presets`.

Configurable:

- product publication;
- product content;
- product technical attributes;
- filter groups, fields, options and presets;
- product media and documents;
- category hierarchy;
- filter presets;
- related products/categories;
- canonical and indexing policy.

### Content

Collections:

- `pages`;
- `knowledge-articles`.

Configurable:

- page template;
- controlled page blocks;
- article body;
- FAQ;
- CTA;
- related links;
- publication status.

### SEO

Collections/globals:

- `seo-landings`;
- `seo-settings`.

Configurable:

- target query cluster;
- H1;
- title;
- description;
- canonical;
- indexing policy;
- FAQ;
- schema.org type;
- sitemap inclusion;
- internal links.

### Documents And Media

Collections:

- `media`;
- `documents`.

Configurable:

- file;
- external URL;
- alt;
- document type;
- product/category relation;
- proof role;
- public/private status.

### Settings

Globals:

- `site-settings`;
- `rfq-settings`;
- `analytics-settings`.

Configurable:

- company contacts;
- footer/menu links;
- RFQ messages and required fields;
- Yandex Metrika ID;
- GA4 ID;
- analytics debug flags;
- schema.org organization defaults.

### Agent Operations

Collections/scripts:

- `admin-change-log`;
- `agent:propose-change`;
- `agent:apply-change`;
- `export:catalog`;
- `validate:catalog`;
- `validate:seo`;
- `validate:schema`;
- `smoke:public-pages`.

Configurable/observable:

- target collection and record;
- before/after snapshots;
- diff summary;
- validation status;
- preview URL;
- approval status;
- applied by;
- rollback snapshot.

## Out Of Scope

- Full MoySklad synchronization.
- Payment processing.
- Delivery calculation.
- File upload in RFQ forms.
- Visual page builder with arbitrary blocks.
- Multi-language site.

## Success Criteria

- **SC-001**: Payload admin has useful business sections beyond the current empty-looking RFQ-only state.
- **SC-002**: A manager can process a request without reading raw JSON.
- **SC-003**: A product can be edited in admin and rendered on a public product page.
- **SC-004**: A category can be edited in admin and rendered on a public catalog page.
- **SC-005**: Product and category schema.org remain valid after admin edits.
- **SC-006**: Draft/incomplete data does not break public pages.
- **SC-007**: Existing public URLs continue to return `200`.
- **SC-008**: Codex can make a draft product/category/page change through structured data rather than manual UI scraping.
- **SC-009**: Codex can show owner-readable diff and preview before publishing.
- **SC-010**: Agent-made changes are recorded in `admin-change-log`.

## Assumptions

- Payload remains the admin/CMS layer.
- PostgreSQL remains the primary database.
- The current JSON product source is a temporary seed/import source.
- MoySklad is postponed and should not block admin catalog work.
- The first useful implementation should prioritize RFQ, products, categories, documents and media.
