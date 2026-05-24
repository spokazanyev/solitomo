import "server-only";

import { GraphQLClient } from "graphql-request";

import { loadTwentySettings, type TwentySettings } from "./settings";

let cachedClient: { client: GraphQLClient; baseUrl: string; apiKey: string } | null = null;

export async function getTwentyClient(): Promise<{ client: GraphQLClient; settings: TwentySettings } | null> {
  const settings = await loadTwentySettings();
  if (!settings.enabled || !settings.apiKey || !settings.baseUrl) return null;

  if (
    !cachedClient ||
    cachedClient.baseUrl !== settings.baseUrl ||
    cachedClient.apiKey !== settings.apiKey
  ) {
    cachedClient = {
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      client: new GraphQLClient(`${settings.baseUrl.replace(/\/$/, "")}/graphql`, {
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          ...(settings.workspaceId ? { "X-Workspace-Id": settings.workspaceId } : {}),
        },
      }),
    };
  }
  return { client: cachedClient.client, settings };
}

/** Простая ping-проверка соединения. */
export async function pingTwenty(): Promise<{ ok: boolean; message?: string }> {
  const ctx = await getTwentyClient();
  if (!ctx) return { ok: false, message: "Twenty не настроен или выключен." };
  try {
    await ctx.client.request<{ currentUser?: { id: string } }>(
      `query { currentUser { id } }`,
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
