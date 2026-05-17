# Feature Specification: Article Schema On Knowledge

**Feature Branch**: `042-article-schema-on-knowledge`

**Created**: 2026-05-17

**Status**: Deferred (отложено до приоритизации — см. `07-build-specifications/deferred-content-track.md`)

**Input**: AI-агенты предпочитают цитировать страницы с подтверждённым авторством, датой публикации и издателем (E-E-A-T сигналы). 14 knowledge-страниц сейчас отдаются как простые HTML без `Article` JSON-LD — это снижает их вес при retrieval.

## User Scenarios & Testing

### User Story 1 — AI-агент цитирует knowledge-страницу с указанием автора (Priority: P1)

LLM при ответе на вопрос «как выбрать PDU» цитирует `/knowledge/kak-vybrat-pdu/` и в сноске указывает «Источник: Солитон, инженерная команда, опубликовано 2026-XX, обновлено 2026-XX». Это становится возможно потому что страница содержит `Article` JSON-LD с `author`, `publisher`, `datePublished`, `dateModified`.

**Independent Test**: `curl /knowledge/kak-vybrat-pdu/ | grep -o '"@type":"TechArticle"'` возвращает совпадение; `pnpm validate:schema` подтверждает корректность.

**Acceptance**:
1. Все knowledge-страницы (текущие 9 + 5 сравнительных) MUST содержать `Article` или `TechArticle` JSON-LD.
2. Поля: `headline`, `author` (Organization Солитон или Person если известно), `publisher`, `datePublished`, `dateModified`, `mainEntityOfPage`, `image`, `articleBody` (или ссылка).

### User Story 2 — Дата обновления отображается читателю (Priority: P2)

На knowledge-странице видна дата публикации/обновления — повышает доверие читателя и совпадает с meta-данными.

**Acceptance**: В шапке знаниевой статьи виден `<time datetime="2026-...">Обновлено DD.MM.YYYY</time>`.

### User Story 3 — Knowledge как HowTo где применимо (Priority: P2)

Страницы с пошаговыми инструкциями (`/knowledge/kak-vybrat-pdu/`, `/knowledge/kak-rasschitat-nagruzku-na-pdu/`) дополнительно содержат `HowTo` JSON-LD с `HowToStep[]`. Хотя Google убрал rich-snippet, AI-агенты ещё читают.

### Edge Cases

- **Author unknown**: использовать `Organization { name: "Солитон" }` как fallback автор. Это валидно для Schema.org.
- **DateModified в шаблоне**: пока используется шаблонный контент, `dateModified` = `datePublished`. После рефакта content-track обновляется.
- **TechArticle vs Article**: для технических тем (PDU, расчёты) использовать `TechArticle` — более специфичный тип.

## Requirements

### Functional Requirements

- **FR-001**: Каждая knowledge-route MUST эмитить `Article` или `TechArticle` JSON-LD.
- **FR-002**: Поля JSON-LD: `@type`, `headline`, `description`, `image`, `datePublished`, `dateModified`, `author` (Organization), `publisher` (Organization), `mainEntityOfPage`, `url`.
- **FR-003**: На странице (видимо для читателя) MUST отображаться дата публикации/обновления в формате `<time>` тег.
- **FR-004**: 3+ knowledge-страниц с пошаговыми инструкциями дополнительно MUST содержать `HowTo` JSON-LD.
- **FR-005**: `dateModified` MUST обновляться при изменении контента в `template-content.ts` (на этапе после Payload cutover — автоматически через коллекцию).

### Key Entities

- **KnowledgeArticle** (extended): добавить `publishedAt`, `updatedAt` поля в данные.
- **HowToStep**: для шаговых статей — массив пар `{ name, text, image? }`.

## Success Criteria

- **SC-001**: `pnpm validate:schema` проверяет наличие `Article` на всех knowledge URL.
- **SC-002**: Google Rich Results Test → 0 warnings.
- **SC-003**: AI-агент (тестово) корректно атрибутирует источник Солитон при цитировании.

## Assumptions

- Контент пока шаблонный (см. `035-knowledge-content-rewrite`). `Article` schema даёт техническую готовность — фактический рост качества придёт с content-track.
- Автор — Organization Солитон. Person-авторов нет до выхода реальной редакторской команды.
- DatePublished для всех существующих статей = `2026-05-17` (дата структурного добавления schema), `dateModified` = тоже.
