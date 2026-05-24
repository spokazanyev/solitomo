/**
 * POST /api/admin/returns/[id]/reject (053 T024).
 *
 * Transitions a Return → `rejected`. Requires statusReason (≥5 chars).
 */

import { NextResponse, type NextRequest } from "next/server";

import { loadAdminContext } from "@/lib/returns/admin-helpers";
import { returnError } from "@/lib/returns/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  statusReason: string;
  managerNotes?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loaded = await loadAdminContext(id);
  if (!loaded.ok) return loaded.response;
  const { payload, returnDoc } = loaded.ctx;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return returnError(400, "validation_failed", "Invalid JSON");
  }

  if (!body.statusReason?.trim() || body.statusReason.trim().length < 5) {
    return returnError(400, "missing_reason", "statusReason is required (≥5 chars)");
  }

  try {
    const updated = await payload.update({
      collection: "returns" as never,
      id,
      data: {
        status: "rejected",
        statusReason: body.statusReason.trim(),
        managerNotes: body.managerNotes ?? returnDoc.managerNotes,
      } as never,
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    if (message.includes("forbidden transition")) {
      return returnError(409, "invalid_transition", message);
    }
    // eslint-disable-next-line no-console
    console.error("[returns:reject] failed:", err);
    return returnError(500, "validation_failed", "Rejection failed");
  }
}
