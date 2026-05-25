/**
 * POST /api/admin/returns/[id]/received (053 T032, FR-5312).
 *
 * Transitions a Return from `approved` → `received` (item arrived at warehouse).
 * Allows optional refundAmountOverride (kopecks) — manager corrected sum.
 */

import { NextResponse, type NextRequest } from "next/server";

import { loadAdminContext } from "@/lib/returns/admin-helpers";
import { returnError } from "@/lib/returns/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  managerNotes?: string;
  refundAmountOverride?: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loaded = await loadAdminContext(id);
  if (!loaded.ok) return loaded.response;
  const { payload } = loaded.ctx;

  const body = (await req.json().catch(() => ({}))) as Body;

  const data: Record<string, unknown> = { status: "received" };

  if (body.managerNotes != null) data.managerNotes = body.managerNotes;
  if (body.refundAmountOverride != null) {
    if (!Number.isFinite(body.refundAmountOverride) || body.refundAmountOverride < 0) {
      return returnError(400, "validation_failed", "refundAmountOverride must be >= 0");
    }
    if (!body.managerNotes?.trim()) {
      return returnError(
        400,
        "validation_failed",
        "managerNotes required when overriding refundAmount",
      );
    }
    data.refundAmount = Math.round(body.refundAmountOverride);
  }

  try {
    const updated = await payload.update({
      collection: "returns" as never,
      id,
      data: data as never,
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    if (message.includes("forbidden transition")) {
      return returnError(409, "invalid_transition", message);
    }
    // eslint-disable-next-line no-console
    console.error("[returns:received] failed:", err);
    return returnError(500, "validation_failed", "Mark-received failed");
  }
}
