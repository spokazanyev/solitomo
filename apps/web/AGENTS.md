<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Web App Agent Notes

Read `../../agent-project-context.md` before changing Payload collections, public routes, SEO/schema.org logic or RFQ behavior.

Current features (active implementation):

- `../../specs/047-delivery-checkout-apiship/` — модуль доставки с ApiShip + lifecycle + email stub.
- `../../specs/048-twenty-crm-sync/` — синхронизация заказов с Twenty CRM (self-host).
- `../../specs/049-customer-notifications/` — полная инфраструктура уведомлений (email-only, messenger placeholder).
- `../../specs/051-order-numbering-and-immutability/` — SO-YYYY-NNNN нумерация + иммутабельность оплаченных заказов.
- `../../specs/052-cart-as-entity/` — Корзина как сущность БД (Payload `carts`), TTL/abandonment/expiry, конверсия в Order, recovery при отмене до оплаты.
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
- `src/lib/notifications/` — stub email (047) + полная матрица (049).
- `src/lib/crm/twenty/` — GraphQL client + sync + subscriber (048).
- `src/lib/dadata/` — нормализация адресов.
- `src/globals/{ApiShipSettings,CrmSettings,NotificationsSettings}.ts`.
- `src/collections/{ShippingCalculations,ShippingLogs,CrmSyncJobs,NotificationJobs}.ts`.
- Cron-эндпоинты: `src/app/api/cron/{closure,crm-sync,notifications,pickup-reminder,stuck-alerts,carts-cleanup}/route.ts` — защищены `CRON_SECRET`.
- Cart API: `src/app/api/cart/{route,[token]/route,[token]/items/route,[token]/items/[sku]/route,merge/route}.ts` (052).
- Admin-эндпоинты: `src/app/api/admin/orders/[id]/reissue-number/route.ts` (051) — перевыпуск clientNumber.
