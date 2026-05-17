# Feature Specification: Performance Audit

**Feature Branch**: `036-performance-audit`

**Created**: 2026-05-16

**Status**: Draft

**Input**: SEO-review noted that Core Web Vitals have not been verified on the new home page. Local legacy images (109 files, ~400KB avg) and hero WebP (97KB) should be in range; need to confirm with Lighthouse before public release.

## User Scenarios & Testing

### User Story 1 - Mobile Lighthouse Performance ≥ 85 (Priority: P2)

A mobile audit of `/`, `/catalog/pdu/`, `/product/sp-8/`, `/b2b/request-quote/`, `/company/contacts/` reports Performance ≥ 85, LCP < 2.5s, CLS < 0.1, INP < 200ms.

**Acceptance Scenarios**:

1. **Given** a fresh build, **When** Lighthouse Mobile runs against the five URLs, **Then** all five report Performance ≥ 85.
2. **Given** any URL fails, **When** the bottleneck is identified, **Then** specific optimization is applied (next/image, WebP, preload).

## Requirements

- **FR-001**: Lighthouse Mobile report MUST be generated for the five URLs.
- **FR-002**: Report MUST be stored under `06-reports/lighthouse-audit-YYYY-MM-DD.md`.
- **FR-003**: If LCP > 2.5s on any URL, mitigation MUST be applied and re-tested.
- **FR-004**: Hero image MUST be served from `priority` `next/image` when feasible (or `<img>` with `fetchPriority="high"`).

## Success Criteria

- **SC-001**: Performance ≥ 85 on five sampled URLs.
- **SC-002**: Accessibility ≥ 90, Best Practices ≥ 90, SEO 100.
