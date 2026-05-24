# 049 Customer Notifications — Implementation Notes

**Дата**: 2026-05-23
**Статус**: первая итерация полной реализации (US1 + US3 + US4 + US5 + US6 базовая).
**SMS**: не реализуется (решение владельца). Messenger — placeholder для 050.

## Созданные файлы

### Payload-сущности

- `apps/web/src/globals/NotificationsSettings.ts` — Payload Global со всеми полями из data-model §1: enabled, email (provider/apiKey/domain/from/replyTo/sandbox), messenger (placeholder), managers[], marketing, retry, connectionStatus.
- `apps/web/src/collections/NotificationJobs.ts` — Collection `notification-jobs` со статусами queued/in_progress/sent/failed/skipped, поля dedupKey, payload, externalRef, skipReason, attempt, nextAttemptAt. Каналы: email/messenger/admin_ui/dataLayer (без SMS).

### Расширение Orders

- `apps/web/src/collections/Orders.js`:
  - добавлено поле `customer.emailValid` (checkbox, default true);
  - добавлены top-level: `marketingOptIn`, `messengerOptIn`;
  - добавлен массив `notifications[]` — зеркало `notification-jobs` для UI.
  - `smsOptIn` не добавлялось — соблюдено требование.

### Lib

- `apps/web/src/lib/notifications/types.ts` — все TS-типы (NotificationChannel без `sms`, EmailSender, MessengerSender, SendResult).
- `apps/web/src/lib/notifications/matrix.ts` — матрица правил (customer email × 8 событий, messenger × 4 placeholder, manager × 5).
- `apps/web/src/lib/notifications/dedup.ts` — `dedupKey()` + `findExistingByDedupKey()` (FR-4922).
- `apps/web/src/lib/notifications/logger.ts` — `maskEmail`, `maskPhone`, `logInfo/Warn/Error` (FR-4906).
- `apps/web/src/lib/notifications/settings.ts` — `loadNotificationsSettings()` с TTL-кэшем + `managersForEvent`.
- `apps/web/src/lib/notifications/emitter.ts` — создаёт jobs по матрице с dedup, проверка opt-in/emailValid.
- `apps/web/src/lib/notifications/scheduler.ts` — `processNotificationQueue()` для cron-runner'а + `resendNotification()` + `checkStuckQueue()`. Полный retry с экспоненциальным backoff (FR-4905). Зеркалит результат в order.notifications[].
- `apps/web/src/lib/notifications/subscriber.ts` — `registerNotificationsSubscriber()` (вызывается из registerCoreSubscribers в events.ts уже сейчас). Автоматически снимает `047-email-stub`.

### Senders

- `apps/web/src/lib/notifications/senders/index.ts` — registry + buildEmailSender + resolveMessengerSender.
- `apps/web/src/lib/notifications/senders/email/postmark.ts` — реальный Postmark API через fetch.
- `apps/web/src/lib/notifications/senders/email/mailgun.ts` — реальный Mailgun API через fetch.
- `apps/web/src/lib/notifications/senders/email/sendpulse.ts` — stub-заглушка (полная реализация требует OAuth-flow, TODO ниже).
- `apps/web/src/lib/notifications/senders/messenger/index.ts` — `messengerPlaceholderSender`: возвращает `status=skipped, reason=no_sender_registered` (контракт для спеки 050).

### Templates

- `apps/web/src/lib/notifications/templates/helpers.ts` — общие утилиты + HTML-shell.
- `apps/web/src/lib/notifications/templates/index.ts` — registry: getTemplateRenderer.
- **Полные HTML-шаблоны** (subject + text + html): T-001 (paid), T-003 (shipped), T-005 (delivered), T-008 (completed/маркетинг, со ссылкой отписки).
- **Упрощённые text-only**: T-002 (invoice), T-004 (at point), T-006 (courier today), T-007 (pickup reminder), T-009 (cancelled), T-101..T-105 (manager).
- **Messenger M-001/M-003/M-004/M-005** — text-only, через `m-messenger.ts` (рендерятся, но скип через no_sender_registered).

### Cron

- `apps/web/src/app/api/cron/notifications/route.ts` — каждые ~30 с (FR-4932).
- `apps/web/src/app/api/cron/pickup-reminder/route.ts` — каждый час, окно 22-26 ч (FR-4930). Эмитит напрямую в очередь (cron-only событие `shipment.pickup_reminder_24h`).
- `apps/web/src/app/api/cron/stuck-alerts/route.ts` — каждые 6 ч, использует `apiShipSettings.lifecycle.stuckThresholdHours` (FR-4931).

### Admin

- `apps/web/src/app/api/admin/notifications/ping/route.ts` — connection check + сохраняет в connectionStatus.
- `apps/web/src/app/api/admin/notifications/resend/route.ts` — POST { notificationId } для ручной пересылки (FR-4942).

### Preferences (US6)

- `apps/web/src/app/(site)/preferences/[token]/page.tsx` — публичная страница.
- `apps/web/src/app/api/preferences/[token]/route.ts` — GET/PATCH endpoint.
- `apps/web/src/components/notifications/PreferencesForm.tsx` — клиентская форма.

## Зависимости от других спек

- **047**: Используется `emitDomainEvent` + `DomainEventPayload`. 049 subscriber снимает `047-email-stub` через `unregisterSubscriber` при регистрации (избегаем дублирования транзакционных писем).
- **048**: matrix.ts из 047/049 содержит CRM-правила, но они в 048-subscriber'е (`crm-sync-jobs`), а не в notification-jobs — правил channel=`crm` в нашем matrix нет (по проекту 049 — это разные подписчики).
- **050**: messenger-канал зарезервирован. Спека 050 должна вызвать `registerSender("messenger", telegramSender)` из своего onInit. После этого scheduler начнёт использовать его без правок 049.

## payload.config.ts

**НЕ модифицировано** этим агентом (по инструкции). Следующий шаг:

1. Импортировать `NotificationsSettings` из `./globals/NotificationsSettings` и добавить в `globals: []`.
2. Импортировать `NotificationJobs` из `./collections/NotificationJobs` и добавить в `collections: []`.
3. В `onInit()` уже подключен `registerCoreSubscribers()` (из `lib/lifecycle/events.ts`), который автоматически зарегистрирует `049-notifications` subscriber.
4. Запустить `pnpm --filter @soliton/web generate:types` для обновления `payload-types.ts`.

## TODO / открытые вопросы

- **SendPulse-sender**: реализовать OAuth-flow + token-cache. Сейчас возвращает `failed: not implemented`.
- **Email bounce-handling**: спека требует пометить `customer.emailValid=false` после 3 hard bounce. Это требует webhook от Postmark/Mailgun (`POST /api/webhooks/email-bounce/route.ts`) — **не реализовано**, нужен Q к владельцу о провайдере.
- **Аутентификация админ-эндпоинтов**: используется `payload.auth({ headers })`. В Next.js 16 / Payload 3 точная сигнатура может отличаться — следует уточнить при первом запуске.
- **NotificationLogPanel** (T062): UI-панель в карточке заказа Payload Admin для просмотра журнала уведомлений — не реализована, оставлена на следующую итерацию.
- **Маска API key в admin UI** (T013): сейчас apiKey — обычный text. Реальная маскировка через кастомный field component не реализована.
- **Cart abandonment** (`cart.abandoned`): за фича-флагом, по умолчанию выключен; cron не реализован.
- **Тесты**: Vitest snapshot-тесты шаблонов, Playwright e2e с mailtrap — на следующую итерацию.
- **Шаблоны на en**: только ru-локаль (как и предусмотрено MVP).

## Конфигурация cron

В `vercel.json` (или вашем scheduler'е) нужны три задачи:

```json
{
  "crons": [
    { "path": "/api/cron/notifications",    "schedule": "* * * * *" },
    { "path": "/api/cron/pickup-reminder",  "schedule": "0 * * * *" },
    { "path": "/api/cron/stuck-alerts",     "schedule": "0 */6 * * *" }
  ]
}
```

`notifications` запускается раз в минуту (минимум для Vercel free plan); в коде scheduler за один запуск обрабатывает batch размером 50.

## ENV переменные

- `EMAIL_PROVIDER` — `postmark` | `mailgun` | `sendpulse` (fallback если в global не задано).
- `EMAIL_API_KEY` — fallback.
- `EMAIL_FROM` — fallback.
- `EMAIL_REPLY_TO` — fallback.
- `EMAIL_MAILGUN_DOMAIN` — для Mailgun.
- `EMAIL_SANDBOX` — `true` → dry-run.
- `CRON_SECRET` — Bearer-токен для cron-эндпоинтов и admin-операций.
- `SITE_URL` — для генерации ссылок в письмах.
- `PAYLOAD_ADMIN_URL` — опционально, для ссылок в письмах менеджеру.

## Контракт для 050

```ts
import { registerSender } from "@/lib/notifications/senders";
import type { MessengerSender } from "@/lib/notifications/types";

const telegramSender: MessengerSender = {
  channel: "messenger",
  providerName: "telegram",
  async sendMessage({ recipient, text }) {
    /* ... */
    return { status: "sent", externalRef: telegramMessageId };
  },
};

// В onInit() спеки 050:
registerSender("messenger", telegramSender);
```

После этого все queued messenger-jobs автоматически начинают доставляться.
