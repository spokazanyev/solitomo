import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { generateClientNumber } from "@/lib/lifecycle/client-number";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/orders/[id]/reissue-number
 *
 * Reissue a clientNumber for an order. Requires admin auth.
 * Body: { reason: string } — reason must be ≥10 characters (audit trail).
 *
 * Records the old number in clientNumberHistory[], writes to admin-change-log,
 * and assigns a new clientNumber from the PG sequence.
 *
 * Source: spec 051, T015.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const payload = await getPayload({ config: configPromise });
  const auth = await payload.auth({ headers: await headers() });
  if (!auth.user) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const reason = body.reason?.trim();

  // Validate reason (≥10 characters for meaningful audit trail)
  if (!reason || reason.length < 10) {
    return NextResponse.json(
      {
        code: "INVALID_REASON",
        message: "Reason must be at least 10 characters",
      },
      { status: 400 },
    );
  }

  // Fetch the order
  let order: Record<string, unknown>;
  try {
    order = (await payload.findByID({
      collection: "orders",
      id,
    })) as unknown as Record<string, unknown>;
  } catch {
    return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  }

  const oldNumber = order.clientNumber as string | undefined;
  const actorEmail = (auth.user as { email?: string }).email ?? "unknown";

  // Generate new clientNumber
  const result = await generateClientNumber(payload);

  // Build history entry
  const prevHistory = Array.isArray(order.clientNumberHistory)
    ? (order.clientNumberHistory as Record<string, unknown>[])
    : [];
  const historyEntry = {
    oldNumber: oldNumber ?? "(none)",
    reissuedAt: new Date().toISOString(),
    reason,
    actorEmail,
  };

  // Update the order (skip immutability guard — reissue is an authorized mutation)
  await payload.update({
    collection: "orders",
    id,
    data: {
      clientNumber: result.clientNumber,
      clientNumberReissueReason: reason,
      clientNumberHistory: [...prevHistory, historyEntry],
    } as Record<string, unknown>,
    context: { skipImmutability: true },
  });

  // Log to admin-change-log (best-effort)
  try {
    await payload.create({
      collection: "admin-change-log",
      data: {
        actorType: "user",
        actorName: actorEmail,
        targetCollection: "orders",
        targetId: id,
        targetLabel: result.clientNumber,
        changeType: "update",
        diffSummary: "client_number_reissue",
        beforeSnapshot: { clientNumber: oldNumber },
        afterSnapshot: {
          clientNumber: result.clientNumber,
          reason,
          sequenceValue: result.sequenceValue,
        },
      },
    });
  } catch {
    // AdminChangeLog may not exist — don't fail the reissue
  }

  return NextResponse.json({
    ok: true,
    oldNumber: oldNumber ?? null,
    newNumber: result.clientNumber,
    sequenceValue: result.sequenceValue,
    reason,
  });
}
