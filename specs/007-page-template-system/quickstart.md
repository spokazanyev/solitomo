# Quickstart: Page Template System

Дата: 2026-05-15.

## Verify

```bash
pnpm lint
pnpm typecheck
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm build
```

## Smoke Test

```bash
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm dev
curl -sI http://localhost:3000/
curl -sI http://localhost:3000/catalog/pdu/
curl -sI http://localhost:3000/solutions/pdu-dlya-servernogo-shkafa/
curl -sI http://localhost:3000/knowledge/kak-vybrat-pdu/
curl -sI http://localhost:3000/b2b/
curl -sI http://localhost:3000/documents/
curl -sI http://localhost:3000/company/about/
```
