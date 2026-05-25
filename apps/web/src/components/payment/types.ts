/**
 * UI types for /payment/return/[orderId] flow (056 T004).
 *
 * Source: specs/056-yookassa-frontend-integration/data-model.md §1.
 */

export type PaymentReturnState =
  | { kind: "loading" }
  | { kind: "polling"; tickCount: number; lastChecked: Date }
  | {
      kind: "success";
      clientNumber: string;
      receiptStatus: "pending" | "succeeded" | "canceled" | null;
      paidAt: string;
      amount?: number;
      paymentType?: "bank_card" | "sbp" | "yoo_money" | "sberbank";
    }
  | { kind: "failure"; reason: "cancelled" | "expired"; retryAvailable: boolean }
  | { kind: "processing_pending" }
  | { kind: "error"; status: 403 | 404 | 500; message?: string };

export interface PaymentReturnProps {
  orderId: string | number;
  publicToken?: string;
  /** Initial Order.status, передаётся из Server Component через SSR. */
  initialStatus: string;
  /** Initial Order.payment.providerStatus. */
  initialPaymentStatus: string;
  /** SO-YYYY-NNNN, нужен для success-state. */
  clientNumber?: string;
  paidAt?: string | null;
  receiptStatus?: "pending" | "succeeded" | "canceled" | null;
  retryAvailable: boolean;
  /** Order.totals.total в рублях, для dataLayer purchase event. */
  amountRub?: number;
  /** Order.payment.paymentMethodSnapshot.type. */
  paymentType?: "bank_card" | "sbp" | "yoo_money" | "sberbank";
  /** Order.items — для dataLayer purchase items[]. */
  items?: Array<{ sku?: string; title?: string; price?: number; quantity?: number }>;
  /**
   * Token query param для polling URL (если auth был через publicToken).
   * Не используется если customer_session/cart_session валидны.
   */
  pollingTokenParam?: string;
}

/** Response shape от GET /api/orders/[id]/payment-status (контракт 055). */
export interface PaymentStatusResponse {
  orderStatus: string;
  paymentStatus: string;
  paidAt: string | null;
  clientNumber: string | null;
  retryAvailable: boolean;
  receiptStatus: "pending" | "succeeded" | "canceled" | null;
}
