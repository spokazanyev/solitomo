import "server-only";

import { gql } from "graphql-request";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import type { DomainEventPayload } from "../../lifecycle/events";
import { getTwentyClient } from "./client";
import {
  toCompanyInput,
  toOpportunityInput,
  toPersonInput,
  type CompanyInput,
  type OpportunityInput,
  type PersonInput,
} from "./mappers";

const SITE_URL = process.env.SITE_URL ?? "https://soliton.ru";

/**
 * Обработать одно доменное событие — синхронизировать в Twenty.
 * Использует upsert-запросы. Конкретные мутации зависят от версии Twenty;
 * здесь — query-strings, которые легко поменять при апгрейде Twenty.
 */
export async function processCrmEvent(event: DomainEventPayload): Promise<{
  twentyRef?: { opportunityId?: string; personId?: string; companyId?: string };
  status: "success" | "failed" | "quarantined";
  errorMessage?: string;
}> {
  const ctx = await getTwentyClient();
  if (!ctx) return { status: "failed", errorMessage: "Twenty disabled" };

  const { client, settings } = ctx;
  const order = event.order;

  try {
    let personId: string | undefined;
    let companyId: string | undefined;

    const personInput = toPersonInput(order);
    if (personInput) {
      const res = await client.request<{ upsertPerson: { id: string } }>(
        gql`
          mutation UpsertPerson($input: PersonCreateInput!) {
            upsertPerson(data: $input) { id }
          }
        `,
        { input: personInput },
      );
      personId = res.upsertPerson?.id;
    }

    const companyInput = toCompanyInput(order);
    if (companyInput) {
      const res = await client.request<{ upsertCompany: { id: string } }>(
        gql`
          mutation UpsertCompany($input: CompanyCreateInput!) {
            upsertCompany(data: $input) { id }
          }
        `,
        { input: companyInput },
      );
      companyId = res.upsertCompany?.id;
    }

    const oppInput: OpportunityInput = toOpportunityInput(order, settings.stageMap, SITE_URL);
    oppInput.personId = personId;
    oppInput.companyId = companyId;
    if (event.kind === "order.paid" && !oppInput.closeDate) {
      oppInput.closeDate = event.at;
    }
    const oppRes = await client.request<{ upsertOpportunity: { id: string } }>(
      gql`
        mutation UpsertOpportunity($input: OpportunityCreateInput!) {
          upsertOpportunity(data: $input) { id }
        }
      `,
      { input: oppInput },
    );
    const opportunityId = oppRes.upsertOpportunity?.id;

    if (opportunityId) {
      await client
        .request(
          gql`
            mutation CreateActivity($input: ActivityCreateInput!) {
              createActivity(data: $input) { id }
            }
          `,
          {
            input: {
              type: "Note",
              title: humanLabel(event.kind),
              body: renderActivityBody(event),
              opportunityId,
            },
          },
        )
        .catch(() => {
          // Activity создаётся «best-effort»; ошибка не делает всю job failed.
        });

      // Кэшируем refs в Order
      try {
        const payload = await getPayload({ config: configPromise });
        await payload.update({
          collection: "orders",
          id: order.id,
          data: {
            crmRefs: {
              opportunityId,
              personId,
              companyId,
              lastSyncedAt: new Date().toISOString(),
              lastSyncStatus: "success",
            },
          },
        });
      } catch {
        // ignore
      }
    }

    return {
      status: "success",
      twentyRef: { opportunityId, personId, companyId },
    };
  } catch (err) {
    return { status: "failed", errorMessage: (err as Error).message };
  }
}

function humanLabel(kind: DomainEventPayload["kind"]): string {
  const map: Record<DomainEventPayload["kind"], string> = {
    "order.identified": "Customer identified",
    "order.created": "Order created",
    "order.invoice_issued": "Invoice issued",
    "order.paid": "Payment received",
    "order.payment_failed": "Payment failed",
    "shipment.created": "Shipped",
    "shipment.in_transit": "In transit",
    "shipment.at_point": "Arrived at point",
    "shipment.courier_today": "Out for delivery",
    "shipment.delivered": "Delivered",
    "shipment.returned": "Returned",
    "shipment.error": "Shipment error",
    "order.cancelled": "Cancelled",
    "order.completed": "Closed",
    "order.stuck": "Stuck",
    "order.expired": "Expired",
  };
  return map[kind] ?? kind;
}

function renderActivityBody(event: DomainEventPayload): string {
  const ctx = event.context ?? {};
  const parts: string[] = [`Event: ${event.kind}`, `Order: ${event.order.id}`];
  if (event.order.totals?.total) parts.push(`Total: ${event.order.totals.total} ₽`);
  if (ctx.trackingNumber) parts.push(`Track: ${ctx.trackingNumber}`);
  if (ctx.trackingUrl) parts.push(ctx.trackingUrl);
  if (ctx.errorMessage) parts.push(`Error: ${ctx.errorMessage}`);
  return parts.join("\n");
}
