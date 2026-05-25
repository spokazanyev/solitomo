/**
 * TypeScript-типы модуля уведомлений (049).
 *
 * SMS-канал отсутствует осознанно (решение от 2026-05-23). Вместо него — messenger
 * (placeholder для спеки 050). См. specs/049-customer-notifications/.
 */

import type { DomainEventKind, DomainEventPayload, OrderSnapshot } from "../lifecycle/events";

export type NotificationChannel = "email" | "messenger" | "admin_ui" | "dataLayer";

export type NotificationRecipientKind = "customer" | "manager" | "twenty" | "admin_ui";

export type NotificationStatus = "queued" | "in_progress" | "sent" | "failed" | "skipped";

export type NotificationSkipReason =
  | "duplicate"
  | "opt_out"
  | "invalid_recipient"
  | "no_sender_registered"
  | "sandbox"
  | "disabled"
  | "already_sent"
  | "missing_data";

export type NotificationRequires = "marketingOptIn" | "emailValid" | "messengerOptIn";

export interface NotificationRule {
  event: DomainEventKind;
  channel: NotificationChannel;
  template: string;
  recipient: NotificationRecipientKind;
  requires?: NotificationRequires;
}

export interface NotificationJobRecord {
  id: string;
  notificationId: string;
  orderId: string;
  event: DomainEventKind;
  channel: NotificationChannel;
  template: string;
  recipient: string;
  scheduledAt: string;
  sentAt?: string;
  status: NotificationStatus;
  attempt: number;
  nextAttemptAt?: string;
  errorMessage?: string;
  errorCode?: string;
  externalRef?: string;
  payload?: NotificationJobPayload;
  skipReason?: NotificationSkipReason;
  dedupKey: string;
}

/** Полезная нагрузка, передаваемая в шаблонизатор. */
export interface NotificationJobPayload {
  order: OrderSnapshot;
  event: {
    kind: DomainEventKind;
    at: string;
    statusFrom?: string;
    statusTo?: string;
    message?: string;
  };
  manager?: { email: string; fullName?: string };
}

export interface RenderedMessage {
  subject: string;
  text: string;
  html?: string;
}

export type SendStatus = "sent" | "failed" | "skipped";

export interface SendResult {
  status: SendStatus;
  externalRef?: string;
  errorMessage?: string;
  errorCode?: string;
  /** Только при status="failed": признак transient-ошибки (5xx, timeout) для retry. */
  transient?: boolean;
  /** Только при status="skipped": причина. */
  skipReason?: NotificationSkipReason;
}

export interface EmailSender {
  readonly channel: "email";
  readonly providerName: string;
  sendEmail(input: {
    to: string;
    from: string;
    replyTo?: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<SendResult>;
  ping(): Promise<SendResult>;
}

export interface MessengerSender {
  readonly channel: "messenger";
  readonly providerName: string;
  sendMessage(input: {
    recipient: string;
    text: string;
  }): Promise<SendResult>;
}

export type AnySender = EmailSender | MessengerSender;

export interface NotificationContext {
  event: DomainEventPayload;
  rule: NotificationRule;
  recipientEmail?: string;
  managerEntry?: { email: string; name?: string; events?: string[] };
}
