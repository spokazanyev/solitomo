import "server-only";

import { getPayload } from "payload";
import configPromise from "@payload-config";

export type EmailProvider = "postmark" | "mailgun" | "sendpulse" | "unisender_go";

export interface NotificationsSettings {
  enabled: boolean;
  email: {
    provider: EmailProvider;
    apiKey: string;
    domain?: string;
    from: string;
    replyTo?: string;
    sandbox: boolean;
  };
  messenger: {
    enabled: boolean;
    provider: "telegram" | "max" | "vk_messages";
  };
  managers: Array<{ email: string; name?: string; events: string[] }>;
  marketing: {
    cartAbandonmentEnabled: boolean;
    cartAbandonmentDelayMin: number;
    npsEnabled: boolean;
  };
  retry: {
    maxAttempts: number;
    baseDelaySec: number;
    stuckQueueThreshold: number;
  };
}

/**
 * 062 follow-up: парсит NOTIFICATION_MANAGER_EMAILS="a@x.ru,b@y.ru" в список
 * менеджеров (все подписаны на "everything"). Позволяет активировать
 * менеджерские письма (T-101/T-102/...) без admin-доступа к Payload Global.
 */
function parseEnvManagers(): NotificationsSettings["managers"] {
  const raw = process.env.NOTIFICATION_MANAGER_EMAILS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .map((email) => ({ email, events: ["everything"] }));
}

const FALLBACK: NotificationsSettings = {
  // 062: env-override активации. Payload Global enabled по-прежнему уважается
  // (см. loadNotificationsSettings), но на проде без admin-доступа удобнее
  // включить флагом NOTIFICATIONS_ENABLED=true в .env.
  enabled: process.env.NOTIFICATIONS_ENABLED === "true",
  email: {
    provider: (process.env.EMAIL_PROVIDER as EmailProvider) ?? "postmark",
    apiKey: process.env.EMAIL_API_KEY ?? "",
    domain: process.env.EMAIL_MAILGUN_DOMAIN,
    from: process.env.EMAIL_FROM ?? "Soliton <orders@soliton.ru>",
    replyTo: process.env.EMAIL_REPLY_TO ?? "support@soliton.ru",
    sandbox: process.env.EMAIL_SANDBOX === "true",
  },
  messenger: {
    enabled: false,
    provider: "telegram",
  },
  managers: parseEnvManagers(),
  marketing: {
    cartAbandonmentEnabled: false,
    cartAbandonmentDelayMin: 60,
    npsEnabled: true,
  },
  retry: {
    maxAttempts: 5,
    baseDelaySec: 30,
    stuckQueueThreshold: 100,
  },
};

let cached: NotificationsSettings | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

export async function loadNotificationsSettings(): Promise<NotificationsSettings> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
  try {
    const p = await getPayload({ config: configPromise });
    const raw = (await p.findGlobal({ slug: "notifications-settings" })) as unknown as Record<string, unknown> | null;
    const merged: NotificationsSettings = JSON.parse(JSON.stringify(FALLBACK));
    if (raw) {
      // 062: env-override NOTIFICATIONS_ENABLED=true имеет приоритет — позволяет
      // включить отправку на проде без admin-доступа к Global. Если env не задан,
      // уважаем значение из Payload Global (raw.enabled).
      if (process.env.NOTIFICATIONS_ENABLED === "true") merged.enabled = true;
      else if (typeof raw.enabled === "boolean") merged.enabled = raw.enabled;
      const email = raw.email as unknown as Record<string, unknown> | undefined;
      if (email) {
        if (typeof email.provider === "string") merged.email.provider = email.provider as EmailProvider;
        if (typeof email.apiKey === "string" && email.apiKey) merged.email.apiKey = email.apiKey;
        else if (!merged.email.apiKey) merged.email.apiKey = process.env.EMAIL_API_KEY ?? "";
        if (typeof email.domain === "string") merged.email.domain = email.domain;
        if (typeof email.from === "string" && email.from) merged.email.from = email.from;
        if (typeof email.replyTo === "string") merged.email.replyTo = email.replyTo;
        if (typeof email.sandbox === "boolean") merged.email.sandbox = email.sandbox;
      }
      const messenger = raw.messenger as unknown as Record<string, unknown> | undefined;
      if (messenger) {
        if (typeof messenger.enabled === "boolean") merged.messenger.enabled = messenger.enabled;
        if (typeof messenger.provider === "string") {
          merged.messenger.provider = messenger.provider as NotificationsSettings["messenger"]["provider"];
        }
      }
      const managers = raw.managers as Array<Record<string, unknown>> | undefined;
      // 062: используем Global-список менеджеров только если он непустой.
      // Иначе сохраняем env-managers из FALLBACK (NOTIFICATION_MANAGER_EMAILS),
      // чтобы пустой Global не затирал env-конфиг.
      if (Array.isArray(managers) && managers.length > 0) {
        merged.managers = managers
          .filter((m) => typeof m?.email === "string" && m.email)
          .map((m) => ({
            email: String(m.email),
            name: typeof m.name === "string" ? m.name : undefined,
            events: Array.isArray(m.events) ? (m.events as unknown[]).map(String) : ["everything"],
          }));
      }
      const marketing = raw.marketing as unknown as Record<string, unknown> | undefined;
      if (marketing) {
        if (typeof marketing.cartAbandonmentEnabled === "boolean")
          merged.marketing.cartAbandonmentEnabled = marketing.cartAbandonmentEnabled;
        if (typeof marketing.cartAbandonmentDelayMin === "number")
          merged.marketing.cartAbandonmentDelayMin = marketing.cartAbandonmentDelayMin;
        if (typeof marketing.npsEnabled === "boolean") merged.marketing.npsEnabled = marketing.npsEnabled;
      }
      const retry = raw.retry as unknown as Record<string, unknown> | undefined;
      if (retry) {
        if (typeof retry.maxAttempts === "number") merged.retry.maxAttempts = retry.maxAttempts;
        if (typeof retry.baseDelaySec === "number") merged.retry.baseDelaySec = retry.baseDelaySec;
        if (typeof retry.stuckQueueThreshold === "number")
          merged.retry.stuckQueueThreshold = retry.stuckQueueThreshold;
      }
    }
    cached = merged;
    cachedAt = Date.now();
    return merged;
  } catch {
    return FALLBACK;
  }
}

export function invalidateNotificationsCache(): void {
  cached = null;
  cachedAt = 0;
}

/** Менеджеры, подписанные на конкретное событие. */
export function managersForEvent(
  settings: NotificationsSettings,
  event: string,
): Array<{ email: string; name?: string }> {
  return settings.managers
    .filter((m) => m.events.includes("everything") || m.events.includes(event))
    .map((m) => ({ email: m.email, name: m.name }));
}
