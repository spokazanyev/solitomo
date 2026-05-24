import type { OrderSnapshot } from "./events";

/**
 * Превращает «сырой» Payload Order doc в OrderSnapshot для подписчиков.
 */
export function buildOrderSnapshot(doc: Record<string, unknown>): OrderSnapshot {
  return {
    id: String(doc.id ?? ""),
    clientNumber: typeof doc.clientNumber === "string" ? doc.clientNumber : undefined, // 051
    publicToken: typeof doc.publicToken === "string" ? doc.publicToken : undefined,
    type: typeof doc.type === "string" ? doc.type : undefined,
    status: String(doc.status ?? ""),
    createdAt: typeof doc.createdAt === "string" ? doc.createdAt : undefined,
    customer: (doc.customer ?? undefined) as OrderSnapshot["customer"],
    totals: (doc.totals ?? undefined) as OrderSnapshot["totals"],
    delivery: (doc.delivery ?? undefined) as OrderSnapshot["delivery"],
    shipment: (doc.shipment ?? undefined) as OrderSnapshot["shipment"],
    items: (doc.items ?? undefined) as OrderSnapshot["items"],
    crmRefs: (doc.crmRefs ?? undefined) as OrderSnapshot["crmRefs"],
    // 053: return aggregates
    hasReturns: typeof doc.hasReturns === "boolean" ? doc.hasReturns : undefined,
    returnsCount: typeof doc.returnsCount === "number" ? doc.returnsCount : undefined,
    totalRefunded: typeof doc.totalRefunded === "number" ? doc.totalRefunded : undefined,
  };
}
