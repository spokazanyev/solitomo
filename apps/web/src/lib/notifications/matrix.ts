/**
 * Матрица уведомлений: какие правила срабатывают на какие доменные события.
 *
 * Источник: specs/049-customer-notifications/contracts/notification-events.md
 * + 07-build-specifications/order-lifecycle-spec.md §3.
 *
 * SMS-правила удалены навсегда (решение от 2026-05-23).
 * Messenger-правила оставлены как архитектурный задел для спеки 050 — в 049
 * соответствующие jobs идут в `skipped, reason=no_sender_registered`.
 */

import type { NotificationRule } from "./types";

export const notificationMatrix: NotificationRule[] = [
  // -------- Customer · Email --------
  { event: "order.paid", channel: "email", template: "T-001", recipient: "customer", requires: "emailValid" },
  { event: "order.invoice_issued", channel: "email", template: "T-002", recipient: "customer", requires: "emailValid" },
  { event: "shipment.created", channel: "email", template: "T-003", recipient: "customer", requires: "emailValid" },
  { event: "shipment.at_point", channel: "email", template: "T-004", recipient: "customer", requires: "emailValid" },
  { event: "shipment.courier_today", channel: "email", template: "T-006", recipient: "customer", requires: "emailValid" },
  { event: "shipment.delivered", channel: "email", template: "T-005", recipient: "customer", requires: "emailValid" },
  { event: "order.completed", channel: "email", template: "T-008", recipient: "customer", requires: "emailValid" },
  { event: "order.cancelled", channel: "email", template: "T-009", recipient: "customer", requires: "emailValid" },
  // Cron-only события (генерируются pickup-reminder и stuck-alerts):
  // обрабатываются через emit прямо в cron-handler'ах, попадают в матрицу так же.
  // Эмулируем shipment.pickup_reminder_24h как доменное событие. Так как DomainEventKind
  // его не содержит, оно эмитится через специальный helper (см. cron/pickup-reminder).
  // Здесь же используем шаблон T-007 при event=shipment.at_point с признаком reminder=true
  // — обходной путь: cron-эмиттер использует kind "shipment.at_point" + meta.reminder24h=true,
  // а matcher в emitter.ts отдельно решает T-007.

  // -------- Customer · Messenger (placeholder для 050) --------
  { event: "order.paid", channel: "messenger", template: "M-001", recipient: "customer", requires: "messengerOptIn" },
  { event: "shipment.created", channel: "messenger", template: "M-003", recipient: "customer", requires: "messengerOptIn" },
  { event: "shipment.at_point", channel: "messenger", template: "M-004", recipient: "customer", requires: "messengerOptIn" },
  { event: "shipment.delivered", channel: "messenger", template: "M-005", recipient: "customer", requires: "messengerOptIn" },

  // -------- Manager · Email --------
  { event: "order.paid", channel: "email", template: "T-101", recipient: "manager" },
  { event: "order.invoice_issued", channel: "email", template: "T-102", recipient: "manager" },
  { event: "shipment.error", channel: "email", template: "T-103", recipient: "manager" },
  { event: "order.stuck", channel: "email", template: "T-104", recipient: "manager" },
  { event: "order.cancelled", channel: "email", template: "T-105", recipient: "manager" },
];

/** Правило для cron-only события pickup-reminder-24h (см. cron/pickup-reminder/route.ts). */
export const pickupReminderRule: NotificationRule = {
  // event помечается как shipment.at_point с meta.reminder24h=true в payload.
  event: "shipment.at_point",
  channel: "email",
  template: "T-007",
  recipient: "customer",
  requires: "emailValid",
};

/** Маркетинговые шаблоны — содержат ссылку отписки (FR-4951). */
export const marketingTemplates: ReadonlySet<string> = new Set(["T-008"]);
