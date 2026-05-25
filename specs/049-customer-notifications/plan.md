# Implementation Plan: Customer Notifications

**Branch**: `049-customer-notifications` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

## Summary

Реализовать полноценную инфраструктуру уведомлений: email (Postmark/Mailgun) + SMS (SMSC/SMS-aero) + админ-канал. Источник событий — emitter из 047. Очередь `notification-jobs` с retry и idempotency. Шаблоны как код. Opt-in/opt-out. После релиза 049 — снимаем минимальный stub транзакционных email в 047.

## Technical Context

**Language/Version**: TypeScript 5, Node 20.

**Primary Dependencies**:
- Email шаблонизатор: `react-email@^2` (рекомендация; альтернатива — Handlebars / MJML).
- HTTP клиенты провайдеров: `postmark@^4` или `mailgun.js@^10`; SMS — REST через `axios`.
- `zod@^3` для валидации входящих job-payload'ов.

**Storage**: PostgreSQL (через Payload).

**Testing**: Vitest (unit, шаблоны, matrix); Playwright e2e — sandbox-прогон полного цикла с mailtrap.

**Target Platform**: server-side (Node runtime).

**Performance Goals**:
- p95 email-job обработка ≤ 5 с.
- p95 SMS-job обработка ≤ 3 с.
- 0 потерянных событий за 30 дней.

**Constraints**:
- API-ключи только server-side.
- ПДн в логах замаскированы.
- Каждое уведомление идемпотентно.

**Scale/Scope**:
- 1–2 спринта.
- ~16 шаблонов email + ~6 SMS.
- 1 шаблонизатор + 2 sender'а + 3 cron-задачи.

## Project Structure

```text
apps/web/src/
├── globals/NotificationsSettings.ts
├── collections/NotificationJobs.ts
├── app/api/
│   ├── admin/notifications/
│   │   ├── resend/route.ts        # ручная пересылка
│   │   └── ping/route.ts          # connection check
│   └── preferences/[token]/route.ts # opt-out (US6)
├── components/admin/orders/NotificationLogPanel.tsx
├── lib/notifications/
│   ├── matrix.ts            # правила event → channel/template/recipient
│   ├── emitter.ts           # создаёт jobs из событий emitDomainEvent
│   ├── scheduler.ts         # cron-runner для очереди
│   ├── dedup.ts             # ключ + проверка
│   ├── templates/
│   │   ├── T-001-paid.tsx
│   │   ├── T-002-invoice.tsx
│   │   ├── T-003-shipped.tsx
│   │   ├── T-004-at-point.tsx
│   │   ├── T-005-delivered.tsx
│   │   ├── T-006-courier-today.tsx
│   │   ├── T-007-pickup-reminder.tsx
│   │   ├── T-008-nps.tsx
│   │   ├── T-009-cancelled.tsx
│   │   ├── T-101-new-paid-manager.tsx
│   │   ├── T-102-invoice-manager.tsx
│   │   ├── T-103-shipment-error.tsx
│   │   ├── T-104-stuck-order.tsx
│   │   ├── T-105-cancelled-manager.tsx
│   │   ├── sms/T-201-paid.ts
│   │   ├── sms/T-202-shipped.ts
│   │   ├── sms/T-203-at-point.ts
│   │   ├── sms/T-204-courier-today.ts
│   │   ├── sms/T-205-pickup-reminder.ts
│   │   └── sms/T-206-delivered.ts
│   ├── senders/
│   │   ├── email/postmark.ts
│   │   ├── email/mailgun.ts
│   │   ├── email/sendpulse.ts
│   │   ├── sms/smsc.ts
│   │   └── sms/smsaero.ts
│   ├── crons/
│   │   ├── pickup-reminder.ts
│   │   ├── stuck-order-alert.ts
│   │   └── notification-runner.ts
│   └── logger.ts
└── pages/preferences/[token]/page.tsx   # opt-out page (US6)
```

## Phase 0 Research

1. **Шаблонизатор**: React-email vs Handlebars vs MJML. Рекомендация — React-email (нативный TSX, тестируемый, отвечает за HTML+text).
2. **Email-провайдер**: Postmark (премиум, лучшие deliverability) vs Mailgun (российская поддержка) vs SendPulse (РФ-родной).
3. **SMS-провайдер**: SMSC.ru (стабильный, есть отчёты) vs SMS-aero (дешевле). Возможна обвязка двумя для fallback.
4. **Schedule mechanism**: Vercel Cron / Payload jobs / pg-boss / простой cron worker внутри Next.js.

## Phase 1 Outputs

- `data-model.md`
- `contracts/notification-events.md` (уже перенесён)
- `screens.md` (S12-расширенный + страница preferences)
- `quickstart.md` (sandbox setup, mailtrap, тест-номер SMS)
- `tasks.md`

## Risk & Mitigation

| Риск | Митигация |
|---|---|
| Письма попадают в спам | DKIM/SPF/DMARC настроены до запуска; warm-up; постмастер-аналитика. |
| SMS дорогие при высоком трафике | Лимит на opt-in; SMS только на критичные события. |
| Шаблоны ломаются на разных клиентах | Snapshot-тесты через `litmus.com`-аналог; React-email preview в CI. |
| Outage провайдера | Очередь буферизует; алерт владельцу при > 100 jobs queued. |
| ПДн в логах | Линтер + тест на маскировку. |
