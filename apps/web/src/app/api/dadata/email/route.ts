/**
 * POST /api/dadata/email — DaData email suggestions proxy.
 *
 * Body: { query: string; count?: number }
 * Response: { suggestions: DadataEmailSuggestion[] }
 *
 * DaData both autocompletes the local part with the most common domains and
 * corrects typos (gmial.com → gmail.com, yandx.ru → yandex.ru). For the
 * checkout form this reduces undelivered-email rate (relevant for the
 * Unisender Go transactional flow — see specs/049-customer-notifications).
 *
 * Falls back to empty `suggestions: []` when DaData isn't configured.
 */

import { NextResponse, type NextRequest } from "next/server";

import { suggestEmail } from "@/lib/dadata/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  query?: string;
  count?: number;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ code: "INVALID_JSON" }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }

  const count = Math.max(1, Math.min(10, body.count ?? 5));
  const suggestions = await suggestEmail(query, count);
  return NextResponse.json({ suggestions }, { status: 200 });
}
