import "server-only";

import { getPayload } from "payload";
import configPromise from "@payload-config";

import { registerSubscriber, type DomainEventPayload, type DomainEventSubscriber } from "../../lifecycle/events";

/**
 * Подписчик, который не делает синк сам, а ставит CRM-job в очередь
 * `crm-sync-jobs`. Реальный sync — в cron'е /api/cron/crm-sync.
 */
const twentySubscriber: DomainEventSubscriber = {
  name: "048-twenty-crm-sync",
  async handle(event: DomainEventPayload) {
    try {
      const payload = await getPayload({ config: configPromise });
      const jobId = event.eventId;
      await payload.create({
        collection: "crm-sync-jobs",
        data: {
          jobId,
          orderId: String(event.order.id),
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
