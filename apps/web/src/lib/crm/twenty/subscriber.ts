import "server-only";

import { getPayload } from "payload";
import configPromise from "@payload-config";

import { registerSubscriber, type DomainEventPayload, type DomainEventSubscriber } from "../../lifecycle/events";
import { loadTwentySettings } from "./settings";

/**
 * Twenty CRM event subscriber (048).
 *
 * Enqueues domain events into `crm-sync-jobs` for the cron worker to consume.
 * Does NOT perform the sync inline — that's done by `/api/cron/crm-sync`.
 *
 * Gating (MVP behavior — see `07-build-specifications/crm-integration-pattern.md`):
 *  - If `crmSettings.enabled = false` (MVP default), this subscriber short-circuits
 *    BEFORE enqueueing. Otherwise the queue would fill with unprocessable jobs.
 *  - Only events with a CRM-meaningful entity ref are enqueued:
 *    order.* / shipment.* / return.* / customer.*. Cart events are skipped —
 *    they don't map to the Twenty Opportunity/Person model.
 *
 * Future (when Twenty is onboarded): per-capability gates per the
 * integration-pattern document. For MVP we only need the global `enabled` gate.
 */

// 055: `payment.` добавлен — когда Twenty подключат (crmSettings.enabled=true),
// payment.succeeded/canceled/etc будут идти в Activity. На launch crmSettings.enabled=false → no-op.
const CRM_RELEVANT_PREFIXES = ["order.", "shipment.", "return.", "customer.", "payment."] as const;

function isCrmRelevant(kind: string): boolean {
  return CRM_RELEVANT_PREFIXES.some((p) => kind.startsWith(p));
}

function resolveOrderId(event: DomainEventPayload): string | undefined {
  if (event.order?.id) return String(event.order.id);
  if (event.returnData?.orderId) return String(event.returnData.orderId);
  // Customer events have no order ref; we still enqueue so Person upserts run
  return undefined;
}

const twentySubscriber: DomainEventSubscriber = {
  name: "048-twenty-crm-sync",
  async handle(event: DomainEventPayload) {
    // Gate 1: event kind is CRM-relevant
    if (!isCrmRelevant(event.kind)) return;

    // Gate 2: Twenty is enabled in settings (MVP default = false → no-op)
    let settings;
    try {
      settings = await loadTwentySettings();
    } catch {
      return;
    }
    if (!settings.enabled) return;

    const orderId = resolveOrderId(event);

    try {
      const payload = await getPayload({ config: configPromise });
      await payload.create({
        collection: "crm-sync-jobs",
        data: {
          jobId: event.eventId,
          orderId: orderId ?? "",
          event: event.kind,
          payload: event as unknown as Record<string, unknown>,
          status: "queued",
          attempt: 0,
          nextAttemptAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[048-twenty] failed to enqueue", err);
    }
  },
};

let registered = false;
export function registerTwentySubscriber(): void {
  if (registered) return;
  registerSubscriber(twentySubscriber);
  registered = true;
}
