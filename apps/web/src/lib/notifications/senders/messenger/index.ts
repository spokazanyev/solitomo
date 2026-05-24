import "server-only";

import type { MessengerSender, SendResult } from "../../types";

/**
 * Messenger-sender placeholder для 049.
 *
 * В MVP 049 реального sender'а нет (решение: SMS не реализуется, мессенджеры — спека 050).
 * Этот объект возвращает `skipped, reason=no_sender_registered` — чтобы scheduler не падал
 * и можно было увидеть в журнале, что messenger-job был запланирован.
 *
 * Контракт для спеки 050:
 *   import { registerSender } from "@/lib/notifications/senders";
 *   registerSender("messenger", telegramSender);
 *
 * После этого scheduler начнёт использовать реальный sender без правок 049.
 */
export const messengerPlaceholderSender: MessengerSender = {
  channel: "messenger",
  providerName: "placeholder",
  async sendMessage(): Promise<SendResult> {
    return {
      status: "skipped",
      skipReason: "no_sender_registered",
      errorMessage: "No messenger sender registered (see spec 050)",
    };
  },
};
