/**
 * POST /api/webhooks/twenty (048 FR-5450a, MVP stub).
 *
 * Inbound webhook from Twenty CRM. In MVP (Twenty disabled) responds 503 with
 * a hint. Real implementation lands when Twenty is onboarded — see
 * `07-build-specifications/crm-integration-pattern.md` for the contract.
 *
 * Future scope per the integration pattern:
 *  - opportunity.stage-changed → map to Order.status (capability orderLifecycle = crm-primary)
 *  - person.updated → upsert Customer (capability customerProfile = crm-primary)
 *  - HMAC validation via crmSettings.webhookSecret
 *  - Immutability guards (051 wasEverPaid) still apply — even Twenty cannot
 *    edit frozen Order fields
 */

import { NextResponse, type NextRequest } from "next/server";

import { loadTwentySettings } from "@/lib/crm/twenty/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const settings = await loadTwentySettings().catch(() => null);
  if (!settings?.enabled) {
    return NextResponse.json(
      {
        code: "CRM_DISABLED",
        message:
          "Twenty CRM is disabled (MVP launch state). " +
          "Enable via crmSettings.enabled when onboarding. " +
          "See 07-build-specifications/crm-integration-pattern.md.",
      },
      { status: 503 },
    );
  }

  // When enabled, the real handler will:
  //   1. Verify HMAC signature against settings.webhookSecret
  //   2. Parse Twenty event payload (Opportunity.updated / Person.updated)
  //   3. Apply capability-aware routing per integration-pattern doc
  // Not implemented in MVP.
  return NextResponse.json(
    {
      code: "NOT_IMPLEMENTED",
      message: "Twenty webhook handler is enabled but not implemented in MVP",
    },
    { status: 501 },
  );
}
