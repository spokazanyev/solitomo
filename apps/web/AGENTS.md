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
- `../../specs/055-yookassa-payments-integration/` — Полная интеграция ЮKassa: create-payment + two-stage capture + webhook handler (IP-allowlist + idempotency + amount-match) + receipt 54-ФЗ (`vat_code=12`, НДС 22% по ФЗ-425) + cron expire/reconcile/capture-retry + refund-webhook (закрывает 053). **Status**: backend MVP implemented, 4 commits на ветке 055.
- `../../specs/056-yookassa-frontend-integration/` — Frontend integration поверх 055: `/payment/return/[orderId]` polling page, ReviewClient/RetryPaymentButton/PhysicalCheckoutForm API contract fix, 4 новых email-template (T-015/T-109/T-110/T-111), POST /api/orders customer_session-binding (FR-5609), dataLayer `purchase` + `payment_intent` events. **Status**: `/specify` + `/clarify` + `/plan` + `/tasks` + `/implement` done — MVP shippable.
- `../../specs/057-yookassa-buyer-info-compliance/` — Buyer-info compliance для модерации ЮKassa: новая Payload-коллекция `static-pages` (9 страниц `/info/*`: оплата/доставка/возврат/гарантия/оферта/конфиденциальность/ПДн/соглашение/FAQ) с версионированием юр-документов, embedded group `consent` в Orders/Carts/Customers/RfqRequests (152-ФЗ), `<ConsentCheckbox>` во всех 5 формах, server-side `makeConsentRecord(req)` с sha256-IP-hash + policy-version-cache, `<CookieConsentBanner>` с opt-in аналитикой (заменяет `AnalyticsScripts`), реквизиты + payment-logos + 4 policy-links в footer, dropdown «Покупателям» в header, banking details на `/company/contacts/`. **Status**: `/implement` done (multi-agent mode). Activation gate: seed `pnpm seed:static-pages` + Owner правит тексты в админке + manual `paymentSettings.enabled=true` после модерации ЮKassa.
- `../../specs/062-invoice-shipping-unify/` — Унификация выбора доставки в чекауте юрлица: 3 режима (самовывоз / служба ApiShip / своя ТК покупателя), переиспользование AddressForm + DeliveryBlock от 047, новое поле `Order.delivery.handoverNote` (≤1000 символов, остаётся редактируемым после `paid` — exception из 051), миграция enum `tc → own_carrier`, новое событие `shipping_mode_changed`, расширенный PDF-счёт с блоком «Примечания» для pickup/own_carrier. **Status**: implemented (Phase 1-7 done), manual PDF visual smoke за владельцем перед merge.
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
- `src/lib/consent/` — 057: ConsentRecord type, `consentField()` (Payload group), `makeConsentRecord(req)` (server-side helper для API endpoints), policy-version cache.
- `src/lib/static-pages/` — 057: `getStaticPage(slug)` + cache invalidation, для `/info/*` страниц.
- `src/lib/analytics/` — 057+058: `cookie-consent` + `analytics-loader` (canonical Yandex snippet с `ecommerce: "dataLayer"` для FR-110-115); `events.ts` (35+ typed event-helpers); `data-layer.ts` (ecommerce dual-push); `pii-filter.ts` (FR-062 scrubPII); `attribution.ts` (UTM/yclid + referrer classification); `env-marker.ts`; `visit-context.ts`; `server-tracker.ts` (FR-040); `offline-conversions.ts` (FR-033/034); `agent/` (Phase 12 — Metrika Management API client, safety, audit).
- `src/middleware.ts` — 058: env-marker header + first-party attribution cookies + first_seen cookie capture.
- `apps/web/config/metrika.config.ts` — 058: source-of-truth для Metrika config (apply через `pnpm metrika:apply-config`).
- `apps/web/scripts/metrika-{apply,validate,export}-config.ts` — 058 CLI scripts.
- `apps/web/scripts/seed-analytics-settings.mjs` — 058: `pnpm seed:analytics-settings`.
- `src/collections/{AgentProposals,AgentExecutionLog,Annotations}.ts` — 058 коллекции.
- `src/globals/AnalyticsSettings.ts` — 058: runtime-config.
- `src/components/phone/TrackedPhone.tsx` + `TrackedEmail.tsx` — 058: call-tracking ready обёртки.
- `src/components/product/ProductDetailAnalytics.tsx` — 058 T028: view_item + ecommerce.detail wrapper.
- `src/components/analytics/AnalyticsContextProvider.tsx` — 058 T020.
- `src/components/consent/` — 057: `ConsentCheckbox` (общий для 5 форм), `CookieConsentBanner` (opt-in аналитика).
- `src/components/static-pages/` — 057: `StaticPageRenderer` + `BuyerInfoNav` + `LexicalRenderer` для `/info/*`.
- `src/components/company/BankingDetails.tsx` — 057: банковские реквизиты + директор для `/company/contacts/`.
- `src/collections/StaticPages.ts` — 057: Payload v3 collection с versioning + policy-validation hooks.
- `scripts/seed-static-pages.mjs` — 057: idempotent seed 9 страниц из `specs/057-.../contracts/content-templates/*.md`. Запуск: `pnpm seed:static-pages`.
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
