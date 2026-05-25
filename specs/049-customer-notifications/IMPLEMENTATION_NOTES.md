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
- **Email bounce-handling**: спека требует пометить `customer.emailValid=false` после 3 hard bounce. ~~Это требует webhook от Postmark/Mailgun (`POST /api/webhooks/email-bounce/route.ts`) — **не реализовано**, нужен Q к владельцу о провайдере.~~ **Провайдер выбран (Unisender Go, 2026-05-24).** Webhook у Unisender называется «Webhook для статистики», настраивается в кабинете → даёт события `delivered / hard_bounce / soft_bounce / complained / unsubscribed`. Endpoint всё ещё не реализован — задача в `07-build-specifications/deferred-content-track.md` § п. 25, шаг 6.
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

- `EMAIL_PROVIDER` — `postmark` | `mailgun` | `sendpulse` | `unisender_go` (fallback если в global не задано). С 2026-05-24 в `.env.local` стоит `unisender_go`.
- `EMAIL_API_KEY` — fallback. Для Unisender Go это API-ключ из кабинета.
- `EMAIL_FROM` — fallback. На 2026-05-24 = `PDU Market <orders@pdumarket.ru>` (подтверждённый домен Unisender).
- `EMAIL_REPLY_TO` — fallback.
- `EMAIL_MAILGUN_DOMAIN` — для Mailgun.
- `UNISENDER_GO_BASE_URL` — base URL региона Unisender Go. На EU-аккаунте — `https://go2.unisender.ru/ru/transactional/api/v1`, на RU-аккаунте — `https://go1.unisender.ru/ru/transactional/api/v1`. Если не задан, адаптер использует `go1` по умолчанию.
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

## 2026-05-24: Подключён Unisender Go (EU-регион `go2`)

**Контекст.** В рамках выбора транзакционного email-провайдера (см. ресёрч и сравнение, проведённые в чат-истории «Транзакционная почта для pdumarket.ru») остановились на **Unisender Go** — российский ESP, оплата рублями с ИП, лучшая доставляемость в Mail.ru/Yandex среди доступных, API в стиле Mailgun.

**Аккаунт.** Пользователь зарегистрирован на EU-инстансе (`go2.unisender.ru`). RU-инстанс (`go1.unisender.ru`) не знает user_id этого ключа — проверено через `/template/list.json` (401 на go1, 200 на go2). При создании нового адаптера обязательно указывать корректный регион через `UNISENDER_GO_BASE_URL`.

**Что сделано:**

1. **Новый файл `apps/web/src/lib/notifications/senders/email/unisender-go.ts`** — реализация `EmailSender` под Unisender Go transactional API.
   - `sendEmail(...)` → POST `/email/send.json` с payload `{ message: { recipients[], body{html,plaintext}, subject, from_email, from_name, reply_to, track_links:0, track_read:0 } }`.
   - Header `X-API-KEY: <apiKey>`.
   - Парсер `From` понимает форматы `"Name <email@domain>"` и `"email@domain"`.
   - Маппинг ответа: `{status:"success", emails:[{id}]}` → `SendResult.sent` с `externalRef`; `{status:"error", code, message}` → `SendResult.failed` с кодом, классификация transient: `http >= 500 || http === 429`.
   - `ping()` использует `/template/list.json` (cheapest auth check; протестировано — работает).
2. **`apps/web/src/lib/notifications/settings.ts`** — в union `EmailProvider` добавлен `"unisender_go"`.
3. **`apps/web/src/lib/notifications/senders/index.ts`** — `buildEmailSender` теперь умеет ветку `unisender_go`, читает `process.env.UNISENDER_GO_BASE_URL` (fallback на go1).
4. **`apps/web/.env.local` + `apps/web/.env.example`** — переключено: `EMAIL_PROVIDER=unisender_go`, ключ в `EMAIL_API_KEY` (общая конвенция), `EMAIL_FROM="PDU Market <orders@pdumarket.ru>"`, `EMAIL_REPLY_TO=support@pdumarket.ru`, `UNISENDER_GO_BASE_URL=https://go2.unisender.ru/ru/transactional/api/v1`. **`EMAIL_SANDBOX=true` сохранён** — на free-тарифе реальная отправка на mail.ru/gmail/yandex заблокирована Unisender'ом.
5. **`stub.ts` не трогался** — он 047-stub, который 049 subscriber снимает через `unregisterSubscriber("047-email-stub")`. На проде дублирования не будет.

**Что протестировано:**

- ✅ Auth — `/template/list.json` → 200 OK, аккаунт чист.
- ✅ Регион — `go2` принимает, `go1` отвергает с 401 (зафиксировано в env).
- ✅ Подтверждённый домен — `/domain/list.json` показывает `pdumarket.ru` со статусом `confirmed` и DKIM `active`.
- ✅ Адаптер end-to-end до уровня валидации Unisender — `From: orders@pdumarket.ru` принят; payload корректный.
- ❌ Реальная доставка на gmail/mail.ru — **заблокирована free-tier'ом** (HTTP 403, code 903: «On the 'free_tier' tariff it is allowed to send letters only to the 'checked' domains or 'checked' emails»). Требуется платный тариф.

**TypeScript.** В новых файлах ошибок нет. Pre-existing ошибки в `src/lib/crm/twenty/*` и `src/lib/lifecycle/__tests__/events.test.ts` не относятся к этим изменениям.

**Тест-скрипт.** Лежит в `/tmp/test-unisender-send.mjs` (не в репозитории — одноразовый). Воспроизводит ровно тот же HTTP-запрос, что и адаптер; читает `.env.local` напрямую. Удобен для проверки после смены тарифа / DNS-записей.

**Снятые блокеры:**

- `07-build-specifications/deferred-content-track.md` § п. 15, строка про «SMTP / email-сервис для отправки PDF-счетов и нотификаций» — выбор сделан.
- Тот же файл, § п. 24, пункт owner-actions 3 — «Получить SMTP для уведомлений Twenty» — переиспользуем Unisender.
- Этот файл, раздел «TODO / открытые вопросы», пункт «Email bounce-handling … нужен Q к владельцу о провайдере» — провайдер выбран. Реализация webhook остаётся открытой.

**Что осталось до боевого включения** — см. `07-build-specifications/deferred-content-track.md` § п. 25 «Unisender Go — переход на платный тариф + boevoe тестирование»: смена тарифа, DMARC/SPF верификация, end-to-end тест с прибытием в инбокс, снятие sandbox, прогрев репутации, bounce-webhook.
