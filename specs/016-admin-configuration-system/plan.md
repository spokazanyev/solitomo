# Implementation Plan: Admin Configuration System

**Branch**: `016-admin-configuration-system`  
**Date**: 2026-05-15  
**Spec**: [spec.md](./spec.md)

## Summary

Build the first agent-ready Payload admin layer for Soliton: richer RFQ records, catalog and SEO collections, configurable filters, audit logging, and shared project context for Codex, Claude Code and future agents. This stage does not switch public pages from JSON to Payload yet; it prepares the admin data model and safe operations layer.

## Technical Context

**Runtime**: Next.js 16, React 19, Payload 3, PostgreSQL.  
**Current Admin**: users and `rfq-requests` only.  
**Current Public Data Source**: `00-source-data/assortment/soliton1_assortment_raw.json` via `apps/web/src/lib/products/source-products.ts`.  
**Constraint**: Public site must keep working while admin collections are added.

## Scope

### In Scope

- Add Payload collections for catalog, attributes, filters, media/documents and audit log.
- Improve RFQ records with structured line items and manager workflow fields.
- Add stable identifiers and draft/review/published fields for agent operations.
- Add shared context files for Codex and Claude Code.
- Add package scripts for agent context and validation placeholders.
- Keep public pages backed by current JSON source until import/render migration is explicitly implemented.

### Out Of Scope

- Switching product/category rendering to Payload.
- MoySklad synchronization.
- Payment/delivery live integrations.
- MCP server implementation.
- Arbitrary page builder.

## Architecture

Payload collections become the structured operating layer:

- `products`
- `categories`
- `attribute-groups`
- `attributes`
- `attribute-options`
- `filter-groups`
- `filter-fields`
- `filter-options`
- `filter-presets`
- `media`
- `documents`
- `admin-change-log`
- improved `rfq-requests`

Agent scripts are thin local entry points:

- `agent:context`
- `export:catalog`
- `validate:catalog`
- `validate:seo`
- `validate:schema`
- `smoke:public-pages`
- `agent:propose-change`
- `agent:apply-change`

## Data Safety

- Agent changes are draft-first.
- High-risk changes require owner approval before publication.
- Bulk operations must support dry-run.
- Deletion remains restricted.
- Schema.org, SEO and public page smoke checks are required before publishing agent-led changes.

## Verification

Required checks:

```bash
pnpm --filter @soliton/web generate:types
pnpm typecheck
pnpm lint
```

Smoke checks:

```text
200 /admin/
200 /
200 /catalog/pdu/
200 /product/sp-8/
200 /b2b/request-quote/
```

## Follow-Up

After this stage:

1. Seed current 66 products into Payload.
2. Render product/category pages from Payload.
3. Add preview/diff UI or command output for agent edits.
4. Decide whether MCP is needed after scripts/API stabilize.
