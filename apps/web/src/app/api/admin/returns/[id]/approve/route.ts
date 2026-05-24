/**
 * POST /api/admin/returns/[id]/approve (053 T024).
 *
 * Transitions a Return from `requested` → `approved`.
 * Requires admin session.
 */

import { NextResponse, type NextRequest } from "next/server";

import { loadAdminContext } from "@/lib/returns/admin-helpers";
import { returnError } from "@/lib/returns/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
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

  const body = (await req.json().catch(() => ({}))) as Body;

  try {
    const updated = await payload.update({
      collection: "returns" as never,
      id,
      data: {
        status: "approved",
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
    console.error("[returns:approve] failed:", err);
    return returnError(500, "validation_failed", "Approval failed");
  }
}
