# Research: Technical Project Foundation

Дата: 2026-05-14.

## Decision: Use pnpm Workspace

Use a root `pnpm-workspace.yaml` and root scripts that delegate to `apps/web`.

## Rationale

The project already contains planning docs and Spec Kit artifacts. A workspace separates app code from SDD docs and keeps future packages/scripts possible.

## Decision: Place Application In `apps/web`

The Next.js + Payload application lives under `apps/web`.

## Rationale

This avoids mixing generated app files with `01-site-structure`, `07-build-specifications`, `.specify`, and `specs`.

## Decision: Use Next.js App Router With Payload 3

Use a TypeScript Next.js app and integrate Payload CMS routes/config inside the app.

## Rationale

The selected platform is Next.js + Payload + PostgreSQL. Payload 3 is designed to work with Next.js and supports PostgreSQL via `@payloadcms/db-postgres`.

## Decision: Use Docker Compose For Local PostgreSQL

Provide a local Postgres service for development.

## Rationale

It makes local setup repeatable and avoids depending on a manually installed database.

## Alternatives Considered

### Scaffold In Project Root

Rejected because the root already contains SDD/project docs and should remain the planning workspace.

### Use npm Instead Of pnpm

Rejected because pnpm is installed and better supports a multi-package workspace.

### Use SQLite For First Skeleton

Rejected because the chosen production direction is PostgreSQL and product data/integrations should be modeled against it from the start.
