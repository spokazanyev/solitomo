---
description: "Task list for 049-customer-notifications"
---

# Tasks: Customer Notifications

## Phase 1: Setup

- [ ] T001 Создать ветку `049-customer-notifications`, каталоги `apps/web/src/lib/notifications/{senders,templates,crons}`.
- [ ] T002 После research добавить deps: `react-email@^2` + `@react-email/components` + email-провайдер (`postmark` или `mailgun.js`). **SMS-зависимости НЕ ставим.**
- [ ] T003 Lint-правило `import "server-only"` для всех `lib/notifications/senders/*`.

## Phase 2: Foundational

- [ ] T010 `apps/web/src/globals/NotificationsSettings.ts` по data-model §1 (email + messenger-placeholder). Подключить.
- [ ] T011 `apps/web/src/collections/NotificationJobs.ts` по data-model §2 (channel: email/messenger/admin_ui/dataLayer). Подключить.
- [ ] T012 Расширить `orders`: `marketingOptIn`, `messengerOptIn`, `customer.emailValid`, `notifications[]`. **`smsOptIn` НЕ добавляется.**
- [ ] T013 Маскированный field-компонент для `email.apiKey`.
- [ ] T014 Реализовать `lib/notifications/matrix.ts` по `contracts/notification-events.md`.
- [ ] T015 Реализовать `lib/notifications/emitter.ts` (создаёт jobs + dedup по 24h-bucket).
- [ ] T016 Реализовать `lib/notifications/scheduler.ts` (cron-runner).
- [ ] T017 Реализовать `lib/notifications/dedup.ts`.
- [ ] T018 Реализовать `lib/notifications/logger.ts` (маска ПДн).

## Phase 3: US1 — Email клиенту

- [ ] T020 [US1] React-email шаблоны `T-001/T-002/T-003/T-004/T-005/T-006/T-007/T-008/T-009`.
- [ ] T021 [US1] Sender для выбранного провайдера (Postmark или Mailgun).
- [ ] T022 [US1] Vitest snapshot-тесты шаблонов (без NaN/undefined, ссылки валидны).
- [ ] T023 [US1] Подключить subscriber к `emitDomainEvent` из 047.
- [ ] T024 [US1] Playwright e2e с mailtrap: 5 писем по статусам тестового заказа.

## Phase 4: US2 — Messenger placeholder (P3)

- [ ] T030 [US2] В `lib/notifications/scheduler.ts` обработка `channel=messenger`: если sender не зарегистрирован → `status=skipped, reason=no_sender_registered`.
- [ ] T031 [US2] Vitest тест: правило с `channel=messenger` не падает, корректно `skipped`.
- [ ] T032 [US2] Опциональный чекбокс `messengerOptIn` в форме S10 чекаута 047 (placeholder, по умолчанию выключен).
- [ ] T033 [US2] Документация в `quickstart.md`: «050 регистрирует Telegram-sender через `register('messenger', telegramSender)` без правок 049».

## Phase 5: US3 — Менеджеру

- [ ] T040 [US3] Шаблоны `T-101..T-105`.
- [ ] T041 [US3] Broadcast по `notificationsSettings.managers[]` с фильтром `events`.
- [ ] T042 [US3] Связь с Twenty (если 048 в работе): ссылка на Opportunity в письме.

## Phase 6: US4 — Cron-задачи

- [ ] T050 [US4] Cron `pickup-reminder.ts` — каждый час.
- [ ] T051 [US4] Cron `stuck-order-alert.ts` — каждые 6 часов.
- [ ] T052 [US4] Cron `notification-runner.ts` — каждые 30 с.
- [ ] T053 [US4] Тесты.

## Phase 7: US5 — Админ

- [ ] T060 [US5] Connection check email-провайдера (Postmark/Mailgun/SendPulse).
- [ ] T061 [US5] Кнопка «Переотправить» в карточке заказа (POST `/api/admin/notifications/resend`).
- [ ] T062 [US5] `NotificationLogPanel` (журнал в карточке заказа).

## Phase 8: US6 — Opt-out (P3)

- [ ] T070 [US6] Страница `/preferences/[token]/`.
- [ ] T071 [US6] Hash-токен для anonymized доступа.
- [ ] T072 [US6] Изменение `Order.marketingOptIn` / `messengerOptIn` + `Person.marketingOptIn` в Twenty (если 048 включена).

## Phase N: Polish

- [ ] T090 [P] Snapshot-тесты email через React-email preview.
- [ ] T091 [P] Линтер на наличие ссылки отписки в маркетинговых шаблонах.
- [ ] T092 [P] Алерт владельцу при queue > 100 jobs >30 мин.
- [ ] T093 [P] CI-тест: API-ключ не попадает в client bundle.
- [ ] T094 [P] Документация `quickstart.md`.
- [ ] T095 Обновить document-register, AGENTS.

## Dependencies

- **Hard**: 047 завершён до точки emit events.
- 048 (Twenty CRM) — независим, но если параллельно, T042 добавляет ссылку в письма.

## MVP

US1 (email клиенту) + US3 (email менеджеру) + минимум cron (US4: scheduler + stuck) = MVP.
US2 (SMS), US5 (UI), US6 (opt-out) — следующие итерации.
