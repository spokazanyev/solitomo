/**
 * POST /api/admin/returns/[id]/cancel (053 T024, FR-5314).
 *
 * Transitions a Return → `cancelled`. Allowed only from requested/approved.
 */

import { NextResponse, type NextRequest } from "next/server";

import { loadAdminContext } from "@/lib/returns/admin-helpers";
import { returnError } from "@/lib/returns/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  statusReason?: string;
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
        status: "cancelled",
        statusReason: body.statusReason ?? returnDoc.statusReason,
      } as never,
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    if (message.includes("forbidden transition")) {
      return returnError(409, "invalid_transition", message);
    }
    // eslint-disable-next-line no-console
    console.error("[returns:cancel] failed:", err);
    return returnError(500, "validation_failed", "Cancellation failed");
  }
}
