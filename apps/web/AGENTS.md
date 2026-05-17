<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Web App Agent Notes

Read `../../agent-project-context.md` before changing Payload collections, public routes, SEO/schema.org logic or RFQ behavior.

Current admin feature:

- `../../specs/016-admin-configuration-system/spec.md`
- `../../specs/016-admin-configuration-system/plan.md`
- `../../specs/016-admin-configuration-system/tasks.md`

Useful commands from repo root:

```bash
pnpm agent:context
pnpm --filter @soliton/web generate:types
pnpm typecheck
pnpm lint
```
