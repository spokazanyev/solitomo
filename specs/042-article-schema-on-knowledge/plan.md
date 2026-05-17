# Implementation Plan: Article Schema On Knowledge

**Branch**: `042-article-schema-on-knowledge`

**Spec**: [spec.md](./spec.md)

## Touchpoints

- `apps/web/src/lib/seo/template-content.ts` — расширить `KnowledgeArticle` тип полями `publishedAt`, `updatedAt`, опциональным `howToSteps[]`.
- `apps/web/src/lib/seo/structured-data.ts` — добавить `createArticleJsonLd(route, article, organization)` и `createHowToJsonLd(steps)`.
- `apps/web/src/components/SeoLandingPage.tsx` — эмитить Article JSON-LD для knowledge routes; HowTo если есть steps.
- `apps/web/src/components/page-templates.tsx` `KnowledgeTemplate` — отрендерить `<time>` с датой.

## Архитектура

`knowledgeArticleFor(path)` возвращает объект с обязательными полями + опциональным `howToSteps`. SeoLandingPage обнаруживает knowledge type и вызывает соответствующие helpers.

## Date strategy

Pre-Payload cutover: `publishedAt` / `updatedAt` хранятся в `template-content.ts` как ISO даты. Помечаются `2026-05-17` для всех существующих статей при первом коммите.

Post-Payload cutover (отдельная фича): даты вытаскиваются из коллекции `knowledge-articles`.

## Validation

- `pnpm validate:schema` подтверждает наличие Article JSON-LD на каждом knowledge URL.
- Google Rich Results Test.
- `pnpm typecheck`, `pnpm lint`.
