# Implementation Plan: Order Numbering and Immutability

**Branch**: `051-order-numbering-and-immutability` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

## Summary

Добавить два независимых, но смежных слоя в коллекцию `orders`:

1. **Нумерация** — поле `clientNumber` формата `SO-YYYY-NNNN`, генерируется атомарно через PG `SEQUENCE` per-year в hook'е `beforeChange` (operation=create). Бэкфилл существующих заказов — отдельным скриптом.
2. **Иммутабельность** — hook `beforeChange`, проверяющий список «замороженных» полей при `status ∈ {paid+}` и бросающий `ValidationError` с записью в `admin-change-log`.

Оба hook'а встраиваются в существующий `Orders.js`. Никаких новых коллекций, никаких новых внешних зависимостей.

## Technical Context

**Language/Version**: TypeScript 5 / JS (Orders.js — `.js`, новые модули — `.ts`), Node 20.

**Primary Dependencies**: ничего нового. Только `payload`, `pg` (через payload-postgres adapter, уже есть).

**Storage**: PostgreSQL — `CREATE SEQUENCE order_seq_YYYY` + `nextval()`.

**Testing**: Vitest (unit на формат и edge cases, concurrency-тест на 50 параллельных create); Playwright e2e (paid → попытка мутации items → 400).

**Target Platform**: server-side (Node runtime, Payload hooks).

**Performance Goals**:
- p95 генерации номера ≤ 50 мс (один доп. SQL roundtrip).
- 0 коллизий при concurrency=50.

**Constraints**:
- Атомарность гарантируется PG sequence (или SELECT FOR UPDATE fallback).
- Иммутабельность hook никогда не блокирует обновления служебных полей (`internalComment`, `shipment.*`, `history` etc.).

**Scale/Scope**: 1 спринт (~3–5 дней).

## Project Structure

```text
specs/051-order-numbering-and-immutability/
├── spec.md
├── plan.md
├── data-model.md
├── tasks.md
└── contracts/
    └── clientNumber-generator.ts   # типизированный контракт

apps/web/src/
├── collections/Orders.js          # MODIFY: добавить поле + 2 hook'а
├── lib/lifecycle/
│   ├── client-number.ts           # NEW: generateClientNumber()
│   └── immutability.ts            # NEW: checkPaidImmutability()
└── scripts/
    └── backfill-client-numbers.mjs # NEW: idempotent migration
```

## Phase 0 Research

Не требуется глубокий research:

- PG `SEQUENCE` — стандартный механизм; ограничение per-year реализуется именованием `order_seq_${year}`.
- Альтернатива (если без sequence): `SELECT MAX(SUBSTRING(client_number FROM '\d+$')::int) FROM orders WHERE client_number LIKE 'SO-YYYY-%' FOR UPDATE` в транзакции + retry. Менее быстро, но без миграции SEQUENCE.
- Решение: использовать **SEQUENCE** как основной путь (см. `contracts/clientNumber-generator.ts`); fallback задокументирован, но не реализуется на MVP.

## Phase 1 Outputs

- `data-model.md` — поле, индекс, sequence, audit-запись.
- `contracts/clientNumber-generator.ts` — TypeScript-контракт функции.
- `tasks.md` — 10 задач.

## Risk & Mitigation

| Риск | Митигация |
|---|---|
| Коллизия при concurrent create | PG `SEQUENCE` гарантирует атомарность; unit-тест на 50 параллельных операций. |
| Backfill ломает существующие интеграции (Twenty, ApiShip) | Скрипт пишет только в `clientNumber`; mapper'ы безопасно читают `clientNumber \|\| id`. Запуск — после кода, но до релиза. |
| Кто-то залогинился под admin и снял readonly через DevTools | Hook beforeChange — серверная защита; readonly в UI — только UX. |
| Reissue через legit-роут используется злонамеренно | `clientNumberReissueReason` обязательное; запись в `admin-change-log` с actor'ом. |
| Sequence для нового года не создан | Lazy create в `generateClientNumber()`: если sequence не существует — `CREATE SEQUENCE IF NOT EXISTS`. |

## Constitution Check

- Изменяет финансово-значимые инварианты — owner confirmation перед прод-релизом.
- Не выводит ничего нового на клиент (всё server-side).
- Audit обязателен (FR-5108) — соответствует принципу «прослеживаемость финансовых операций».
