# Review 051 — итоговый отчёт

**Дата ревью**: 2026-05-23 (запущен agent), сохранено на диск 2026-05-24.
**Метод**: автоматическое ревью через background-агента + ручная фиксация результатов (агент успел отчитаться в чате, но сессия прервалась до записи файла).

## Сводка

**34 находки**: CRITICAL=5, HIGH=8, MEDIUM=12, LOW=9.
**Готовность к реализации**: WITH FIXES (после 8 обязательных решений).

## CRITICAL (блокирует реализацию)

| # | Файл / место | Описание | Предложение |
|---|---|---|---|
| C1 | `data-model.md §5` | Описывает «минимальную» схему `admin-change-log` `{at, actorEmail, kind, attemptedFields, …}`. Реальная коллекция `apps/web/src/collections/AdminChangeLog.js` имеет другую schema: `actorType / actorName / targetCollection / targetId / targetLabel / changeType (create|update|publish|archive|import) / beforeSnapshot`. Задача T011 не пройдёт типизацию. | Переписать в data-model.md §5 на реальные поля. Использовать `changeType: "update"`, `targetCollection: "orders"`, `targetId: order.id`, `diffSummary: "client_number_reissue"`, `beforeSnapshot/afterSnapshot` с дельтой полей. |
| C2 | spec.md FR-5106..5108 | «Поля заморожены при `status ∈ {paid, fulfilling, shipped, delivered, completed}`» — но `cancelled / expired` могут случиться **до** `paid`, и для них items не должны быть заморожены. Логично замораживать на основании факта **оплаты**, а не строки статуса. | Использовать `payment.paidAt != null` или новое derived поле `wasEverPaid: boolean` (set on first paid transition, never reset). Документировать «point-of-no-return = first paid». |
| C3 | spec.md FR-5106 + data-model.md §3 | Спека замораживает `totals.subtotal/vat/total` и `items[].price/lineTotal`. Но 047 FR-110 уже обещала **отдельные snapshot-поля**: `totals.snapshotSubtotal/snapshotVat/snapshotTotal` и `items[].priceSnapshot { unit, lineTotal, vatRate, capturedAt }`. **Этих полей нет в текущем Orders.js**. Если не сделать миграцию — нечего блокировать. | Либо (a) сделать миграцию `Orders.js` — добавить `items[].priceSnapshot` и `totals.snapshot*` (тогда 051 расширяет 047 FR-110); либо (b) явно сказать «051 пока замораживает мутабельные поля; snapshot-поля приедут в follow-up». Решить с владельцем. |
| C4 | spec.md US1 + tasks.md | Для существующих заказов, уже отправленных в ApiShip и Twenty, `clientNumber` после backfill **не перезаписывается** в эти внешние системы. | Документировать в US1 edge case: «backfill заполняет только локальный clientNumber; ApiShip/Twenty не reissue». Опционально — sync-скрипт для будущей актуализации. |
| C5 | `contracts/clientNumber-generator.ts` + tasks.md T014 | `sequenceNameFor(year) = order_seq_${year}`. Backfill только текущего года не закроет проблему — на стыке января sequence нового года не существует. | Создавать sequence в beforeChange hook **lazy** в той же транзакции: `CREATE SEQUENCE IF NOT EXISTS order_seq_${year}; SELECT nextval(...)`. Не зависеть от backfill. |

## HIGH (вводит в заблуждение разработчика)

| # | Описание | Действие |
|---|---|---|
| H1 | spec.md US2 — какой UX immutability: disabled / toast / scary modal? | Hook beforeChange бросает `Forbidden` → Payload toast. Для UX добавить `admin.condition` для readOnly. |
| H2 | Reissue — старый номер «висит» уникальным? | Старый идёт в `clientNumberHistory[]`. Уникальность только на current `clientNumber`. |
| H3 | spec.md FR-5104: «Frozen fields list» не полный. §13.5 lifecycle-spec.md — другой список. | Согласовать ровно: `items[]`, `totals.snapshot*`, `delivery.priceSnapshot`, `customer.email`, `clientNumber`. Источник истины §13.5. |
| H4 | `clientNumber` не попадает в `OrderSnapshot` (047 events.ts) → 048/049 не получат в payload. | Добавить `clientNumber?: string` в `OrderSnapshot` и `buildOrderSnapshot()`. |
| H5 | tasks.md MVP — порядок hook генерации vs immutability не указан. Backfill зависнет. | Backfill: передавать `req.context.skipImmutability = true` или временно disable hook. |
| H6 | Race на retry при unique violation не описан. | До 3 повторов с jitter; на третий — log `OrderNumberGenerationFailed`. |
| H7 | Email subject/body — какие части используют clientNumber? | Subject: `Заказ {clientNumber} оплачен`. Body: clientNumber в шапке + publicToken в ссылке. |
| H8 | Формат `SO-YYYY-NNNN` whitelist или default? | Whitelist. Тесты — env-override или `SO-9999-XXXX`. |

## MEDIUM (нужно зафиксировать до старта)

- M1: ApiShip mapper — `String(order.id)` → `order.clientNumber || String(order.id)` (fallback).
- M2: Twenty `Opportunity.name` — заменить шаблон. Уточнить новый формат.
- M3: Concurrency-тесты требуют real-PG (Playwright + dev-server fixture).
- M4: Reissue — отдельная Payload action (custom view), не просто edit field.
- M5: Что с `publicToken` после reissue — остаётся или ротируется?
- M6: Open Q — Payload admin manual create order: триггерить hook или флаг `_test: true`?
- M7: Backfill `--dry-run/--apply` — формат вывода (CSV/log)? rollback?
- M8: Заказ с уже проставленным `clientNumber` — пропустить или перезаписать?
- M9: Sequence imена не сбрасывать никогда (документировать).
- M10: Локализация subject email RU/EN.
- M11: SC-005 «без потерь» — определить метрику.
- M12: Immutability hook whitelist всегда-мутабельных полей: `disputeFlag`, `internalComment`, `crmRefs`, `notifications[]`, `shipment.lastSyncedAt`.

## LOW (косметика)

- L1: spec title → «Order number + immutability».
- L2: `getMoscowYear()` → `getBusinessYear(tz="Europe/Moscow")`.
- L3: Regex поддерживает >4 цифр — отметить в spec.md.
- L4: SQL миграция без `IF NOT EXISTS`.
- L5: Нет фазы «Documentation update» в tasks.md.
- L6: Lint-правило `no-order-id-in-user-facing-code` — warning при use `order.id` вместо `clientNumber`.
- L7: SC — добавить временную метрику (генерация p95 ≤ Xмс).
- L8: contracts — нет explicit error types.
- L9: Backfill — не описано как обрабатывать seed/test-данные.

## Заключение

**Готовность к реализации**: WITH FIXES.

**Минимальный набор фиксов до T001** (8 решений):
1. Подогнать data-model.md §5 под реальную `AdminChangeLog` schema (C1).
2. Заменить «status ∈ paid+» на `wasEverPaid` (C2).
3. Решить snapshot-поля: миграция Orders.js (C3a) ИЛИ признать ограничение 051 (C3b).
4. Документировать что backfill не reissue в ApiShip/Twenty (C4).
5. Sequence — lazy в hook (C5).
6. Добавить `clientNumber` в `OrderSnapshot` (H4).
7. Согласовать frozen-fields список с lifecycle §13.5 (H3).
8. Добавить `clientNumberHistory[]` для reissue audit (H2).

**Главный риск**: C1 — рассинхрон с реальной AdminChangeLog schema. Без подгонки T011 не пройдёт typecheck.
