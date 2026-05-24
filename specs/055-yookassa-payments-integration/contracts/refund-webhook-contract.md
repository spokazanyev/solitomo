# 055 ↔ 053 Refund Webhook Integration Contract

**Date**: 2026-05-24
**Modules involved**:
- `apps/web/src/lib/payments/yookassa-webhook-handler.ts` (055, NEW)
- `apps/web/src/lib/returns/repository.ts` (053, EXTEND)
- `apps/web/src/lib/payments/yookassa-refunds.ts` (053, EXTEND signature)

**Spec coverage**: FR-5553, FR-5554, R9, R11.

---

## Goal

Замкнуть refund-цикл: 053 инициирует refund через `POST /v3/refunds`, ЮKassa отвечает асинхронно через webhook → 055 webhook handler принимает event, валидирует, и зовёт 053-репозиторий для обновления `Returns.status` + `Order.payment.refunds[]`.

**До спеки 055**: webhook принимался mock-handler'ом без проверок, `refund.*` events игнорировались → `Returns.status: refund_pending` навсегда.

**После 055**: `Returns.status: refund_pending → refunded | refund_failed` автоматически. 049 отправляет письмо клиенту.

---

## Module boundaries (Constitution Principle IV: Integrations Isolated)

```
  ЮKassa
    │ POST /api/payment/yookassa/webhook
    ▼
  [055] yookassa-webhook-handler.ts
    │ verify IP + idempotency + amount-match
    │ classify event
    │
    ├─ payment.*  → in-handler logic (updates Order)
    │
    └─ refund.*   → call 053:
                    │
                    ▼
                  [053] returns/repository.ts
                    │ applyRefundSucceeded(input) | applyRefundCanceled(input)
                    │   - find Return by providerRefundId
                    │   - state-machine transition
                    │   - update Order.payment.refunds[i].providerStatus
                    │   - maybeMarkOrderReturned()  ← existing 053 logic
                    │   - emit return.refunded | return.refund_failed
                    ▼
                  Done. Webhook returns 200 OK to ЮKassa.
```

**055 NEVER mutates `Returns` collection directly.** Все изменения через 053-репозиторий. Это enforces Constitution IV (Integrations Isolated).

---

## TypeScript contract (053 export)

**File**: `apps/web/src/lib/returns/repository.ts` (existing — add exports).

```ts
// 053 module exports (NEW, added in 055 implementation phase):

export async function applyRefundSucceeded(input: {
  /** ЮKassa refund ID, matches Returns.providerRefundId */
  providerRefundId: string;
  /** ISO datetime from ЮKassa webhook */
  succeededAt: Date;
  /** Amount in kopecks (per 053 convention) — must match Returns.amount */
  amount: number;
  /** PaymentEvents.eventId for idempotency / trace */
  receivedEventId: string;
}): Promise<ApplyRefundResult>;

export async function applyRefundCanceled(input: {
  providerRefundId: string;
  canceledAt: Date;
  reason: string;
  receivedEventId: string;
}): Promise<ApplyRefundResult>;

export interface ApplyRefundResult {
  /** Found and updated */
  applied: boolean;
  /** Resolved Return info (for emitter / observability) */
  returnId?: string;
  returnNumber?: string;
  orderId?: string;
  orderNumber?: string;
  /** If applied=false, explains why (for paymentEvents.rejectedReason) */
  reason?: "not_found" | "already_in_terminal_state" | "amount_mismatch";
}
```

### Behavior — `applyRefundSucceeded`

1. Find `Return` where `providerRefundId === input.providerRefundId`.
   - If not found → return `{ applied: false, reason: "not_found" }`. 055 handler logs to PaymentEvents with `rejectedReason: "unknown_refund"`.
2. Check `Return.status`:
   - If already `refunded` → return `{ applied: false, reason: "already_in_terminal_state" }` (idempotent — webhook retry). 055 logs as `duplicate`.
   - If `refund_pending` → proceed.
   - If anything else (e.g. `cancelled`, `received_back`) → return `{ applied: false, reason: "already_in_terminal_state" }`, log warning.
3. Validate `input.amount === Return.amount` (kopecks). On mismatch → return `{ applied: false, reason: "amount_mismatch" }`. 055 logs PaymentEvents + alerts manager.
4. Atomic update (single Payload `update` call):
   - `Return.status = "refunded"`
   - `Return.refundedAt = input.succeededAt`
   - `Return.providerStatus = "succeeded"`
5. Lookup Order, update `Order.payment.refunds[i]` where `providerRefundId` matches:
   - `providerStatus = "succeeded"`
   - `refundedAt = input.succeededAt`
6. Call existing `maybeMarkOrderReturned(orderId)` — already has 053-C1 fix for kopecks comparison.
7. Emit domain event `return.refunded` via existing `emitDomainEvent`.
8. Return `{ applied: true, returnId, returnNumber, orderId, orderNumber }`.

### Behavior — `applyRefundCanceled`

Similar to `applyRefundSucceeded` but:
- Transitions `Return.status: refund_pending → refund_failed`.
- Sets `Return.refundFailedAt`, `Return.refundFailureReason = input.reason`.
- Updates `Order.payment.refunds[i].providerStatus = "canceled"`.
- Does NOT call `maybeMarkOrderReturned` (no money was actually refunded).
- Emits `return.refund_failed`.

---

## 055 caller (yookassa-webhook-handler.ts)

```ts
import { applyRefundSucceeded, applyRefundCanceled } from "@/lib/returns/repository";

async function handleRefundEvent(event: RefundSucceededEvent | RefundCanceledEvent, paymentEventId: string) {
  if (event.event === "refund.succeeded") {
    const result = await applyRefundSucceeded({
      providerRefundId: event.object.id,
      succeededAt: new Date(),  // ЮKassa doesn't send refunded_at, use receive time
      amount: Math.round(Number(event.object.amount.value) * 100),
      receivedEventId: paymentEventId,
    });

    return result;
  }

  // refund.canceled
  const result = await applyRefundCanceled({
    providerRefundId: event.object.id,
    canceledAt: new Date(),
    reason: event.object.cancellation_details?.reason ?? "unknown",
    receivedEventId: paymentEventId,
  });

  return result;
}
```

The handler then:
- Updates `PaymentEvents.result` to `success` | `rejected` (per `result.applied`).
- If `rejectedReason` returned → store in PaymentEvents + alert via 049.
- Returns 200 OK to ЮKassa regardless (we've recorded the event; admin will handle rejected cases manually).

---

## Receipt support extension (R11)

**File**: `apps/web/src/lib/payments/yookassa-refunds.ts` (existing — extend).

```ts
// BEFORE (053):
export interface CreateRefundInput {
  paymentId: string;
  amount: number;
  description: string;
  idempotencyKey: string;
}

// AFTER (055):
export interface CreateRefundInput {
  paymentId: string;
  amount: number;
  description: string;
  idempotencyKey: string;
  /** ⭐ NEW: 54-ФЗ correction receipt for fiscal compliance.
   *  If absent, ЮKassa won't generate a correction receipt — required for ОСН (FR-5544c).
   *  In dev mode (stub), receipt is logged but not validated. */
  receipt?: YooKassaReceiptInput;
}
```

**Backward compatibility**: receipt optional. 053 (caller in `Returns.afterChange` hook) starts passing it in the 055-implement phase. Existing tests without receipt continue to pass.

**053 builds receipt** via new helper `apps/web/src/lib/returns/refund-receipt.ts`:

```ts
export function buildRefundReceipt(
  order: Order,
  ret: Return,
  vatCodeApplied: number,
): YooKassaReceiptInput {
  return {
    customer: { email: order.customer.email ?? undefined, phone: order.customer.phone ?? undefined },
    items: ret.items.map(item => ({
      description: item.title,
      quantity: String(item.quantity.toFixed(2)),
      amount: { value: (item.refundAmount / 100).toFixed(2), currency: "RUB" },
      vat_code: vatCodeApplied as 1|2|3|4|5|6|11|12,
      payment_subject: "commodity",
      payment_mode: "full_prepayment",
    })),
    tax_system_code: 1, // ОСН — could read from paymentSettings.taxSystemCode
  };
}
```

---

## Idempotency guarantees

1. **ЮKassa side**: at-least-once delivery, retries up to 7 times over 24 hours.
2. **055 webhook handler**: dedups by `paymentEvents.eventId` (composite `${refund.id}:${event}`). Repeated webhook → `paymentEvents.duplicateCount++`, returns 200 OK without calling 053.
3. **053 repository**: even if 055 dedup fails, the state-machine check (`Return.status === "refund_pending"`) prevents double-transition. Second call → `{ applied: false, reason: "already_in_terminal_state" }`.

Three layers of idempotency. Безопасно retriable.

---

## Test plan (for /implement Phase 5)

1. **Unit tests** (`apps/web/src/lib/returns/repository.test.ts`):
   - happy path: `refund_pending → refunded`
   - already refunded: returns `applied: false`
   - amount mismatch: returns `applied: false, reason: amount_mismatch`
   - unknown providerRefundId: returns `applied: false, reason: not_found`
   - race with `maybeMarkOrderReturned` (already correct after C1)
2. **Integration test** (`apps/web/src/lib/payments/__tests__/refund-webhook.integration.test.ts`):
   - Simulate webhook POST with refund.succeeded → assert Return + Order updated
   - Replay same webhook → assert no duplicate effects
3. **E2E** (test-shop ЮKassa via quickstart.md):
   - Full refund flow customer → admin → webhook → Returns.refunded

---

## Migration impact for 053 (post-055)

After 055 is shipped:
- 053 `Returns.afterChange` hook calling `createRefund()` MUST pass `receipt` argument.
- Existing dev-stub tests without receipt continue to work (receipt is optional in adapter).
- Production behavior: if receipt is missing in prod, throw (fiscal compliance). Adapter enforces.

**Migration script** (out of scope MVP — there are no in-flight refunds at launch).

---

**End of contract.**
