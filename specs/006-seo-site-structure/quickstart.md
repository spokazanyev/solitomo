# Quickstart: SEO Site Structure

Дата: 2026-05-15.

## Verify

```bash
pnpm lint
pnpm typecheck
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm build
```

## Local Smoke Test

```bash
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm dev
curl -sI http://localhost:3000/catalog/pdu/
curl -sI http://localhost:3000/catalog/pdu
curl -s http://localhost:3000/robots.txt
curl -s http://localhost:3000/sitemap.xml
```

Expected:

- `/catalog/pdu/` returns `200`.
- `/catalog/pdu` redirects to `/catalog/pdu/`.
- `robots.txt` disallows `/admin/`, `/api/`, and `/*?*`.
- `sitemap.xml` lists 36 indexable URLs in the current skeleton.
