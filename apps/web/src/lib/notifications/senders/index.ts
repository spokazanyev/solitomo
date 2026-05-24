import "server-only";

/**
 * Реестр senders для каналов уведомлений.
 *
 * Email-sender выбирается по `notificationsSettings.email.provider`.
 * Messenger-sender по умолчанию не зарегистрирован — спека 050 регистрирует через registerSender.
 *
 * Дизайн: спека 050 будет вызывать `registerSender("messenger", telegramSender)` из своего onInit,
 * и тогда scheduler автоматически начнёт его использовать.
 */

import type { EmailProvider, NotificationsSettings } from "../settings";
import type { AnySender, EmailSender, MessengerSender } from "../types";
import { createMailgunSender } from "./email/mailgun";
import { createPostmarkSender } from "./email/postmark";
import { createSendpulseSender } from "./email/sendpulse";
import { createUnisenderGoSender } from "./email/unisender-go";
import { messengerPlaceholderSender } from "./messenger";

const UNISENDER_GO_DEFAULT_BASE_URL = "https://go1.unisender.ru/ru/transactional/api/v1";

const registry: Record<string, AnySender> = {};

export function registerSender(channel: string, sender: AnySender): void {
  registry[channel] = sender;
}

export function getSender(channel: string): AnySender | null {
  return registry[channel] ?? null;
}

export function unregisterSender(channel: string): void {
  delete registry[channel];
}

/** Создаёт email-sender в соответствии с настройками. */
export function buildEmailSender(settings: NotificationsSettings): EmailSender | null {
  const apiKey = settings.email.apiKey;
  if (!apiKey) return null;
  const provider = settings.email.provider as EmailProvider;
  if (provider === "postmark") return createPostmarkSender(apiKey);
  if (provider === "mailgun") {
    if (!settings.email.domain) return null;
    return createMailgunSender(apiKey, settings.email.domain);
  }
  if (provider === "sendpulse") return createSendpulseSender(apiKey);
  if (provider === "unisender_go") {
    const baseUrl = process.env.UNISENDER_GO_BASE_URL ?? UNISENDER_GO_DEFAULT_BASE_URL;
    return createUnisenderGoSender(apiKey, baseUrl);
  }
  return null;
}

/** Возвращает messenger-sender, если зарегистрирован (050). Иначе — placeholder. */
export function resolveMessengerSender(): MessengerSender {
  const found = registry["messenger"];
  if (found && found.channel === "messenger") return found;
  return messengerPlaceholderSender;
}
