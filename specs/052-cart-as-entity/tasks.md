---
description: "Tasks for 052-cart-as-entity"
---

# Tasks: Cart as a First-Class Entity (052)

**Input**: `specs/052-cart-as-entity/{spec.md,plan.md,data-model.md,contracts/cart-api.openapi.yaml}`

**Prerequisites**: 047 (lifecycle emitter, Orders schema) — DONE. 049 (notification matrix
+ T-010 routing rule) — DONE; нужно лишь зарегистрировать новое событие `cart.abandoned`
в matrix и убедиться, что у 049 есть sender для email.

**Tests**: include where critical (state machine, idempotency, conversion). E2E — отдельно
через Playwright.

**Organization**: tasks сгруппированы по фазам, маркированы `[US1]`-`[US6]` где применимо.

## Format: `[ID] [P?] [Story] Description`

- `[P]` — может параллелиться (разные файлы, нет dep).
- `[Story]` — связь с user story.

---

## Phase 1: Setup

- [ ] **T001** Создать миграцию Payload `apps/web/src/migrations/YYYYMMDD_carts_collection.ts`:
  таблица `carts`, индексы, FK `orders.cart_id`. (data-model §8)
- [ ] **T002** Добавить в `apps/web/src/payload.config.ts` import `Carts` collection.
  Сгенерировать типы: `pnpm --filter @soliton/web generate:types`.
- [ ] **T003** [P] Добавить ENV-переменные в `apps/web/.env.example` (data-model §6):
  `CART_TOKEN_COOKIE_NAME`, `CART_TOKEN_COOKIE_MAX_AGE`, `CART_EXPIRY_DAYS`,
  `CART_HARD_DELETE_DAYS`, `CART_CLEANUP_CRON_INTERVAL`.

---

## Phase 2: Foundational (Blocking)

- [ ] **T004** Создать `apps/web/src/collections/Carts.ts` со всеми полями из data-model §1,
  индексами, beforeChange hooks (recalc totals + lastActivityAt + expiresAt),
  afterChange hooks (emit domain events).
- [ ] **T005** [P] Создать `apps/web/src/lib/cart/token.ts`:
  `generateCartToken()` через `crypto.randomUUID() + crypto.getRandomValues(6 bytes) → base64url`;
  `hashCartToken(token)` → sha256 для логов.
- [ ] **T006** [P] Создать `apps/web/src/lib/cart/cookie.ts`:
  `getCartTokenFromCookie(req)`, `setCartTokenCookie(res, token)`, `clearCartTokenCookie(res)`.
  HTTP-only, SameSite=Lax, Secure в production.
- [ ] **T007** [P] Создать `apps/web/src/lib/cart/state-machine.ts`:
  валидация переходов из data-model §3, экспорт `canTransition(from, to): boolean` и
  `assertTransition(from, to)`.
- [ ] **T008** [P] Создать `apps/web/src/lib/cart/merge.ts`:
  портировать `mergeRfqItems` логику из `components/rfq/RfqCart.tsx` (для server-side
  использования, без localStorage-зависимостей).
- [ ] **T009** [P] Создать `apps/web/src/lib/cart/totals.ts`:
  `computeTotals(items): {itemCount, subtotal, knownPriceCount, unknownPriceCount}`.
- [ ] **T010** Создать `apps/web/src/lib/cart/repository.ts`:
  тонкая обёртка над Payload local API — `findByToken`, `create`, `update`, `softDelete`,
  `hardDelete`, `markAbandoned`, `markConverted`, `markExpired`. Каждая функция возвращает
  типизированный Cart.
- [ ] **T011** Расширить `apps/web/src/lib/lifecycle/emitter.ts`: добавить типы событий
  `cart.created | cart.updated | cart.identified | cart.abandoned | cart.converted |
  cart.expired | cart.merged | cart.hard_deleted` в union; экспортировать helper'ы emit'а.
- [ ] **T012** Расширить `apps/web/src/collections/Orders.js`: добавить поле
  `cartId` (relationship → carts, optional, index).

**Checkpoint**: foundation готова — можно начинать US1.

---

## Phase 3: User Story 1 — Cart in DB & cross-device (Priority: P1) 🎯 MVP

**Goal**: Cart живёт в БД, токен в HTTP-only cookie, restore link работает.

### Implementation US1

- [ ] **T013** [US1] Создать `apps/web/src/app/api/cart/route.ts`:
  `POST /api/cart` — создание новой корзины (если cookie нет / token invalid).
  Возвращает `{cart, token}`, ставит cookie. Поддержка `Idempotency-Key`.
- [ ] **T014** [US1] Создать `apps/web/src/app/api/cart/[token]/route.ts`:
  - `GET` — чтение по токену, 404 если нет, 410 если expired/merged.
    Auto-update `lastActivityAt` если query param `?activity=true`.
  - `PATCH` — изменение items / customerEmail. Body schema из cart-api.openapi.yaml.
  - `DELETE` — clear cart (items=[]) или hard-delete при `?hard=true` (GDPR, требует auth).
- [ ] **T015** [US1] Создать `apps/web/src/app/api/cart/[token]/items/route.ts`:
  `POST` — добавить item (через merge); `DELETE /[sku]` — удалить item by sku.
- [ ] **T016** [US1] Создать `apps/web/src/components/cart/CartProvider.tsx`:
  React Context + `useCart()` hook. На mount: 1) читает legacy localStorage если есть,
  2) если cookie нет — `POST /api/cart` с seed-items; 3) если cookie есть — `GET /api/cart/{token}`.
  Server-side state = source of truth, localStorage = optimistic cache (новый ключ
  `soliton-cart-state`).
- [ ] **T017** [US1] Создать `apps/web/src/components/cart/CartClient.tsx`:
  client component wrapper. Должен быть feature-flag-aware: если
  `NEXT_PUBLIC_CART_PERSISTENCE === 'db'` — используется новый flow, иначе fallback
  на `RfqCart.tsx`.
- [ ] **T018** [US1] [P] Создать `apps/web/src/components/cart/AddToCartButton.tsx`:
  новая кнопка, использует `useCart()` из `CartProvider`. Та же UI/UX, что `AddToRfqButton`.
- [ ] **T019** [US1] Создать `apps/web/src/app/cart/restore/[token]/page.tsx`:
  Server component — валидирует токен, ставит cookie, redirect на `/cart/`. Если expired —
  показывает экран «Корзина устарела» с кнопкой «Начать заново».
- [ ] **T020** [US1] [TEST] Vitest unit для `lib/cart/{merge,totals,state-machine,token}.ts`
  в `apps/web/src/lib/cart/__tests__/`.
- [ ] **T021** [US1] [TEST] Integration test для `POST /api/cart` + `GET /api/cart/{token}`:
  cookie ставится, повторный GET возвращает тот же cart, lastActivityAt обновляется.

**Checkpoint US1**: можно положить товар в корзину, закрыть вкладку, открыть с другого
браузера через restore-link и увидеть тот же state.

---

## Phase 4: User Story 2 — TTL 30d & expiry cron (Priority: P1)

### Implementation US2

- [ ] **T022** [US2] Создать `apps/web/src/app/api/cron/carts-cleanup/route.ts`:
  защищён `CRON_SECRET`. Логика:
  1. Найти `(status=active|abandoned) AND lastActivityAt < now() - 30d` → перевести в `expired`,
     emit `cart.expired`.
  2. Найти `status=expired AND lastActivityAt < now() - 90d` → hard delete, emit `cart.hard_deleted`.
  3. Найти `status=active AND lastActivityAt < now() - 60min` → перевести в `abandoned`,
     emit `cart.abandoned` (US5 logic).
  Возвращает summary `{abandoned: N, expired: N, deleted: N}`.
- [ ] **T023** [US2] [P] Добавить `carts-cleanup` в Vercel cron config (`vercel.json`) с
  интервалом `0 * * * *` (каждый час).
- [ ] **T024** [US2] Обновить `app/cart/restore/[token]/page.tsx` (из T019): добавить UI
  «Корзина устарела» с CTA «Начать заново» + товарный оффер.
- [ ] **T025** [US2] [TEST] Integration test для cron `carts-cleanup`:
  factory-cart с `lastActivityAt = now()-31d` → cron → status=expired.

**Checkpoint US2**: cart живёт 30 дней, потом expired; через 90d физически удаляется.

---

## Phase 5: User Story 3 — Cart → Order conversion (Priority: P1)

### Implementation US3

- [ ] **T026** [US3] Модифицировать существующий checkout API в `apps/web/src/app/api/checkout/`
  (см. 047 routes): добавить чтение `cartToken` из cookie/body. При создании Order:
  1. Найти Cart по token (через `repository.findByToken`).
  2. Записать `Order.cartId = cart.id`.
  3. Перевести cart в `status=converted`, `convertedToOrderId`, `convertedAt`.
  4. Emit `cart.converted`.
  5. Если cart уже converted → 409 CART_ALREADY_CONVERTED с `orderId`.
- [ ] **T027** [US3] Если checkout запускается БЕЗ cartToken (legacy direct flow):
  создать synthetic Cart c `status=converted` сразу — для funnel-consistency (FR-5223).
- [ ] **T028** [US3] [TEST] Integration test «full checkout»: POST /api/cart → PATCH (add item) →
  POST /api/checkout/... → проверка `Order.cartId`, `Cart.status=converted`,
  `Cart.convertedToOrderId`.

**Checkpoint US3**: funnel `created → active → converted` отслеживается; SQL-репорт работает.

---

## Phase 6: User Story 4 — Admin UI for active carts (Priority: P2)

### Implementation US4

- [ ] **T029** [US4] Настроить admin column'ы в `Carts.ts` (`defaultColumns`, `useAsTitle`,
  filters): `status=abandoned`, `customerEmail!=null` — самые востребованные фильтры.
- [ ] **T030** [US4] Добавить admin custom view-component
  `apps/web/src/components/admin/carts/CartActions.tsx`:
  кнопки «Скопировать restore URL», «Открыть страницу клиента», «Hard-delete (GDPR)».
- [ ] **T031** [US4] Подключить view-component в `Carts.ts` через
  `admin.components.edit.SaveButton` или sidebar custom field.

**Checkpoint US4**: менеджер в Payload Admin видит активные корзины и может делать outreach.

---

## Phase 7: User Story 5 — Cart abandonment → T-010 (Priority: P2)

### Implementation US5

- [ ] **T032** [US5] Расширить 049 notification matrix
  (`apps/web/src/lib/notifications/matrix.ts`): добавить правило
  `event=cart.abandoned → channel=email → template=T-010 → recipient=customer`,
  с requires `customerEmail set` + `marketingOptIn`.
  Обновить `specs/049-customer-notifications/contracts/notification-events.md` с правилом
  `cart.abandoned → T-010` + bump 049 spec version.
- [ ] **T033** [US5] Создать шаблон `apps/web/src/lib/notifications/templates/T-010-cart-abandoned.tsx`
  (react-email): «Вы оставили товары в корзине» + список items + кнопка
  «Восстановить корзину» → `/cart/restore/{token}/`.
- [ ] **T034** [US5] Подключить cart afterChange-hook (или cron handler) к 049's
  notification emitter: на переход в `abandoned` создать `notification-jobs` запись
  через 049 emitter API.
- [ ] **T035** [US5] [TEST] Integration test: cart с email → ждать 65 min (или mock
  `lastActivityAt`) → cron → `notification-jobs` создан → 049 scheduler отправляет T-010
  (или скипает, если sandbox=true).

**Checkpoint US5**: cart abandonment запускает T-010 (за feature-flag в global).

---

## Phase 8: User Story 6 — Anonymous merge stub (Priority: P3)

### Implementation US6

- [ ] **T036** [US6] Создать `apps/web/src/app/api/cart/merge/route.ts`:
  POST — возвращает `501 NotImplemented` с body `{error: "merge_pending_054"}`. Endpoint
  существует как контракт для будущего 054.
- [ ] **T037** [US6] Документировать в `apps/web/src/lib/cart/repository.ts` placeholder
  функцию `mergeCarts(sourceId, targetId)` — throw "not implemented in 052, см. 054".

**Checkpoint US6**: контракт зафиксирован, реальная реализация — в 054.

---

## Phase 9: Polish & Cross-Cutting

- [ ] **T038** [P] Документация: добавить раздел «Carts» в `AGENTS.md` (apps/web/) с картой
  файлов (по аналогии с 047/048/049 секциями).
- [ ] **T039** [P] Обновить `07-build-specifications/order-lifecycle-spec.md` Phase 2 «Cart»:
  заменить «localStorage» на «Payload `carts` (см. 052)».
- [ ] **T040** Логи: проверить, что во всех новых API routes / cron handlers PII маскируется
  (email → `***@domain`, cartToken → `sha256(token).slice(0,12)`).
- [ ] **T041** Rate-limit: для `GET /api/cart/{token}` — 10 req/min/IP (anti-guess).
  Использовать существующий middleware (если есть) или простой in-memory counter.
- [ ] **T042** Запустить `pnpm typecheck` и `pnpm lint`. Исправить замечания.
- [ ] **T043** [P] Snapshot test для T-010 шаблона (если 049 имеет такую инфра, см. их tasks).

---

## Phase 10: Review Fixes (from REVIEW_NOTES.md)

- [ ] **T044** [US1] Add `op=touch` to `PATCH /api/cart/{token}` for activity extension
  during checkout navigation and finalize-shipping. (FR-5226a)
- [ ] **T045** [US1] Implement `If-Match` header validation on `PATCH op=setItems`:
  при mismatch — 409 `cart_stale`. Коммутативные операции (`mergeItems`, `setQuantity`,
  `removeItem`) — If-Match не обязателен. (FR-5214a)
- [ ] **T046** [US5] Add `marketingOptIn` checkbox field to Cart collection and checkout
  Identify step (S04). Default false, sources: checkout checkbox OR consent-banner
  on `/cart/restore/[token]/`. (FR-5224a)
- [ ] **T047** [P] Add `companyId` forward-ref field (relationship → companies, nullable)
  to Carts collection. (FR-5404 forward-ref для 054)
- [ ] **T048** [US1] Price revalidation in afterRead hook (cached 60s): если
  `|currentPrice - priceAtAdd| / priceAtAdd > 0.05` OR `abs > 100₽` →
  `items[i].warning = 'price_changed'`. На finalize-shipping — повторная проверка
  с PriceMismatchModal. (FR-5232)
- [ ] **T049** Rate-limit `POST /api/cart`: 5/min, 30/day per IP (без cookie).
  Расширить T041. (FR-5212a)

---

## Dependencies & Execution Order

### Phase dependencies

- Setup (T001-T003) → Foundational (T004-T012) → US1 (T013-T021) → US2 (T022-T025) →
  US3 (T026-T028) — все P1, обязательные для MVP.
- US4 (T029-T031), US5 (T032-T035), US6 (T036-T037) — P2/P3, могут идти параллельно после US1.
- Polish (T038-T043) — последний.

### Critical path для MVP

T001 → T002 → T004 → T010 → T013 → T014 → T016 → T026 → T028 → ship.

### Parallel opportunities

- Phase 2 (Foundational): T005, T006, T007, T008, T009 — все `[P]`, разные файлы.
- US1: T018 параллельно с остальными в US1 (другой файл).
- Polish: T038, T039, T043 — все `[P]`.

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Setup + Foundational (T001-T012).
2. US1 (T013-T021) → закрытая cookie-based cart в БД + restore.
3. US2 (T022-T025) → expiry + cron.
4. US3 (T026-T028) → cart → order link.
5. STOP & VALIDATE: можно положить в корзину, закрыть, восстановить, оформить заказ,
   увидеть `Order.cartId` в Payload Admin.
6. Deploy за feature flag `NEXT_PUBLIC_CART_PERSISTENCE=db` (50% traffic), мониторить.

### Then incremental

7. US5 (cart-abandonment T-010) — даёт измеримое улучшение конверсии.
8. US4 (admin UI) — для менеджеров.
9. US6 (merge stub) — голый контракт, реальная импл в 054.
10. Polish.

---

## Notes

- `RfqCart.tsx` НЕ ТРОГАТЬ. Новый `CartClient.tsx` живёт рядом.
- Все cron-эндпоинты защищены `CRON_SECRET` (как в 047/048/049).
- Логи маскируют PII (email и cartToken).
- При переключении feature flag в production — пройти UAT по checklist'у из quickstart.md (TBD).
- 049 matrix UPDATE для `cart.abandoned` — minimal change, одна строка в `matrix.ts`.
