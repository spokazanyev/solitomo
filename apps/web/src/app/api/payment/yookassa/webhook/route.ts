/**
 * ЮKassa webhook endpoint (055 production, replaces 037 mock).
 *
 * Coverage: FR-5530..5555. Полная security pipeline в lib/payments/yookassa-webhook-handler.
 * Этот файл — thin route wrapper.
 */

import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";

import { handleYooKassaWebhook } from "@/lib/payments/yookassa-webhook-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    rawBody = null;
  }

  const result = await handleYooKassaWebhook({
    rawBody,
    headers: request.headers,
  });

  // FR-5536: heavy ops (emit + 049 send) выполняются после ответа 200 через after()
  if (result.outcome.afterResponse) {
    after(result.outcome.afterResponse());
  }

  return NextResponse.json(result.body, { status: result.status });
}
