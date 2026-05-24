import "server-only";

/**
 * Маскировка ПДн в логах модуля уведомлений.
 * FR-4906: email → `***@domain`, телефон — последние 4 цифры.
 */

export function maskEmail(email: string | undefined | null): string {
  if (!email) return "***";
  const at = email.indexOf("@");
  if (at < 0) return "***";
  const domain = email.slice(at + 1);
  return `***@${domain}`;
}

export function maskPhone(phone: string | undefined | null): string {
  if (!phone) return "***";
  const digits = phone.replace(/\D+/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

export function maskRecipient(channel: string, recipient: string): string {
  if (channel === "email") return maskEmail(recipient);
  if (channel === "messenger") return maskPhone(recipient);
  return recipient;
}

export function logInfo(scope: string, message: string, ctx?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.info(`[notifications:${scope}] ${message}`, ctx ?? {});
}

export function logWarn(scope: string, message: string, ctx?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.warn(`[notifications:${scope}] ${message}`, ctx ?? {});
}

export function logError(scope: string, message: string, err?: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[notifications:${scope}] ${message}`, err);
}
