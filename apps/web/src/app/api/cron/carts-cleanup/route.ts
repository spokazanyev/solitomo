/**
 * GET/POST /api/cron/carts-cleanup (052 T022).
 *
 * Runs hourly. Transitions:
 *  - active → abandoned (after 60min idle) — fires cart.abandoned → T-010
 *  - active|abandoned → expired (after 30d idle)
 *  - expired → hard delete (after 90d idle) — GDPR compliance
 *
 * Authorization: Bearer ${CRON_SECRET}.
 */

import { NextResponse, type NextRequest } from "next/server";

import { runCartsCleanup } from "@/lib/cart/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // L5 fix: deny in production when secret missing (env rollback / mis-config protection)
    return process.env.NODE_ENV !== "production";
  }
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

async function run() {
  const result = await runCartsCleanup();
  return { ...result, at: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(await run());
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(await run());
}
