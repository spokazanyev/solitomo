/**
 * POST /api/cart/merge — guest → logged-in cart merge (052 FR-5213, US6).
 *
 * In 052 this endpoint returns 501 — real implementation arrives in 054
 * (Customer Account), where it can verify session and apply mergeCarts rules.
 *
 * Contract is fixed here so frontend code can be written against it.
 */

import { type NextRequest } from "next/server";

import { cartError } from "@/lib/cart/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  return cartError(
    501,
    "merge_pending_054",
    "Cart merge requires Customer Account (spec 054). Not implemented in 052.",
  );
}
