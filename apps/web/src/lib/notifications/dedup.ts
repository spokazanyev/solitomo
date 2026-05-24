import "server-only";

import { getPayload } from "payload";
import configPromise from "@payload-config";

import type { NotificationChannel } from "./types";

/**
 * Ключ дедупликации (FR-4922):
 *   orderId + event + channel + recipient + bucket(at, 24h)
 *
 * Бакет — день в UTC, отсечённый по полночи.
 * При повторном событии в течение 24 часов дубликат подавляется.
 */
export function dedupKey(input: {
  orderId: string;
  event: string;
  channel: NotificationChannel | string;
  recipient: string;
  at: Date | string;
}): string {
  const at = input.at instanceof Date ? input.at : new Date(input.at);
  const day = Number.isNaN(at.getTime())
    ? "0"
    : `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}-${String(at.getUTCDate()).padStart(2, "0")}`;
  return [input.orderId, input.event, input.channel, normalizeRecipient(input.recipient), day]
    .map((s) => String(s).trim().toLowerCase())
    .join("|");
}

function normalizeRecipient(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Проверка: существует ли уже job с этим dedupKey в активном статусе.
 * Если есть — новая job не создаётся, лог: `skipped (duplicate)`.
 */
export async function findExistingByDedupKey(key: string): Promise<{ id: string; status: string } | null> {
  try {
    const p = await getPayload({ config: configPromise });
    const result = await p.find({
      collection: "notification-jobs",
      where: {
        and: [
          { dedupKey: { equals: key } },
          { status: { in: ["queued", "in_progress", "sent"] } },
        ],
      },
      limit: 1,
    });
    const doc = result.docs[0] as { id: unknown; status: unknown } | undefined;
    if (!doc) return null;
    return { id: String(doc.id), status: String(doc.status) };
  } catch {
    return null;
  }
}
