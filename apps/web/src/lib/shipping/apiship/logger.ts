import "server-only";

import { getPayload } from "payload";
import configPromise from "@payload-config";

export interface LogEntry {
  direction: "out" | "in";
  endpoint: string;
  method?: string;
  status?: number;
  requestId?: string;
  orderId?: string;
  durationMs?: number;
  request?: unknown;
  response?: unknown;
  error?: string;
}

function maskPii<T>(input: T): T {
  if (input == null || typeof input !== "object") return input;
  const clone = Array.isArray(input) ? [...input] : { ...input };
  for (const key of Object.keys(clone)) {
    const value = (clone as Record<string, unknown>)[key];
    if (typeof value === "string") {
      if (/email/i.test(key)) (clone as Record<string, unknown>)[key] = maskEmail(value);
      else if (/phone/i.test(key)) (clone as Record<string, unknown>)[key] = maskPhone(value);
      else if (/(token|secret|apikey|api_key|password|auth)/i.test(key))
        (clone as Record<string, unknown>)[key] = "***";
    } else if (typeof value === "object" && value !== null) {
      (clone as Record<string, unknown>)[key] = maskPii(value);
    }
  }
  return clone as T;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `***@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

export async function logRequest(endpoint: string, payload: { input?: unknown; output?: unknown; orderId?: string }) {
  try {
    const p = await getPayload({ config: configPromise });
    await p.create({
      collection: "shipping-logs",
      data: {
        direction: "out",
        endpoint,
        method: "POST",
        request: payload.input ? (maskPii(payload.input) as Record<string, unknown>) : null,
        response: payload.output ? (maskPii(payload.output) as Record<string, unknown>) : null,
        orderId: payload.orderId,
        at: new Date().toISOString(),
      },
    });
  } catch (err) {
    // Не блокируем основной flow при сбое логирования.
    // eslint-disable-next-line no-console
    console.warn("[shipping-logs] write failed", err);
  }
}

export async function logError(endpoint: string, err: unknown) {
  try {
    const p = await getPayload({ config: configPromise });
    const message = err instanceof Error ? err.message : String(err);
    await p.create({
      collection: "shipping-logs",
      data: {
        direction: "out",
        endpoint,
        error: message,
        at: new Date().toISOString(),
      },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[shipping-logs] error log failed", e);
  }
}
