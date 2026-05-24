import "server-only";

import type { EmailSender, SendResult } from "../../types";

/**
 * SendPulse-sender — упрощённая реализация. Полноценный OAuth-flow не реализован
 * (требует client_id / client_secret и кэш токена). Возвращает failed-not-implemented,
 * чтобы при выборе провайдера админ увидел понятную ошибку.
 *
 * Когда придёт время выбрать SendPulse, заполните токен-flow здесь.
 */
export function createSendpulseSender(apiKey: string): EmailSender {
  return {
    channel: "email",
    providerName: "sendpulse",
    async sendEmail(): Promise<SendResult> {
      void apiKey;
      return {
        status: "failed",
        errorMessage: "SendPulse sender not implemented; choose postmark or mailgun for now",
        transient: false,
      };
    },
    async ping(): Promise<SendResult> {
      return {
        status: "failed",
        errorMessage: "SendPulse sender not implemented",
      };
    },
  };
}
