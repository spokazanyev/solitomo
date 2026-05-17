# Tasks: Admin Configuration System

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), `07-build-specifications/admin-configuration-spec.md`

## Phase 1 - Planning

- [x] T001 Create implementation plan for admin configuration system.
- [x] T002 Create implementation task list.

## Phase 2 - Payload Collections

- [x] T003 Add shared admin field helpers for status, quality, agent and SEO fields.
- [x] T004 Improve `rfq-requests` with structured items, manager workflow fields and UTM/source fields.
- [x] T005 Add `admin-change-log` collection.
- [x] T006 Add catalog collections: `products`, `categories`, `media`, `documents`.
- [x] T007 Add attribute collections: `attribute-groups`, `attributes`, `attribute-options`.
- [x] T008 Add configurable filter collections: `filter-groups`, `filter-fields`, `filter-options`, `filter-presets`.
- [x] T009 Register new collections in `payload.config.ts`.

## Phase 3 - Agent Context And Scripts

- [x] T010 Create `agent-project-context.md`.
- [x] T011 Update `AGENTS.md` and `apps/web/CLAUDE.md` to point agents to the project context.
- [x] T012 Add `agent:context` script.
- [x] T013 Add baseline validation/export script placeholders with explicit TODO output.

## Phase 4 - Verification

- [x] T014 Generate Payload types/import map if required.
- [x] T015 Run `pnpm typecheck`.
- [x] T016 Run `pnpm lint`.
- [x] T017 Smoke check `/admin/` and core public URLs.

## Phase 5 - Payload Seeding

- [x] T018 Add `seed:catalog` Payload bin script.
- [x] T019 Run `seed:catalog:dry-run`.
- [x] T020 Run `seed:catalog`.
- [x] T021 Verify seeded Products/Categories/Filters in Payload API/admin.

## Phase 6 - Follow-Up Tasks

- [ ] T022 Switch public product pages to Payload source.
- [ ] T023 Switch catalog/filter pages to Payload source.
- [ ] T024 Implement real agent propose/apply workflow with diff, preview and audit log writes.
- [ ] T025 Decide on MCP after scripts/API stabilize.
