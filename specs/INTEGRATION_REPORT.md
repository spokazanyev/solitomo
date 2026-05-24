# Integration Report — 047 / 048 / 049

**Дата**: 2026-05-23
**Ветка**: `047-delivery-checkout-apiship`
**Скоуп**: интеграция трёх параллельных модулей (ApiShip / Twenty CRM / Customer Notifications) в общую сборку Next.js 16 + Payload v3.

## Status

| Шаг | Результат |
| --- | --- |
| `pnpm install` | OK (после удаления несуществующего `@yandex/ymaps3-types@^0.0.36`) |
| `pnpm --filter @soliton/web generate:types` | OK (новые collections/globals добавлены в payload-types.ts) |
| `pnpm typecheck` | **PASS** (0 ошибок) |
| `pnpm lint` | **PASS** (0 errors, 28 warnings — некритичные, unused vars/disable directives) |
| `pnpm --filter @soliton/web test` | **PASS** (7 файлов, 48 тестов) |
| `pnpm build` | **не запускался** (по инструкции) |

## Что было собрано (payload.config.ts)

Дополнены:

```ts
collections: [
  …,
  ShippingCalculations,
  ShippingLogs,
  CrmSyncJobs,        // ← 048
  NotificationJobs,   // ← 049
],
globals: [
  ApiShipSettings,
  CrmSettings,          // ← 048
  NotificationsSettings // ← 049
],
```

`onInit()` подключает `registerCoreSubscribers()` — он автоматически регистрирует subscribers 047 (lifecycle), 048 (Twenty CRM enqueue) и 049 (Notifications).

## Файлы, созданные / изменённые в этой сессии

| Область | Главные правки |
| --- | --- |
| `apps/web/src/payload.config.ts` | подключение всех collections / globals |
| `apps/web/package.json` | удалён несуществующий `@yandex/ymaps3-types` |
| `apps/web/src/payload-types.ts` | регенерирован |
| AdminChangeLog usage | в `globals/ApiShipSettings.ts`, `globals/NotificationsSettings.ts`, `lib/lifecycle/events.ts` обновлено под реальную схему (`actorType`/`actorName`/`targetCollection`/`targetId`/`targetLabel`/`changeType`/`diffSummary`/`afterSnapshot`), вместо несуществующих `actor`/`action`/`target`/`details`. |
| `Order` cast'ы | `(... as Record<string, unknown>)` → `(... as unknown as Record<string, unknown>)` массово в `lib/lifecycle/closure.ts`, `lib/shipping/admin-ops.ts`, `lib/notifications/{scheduler,emitter,settings}.ts`, `lib/crm/twenty/settings.ts`, `app/api/cron/*`, `app/api/admin/crm/force-sync`, `app/api/preferences/[token]/route.ts`, `app/(site)/preferences/[token]/page.tsx`, `app/api/webhooks/apiship/route.ts`. |
| `apps/web/src/lib/shipping/admin-ops.ts` | partial-type расширен полями `addressNormalized` и `priceSnapshot`; data-объекты updates типизированы. |
| `apps/web/src/app/api/webhooks/apiship/route.ts` | импорт типа `Order`, отдельный `shipmentUpdate` блок, `orderStatusUpdate` приведён к `Order["status"]`. |
| `apps/web/src/lib/shipping/apiship/cache.ts` | id collection `shipping-calculations` приведён к `number`; `data` поля типизированы как `Record<string, unknown>`. |
| `apps/web/src/lib/shipping/apiship/logger.ts` | undefined → null для `request`/`response` JSON-полей. |
| `apps/web/src/lib/crm/twenty/subscriber.ts` | `orderId: String(event.order.id)`, `payload: event as unknown as Record<string, unknown>`. |
| `apps/web/src/app/api/cron/pickup-reminder/route.ts`, `lib/notifications/emitter.ts` | `orderId: Number(snapshot.id)` — поле `relationship` ожидает number. |
| `apps/web/src/app/api/checkout/finalize-shipping/route.ts` | устранён дубликат `countryCode`, заменён `let cacheKey` → `const`. |
| React `set-state-in-effect` | добавлены прицельные `eslint-disable-next-line` для `AddressForm.tsx`, `DeliveryBlock.tsx`, `PointSelector.tsx` (это паттерн «reset on input invalidation», легитимный). |

## Известные предупреждения / точки внимания

1. **28 ESLint warnings** — все некритичные:
   - "Unused eslint-disable directive" — артефакт строгости ESLint 9; можно почистить в отдельном пасе.
   - "_orderId / _reason / _kind defined but never used" в fallback-провайдере — намеренное (контракт интерфейса).
   - `local` в `apiship/logger.ts` (deconstructing) и `pickCheapestTariff` в provider.ts — мёртвый код, можно удалить.
2. **SendPulse email sender** (`lib/notifications/senders/email/sendpulse.ts`) — заглушка, возвращает `failed: not implemented`. Реальный OAuth-flow не реализован.
3. **Email bounce webhook** (FR-049 emailValid) — `/api/webhooks/email-bounce/route.ts` не создан, нужен Q к владельцу о провайдере.
4. **Notification log panel** в Payload Admin (T062, 049) — не реализована.
5. **Cart abandonment** notification — выключен за фича-флагом, cron не создан.
6. **MessengerSender** — placeholder, скипает с `no_sender_registered`. Полная реализация — спека 050.
7. **DaData token** (`DADATA_API_KEY`) и `CRON_SECRET`, `EMAIL_*`, `TWENTY_*` — env-переменные ещё не заполнены, без них cron / suggest / sync работают в degraded-режиме.
8. **Auth admin-эндпоинтов** (`api/admin/notifications/{ping,resend}`, `api/admin/shipping/*`, `api/admin/crm/force-sync`) — использует `payload.auth({ headers })`; контракт в Next.js 16 / Payload 3 может потребовать корректировки при первом реальном запуске.

## Следующие шаги (для разработчика)

1. **Миграции БД**: после первого `pnpm dev` Payload поднимет миграции для новых collections (`shipping-calculations`, `shipping-logs`, `crm-sync-jobs`, `notification-jobs`) и расширения `orders` (`emailValid`, `marketingOptIn`, `messengerOptIn`, `notifications[]`).
2. **Заполнить ENV** (см. `specs/047/quickstart.md`, `specs/049/IMPLEMENTATION_NOTES.md`):
   - `APISHIP_TOKEN`, `APISHIP_BASE_URL`
   - `DADATA_API_KEY`
   - `TWENTY_API_URL`, `TWENTY_API_KEY` (после поднятия self-host)
   - `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_MAILGUN_DOMAIN`
   - `CRON_SECRET`, `SITE_URL`, `PAYLOAD_ADMIN_URL`
3. **Поднять Twenty self-host** (docker-compose), создать API ключ, прогнать `apps/web/scripts/crm-migrate-fields.mjs` для добавления custom fields в Person/Company/Opportunity.
4. **Подключить cron-расписания** (Vercel cron или внешний шедулер):
   ```json
   { "path": "/api/cron/notifications",    "schedule": "* * * * *" },
   { "path": "/api/cron/pickup-reminder",  "schedule": "0 * * * *" },
   { "path": "/api/cron/stuck-alerts",     "schedule": "0 */6 * * *" },
   { "path": "/api/cron/closure",          "schedule": "0 3 * * *" },
   { "path": "/api/cron/crm-sync",         "schedule": "*/2 * * * *" }
   ```
5. **Регенерация типов**: при любых правках schema снова `pnpm --filter @soliton/web generate:types`.
6. **e2e-тесты** (mailtrap для писем, smoke ApiShip): не написаны, в TESTS_NOTES.md как next iteration.
7. **Cleanup ESLint warnings** — отдельный мелкий PR.
