import "server-only";

import { getPayload } from "payload";
import configPromise from "@payload-config";

export async function getCalculation(key: string): Promise<unknown | null> {
  try {
    const p = await getPayload({ config: configPromise });
    const now = new Date().toISOString();
    const res = await p.find({
      collection: "shipping-calculations",
      where: { and: [{ key: { equals: key } }, { expiresAt: { greater_than: now } }] },
      limit: 1,
    });
    return (res.docs[0] as { data?: unknown } | undefined)?.data ?? null;
  } catch {
    return null;
  }
}

export async function saveCalculation(key: string, data: unknown, ttlMs: number): Promise<void> {
  try {
    const p = await getPayload({ config: configPromise });
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    const existing = await p.find({
      collection: "shipping-calculations",
      where: { key: { equals: key } },
      limit: 1,
    });
    if (existing.docs[0]) {
      await p.update({
        collection: "shipping-calculations",
        id: (existing.docs[0] as { id: number }).id,
        data: { data: data as Record<string, unknown>, expiresAt },
      });
      return;
    }
    await p.create({
      collection: "shipping-calculations",
      data: { key, data: data as Record<string, unknown>, expiresAt },
    });
  } catch {
    // Не блокируем основной flow.
  }
}

export async function purgeExpiredCalculations(): Promise<number> {
  try {
    const p = await getPayload({ config: configPromise });
    const now = new Date().toISOString();
    const res = await p.find({
      collection: "shipping-calculations",
      where: { expiresAt: { less_than: now } },
      limit: 1000,
    });
    let deleted = 0;
    for (const doc of res.docs as Array<{ id: number }>) {
      await p.delete({ collection: "shipping-calculations", id: doc.id });
      deleted++;
    }
    return deleted;
  } catch {
    return 0;
  }
}
