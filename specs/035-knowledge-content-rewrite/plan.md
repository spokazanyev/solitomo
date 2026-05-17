# Implementation Plan: Knowledge Content Rewrite

**Branch**: `035-knowledge-content-rewrite`

**Spec**: [spec.md](./spec.md)

## Scope

Content production. No code changes after spec `033` lands its placeholder structure.

## Content Track Owner

Owner: editorial team (TBD).

## Article Briefs

Detailed briefs are kept in `07-build-specifications/knowledge-content-briefs.md` (to be created in content track).

## Storage

While public site reads from `template-content.ts`, articles are authored there. After Payload public cutover (`017-payload-public-cutover`), they migrate to the `knowledge-articles` collection.

## Validation

- Each new article passes a 4-eyes editorial review.
- Text.ru uniqueness ≥ 80%.
- Manual SEO check: H1, structured headings, internal links, FAQ.
