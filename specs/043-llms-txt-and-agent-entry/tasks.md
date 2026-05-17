# Tasks: llms.txt + Agent Entry Points

- [ ] T001 Создать `apps/web/src/app/llms.txt/route.ts` — GET handler возвращает Markdown, генерится из `seoRoutes` (группировка по type: home/catalog/b2b/solution/knowledge/document/company) + ссылки на feeds.
- [ ] T002 Content-Type `text/markdown; charset=utf-8`.
- [ ] T003 Создать `apps/web/src/app/llms-full.txt/route.ts` — расширенная версия с краткими summary каждой категории, основными FAQ, контактами компании.
- [ ] T004 Расширить `createOrganizationJsonLd()` в `apps/web/src/lib/seo/structured-data.ts` — добавить `potentialAction: [SearchAction, ContactAction]`.
- [ ] T005 Manual review структуры llms.txt по https://llmstxt.org/.
- [ ] T006 `pnpm validate:schema` — Organization с potentialAction проходит.
- [ ] T007 `curl /llms.txt` отдаёт корректный markdown.
- [ ] T008 `curl /llms-full.txt` отдаёт расширенный markdown < 30 KB.
