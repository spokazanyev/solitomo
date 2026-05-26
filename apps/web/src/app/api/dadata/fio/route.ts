/**
 * POST /api/dadata/fio — DaData FIO suggestions proxy.
 *
 * Body: { query: string; count?: number; parts?: Array<"NAME"|"PATRONYMIC"|"SURNAME"> }
 * Response: { suggestions: DadataFioSuggestion[] }
 *
 * `parts` narrows the suggestion type (NAME-only for the first-name input,
 * SURNAME-only for the surname input, etc.). Omit for full-FIO suggestions.
 *
 * Falls back to empty `suggestions: []` when DaData isn't configured or
 * returns an error — the form remains usable as a plain text input.
 */

import { NextResponse, type NextRequest } from "next/server";

import { suggestFio } from "@/lib/dadata/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  query?: string;
  count?: number;
  parts?: Array<"NAME" | "PATRONYMIC" | "SURNAME">;
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

  // Cap user-provided count to a safe ceiling.
  const count = Math.max(1, Math.min(10, body.count ?? 7));

  const suggestions = await suggestFio(query, count, body.parts);
  return NextResponse.json({ suggestions }, { status: 200 });
}
