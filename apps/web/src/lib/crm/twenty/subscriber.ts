import type {
  DomainEventHandler,
  DomainEventPayload,
} from "@/lib/domain-events/types";
import { syncOrderToTwenty } from "./sync";

const TWENTY_API_URL = process.env.TWENTY_API_URL ?? "";
const TWENTY_API_KEY = process.env.TWENTY_API_KEY ?? "";

export function isConfigured(): boolean {
  return TWENTY_API_URL.length > 0 && TWENTY_API_KEY.length > 0;
}

export const twentySubscriber: DomainEventHandler = async (
  event: DomainEventPayload,
) => {
  if (!isConfigured()) return;
  if (!event.kind.startsWith("order.")) return;

  if (!event.order) return;

  await syncOrderToTwenty(event.order.id, event.kind, {
    apiUrl: TWENTY_API_URL,
    apiKey: TWENTY_API_KEY,
  });
};
