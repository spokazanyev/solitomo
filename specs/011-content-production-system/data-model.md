# Data Model: Content Production System

## KnowledgeArticle

- `intro`: opening paragraph.
- `sections`: article sections with `title` and `text`.
- `faqs`: visible FAQ items.

## FaqItem

- `question`: visible question.
- `answer`: visible answer and JSON-LD answer text.

## ContentProductionPlan

Documented in `07-build-specifications/content-production-plan.md`:

- page priority;
- content template;
- proof needs;
- review status;
- next action.
