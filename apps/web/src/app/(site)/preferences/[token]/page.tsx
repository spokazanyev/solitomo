/**
 * Публичная страница управления подпиской (049, US6).
 *
 * /preferences/[token]/
 *
 * Позволяет клиенту отписаться от маркетинговых писем (T-008) и
 * управлять placeholder-каналом messenger (для будущей спеки 050).
 *
 * FR-4950, FR-4952, FR-4951 (ссылка отписки в маркетинговых письмах).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPayload } from "payload";
import configPromise from "@payload-config";

import { PreferencesForm } from "@/components/notifications/PreferencesForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Управление подпиской",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PreferencesPage({ params }: PageProps) {
  const { token } = await params;
  if (!token || token.length < 6) notFound();

  const p = await getPayload({ config: configPromise });
  const result = await p.find({
    collection: "orders",
    where: { publicToken: { equals: token } },
    limit: 1,
  });
  const order = result.docs[0] as unknown as Record<string, unknown> | undefined;
  if (!order) notFound();

  const customer = (order.customer as { email?: string } | undefined) ?? {};
  const email = customer.email ?? "";
  const maskedEmail = email.includes("@") ? `***@${email.split("@")[1]}` : "—";

  return (
    <main style={{ maxWidth: 640, margin: "60px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Управление подпиской</h1>
      <p style={{ color: "#6b6b5e", marginBottom: 24 }}>
        Заказ <code>{String(order.id)}</code> · email <code>{maskedEmail}</code>
      </p>
      <PreferencesForm
        token={token}
        initialMarketingOptIn={Boolean(order.marketingOptIn)}
        initialMessengerOptIn={Boolean(order.messengerOptIn)}
        currentEmail={email}
      />
      <p style={{ color: "#6b6b5e", marginTop: 32, fontSize: 13 }}>
        Транзакционные письма (оплата, отправка, доставка) отправляются всегда — это
        не маркетинговая рассылка и отписаться от них нельзя в соответствии с
        обязательствами по обработке заказа.
      </p>
    </main>
  );
}
