# Contract: Technical Foundation Output

Дата: 2026-05-14.

## Required Code/Config Outputs

- `package.json`
- `pnpm-workspace.yaml`
- `docker-compose.yml`
- `.env.example`
- `apps/web/package.json`
- `apps/web/src/payload.config.ts`
- Next.js app files under `apps/web/src/app/`

## Required Documentation Outputs

- `07-build-specifications/technical-project-foundation.md`
- updates to `README.md`
- updates to `AGENTS.md`
- updates to `07-build-specifications/document-register.md`

## Required Commands

Root scripts should include:

- install handled by pnpm;
- `dev`;
- `build`;
- `lint`;
- `typecheck` or equivalent if available.

## Required Local Services

Docker Compose must define PostgreSQL with:

- database;
- user;
- password;
- persistent volume;
- exposed local port.

## Quality Rules

- No secrets committed.
- Existing docs/specs preserved.
- App code lives in `apps/web`.
- README explains local startup.
- Verification commands are documented.
