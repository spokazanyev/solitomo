# Implementation Plan: RFQ And Cart

**Branch**: `012-rfq-and-cart` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)

## Summary

Implement the first working RFQ flow: product page passes SKU into a form, buyer submits project details, API validates and saves the request to Payload or local fallback, and admin users can later process requests.

## Technical Context

**Language/Version**: TypeScript, Next.js 16.2.6, React 19, Payload 3.84.1.

**Primary Dependencies**: Existing Next app, Payload config, product pages, B2B page template.

**Storage**: Payload collection `rfq-requests`; local JSONL fallback at `00-source-data/rfq-submissions/rfq-requests.jsonl`.

**Testing**: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `curl` page and API tests.

## Constitution Check

- Specification-first development: PASS.
- B2B/RFQ first: PASS.
- Integrations isolated and observable: PASS.
- Analytics and search control: PARTIAL, analytics metadata captured but event dispatch deferred.
- Maintainable by Codex: PASS.
- Quality gates: PASS.
