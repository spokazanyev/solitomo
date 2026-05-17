# Tasks: Article Schema On Knowledge

- [ ] T001 В `apps/web/src/lib/seo/template-content.ts` расширить `KnowledgeArticle` тип: добавить `publishedAt: string`, `updatedAt: string`, `howToSteps?: Array<{ name: string; text: string }>`.
- [ ] T002 Заполнить `publishedAt` / `updatedAt` для всех 14 knowledge-статей значением `2026-05-17` (структурный коммит). Контент-track обновит позже.
- [ ] T003 Для `/knowledge/kak-vybrat-pdu/`, `/knowledge/kak-rasschitat-nagruzku-na-pdu/`, `/knowledge/gorizontalnyj-ili-vertikalnyj-pdu/` добавить `howToSteps` (минимум 3 шага на статью).
- [ ] T004 В `apps/web/src/lib/seo/structured-data.ts` добавить `createArticleJsonLd(route, article, contacts)` — TechArticle с `@type`, `headline`, `description`, `image`, `datePublished`, `dateModified`, `author`, `publisher`, `mainEntityOfPage`, `url`.
- [ ] T005 Там же добавить `createHowToJsonLd(steps)` — `HowTo` JSON-LD c `step[]`.
- [ ] T006 В `apps/web/src/components/SeoLandingPage.tsx` — для `route.type === "knowledge"` эмитить Article JSON-LD; если `howToSteps` есть — HowTo тоже.
- [ ] T007 В `KnowledgeTemplate` (`page-templates.tsx`) — добавить под H1 строку `<time>Опубликовано {date}</time>` (и `Обновлено` если различается).
- [ ] T008 `pnpm validate:schema` — Article на всех knowledge.
- [ ] T009 `pnpm typecheck`, `pnpm lint` — зелёные.
