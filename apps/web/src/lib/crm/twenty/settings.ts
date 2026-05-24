import "server-only";

import { getPayload } from "payload";
import configPromise from "@payload-config";

export interface TwentySettings {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  workspaceId?: string;
  defaultAssignee?: string;
  webhookSecret?: string;
  stageMap: Record<string, string>;
  retry: { maxAttempts: number; baseDelaySec: number; rateLimitRpm: number };
}

const DEFAULT_STAGE_MAP: Record<string, string> = {
  draft: "New",
  pending_payment: "Quote",
  awaiting_payment: "Quote",
  paid: "Won",
  fulfilling: "Won",
  shipped: "Won",
  delivered: "Won",
  completed: "Won.Closed",
  cancelled: "Lost",
  returned: "Lost",
  expired: "Lost",
};

const FALLBACK: TwentySettings = {
  enabled: false,
  baseUrl: process.env.TWENTY_API_URL ?? "https://crm.soliton.ru",
  apiKey: process.env.TWENTY_API_KEY ?? "",
  workspaceId: process.env.TWENTY_WORKSPACE_ID,
  webhookSecret: process.env.TWENTY_WEBHOOK_SECRET,
  stageMap: DEFAULT_STAGE_MAP,
  retry: { maxAttempts: 5, baseDelaySec: 30, rateLimitRpm: 60 },
};

let cached: TwentySettings | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

export async function loadTwentySettings(): Promise<TwentySettings> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
  try {
    const payload = await getPayload({ config: configPromise });
    const raw = (await payload.findGlobal({ slug: "crm-settings" })) as unknown as Record<string, unknown> | null;
    const merged: TwentySettings = JSON.parse(JSON.stringify(FALLBACK));
    if (raw) {
      if (typeof raw.enabled === "boolean") merged.enabled = raw.enabled;
      if (typeof raw.baseUrl === "string" && raw.baseUrl) merged.baseUrl = raw.baseUrl;
      if (typeof raw.apiKey === "string" && raw.apiKey) merged.apiKey = raw.apiKey;
      else merged.apiKey = process.env.TWENTY_API_KEY ?? "";
      if (typeof raw.workspaceId === "string") merged.workspaceId = raw.workspaceId;
      if (typeof raw.defaultAssignee === "string") merged.defaultAssignee = raw.defaultAssignee;
      if (typeof raw.webhookSecret === "string") merged.webhookSecret = raw.webhookSecret;
      const stage = raw.stageMap as Record<string, string> | undefined;
      if (stage) Object.assign(merged.stageMap, stage);
      const retry = raw.retry as Record<string, number> | undefined;
      if (retry) Object.assign(merged.retry, retry);
    }
    cached = merged;
    cachedAt = Date.now();
    return merged;
  } catch {
    return FALLBACK;
  }
}

export function invalidateTwentyCache() {
  cached = null;
  cachedAt = 0;
}
