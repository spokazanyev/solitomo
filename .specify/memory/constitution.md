# Soliton Site Constitution

## Core Principles

### I. Specification-First Development

Every material change starts with a written specification before implementation. A feature must pass the Spec Kit flow in order: `speckit-specify`, optionally `speckit-clarify`, then `speckit-plan`, `speckit-tasks`, and only then `speckit-implement`.

Implementation work may not begin from a vague request if the change affects public pages, product data, checkout, payment, delivery, analytics, SEO, or integrations. The specification must define user value, functional requirements, acceptance scenarios, data entities, dependencies, and success criteria.

### II. SEO And Demand Are Product Requirements

SEO is not a post-launch enhancement. URL structure, metadata, sitemap, robots, canonical logic, schema.org, internal linking, FAQ, category text, landing pages, and indexation rules are required product behavior.

New categories, filters, use-case pages, and content sections must map to confirmed demand clusters or documented business reasons. Pages that target organic traffic must have measurable intent, unique value, and clear conversion paths.

Structured data must remain aligned with current schema.org vocabulary and search-engine structured-data guidelines. Public product, category, organization, breadcrumb, FAQ, article, contact, offer, delivery, and payment-related pages must expose machine-readable JSON-LD where applicable. Product data must include only truthful, source-backed properties; stock, availability, reviews, ratings, shipping details, registry status, certificates, and comparison claims may not be marked up until the underlying evidence exists in project data.

### III. B2B/RFQ First, B2C Checkout Second

Soliton is a technical B2B/B2C catalog, not only a commodity checkout store. Corporate purchase flows, request for quotation, invoice requests, file attachments, company details, delivery by agreement, and manager follow-up are first-class requirements.

Online payment and automated delivery are important, but they must not weaken the B2B flow. Every commerce feature must support both individual buyers and corporate buyers unless the specification explicitly scopes one of them out.

### IV. Integrations Must Be Isolated And Observable

External services must be integrated through explicit provider interfaces, not scattered through UI code. This applies to MойСклад, payment providers, delivery services, email notifications, analytics, and search tooling.

Webhook handlers and sync jobs must be idempotent. Integration failures must be logged with enough context to diagnose the problem without exposing secrets or unnecessary personal data.

### V. Analytics And Search Control Are Required

Yandex Metrica, Google Analytics 4, Yandex Webmaster, and Google Search Console are part of the product. User journeys, product views, category views, add-to-cart, RFQ submission, invoice request, checkout, payment, and delivery events must be measurable.

No feature that affects acquisition or conversion is complete until its analytics events and verification steps are specified and implemented.

### VI. Code Must Stay Maintainable By Codex

Prefer code-first architecture, explicit data models, typed contracts, repeatable scripts, and documentation close to the implementation. Avoid hidden business logic in admin-only settings, manual one-off configuration, or external tools unless the specification records why.

Codex must be able to reconstruct the intended behavior from repository files: specs, plans, tasks, schemas, tests, and operational documentation.

### VII. Quality Gates Before Release

Release candidates must pass relevant gates:

- core pages render on desktop and mobile;
- catalog and product pages are crawlable;
- sitemap and robots are valid;
- schema.org JSON-LD is valid, truthful, and aligned with the relevant page type;
- primary forms submit correctly;
- analytics events are visible in debug tools;
- integration webhooks are safe to retry;
- secrets are not committed;
- regression tests or smoke tests cover the critical path.

## Technical Constraints

The preferred platform is Next.js + Payload CMS + PostgreSQL unless a later approved specification changes this decision.

Default external services:

- MойСклад for operational product, stock, price, order, and counterparty data.
- ЮKassa as the primary online payment provider.
- ApiShip, СДЭК, and Деловые Линии as delivery candidates.
- Yandex Metrica and Google Analytics 4 for analytics.
- Yandex Webmaster and Google Search Console for search monitoring.

Product content, SEO content, page structure, and conversion flows belong to the site/CMS layer. Accounting, stock, operational orders, and counterparties belong to MойСклад.

## Development Workflow

1. Define or update the relevant project specification in `specs/`.
2. Resolve material ambiguity with `speckit-clarify` when needed.
3. Generate a plan with `speckit-plan`.
4. Generate executable tasks with `speckit-tasks`.
5. Implement tasks with `speckit-implement`.
6. Verify against acceptance criteria and quality gates.
7. Update project documents when decisions change.

Project planning documents outside `specs/` remain useful background. Feature execution must happen through Spec Kit artifacts.

## Governance

This constitution supersedes informal preferences. If a feature plan violates a principle, the plan must either change or explicitly document the violation, business reason, risk, and mitigation.

Amendments require updating this file and recording the reason in the relevant planning document. Major architectural changes require updating `05-implementation-roadmap/master-project-plan.md` and `07-build-specifications/document-register.md`.

**Version**: 1.1.0 | **Ratified**: 2026-05-14 | **Last Amended**: 2026-05-15
