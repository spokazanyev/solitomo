/**
 * POST /api/analytics/server-hit (058 T037).
 *
 * Server-side endpoint для отправки `purchase` hit'а через Yandex.Metrika
 * Measurement Protocol. Вызывается Order paid-hook (Orders.afterChange) после
 * успешной оплаты.
 *
 * См. contracts/server-hit-endpoint.md.
 *
 * Auth: same-origin (cron-secret not required для internal Payload-вызовов
 * через payload.find/local fetch).
 */
import { type NextRequest, NextResponse } from "next/server";

import { sendOfflineConversion } from "@/lib/analytics/offline-conversions";
import { sendServerPurchase } from "@/lib/analytics/server-tracker";

interface RequestBody {
  hit_type: "purchase";
  transaction_id: string;
  ym_client_id?: string;
  yclid?: string;
  value: number;
  currency: "RUB";
  page_url: string;
  consent_was_given: boolean;
  goal_id?: string; // 'purchase' default
  paid_at?: string; // ISO8601
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.transaction_id) {
    return NextResponse.json({ error: "transaction_id required" }, { status: 400 });
  }

  // FR-043: respect consent
  if (!body.consent_was_given) {
    return NextResponse.json({ status: "skipped_no_consent" }, { status: 200 });
  }

  const counterId = process.env.YM_COUNTER_ID;
  const agentToken = process.env.YM_AGENT_TOKEN;

  if (!counterId) {
    return NextResponse.json({ status: "skipped_kill_switch", reason: "YM_COUNTER_ID missing" }, { status: 200 });
  }

  // Send server-side purchase hit (FR-040)
  const hitArgs: Parameters<typeof sendServerPurchase>[0] = {
    counterId,
    transactionId: body.transaction_id,
    value: body.value,
    pageUrl: body.page_url,
  };
  if (body.ym_client_id) hitArgs.ymClientId = body.ym_client_id;
  const purchaseResult = await sendServerPurchase(hitArgs);

  // FR-033/034: offline-conversion if yclid (или client_id-based)
  let offlineResult: Awaited<ReturnType<typeof sendOfflineConversion>> | null = null;
  if (agentToken && (body.yclid || body.ym_client_id)) {
    const offlineArgs: Parameters<typeof sendOfflineConversion>[0] = {
      counterId,
      apiToken: agentToken,
      goalId: body.goal_id ?? "purchase",
      transactionId: body.transaction_id,
      value: body.value,
      dateTime: body.paid_at ?? new Date().toISOString(),
    };
    if (body.yclid) offlineArgs.yclid = body.yclid;
    else if (body.ym_client_id) offlineArgs.clientId = body.ym_client_id;

    offlineResult = await sendOfflineConversion(offlineArgs);
  }

  return NextResponse.json({
    purchase: purchaseResult,
    offline: offlineResult,
  });
}
