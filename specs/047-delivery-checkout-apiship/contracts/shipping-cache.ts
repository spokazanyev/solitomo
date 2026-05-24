/**
 * Кэш расчётов тарифов.
 * Контрактный референс для apps/web/src/lib/shipping/apiship/cache.ts.
 *
 * Источник идеи — Medusa-плагин:
 * packages/medusa-fulfillment-apiship/src/workflows/get-calculation.ts
 * packages/medusa-fulfillment-apiship/src/workflows/save-calculation.ts
 *
 * Мы заменяем Medusa-workflows на прямой доступ к Payload-коллекции
 * `shipping-calculations` (data-model.md §3).
 */

import "server-only";
import { getPayload } from "payload";
import config from "@payload-config";

export async function getCalculation(key: string): Promise<unknown | null> {
  const payload = await getPayload({ config });
  const now = new Date().toISOString();
  const found = await payload.find({
    collection: "shipping-calculations",
    where: {
      and: [
        { key: { equals: key } },
        { expiresAt: { greater_than: now } },
      ],
    },
    limit: 1,
  });
  return found.docs[0]?.data ?? null;
}

export async function saveCalculation(key: string, data: unknown, ttlMs: number): Promise<void> {
  const payload = await getPayload({ config });
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  // Upsert: пробуем обновить, иначе создаём.
  const existing = await payload.find({
    collection: "shipping-calculations",
    where: { key: { equals: key } },
    limit: 1,
  });
  if (existing.docs[0]) {
    await payload.update({
      collection: "shipping-calculations",
      id: existing.docs[0].id,
      data: { data, expiresAt },
    });
    return;
  }
  await payload.create({
    collection: "shipping-calculations",
    data: { key, data, expiresAt },
  });
}

/** Чистка устаревших записей. Вызывается cron-задачей. */
export async function purgeExpiredCalculations(): Promise<number> {
  const payload = await getPayload({ config });
  const now = new Date().toISOString();
  const stale = await payload.find({
    collection: "shipping-calculations",
    where: { expiresAt: { less_than: now } },
    limit: 1000,
  });
  for (const doc of stale.docs) {
    await payload.delete({ collection: "shipping-calculations", id: doc.id });
  }
  return stale.docs.length;
}
