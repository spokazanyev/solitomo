/**
 * POST /api/customers/logout (054 FR-5418).
 *
 * Clears `customer_session` cookie. Preserves `soliton_cart_token` (cart
 * stays anonymous, can be re-merged on next login).
 */

import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("customer_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  // C2 fix: also clear CSRF cookie
  response.cookies.set("customer_csrf_token", "", {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
