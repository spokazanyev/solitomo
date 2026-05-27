# Implementation Plan: Унификация сводки заказа в формах checkout

**Branch**: `061-unified-checkout-summary` | **Date**: 2026-05-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/061-unified-checkout-summary/spec.md`

## Summary

Извлечь правую sticky-колонку из `InvoiceCheckoutForm.tsx` и `PhysicalCheckoutForm.tsx` в общий компонент `OrderSummaryCard.tsx`. Подключить его в обе формы с разными пропсами: юр.форма использует «голый» режим (заголовок, список, итог, согласие, кнопка), физ.форма дополнительно включает блок структуры стоимости «Товары / Доставка / Итого» (FR-006), подсказку для не выбранной доставки (FR-007), и актуальный текст про ЮKassa (FR-015). Логика валидации и form-state остаётся в parent-формах — компонент только применяет `disabled`/`loading`/`error`. Левая колонка обеих форм не трогается. RFQ-форма не затрагивается.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20.x (Next.js 16 runtime)

**Primary Dependencies**: Next.js 16 (App Router, RSC), React 19, Tailwind CSS, `lucide-react` (icons: Receipt, CreditCard, Loader2, ArrowRight), внутренний компонент `@/components/consent/ConsentCheckbox` (от спеки 057), `@/components/rfq/RfqCart` для `RfqCartItem`/`getCartTotal`.

**Storage**: N/A — изменения чисто на UI-слое, ни в одну коллекцию Payload и ни в одну таблицу Postgres не пишем.

**Testing**: Vitest для unit-тестов компонента (`apps/web/src/components/cart/__tests__/OrderSummaryCard.test.tsx` — новый файл). Manual smoke-test на dev-сервере: оба flow (`/cart/checkout/physical/` и `/cart/checkout/invoice/`).

**Target Platform**: Browser (client component — `"use client"`), Linux server (Next.js standalone, Docker).

**Project Type**: Web application (single Next.js монорепозиторий `apps/web/`). UI-рефактор без backend-составляющей.

**Performance Goals**:
- Render правой колонки за <16ms на типичной корзине (3–10 позиций) — лимит одного фрейма.
- Никаких сетевых вызовов внутри компонента (тот же rendering profile что у текущей формы).
- Bundle delta: ≤2 KB gzip (новый компонент + удаление дублирующейся inline-разметки в двух формах).

**Constraints**:
- **Не нарушать FR-5735** из спеки 057: `consent` checkbox должен передаваться родителю и попадать в submit-payload как есть.
- **Не ломать аналитику**: события `pushEvent` (`checkout_cta_pay_clicked`, `payment_intent`, `invoice_requested`, INN-валидация) срабатывают в parent-формах — компонент не должен их перехватывать или менять моменты.
- **Backward-compat для существующих заказов**: API `POST /api/orders` не меняется, никаких новых полей в payload.
- **Mobile-layout**: на ≤640px sidebar становится full-width блоком после левой колонки — текущее поведение сохраняется.
- **Type-safety**: компонент принимает `RfqCartItem[]` (типизированный, тот же что используется в parent-формах через `useRfqCartItems`), нет ослабления типов.

**Scale/Scope**:
- Касается 2 страниц (`/cart/checkout/physical/`, `/cart/checkout/invoice/`).
- 1 новый компонент (~180 строк), 2 изменения в существующих формах (~50 строк удалить, ~10 строк передать props).
- Unit-тесты: ~8–10 test cases на новый компонент.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Specification-First Development — ✅ PASS
Спека `spec.md` написана и прошла quality checklist (16/16) с предварительным `clarify`-этапом (Q1–Q4 решены до начала). Этот план опирается на FR/SC из неё.

### II. SEO And Demand Are Product Requirements — ✅ PASS (N/A)
Фича не затрагивает публичные URL, метаданные, JSON-LD, sitemap, robots, индексацию. Страницы `/cart/checkout/*` помечены `robots: { index: false, follow: false }` — поисковики туда не ходят.

### III. B2B/RFQ First, B2C Checkout Second — ✅ PASS
RFQ-форма `/cart/checkout/quote/` явно исключена из скоупа (assumption в спеке + scope boundary). Юр.форма (B2B) укрепляется как эталон визуала — это поддерживает принцип «B2B/RFQ first».

### IV. Integrations Must Be Isolated And Observable — ✅ PASS (N/A)
Внешние интеграции не задействованы (фича чисто на UI). ЮKassa-интеграция продолжает работать через текущий `/api/payment/yookassa/create` — компонент только триггерит submit формы.

### V. Analytics And Search Control Are Required — ✅ PASS
Аналитические события `pushEvent` остаются в parent-формах и срабатывают в те же моменты. FR-018 явно фиксирует: «события MUST срабатывать в те же моменты что и раньше».

### VI. Code Must Stay Maintainable By Codex — ✅ PASS
- Один общий компонент = один источник истины для визуала. Уменьшает дублирование разметки между Invoice и Physical форм.
- Контракт props типизирован, документирован.
- Никакой «скрытой бизнес-логики в admin-only настройках» — компонент чистый, состояние снаружи (parent-формы).

### VII. Quality Gates Before Release — ✅ PASS
- Unit-тесты на компонент (Vitest).
- Manual smoke на dev-окружении (обе формы, корзина с 1, 8, 50 позициями).
- `pnpm typecheck`, `pnpm lint`, `pnpm test` обязательны.
- Аналитика верифицируется в GA Debug View после деплоя.
- Никаких новых секретов, БД-миграций или вебхуков — quality gates легкие.

### Result: ALL GATES PASS — переход к Phase 0 разрешён.

## Project Structure

### Documentation (this feature)

```text
specs/061-unified-checkout-summary/
├── plan.md                # This file
├── spec.md                # Feature specification (done, 20 FR, 3 user stories)
├── research.md            # Phase 0 output (этой команды)
├── data-model.md          # Phase 1 output — описывает props/UI-сущности
├── quickstart.md          # Phase 1 output — manual smoke procedure
├── contracts/             # Phase 1 output
│   └── order-summary-card-component.md
├── checklists/
│   └── requirements.md    # done (16/16 passed)
└── tasks.md               # Phase 2 output (NOT created by this command)
```

### Source Code (repository root)

Single Next.js monorepo. Real layout:

```text
apps/web/
├── src/
│   ├── components/
│   │   └── cart/
│   │       ├── OrderSummaryCard.tsx              # ← НОВЫЙ компонент (~180 строк)
│   │       ├── InvoiceCheckoutForm.tsx           # ← заменить inline <aside> (~55 строк → 1 вызов)
│   │       ├── PhysicalCheckoutForm.tsx          # ← то же (~60 строк → 1 вызов с showDeliveryLine)
│   │       └── __tests__/
│   │           └── OrderSummaryCard.test.tsx     # ← НОВЫЕ unit-тесты (~150 строк)
│   ├── components/checkout/                       # — не трогаем (DeliveryBlock, AddressForm, DadataSuggestInput, PhoneInput)
│   ├── components/consent/                        # — не трогаем (ConsentCheckbox)
│   └── components/rfq/                            # — не трогаем (useRfqCartItems, getCartTotal, RfqCartItem)
```

**Structure Decision**: используем существующий каталог `apps/web/src/components/cart/` — там уже живут обе checkout-формы. Новый компонент логически принадлежит этому модулю. Никаких новых пакетов или каталогов верхнего уровня не создаём.

## Complexity Tracking

> Constitution Check прошёл без violations. Раздел оставлен пустым — нет компромиссов, требующих обоснования.

## Post-Design Constitution Re-check

*Выполнено после генерации research.md, data-model.md, contracts/, quickstart.md.*

| Принцип | Pre-design | Post-design | Комментарий |
|---|---|---|---|
| I. Spec-First | ✅ | ✅ | Все артефакты на месте (spec, plan, research, data-model, contracts, quickstart, checklist). |
| II. SEO | ✅ N/A | ✅ N/A | Никаких URL/SEO-изменений в дизайне. |
| III. B2B/RFQ first | ✅ | ✅ | Юр.форма становится визуальным эталоном — B2B-flow усиливается. RFQ-форма не трогается. |
| IV. Integrations isolated | ✅ N/A | ✅ N/A | Никаких новых интеграций. Существующие (ЮKassa, ApiShip) не трогаются. |
| V. Analytics | ✅ | ✅ | Контракт компонента фиксирует: события остаются в parent. Тесты проверяют что компонент не вызывает аналитику сам. |
| VI. Maintainable by Codex | ✅ | ✅ | Typed props, unit-тесты, чистый компонент без скрытого state. |
| VII. Quality gates | ✅ | ✅ | quickstart покрывает manual smoke; unit-тесты в contracts/. |

**Post-design verdict**: ALL GATES PASS. Готов к Phase 2 (`/speckit-tasks`).
