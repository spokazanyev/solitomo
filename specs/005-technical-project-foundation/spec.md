# Feature Specification: Technical Project Foundation

**Feature Branch**: `005-technical-project-foundation`

**Created**: 2026-05-14

**Status**: Implemented. Runtime admin/database verification is pending a running local Docker daemon.

**Input**: User description: "Продолжить SDD-план. Создать технический скелет проекта для нового сайта Soliton на Next.js + Payload CMS + PostgreSQL + Docker, чтобы дальнейшая разработка велась Codex по спецификациям."

## User Scenarios & Testing

### User Story 1 - Run The Web Application Locally (Priority: P1)

As the project owner and Codex, I want a local development application skeleton so that future catalog, SEO, checkout, and integration features have a real codebase to build on.

**Why this priority**: All later implementation depends on a working app structure, package scripts, environment configuration, and local startup path.

**Independent Test**: A developer can install dependencies, start infrastructure, run the web app, and open the homepage and admin route locally.

**Acceptance Scenarios**:

1. **Given** the repository, **When** a developer runs the documented setup commands, **Then** dependencies install without manual project restructuring.
2. **Given** local environment variables, **When** the app starts, **Then** the public homepage route responds.
3. **Given** local environment variables and database, **When** the app starts, **Then** Payload admin/API routes are present for future CMS work.

---

### User Story 2 - Establish Maintainable Project Structure (Priority: P2)

As Codex, I want a clear project layout so that future features can be implemented without mixing documentation, app code, generated files, and integration scripts.

**Why this priority**: The project already contains SDD specs and planning docs. App code must live in a clean workspace structure.

**Independent Test**: A future feature can identify where to place frontend code, Payload config, collections, scripts, tests, docs, and environment examples.

**Acceptance Scenarios**:

1. **Given** the project tree, **When** a future task targets app code, **Then** the expected path is under `apps/web`.
2. **Given** environment setup, **When** secrets are needed, **Then** `.env.example` documents required variables and `.env*` remains ignored.

---

### User Story 3 - Provide Baseline Quality Gates (Priority: P3)

As the project owner, I want baseline scripts and checks so that future Codex changes can be validated consistently.

**Why this priority**: The project will grow across SEO, ecommerce, integrations, and analytics. Basic gates must exist early.

**Independent Test**: A developer can run lint/build/type checks or their first available equivalents and see a deterministic pass/fail signal.

**Acceptance Scenarios**:

1. **Given** dependencies are installed, **When** a developer runs the documented verification commands, **Then** the app produces a clear result.
2. **Given** a future feature, **When** Codex changes app code, **Then** the same baseline commands can be reused for verification.

### Edge Cases

- The root directory already contains planning documents and Spec Kit files; scaffolding must not overwrite them.
- Database may not be running; docs must distinguish app setup from DB setup.
- Payload collections may be minimal initially; the skeleton must still support later product/catalog collections.
- Environment variables may be missing; the app/docs must make required variables clear.

## Requirements

### Functional Requirements

- **FR-001**: The project MUST use a workspace layout with application code under `apps/web`.
- **FR-002**: The project MUST include a Next.js TypeScript app using App Router.
- **FR-003**: The project MUST include Payload CMS dependencies and a minimal Payload configuration prepared for PostgreSQL.
- **FR-004**: The project MUST include Docker Compose or equivalent local database instructions for PostgreSQL.
- **FR-005**: The project MUST include `.env.example` documenting required local variables.
- **FR-006**: The project MUST include package scripts for development and verification.
- **FR-007**: The project MUST include a public homepage placeholder aligned with Soliton positioning.
- **FR-008**: The project MUST include a technical foundation document with startup and verification commands.
- **FR-009**: The project MUST not remove or overwrite existing SDD/project documentation.

### Key Entities

- **Workspace**: Root package/workspace configuration that separates docs/specs from application code.
- **Web App**: Next.js application under `apps/web`.
- **CMS Config**: Payload configuration and admin/API route setup.
- **Database Service**: Local PostgreSQL service for Payload.
- **Environment Contract**: Required variables and defaults for local setup.
- **Quality Gate**: Script or command used to verify the baseline app.

## Success Criteria

### Measurable Outcomes

- **SC-001**: `apps/web` exists and contains a Next.js TypeScript app.
- **SC-002**: Root workspace package configuration exists and can run web app scripts.
- **SC-003**: Payload config and PostgreSQL adapter dependencies are present.
- **SC-004**: Docker Compose defines a PostgreSQL service.
- **SC-005**: Setup documentation includes install, dev, and verification commands.
- **SC-006**: Baseline verification command runs and reports a deterministic result.

## Assumptions

- The first implementation may use minimal Payload collections; product collections are defined in the next implementation feature.
- PostgreSQL will run locally via Docker for development.
- The current project folder remains the SDD/project root; application code lives under `apps/web`.
- pnpm is available and preferred because it is installed locally.
