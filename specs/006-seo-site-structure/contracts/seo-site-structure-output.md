# Contract: SEO Site Structure Output

The feature is complete when these outputs exist and pass verification:

## Documentation Outputs

- `07-build-specifications/seo-technical-spec.md`
- `07-build-specifications/seo-landing-matrix.md`
- updated `01-site-structure/site-map.md`
- updated `07-build-specifications/document-register.md`
- updated `README.md`

## Code Outputs

- `apps/web/src/lib/seo/seo-registry.ts`
- `apps/web/src/lib/seo/structured-data.ts`
- `apps/web/src/components/SeoLandingPage.tsx`
- `apps/web/src/app/robots.ts`
- `apps/web/src/app/sitemap.ts`
- static route pages for catalog, solutions, knowledge, B2B, documents, and company sections.

## Verification Outputs

Commands:

```bash
pnpm lint
pnpm typecheck
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm build
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm dev
curl -sI http://localhost:3000/catalog/pdu/
curl -s http://localhost:3000/robots.txt
curl -s http://localhost:3000/sitemap.xml
```

Expected:

- lint/typecheck/build pass.
- `/catalog/pdu/` returns 200.
- `/catalog/pdu` redirects to `/catalog/pdu/`.
- sitemap contains initial indexable route set.
- robots blocks admin/API/parameter URLs.
