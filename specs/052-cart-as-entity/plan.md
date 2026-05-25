# Implementation Plan: Cart as a First-Class Entity

**Branch**: `052-cart-as-entity` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

## Summary

Выделить корзину в самостоятельную Payload-коллекцию `carts` (источник правды), оставить
`localStorage` как client cache. Token хранится в HTTP-only cookie. Реализовать REST API
`/api/cart/*`, cron `carts-cleanup` (abandonment + expiry + GDPR hard-delete), интеграцию
с 047 emitter (`cart.*` события), интеграцию с 049 matrix (T-010 cart abandonment),
расширение `orders` полем `cartId`. Без новых зависимостей — используем Payload, Next.js
API routes, существующий emitter и cron-инфраструктуру.

## Technical Context

**Language/Version**: TypeScript 5, Node 20.

**Primary Dependencies**: НЕТ новых.
- Payload v3 (collection + access control + indexes).
- Next.js 16 App Router (API routes).
- Существующий `crypto.randomUUID()` + `crypto.getRandomValues()` (стандарт Node 20).
- 047 `lib/lifecycle/emitter.ts` для domain events.
- 049 `lib/notifications/*` для отправки T-010 (через matrix).

**Storage**: PostgreSQL через Payload (та же база, что и Orders).

**Testing**:
- Vitest unit: state machine переходов, mergeItems, idempotency.
- Vitest integration: API routes против sqlite-memory или test postgres.
- Playwright e2e: добавил в корзину → закрыл вкладку → восстановил по email-ссылке;
  full checkout с проверкой `Order.cartId`.

**Target Platform**: Server-side (Vercel / Next.js Node runtime). API endpoints — Node, не Edge,
т.к. нужен Payload access.

**Performance Goals**:
- p95 `GET /api/cart/{token}` ≤ 80 ms.
- p95 `PATCH /api/cart/{token}` (add item) ≤ 120 ms (включая запись в БД).
- Cron carts-cleanup ≤ 30 сек на 10k корзин.

**Constraints**:
- `cartToken` — HTTP-only cookie, не доступен из JS.
- Все mutate API идемпотентны через `Idempotency-Key` header (опц.).
- PII в логах маскируется.

**Scale/Scope**:
- 1 спринт.
- 1 новая коллекция, 1 cron, 4 API routes, 1 новый React компонент (`CartClient.tsx`).
- Расширение Orders collection на одно поле.

## Constitution Check

- Без новых external deps — pass.
- Защита cron через `CRON_SECRET` — pass.
- PII не лежит в URL / logs — pass.
- Backward-compatible: `RfqCart.tsx` legacy fallback — pass.

## Project Structure

### Documentation (this feature)

```text
specs/052-cart-as-entity/
├── plan.md                       # этот файл
├── spec.md                       # User Stories + FR-5201..5230
├── data-model.md                 # Carts collection + state machine + indexes
├── tasks.md                      # T001..T020 разбивка
└── contracts/
    └── cart-api.openapi.yaml     # REST контракт /api/cart/*
```

### Source Code (repository)

```text
apps/web/src/
├── collections/
│   ├── Carts.ts                          # NEW — Payload collection
│   └── Orders.js                         # MODIFY — добавить cartId relation
├── app/api/
│   ├── cart/
│   │   ├── route.ts                      # POST /api/cart (create)
│   │   ├── [token]/route.ts              # GET / PATCH / DELETE
│   │   ├── [token]/items/route.ts        # POST add item
│   │   ├── [token]/items/[sku]/route.ts  # DELETE remove item
│   │   └── merge/route.ts                # POST merge (US6 stub, returns 501)
│   ├── cron/
│   │   └── carts-cleanup/route.ts        # NEW cron endpoint
│   └── checkout/
│       └── (existing 047 routes)         # MODIFY: принять cartToken на create-order
├── components/
│   ├── rfq/RfqCart.tsx                   # KEEP UNCHANGED (legacy fallback)
│   └── cart/
│       ├── CartClient.tsx                # NEW — server-sync React context provider
│       ├── CartProvider.tsx              # NEW — useCart hook на базе CartClient
│       ├── AddToCartButton.tsx           # NEW — заменяет AddToRfqButton при feature flag
│       └── CartRestoreScreen.tsx         # NEW — /cart/restore/[token]/ UI
├── app/cart/
│   ├── (existing /cart pages)
│   └── restore/[token]/page.tsx          # NEW — restore page (US1, US2)
├── lib/
│   ├── cart/
│   │   ├── token.ts                      # NEW — generate/validate cartToken
│   │   ├── state-machine.ts              # NEW — статусы и переходы
│   │   ├── merge.ts                      # NEW — mergeItems (порт из RfqCart)
│   │   ├── totals.ts                     # NEW — пересчёт subtotal
│   │   ├── api-client.ts                 # NEW — fetch-обёртки для CartClient.tsx
│   │   ├── cookie.ts                     # NEW — get/set HTTP-only cookie
│   │   └── repository.ts                 # NEW — Payload data access layer
│   └── lifecycle/
│       └── (existing)                    # USE — emitDomainEvent для cart.*
└── globals/
    └── (existing NotificationsSettings)  # ALREADY HAS cartAbandonmentEnabled (049)
```

**Structure Decision**: одно next.js приложение, новая Payload коллекция, новые API routes
под `/api/cart/`, новый компонентный subtree под `components/cart/`, legacy `components/rfq/`
остаётся нетронутой.

## Phase 0 Research

1. **Cookie strategy**: HTTP-only vs JS-accessible.
   - Решение: HTTP-only (XSS protection). UI получает state через API, не из cookie.
2. **cartToken length / entropy**: 128 bit достаточно для anti-guess; используем
   `crypto.randomUUID()` (122 bit RFC4122 v4) + дополнительные 6 байт из `getRandomValues`,
   итого 26 символов base64url.
3. **Idempotency**: `Idempotency-Key` header (опционально); реализуем in-memory cache на
   5 мин с fallback на отсутствие → каждый запрос отдельный.
4. **Cron infrastructure**: уже есть `apps/web/src/app/api/cron/{closure,crm-sync,notifications,pickup-reminder,stuck-alerts}/`,
   подключение через Vercel cron config (или `vercel.json`). Добавляем `carts-cleanup`.
5. **Schema migration**: Payload v3 поддерживает миграции через `pnpm payload migrate`.
   Создаём `migrations/202605xx_carts.ts`.

## Phase 1 Outputs

- `data-model.md` (collection schema, state machine, indexes, ENV).
- `contracts/cart-api.openapi.yaml` (OpenAPI 3.1 для всех 6 endpoints).
- `tasks.md` (15-20 задач, грейдированные по US).
- (optional) `quickstart.md` — позже, перед началом dev.

## Risk & Mitigation

| Риск | Митигация |
|---|---|
| Cookie не сохраняется (SameSite/cross-domain после смены домена на pdumarket.ru) | Тест SameSite=Lax + secure; fallback: token в localStorage если CookieDisabled. |
| Многократный POST /api/cart на flaky network → дубликаты carts | Idempotency-Key + проверка cookie перед созданием новой записи. |
| Раздутие БД при abandoned-корзинах | Cron hard-delete после 90d, индекс на expiresAt, мониторинг count. |
| Race condition при одновременных PATCH с двух устройств | Last-write-wins по `updatedAt`; для критичных конфликтов — `If-Match` etag (опц.). |
| Снижение PageSpeed из-за server fetch на каждом mount | HTTP-кэш на 60 сек для GET; localStorage-cache для optimistic first paint. |
| Утечка PII в Vercel logs | Логировать только cartToken-hash, маска email (`***@domain`). |
| Legacy localStorage cart не мигрирует при feature flag toggle | Boot migration в CartClient.tsx, описание в quickstart. |
