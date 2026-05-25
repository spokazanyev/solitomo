import type { Metadata } from "next";
import { cookies } from "next/headers";
import configPromise from "@payload-config";
import { getPayload } from "payload";

import { PaymentReturnClient } from "@/components/payment/PaymentReturnClient";
import { PaymentReturnError } from "@/components/payment/PaymentReturnError";
import { loadCustomerFromRequest } from "@/lib/customers/session";

/**
 * /payment/return/[orderId] (056 US3, FR-5620).
 *
 * Server Component. Loads Order через Payload Local API, проверяет auth
 * (customer_session / cart_session / publicToken) — FR-5621.
 *
 * Не индексируется поисковиками (closed page).
 */

export const metadata: Metadata = {
  title: "Платёж — Soliton",
  description: "Подтверждение оплаты заказа",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageParams {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ token?: string }>;
}

interface AuthCheckResult {
  authorized: boolean;
  authMethod: "customer_session" | "cart_session" | "public_token" | "none";
}

async function checkAuth(
  order: {
    cartId?: string | number | { id: string | number } | null;
    customerId?: string | number | { id: string | number } | null;
    publicToken?: string;
  },
  tokenParam: string | undefined,
): Promise<AuthCheckResult> {
  // 1) publicToken (?token=) match — strongest, works even after session expires
  if (tokenParam && order.publicToken && tokenParam === order.publicToken) {
    return { authorized: true, authMethod: "public_token" };
  }

  const cookieStore = await cookies();

  // 2) cart_session cookie match
  const cartCookie = cookieStore.get("cart_session")?.value;
  if (cartCookie && order.cartId) {
    const cartIdRaw =
      typeof order.cartId === "string" || typeof order.cartId === "number"
        ? order.cartId
        : order.cartId.id;
    if (String(cartIdRaw) === cartCookie) {
      return { authorized: true, authMethod: "cart_session" };
    }
  }

  // 3) customer_session — uses 054 verification utility
  // Build a Request-like object for loadCustomerFromRequest
  try {
    const headers = new Headers();
    const sessionCookie = cookieStore.get("customer_session")?.value;
    if (sessionCookie) {
      headers.set("cookie", `customer_session=${sessionCookie}`);
      const session = await loadCustomerFromRequest(new Request("http://internal/", { headers }));
      const customerIdFromSession = session?.customer?.id;
      const customerIdFromOrder = order.customerId
        ? typeof order.customerId === "string" || typeof order.customerId === "number"
          ? order.customerId
          : order.customerId.id
        : null;
      if (
        customerIdFromSession != null &&
        customerIdFromOrder != null &&
        String(customerIdFromSession) === String(customerIdFromOrder)
      ) {
        return { authorized: true, authMethod: "customer_session" };
      }
    }
  } catch {
    // ignore session verification errors — fall through to forbidden
  }

  return { authorized: false, authMethod: "none" };
}

export default async function PaymentReturnPage({ params, searchParams }: PageParams) {
  const { orderId } = await params;
  const { token } = await searchParams;

  if (!orderId) {
    return <PaymentReturnError status={404} message="Не указан ID заказа" />;
  }

  const payload = await getPayload({ config: configPromise });

  let order: Record<string, unknown> | null = null;
  try {
    order = (await payload.findByID({
      collection: "orders",
      id: orderId as never,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown> | null;
  } catch {
    order = null;
  }

  if (!order) {
    return <PaymentReturnError status={404} />;
  }

  const orderTyped = order as {
    id: string | number;
    status?: string;
    clientNumber?: string;
    publicToken?: string;
    cartId?: string | number | { id: string | number } | null;
    customerId?: string | number | { id: string | number } | null;
    payment?: {
      providerStatus?: string;
      paidAt?: string | null;
      receiptStatus?: "pending" | "succeeded" | "canceled" | null;
      amount?: number;
      paymentMethodSnapshot?: { type?: "bank_card" | "sbp" | "yoo_money" | "sberbank" };
    } | null;
    totals?: { total?: number };
    items?: Array<{ sku?: string; title?: string; price?: number; quantity?: number }>;
  };

  // Auth check (FR-5621)
  const auth = await checkAuth(orderTyped, token);
  if (!auth.authorized) {
    return <PaymentReturnError status={403} />;
  }

  // Determine retryAvailable for failure UI
  const retryAvailable = orderTyped.status === "pending_payment";

  // For polling URL — pass token query if we authed via publicToken
  const pollingTokenParam = auth.authMethod === "public_token" ? token : undefined;

  return (
    <PaymentReturnClient
      orderId={orderTyped.id}
      publicToken={orderTyped.publicToken}
      initialStatus={orderTyped.status ?? "unknown"}
      initialPaymentStatus={orderTyped.payment?.providerStatus ?? "none"}
      clientNumber={orderTyped.clientNumber}
      paidAt={orderTyped.payment?.paidAt ?? null}
      receiptStatus={orderTyped.payment?.receiptStatus ?? null}
      retryAvailable={retryAvailable}
      amountRub={orderTyped.totals?.total}
      paymentType={orderTyped.payment?.paymentMethodSnapshot?.type}
      items={orderTyped.items ?? undefined}
      pollingTokenParam={pollingTokenParam}
    />
  );
}
