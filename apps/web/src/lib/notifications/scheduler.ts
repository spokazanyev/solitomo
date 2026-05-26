import "server-only";

import { getPayload } from "payload";
import configPromise from "@payload-config";

import { logError, logInfo, logWarn, maskRecipient } from "./logger";
import { buildEmailSender, resolveMessengerSender } from "./senders";
import { loadNotificationsSettings, type NotificationsSettings } from "./settings";
import { getTemplateRenderer } from "./templates";
import type {
  NotificationChannel,
  NotificationJobPayload,
  NotificationSkipReason,
  NotificationStatus,
  SendResult,
} from "./types";

const BATCH_LIMIT = 50;

export interface SchedulerResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  retried: number;
}

/**
 * Cron-runner: каждые 30 секунд (FR-4932) забирает queued jobs и обрабатывает.
 *
 * - status=queued AND nextAttemptAt<=now() (или null)
 * - помечает in_progress
 * - рендерит шаблон
 * - отправляет через подходящий sender
 * - sent / failed (retry до maxAttempts с экспоненциальным backoff'ом) / skipped
 * - после терминального статуса (sent/failed/skipped) — копирует запись в order.notifications[]
 */
export async function processNotificationQueue(): Promise<SchedulerResult> {
  const settings = await loadNotificationsSettings();
  const p = await getPayload({ config: configPromise });
  const now = new Date().toISOString();

  const result = await p.find({
    collection: "notification-jobs",
    where: {
      and: [
        { status: { equals: "queued" } },
        {
          or: [{ nextAttemptAt: { less_than_equal: now } }, { nextAttemptAt: { exists: false } }],
        },
      ],
    },
    limit: BATCH_LIMIT,
    sort: "scheduledAt",
  });

  const stats: SchedulerResult = { processed: 0, sent: 0, failed: 0, skipped: 0, retried: 0 };

  // Лениво создаём email-sender один раз.
  const emailSender = buildEmailSender(settings);

  for (const doc of result.docs as unknown as Array<Record<string, unknown>>) {
    stats.processed++;
    const id = String(doc.id);
    const channel = String(doc.channel) as NotificationChannel;
    const attempt = Number(doc.attempt ?? 0);
    const template = String(doc.template);
    const recipient = String(doc.recipient);

    try {
      await p.update({
        collection: "notification-jobs",
        id,
        data: { status: "in_progress" },
      });
    } catch (err) {
      logError("scheduler", `cannot mark in_progress id=${id}`, err);
      continue;
    }

    if (!settings.enabled) {
      await terminate(id, "skipped", { skipReason: "disabled" }, doc);
      stats.skipped++;
      continue;
    }
    if (channel === "email" && settings.email.sandbox && !settings.email.apiKey) {
      // нет api key + sandbox => только лог
      await terminate(id, "skipped", { skipReason: "sandbox" }, doc);
      stats.skipped++;
      continue;
    }

    const renderer = getTemplateRenderer(template);
    if (!renderer) {
      await terminate(
        id,
        "failed",
        { errorMessage: `unknown template ${template}`, errorCode: "no_template" },
        doc,
      );
      stats.failed++;
      continue;
    }

    let rendered;
    try {
      rendered = renderer(doc.payload as NotificationJobPayload);
    } catch (err) {
      await terminate(
        id,
        "failed",
        { errorMessage: `render error: ${(err as Error).message}`, errorCode: "render_error" },
        doc,
      );
      stats.failed++;
      continue;
    }

    let res: SendResult;
    if (channel === "email") {
      if (!emailSender) {
        res = {
          status: "skipped",
          skipReason: "no_sender_registered",
          errorMessage: "Email sender unavailable: missing apiKey or provider",
        };
      } else if (settings.email.sandbox) {
        logInfo("scheduler", "sandbox dry-run", {
          template,
          to: maskRecipient(channel, recipient),
          subject: rendered.subject,
        });
        res = { status: "skipped", skipReason: "sandbox" };
      } else {
        res = await emailSender.sendEmail({
          to: recipient,
          from: settings.email.from,
          replyTo: settings.email.replyTo,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          listUnsubscribeUrl: rendered.listUnsubscribeUrl,
        });
      }
    } else if (channel === "messenger") {
      const sender = resolveMessengerSender();
      res = await sender.sendMessage({ recipient, text: rendered.text });
    } else if (channel === "admin_ui" || channel === "dataLayer") {
      // Канал admin_ui / dataLayer — write-only, реальной отправки нет; считаем sent.
      res = { status: "sent" };
    } else {
      res = {
        status: "failed",
        errorMessage: `unsupported channel: ${channel}`,
        errorCode: "no_channel",
      };
    }

    if (res.status === "sent") {
      await terminate(
        id,
        "sent",
        { externalRef: res.externalRef, sentAt: new Date().toISOString() },
        doc,
      );
      stats.sent++;
      logInfo("scheduler", "sent", {
        template,
        channel,
        to: maskRecipient(channel, recipient),
      });
    } else if (res.status === "skipped") {
      await terminate(
        id,
        "skipped",
        {
          skipReason: res.skipReason ?? "duplicate",
          errorMessage: res.errorMessage,
        },
        doc,
      );
      stats.skipped++;
    } else {
      // failed → retry?
      const nextAttempt = attempt + 1;
      const isFinal = nextAttempt >= settings.retry.maxAttempts || res.transient === false;
      if (isFinal) {
        await terminate(
          id,
          "failed",
          {
            errorMessage: res.errorMessage,
            errorCode: res.errorCode,
            attempt: nextAttempt,
          },
          doc,
        );
        stats.failed++;
      } else {
        const delaySec =
          settings.retry.baseDelaySec * Math.pow(2, attempt) * (0.5 + Math.random());
        await p.update({
          collection: "notification-jobs",
          id,
          data: {
            status: "queued",
            attempt: nextAttempt,
            errorMessage: res.errorMessage,
            errorCode: res.errorCode,
            nextAttemptAt: new Date(Date.now() + delaySec * 1000).toISOString(),
          },
        });
        stats.retried++;
        logWarn("scheduler", "retry", {
          template,
          channel,
          attempt: nextAttempt,
          delaySec: Math.round(delaySec),
        });
      }
    }
  }

  return stats;
}

interface TerminateExtras {
  externalRef?: string;
  errorMessage?: string;
  errorCode?: string;
  skipReason?: NotificationSkipReason | string;
  sentAt?: string;
  attempt?: number;
}

/**
 * Финализирует job (sent/failed/skipped) и копирует запись в order.notifications[].
 */
async function terminate(
  id: string,
  status: NotificationStatus,
  extras: TerminateExtras,
  doc: Record<string, unknown>,
): Promise<void> {
  const p = await getPayload({ config: configPromise });
  const update: Record<string, unknown> = {
    status,
    errorMessage: extras.errorMessage ?? null,
    errorCode: extras.errorCode ?? null,
    skipReason: extras.skipReason ?? null,
    externalRef: extras.externalRef ?? null,
    sentAt: extras.sentAt ?? null,
  };
  if (typeof extras.attempt === "number") update.attempt = extras.attempt;
  try {
    await p.update({ collection: "notification-jobs", id, data: update });
  } catch (err) {
    logError("scheduler", "failed to finalize job", err);
    return;
  }

  // Зеркалим в order.notifications[]
  try {
    const orderId = extractOrderId(doc);
    if (!orderId) return;
    const order = (await p.findByID({ collection: "orders", id: orderId })) as unknown as Record<string, unknown>;
    const list = Array.isArray(order.notifications) ? order.notifications : [];
    list.push({
      notificationId: String(doc.notificationId),
      event: String(doc.event),
      channel: String(doc.channel),
      template: String(doc.template),
      recipient: String(doc.recipient),
      scheduledAt: doc.scheduledAt,
      sentAt: extras.sentAt ?? null,
      status,
      errorMessage: extras.errorMessage ?? null,
      externalRef: extras.externalRef ?? null,
      skipReason: extras.skipReason ?? null,
    });
    await p.update({
      collection: "orders",
      id: orderId,
      data: { notifications: list },
    });
  } catch {
    // не блокируем
  }
}

function extractOrderId(doc: Record<string, unknown>): string | null {
  const orderId = doc.orderId;
  if (typeof orderId === "string") return orderId;
  if (typeof orderId === "number") return String(orderId);
  if (orderId && typeof orderId === "object" && "id" in (orderId as unknown as Record<string, unknown>)) {
    return String((orderId as { id: unknown }).id);
  }
  return null;
}

/** Используется в admin/notifications/resend. */
export async function resendNotification(notificationId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const p = await getPayload({ config: configPromise });
    const found = await p.find({
      collection: "notification-jobs",
      where: { notificationId: { equals: notificationId } },
      limit: 1,
    });
    const doc = found.docs[0] as unknown as Record<string, unknown> | undefined;
    if (!doc) return { ok: false, message: "Notification not found" };
    await p.update({
      collection: "notification-jobs",
      id: String(doc.id),
      data: {
        status: "queued",
        attempt: 0,
        nextAttemptAt: new Date().toISOString(),
        errorMessage: null,
        errorCode: null,
        skipReason: null,
      },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

/** Алёрт: queued > settings.retry.stuckQueueThreshold > 30 минут. */
export async function checkStuckQueue(): Promise<{ queued: number; over: boolean }> {
  const settings: NotificationsSettings = await loadNotificationsSettings();
  const p = await getPayload({ config: configPromise });
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  try {
    const res = await p.find({
      collection: "notification-jobs",
      where: {
        and: [
          { status: { equals: "queued" } },
          { scheduledAt: { less_than_equal: thirtyMinAgo } },
        ],
      },
      limit: 0,
      pagination: false,
    });
    const count = (res as { totalDocs?: number }).totalDocs ?? 0;
    return { queued: count, over: count > settings.retry.stuckQueueThreshold };
  } catch {
    return { queued: 0, over: false };
  }
}
