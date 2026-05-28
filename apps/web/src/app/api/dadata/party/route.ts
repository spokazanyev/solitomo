/**
 * POST /api/dadata/party — DaData party (organization) suggestions proxy.
 *
 * Body: { query: string; count?: number }
 * Response: { suggestions: DadataPartySuggestion[] }  // only branch_type === "MAIN" (R4)
 *
 * `query` may be an organization name OR an INN. Branches are filtered out in
 * `suggestParty` (the client layer).
 *
 * Falls back to empty `suggestions: []` when DaData isn't configured or returns
 * an error — the form remains usable as a plain text input (FR-012).
 */

import { NextResponse, type NextRequest } from "next/server";

import { suggestParty } from "@/lib/dadata/client";

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

  // Cap user-provided count to a safe ceiling.
  const count = Math.max(1, Math.min(10, body.count ?? 7));

  const suggestions = await suggestParty(query, count);
  return NextResponse.json({ suggestions }, { status: 200 });
}
