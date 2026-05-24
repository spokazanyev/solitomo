import "server-only";

/**
 * YooKassa Refunds adapter (053 FR-5317, FR-5318, T031).
 *
 * Real REST call to `POST /v3/refunds` of YooKassa. Auth via basic auth
 * (shopId:secretKey) from env. Idempotency via `Idempotence-Key` header
 * (note: YooKassa spelling — without the trailing "y").
 *
 * If `YOOKASSA_SHOP_ID` and `YOOKASSA_SECRET_KEY` are not configured, the
 * function returns a synthetic stub response. This keeps the test/dev
 * environments operable without real credentials; production deployment
 * MUST set both env vars.
 */

export interface CreateRefundInput {
  /** YooKassa payment ID from original purchase (Order.payment.providerRef). */
  paymentId: string;
  /** Refund amount in kopecks. */
  amount: number;
  /** Human-readable description (shown in YooKassa dashboard). */
  description: string;
  /** Idempotence-Key header — use `${returnId}:refund` to dedupe retries. */
  idempotencyKey: string;
}

export interface RefundResult {
  id: string;
  status: "succeeded" | "pending" | "canceled";
  amount: number;
  /** True if the result came from the stub (no real API call). */
  stub: boolean;
}

const YOOKASSA_API_URL = "https://api.yookassa.ru/v3/refunds";

export async function createRefund(input: CreateRefundInput): Promise<RefundResult> {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;

  // H2 fix: in production, missing credentials is a hard error — never silently
  // succeed (otherwise the customer's refund is never actually issued).
  if (!shopId || !secretKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "YooKassa credentials missing in production — cannot process refund. " +
          "Set YOOKASSA_SHOP_ID + YOOKASSA_SECRET_KEY env vars.",
      );
    }
    // eslint-disable-next-line no-console
    console.warn(
      `[yookassa-refunds] dev mode — returning stub for paymentId=${input.paymentId.slice(0, 8)}***`,
    );
    return {
      id: `stub_refund_${input.idempotencyKey}`,
      status: "succeeded",
      amount: input.amount,
      stub: true,
    };
  }

  const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
  const body = {
    payment_id: input.paymentId,
    amount: {
      // YooKassa uses rubles with 2 decimals
      value: (input.amount / 100).toFixed(2),
      currency: "RUB",
    },
    description: input.description.slice(0, 128),
  };

  let response: Response;
  try {
    response = await fetch(YOOKASSA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        "Idempotence-Key": input.idempotencyKey,
      },
      body: JSON.stringify(body),
      // H2 fix: 10s timeout — prevents the handler from hanging indefinitely on slow YooKassa
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new Error(`YooKassa network error: ${(err as Error)?.message ?? String(err)}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`YooKassa ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    id?: string;
    status?: "succeeded" | "pending" | "canceled";
    amount?: { value?: string; currency?: string };
  };

  return {
    id: String(data.id ?? ""),
    status: data.status ?? "pending",
    amount: Math.round(Number(data.amount?.value ?? 0) * 100),
    stub: false,
  };
}
