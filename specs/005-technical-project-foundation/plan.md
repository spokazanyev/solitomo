# Implementation Plan: Technical Project Foundation

**Branch**: `005-technical-project-foundation` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-technical-project-foundation/spec.md`

## Summary

Create a maintainable technical foundation for Soliton's future site: root pnpm workspace, Next.js TypeScript app under `apps/web`, Payload CMS configuration prepared for PostgreSQL, local Postgres via Docker Compose, environment examples, startup docs, and baseline verification scripts.

## Technical Context

**Language/Version**: TypeScript on Node.js 22.16.0.

**Primary Dependencies**: Next.js, React, Payload CMS, `@payloadcms/db-postgres`, PostgreSQL, pnpm.

**Storage**: PostgreSQL for Payload local development; source code in `apps/web`; docs/specs remain at project root.

**Testing**: Baseline lint/build/type or first available verification scripts.

**Target Platform**: Local development first; future deployment TBD.

**Project Type**: Web application with CMS backend integrated into Next.js.

**Performance Goals**: Not applicable for skeleton; keep foundation lean.

**Constraints**: Must not overwrite existing planning docs; app code lives under `apps/web`; secrets must not be committed.

**Scale/Scope**: One web app workspace plus local DB service.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Specification-first development: PASS.
- SEO and demand as product requirements: PASS. App placeholder and structure must support future SEO features.
- B2B/RFQ first: PASS. No checkout in this feature, but structure must not block B2B/RFQ.
- Integrations isolated and observable: PASS. No integrations yet; future provider modules are expected.
- Analytics and search control: PASS. No analytics yet; future app structure must support it.
- Maintainable by Codex: PASS. Workspace and docs are explicit.
- Quality gates: PASS. Baseline verification scripts are required.

## Project Structure

### Documentation (this feature)

```text
specs/005-technical-project-foundation/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── technical-foundation-output.md
└── tasks.md
```

### Source Code

```text
package.json
pnpm-workspace.yaml
docker-compose.yml
.env.example

apps/
└── web/
    ├── package.json
    ├── next.config.ts
    ├── src/
    │   ├── app/
    │   ├── collections/
    │   └── payload.config.ts
    └── ...
```

**Structure Decision**: Use a root pnpm workspace with a single `apps/web` app. This keeps SDD docs separate from implementation code and leaves room for future scripts/packages.

## Phase 0: Research

Decisions:

- Use pnpm because it is installed and suited to workspaces.
- Use `apps/web` for the Next.js/Payload app.
- Use PostgreSQL via Docker Compose for local CMS development.
- Start with minimal Payload collections; product collections follow in a later feature.

## Phase 1: Design & Contracts

Artifacts:

- `research.md` - technical decisions.
- `data-model.md` - workspace entities.
- `contracts/technical-foundation-output.md` - required output.
- `quickstart.md` - setup and verification guide.

## Complexity Tracking

No constitution violations.
