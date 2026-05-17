# Quickstart: Technical Project Foundation

Дата: 2026-05-14.

## Setup

From project root:

```bash
pnpm install
cp .env.example apps/web/.env.local
docker compose up -d postgres
pnpm dev
```

If Docker Desktop is not running, public homepage development can still be checked with:

```bash
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm dev
```

Payload admin runtime requires PostgreSQL.

## Verification

```bash
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm --filter @soliton/web generate:importmap
pnpm lint
pnpm typecheck
pnpm build
```

## Expected Result

- Web app starts from root script.
- Homepage opens locally.
- Payload configuration exists.
- PostgreSQL service is defined.
- Existing SDD docs remain intact.
