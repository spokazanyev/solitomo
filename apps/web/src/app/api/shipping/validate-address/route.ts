/**
 * POST /api/shipping/validate-address — нормализация + DaData suggestions.
 *
 * Query: ?suggest=1 — режим подсказок.
 * Без флага — clean (нормализация одного адреса).
 */

import { NextResponse, type NextRequest } from "next/server";

import { cleanAddress, dadataToNormalized, suggestAddress } from "@/lib/dadata/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  addressString?: string;
  countryCode?: string;
  query?: string;
}

export async function POST(req: NextRequest) {
  const suggestMode = req.nextUrl.searchParams.get("suggest") === "1";
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ code: "INVALID_JSON" }, { status: 400 });
  }

  if (suggestMode) {
    const query = body.query ?? body.addressString ?? "";
    const suggestions = await suggestAddress(query);
    return NextResponse.json({ suggestions }, { status: 200 });
  }

  const raw = body.addressString ?? body.query ?? "";
  if (!raw) {
    return NextResponse.json({ isValid: false, raw: "" }, { status: 200 });
  }
  const clean = await cleanAddress(raw);
  const normalized = dadataToNormalized(clean, raw);
  return NextResponse.json(normalized, { status: 200 });
}
