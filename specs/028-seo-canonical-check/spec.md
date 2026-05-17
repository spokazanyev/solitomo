# Feature Specification: SEO Canonical And Validation Scripts

**Feature Branch**: `028-seo-canonical-check`

**Created**: 2026-05-15

**Status**: Draft

**Input**: Sitewide review v3 found that `pnpm validate:seo` and `pnpm validate:schema` are placeholders. Canonical/trailing-slash behaviour is implicit. Sitemap generation is not part of release QA.

## User Scenarios & Testing

### User Story 1 - Search Crawler Follows Canonical URLs (Priority: P1)

A crawler requests `/catalog/pdu` (no trailing slash). The server returns `308` to `/catalog/pdu/`. Canonical tag points to `/catalog/pdu/`. Query parameters do not change the canonical.

**Why this priority**: Avoids duplicate-content penalties and keeps SEO matrix predictable.

**Independent Test**: `curl -I /catalog/pdu` → `308`; `view-source` of `/catalog/pdu/?current=32a` shows canonical without query.

**Acceptance Scenarios**:

1. **Given** a URL without trailing slash, **When** requested, **Then** the server returns 308 to the slashed variant.
2. **Given** a query parameter, **When** the page is rendered, **Then** canonical points to the clean URL.

### User Story 2 - QA Runs A Real SEO Validator (Priority: P1)

A developer runs `pnpm validate:seo`. The script walks the sitemap, asserts each URL returns 200, has a unique title, H1 and meta description, includes the expected JSON-LD blocks, and writes a dated report.

**Why this priority**: Today QA depends on manual checks; regressions slip through.

**Independent Test**: Running the script on a healthy build produces a zero-error report; tampering with one page's meta description fails the script.

**Acceptance Scenarios**:

1. **Given** a successful build, **When** `pnpm validate:seo` runs, **Then** it exits 0 and writes a dated report into `06-reports/`.
2. **Given** a missing canonical, **When** the script runs, **Then** it exits 1 with the offending URL listed.

### User Story 3 - QA Validates Structured Data Programmatically (Priority: P1)

A developer runs `pnpm validate:schema`. The script asserts that each page emits the expected JSON-LD types and that each block parses against schema.org rules.

**Independent Test**: Running on a healthy build → exit 0; modifying Product JSON-LD to remove `name` → exit 1.

### Edge Cases

- What if the sitemap is empty or unreachable? Script fails fast with a clear message.
- What if the build is in dev mode and uses Turbopack? Script must run against the dev server or a fresh build.
- What if a route ships without JSON-LD (e.g., 404)? Script must allow declarative exclusions.

## Requirements

### Functional Requirements

- **FR-001**: Server MUST 308-redirect URLs without trailing slash to the slashed variant for public routes.
- **FR-002**: Canonical tag MUST be query-parameter-agnostic.
- **FR-003**: `pnpm validate:seo` MUST be a real script that walks sitemap and asserts page integrity.
- **FR-004**: `pnpm validate:schema` MUST be a real script that asserts structured-data correctness.
- **FR-005**: Both scripts MUST write timestamped reports into `06-reports/`.

### Key Entities

- **SeoCheckResult**: url, status, missingFields[], warnings[].
- **SchemaCheckResult**: url, jsonLdTypes[], errors[].

## Success Criteria

### Measurable Outcomes

- **SC-001**: Trailing-slash redirect verified on five sampled URLs.
- **SC-002**: `pnpm validate:seo` runs on 102 sitemap URLs and exits 0 on healthy build.
- **SC-003**: `pnpm validate:schema` validates JSON-LD on a representative subset (home, catalog, product, knowledge, B2B, document) with no errors.

## Assumptions

- The sitemap remains the source of truth for public URL coverage.
- The validator script can run against the local dev server or a fresh production build.
- Network access to schema.org or third-party validators is not required; validation is local using a JSON schema or a JSON-LD parser.
