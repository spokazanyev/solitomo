<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Web App Agent Notes

Read `../../agent-project-context.md` before changing Payload collections, public routes, SEO/schema.org logic or RFQ behavior.

Current features (active implementation):

- `../../specs/047-delivery-checkout-apiship/` — модуль доставки с ApiShip + lifecycle + email stub.
- `../../specs/048-twenty-crm-sync/` — синхронизация заказов с Twenty CRM (self-host). **MVP-state: `crmSettings.enabled=false`**, сервис автономен. Интеграция Twenty запланирована через 1-2 месяца после запуска. Целевая архитектура — `../../07-build-specifications/crm-integration-pattern.md` (capability matrix).
- `../../specs/049-customer-notifications/` — полная инфраструктура уведомлений (email-only, messenger placeholder).
- `../../specs/051-order-numbering-and-immutability/` — SO-YYYY-NNNN нумерация + иммутабельность оплаченных заказов.
- `../../specs/052-cart-as-entity/` — Корзина как сущность БД (Payload `carts`), TTL/abandonment/expiry, конверсия в Order, recovery при отмене до оплаты.
- `../../specs/053-returns-and-refunds/` — Полноценный жизненный цикл возвратов (Payload `returns`), RT-YYYY-NNNN, ЮKassa Refunds, чек коррекции 54-ФЗ (stub), КСФ для юрлица (stub), полный/частичный возврат, синхронизация Order.{hasReturns,returnsCount,totalRefunded,disputeFlag}.
- `../../specs/054-customer-account/` — Customer / Company сущности, magic-link (opaque 256-bit), customer_session cookie, register/login/forgot-password, /me/orders с role-based privacy filter, GDPR export/delete, marketingOptIn migration на Customer (049 fallback на Order), FR-5420/FR-5421 backfill.
- `../../specs/055-yookassa-payments-integration/` — Полная интеграция ЮKassa: create-payment + two-stage capture + webhook handler (IP-allowlist + idempotency + amount-match) + receipt 54-ФЗ (`vat_code=12`, НДС 22% по ФЗ-425) + cron expire/reconcile/capture-retry + refund-webhook (закрывает 053). **Status**: `/speckit-specify` + `/speckit-clarify` done; `/speckit-plan` complete; `/speckit-tasks` следующий.
- Канонический документ жизненного цикла: `../../07-build-specifications/order-lifecycle-spec.md`.

Useful commands from repo root:

```bash
pnpm agent:context
pnpm --filter @soliton/web generate:types
pnpm typecheck
pnpm lint
pnpm --filter @soliton/web test
```

Краткая карта модулей:

- `src/lib/shipping/` — ApiShip provider + fallback + registry (047).
- `src/lib/lifecycle/` — domain event emitter, status-machine, closure cron, client-number generator (051), immutability guard (051).
- `src/lib/cart/` — Cart token/cookie/state-machine/merge/totals/repository/cron + recovery subscriber (052).
- `src/lib/returns/` — Returns state-machine, number-generator (RT), policies, repository, events, admin-helpers (053).
- `src/lib/customers/` — Magic-link/reset tokens, session loader, repository, CSRF helpers, api-utils (054).
- `src/lib/payments/yookassa-refunds.ts` — ЮKassa Refunds adapter (053).
- `src/lib/documents/credit-memo-number.ts` — Credit-memo number generator (CM-YYYY-NNNN, 053).
- `src/lib/notifications/` — stub email (047) + полная матрица (049).
- `src/lib/crm/twenty/` — GraphQL client + sync + subscriber (048).
- `src/lib/dadata/` — нормализация адресов.
- `src/globals/{ApiShipSettings,CrmSettings,NotificationsSettings}.ts`.
- `src/collections/{ShippingCalculations,ShippingLogs,CrmSyncJobs,NotificationJobs}.ts`.
- Cron-эндпоинты: `src/app/api/cron/{closure,crm-sync,notifications,pickup-reminder,stuck-alerts,carts-cleanup,returns-overdue}/route.ts` — защищены `CRON_SECRET`.
- Cart API: `src/app/api/cart/{route,[token]/route,[token]/items/route,[token]/items/[sku]/route,merge/route}.ts` (052).
- Returns API: `src/app/api/returns/route.ts` (public POST/GET), `src/app/api/admin/returns/{route,[id]/{approve,reject,cancel,received,refund}/route}.ts` (053).
- Customers API: `src/app/api/customers/{register,login,logout,magic-request,magic/[token],forgot-password,reset-password,me/{route,orders,export,delete,merge-cart}}/route.ts` (054).
- Admin-эндпоинты: `src/app/api/admin/orders/[id]/reissue-number/route.ts` (051) — перевыпуск clientNumber.
