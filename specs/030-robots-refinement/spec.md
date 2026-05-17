# Feature Specification: Robots Refinement

**Feature Branch**: `030-robots-refinement`

**Created**: 2026-05-16

**Status**: Draft

**Input**: SEO-review found `Disallow: /*?*` blocks all query-string URLs. This prevents UTM-tracked landing pages from being indexed and conflicts with future filter-by-query catalog features. Duplicate-content concerns are already handled by `<link rel="canonical">` on every page.

## User Scenarios & Testing

### User Story 1 - UTM-tagged URLs Are Indexable (Priority: P1)

A Yandex/Google crawler visits `/catalog/pdu/?utm_source=email` and indexes it under its canonical (the clean URL).

**Independent Test**: `curl /robots.txt` does NOT contain `/*?*`; crawler can fetch query-string URL.

### User Story 2 - Admin/API/Static Stay Blocked (Priority: P1)

`/admin/`, `/api/`, `/_next/` remain disallowed.

## Requirements

- **FR-001**: `robots.txt` MUST NOT contain `Disallow: /*?*`.
- **FR-002**: `robots.txt` MUST contain `Disallow: /admin/`, `Disallow: /api/`, `Disallow: /_next/`.
- **FR-003**: Canonical handling MUST remain query-parameter-agnostic on all public routes.

## Success Criteria

- **SC-001**: `curl /robots.txt` returns the new policy.
- **SC-002**: Yandex.Webmaster Crawl Status shows query-string URLs as "Indexable" but `canonical` consolidation.
