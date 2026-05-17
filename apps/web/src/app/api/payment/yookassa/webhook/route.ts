import { NextResponse, type NextRequest } from "next/server";
import configPromise from "@payload-config";
import { getPayload } from "payload";

// TODO(owner): после получения ЮKassa shopId/secret реализовать проверку подписи,
// идемпотентность и реальное обновление статуса заказа (см. spec 037, Phase 4).
// Сейчас обработчик принимает payload, ищет заказ по providerRef и переключает статус,
// но без проверки источника. В режиме mock не должен быть открыт в продакшен.

export async function POST(request: NextRequest) {
  if (process.env.YOOKASSA_MOCK_DISABLED === "true") {
    return NextResponse.json({ error: "Mock disabled" }, { status: 403 });
  }

  let body: { object?: { id?: string; status?: string; amount?: { value?: string } } };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const providerRef = body.object?.id;
  const providerStatus = body.object?.status;
  if (!providerRef) {
    return NextResponse.json({ error: "Missing payment id" }, { status: 400 });
  }

  try {
    const payload = await getPayload({ config: configPromise });
    const result = await payload.find({
      collection: "orders",
      where: { "payment.providerRef": { equals: providerRef } },
      limit: 1,
    });
    const order = result.docs[0];
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const allowedProviderStatuses = ["none", "pending", "succeeded", "canceled"] as const;
    type ProviderStatus = (typeof allowedProviderStatuses)[number];
    const normalisedProviderStatus: ProviderStatus = allowedProviderStatuses.includes(
      (providerStatus ?? "") as ProviderStatus,
    )
      ? (providerStatus as ProviderStatus)
      : "pending";

    const nextStatus =
      normalisedProviderStatus === "succeeded"
        ? "paid"
        : normalisedProviderStatus === "canceled"
          ? "cancelled"
          : order.status;
    await payload.update({
      collection: "orders",
      id: order.id,
      data: {
        status: nextStatus,
        payment: {
          ...order.payment,
          providerStatus: normalisedProviderStatus,
          paidAt:
            normalisedProviderStatus === "succeeded"
              ? new Date().toISOString()
              : order.payment?.paidAt,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[yookassa webhook] update failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
