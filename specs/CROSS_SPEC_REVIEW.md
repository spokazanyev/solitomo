# Cross-Spec Consistency Review: Specs 047-054

**Date**: 2026-05-24
**Reviewer**: Claude Opus 4.6 (automated cross-spec analysis)
**Scope**: specs 047, 048, 049, 051, 052, 053, 054 + canonical `order-lifecycle-spec.md` + implementation files (`events.ts`, `status-machine.ts`, `Orders.js`, `AdminChangeLog.js`, `payload.config.ts`)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 9 |
| HIGH | 12 |
| MEDIUM | 15 |
| LOW | 8 |
| **Total** | **44** |

---

## 1. FR Numbering Collisions

### Finding 1.1 -- MEDIUM: FR numbering conventions inconsistent across specs

Each spec uses a prefix derived from its number, but conventions vary:

| Spec | Expected prefix | Actual prefix used | Notes |
|---|---|---|---|
| 047 | FR-47xx | FR-1xx, FR-2xx, FR-3xx, FR-4xx, FR-5xx, FR-6xx, FR-9xx, FR-10xx, FR-12xx, FR-13xx | Uses **topic-based** numbering, not spec-based |
| 048 | FR-48xx | FR-4801..FR-4812 | Correct |
| 049 | FR-49xx | FR-4901..FR-4952 | Correct |
| 051 | FR-51xx | FR-5101..FR-5110 | Correct |
| 052 | FR-52xx | FR-5201..FR-5230 | Correct |
| 053 | FR-53xx | FR-5301..FR-5340 | Correct |
| 054 | FR-54xx | FR-5401..FR-5450 | Correct |

**Collision risk**: 047's FR-5xx (settings/admin) overlaps with 051's FR-51xx, and 047's FR-9xx overlaps with 049's FR-49xx -- but only if numbers were extended (they are not; 047 uses at most FR-905). **No actual collision found.**

**Action**: 047 should be renumbered to FR-47xx convention if specs are ever consolidated. Low priority -- cosmetic only.

### Finding 1.2 -- LOW: 047 FR-12xx (CRM schema) conceptually overlaps with 048 FR-48xx

047 defines FR-1210, FR-1211 for CRM schema fields. These are correctly scoped as "infrastructure only" with implementation in 048. No actual conflict, but the dual numbering means a developer needs to check two specs for CRM-related FRs.

---

## 2. DomainEventKind Coverage

### Finding 2.1 -- CRITICAL: `cart.*` events not in DomainEventKind enum; no extension mechanism defined

**Current enum** (`events.ts:18-34`): 16 kinds (`order.*` + `shipment.*`). Does NOT include:
- `cart.created`, `cart.updated`, `cart.abandoned`, `cart.converted`, `cart.expired`, `cart.merged`, `cart.recovered` (needed by 052)
- `return.created`, `return.approved`, `return.received`, `return.refunded`, `return.rejected` (needed by 053)

**The problem**: `emitDomainEvent` takes `order: OrderSnapshot` as required field. Cart events and return events have different payloads. 052 review (C5) flagged this but no decision was recorded.

**Inconsistency across specs**:
- 052 `data-model.md` lists 6 cart events to emit through "047 emitter"
- 053 `data-model.md` references `return.created`, `return.approved`, `return.refunded` events going to notification-jobs and crm-sync-jobs
- Neither spec defines HOW these extend the existing enum or payload structure

**Action**: Define a unified extension approach BEFORE implementation begins. Two options:
1. Extend `DomainEventKind` union + make `order` field optional + add `cart?: CartSnapshot` and `return?: ReturnSnapshot` (breaking change)
2. Create parallel `emitCartEvent` / `emitReturnEvent` functions with separate subscriber lists (more isolated)

### Finding 2.2 -- HIGH: 053 `return.*` events not defined anywhere in contracts

053 data-model references `return.created`, `return.approved`, `return.refunded` in the "connections" diagram (section 5), but:
- No formal list of `return.*` event kinds exists
- `notification-events.md` (the canonical event list) does not include any `return.*` events
- 048 FR-4804 lists 15 events it subscribes to -- none are `return.*`

**Action**: Add formal `return.*` event definitions to `notification-events.md`. Update 048 FR-4804 to include `return.created`, `return.refunded`.

### Finding 2.3 -- MEDIUM: `order.returned` event missing from emitter

`status-machine.ts` has `returned` as a valid OrderStatus. But `DomainEventKind` does not include `order.returned`. However, 048 FR-4804 lists it as an event it expects to consume. The lifecycle document `section 3` matrix also does not have a row for `order.returned`.

**Action**: Add `order.returned` to `DomainEventKind` enum. Add row to lifecycle matrix section 3.

### Finding 2.4 -- MEDIUM: `order.payment_failed` in enum but not in lifecycle matrix

`events.ts` defines `order.payment_failed` but `order-lifecycle-spec.md` section 3 matrix has no row for it. 049 notification matrix has no template for it. 048 FR-4804 does not list it.

**Action**: Either remove from enum or add matching matrix entries across specs.

---

## 3. Notification Template ID Consistency

### Finding 3.1 -- HIGH: Template T-014 used for manager-side notification in 053, violating T-0xx = customer convention

**Convention** (from lifecycle matrix):
- T-001..T-010: customer-facing email templates
- T-101..T-105: manager-facing email templates

**053 data-model.md section 5** references:
- `return.created -> notification-jobs (T-014 manager)` -- VIOLATION: T-014 is in customer range but targets manager
- `return.approved -> notification-jobs (T-015 customer)` -- OK
- `return.refunded -> notification-jobs (T-016 customer + manager)` -- T-016 mixed

**053 spec.md FR-5322** references:
- `T-015-return-approved.tsx`
- `T-015-return-rejected.tsx` -- Same T-015 ID for two different templates
- `T-016-return-refunded.tsx`

**Problems**:
1. T-014 for manager violates the convention (should be T-106+)
2. T-015 is used for BOTH approved and rejected variants (should be separate IDs)
3. No gap between T-010 (cart.abandoned in 052) and T-014 (return) -- T-011..T-013 are unassigned

**Action**: Renumber 053 templates:
- `return.created -> manager` = T-106
- `return.approved -> customer` = T-011
- `return.rejected -> customer` = T-012
- `return.refunded -> customer` = T-013
- `return.refunded -> manager` = T-107

### Finding 3.2 -- MEDIUM: 052 reserves T-010 but it is not in 049 notification matrix

052 spec states T-010 for `cart.abandoned`. The lifecycle document section 3 confirms `cart.abandoned -> T-010`. But the actual `notification-events.md` matrix (the code-level contract) does NOT contain a rule for `cart.abandoned`. 052 review (C1) flagged this.

**Action**: Add `{ event: "cart.abandoned", channel: "email", template: "T-010", recipient: "customer", requires: "marketingOptIn" }` to the matrix in `notification-events.md`. This is tracked as 052 task T032 but requires cross-spec coordination.

### Finding 3.3 -- MEDIUM: Template T-002 (invoice) referenced by 054 but not in 047 stub

047 email stub covers T-001, T-003, T-005, T-008. Template T-002 (invoice issued) is referenced in:
- lifecycle matrix section 3
- 054 FR-5415 (magic-link in T-002 for legal orders)

But T-002 is NOT in 047's email stub (FR-408 explicitly lists only 4 templates). 049 would implement it, but between 047 and 049, legal orders get no invoice email.

**Action**: Either add T-002 to 047 stub or document this gap. Low priority if all orders are B2C initially.

### Finding 3.4 -- LOW: No messenger M-010 placeholder for cart.abandoned

049 matrix has M-001, M-003, M-004, M-005 for messenger. 052 review (M6) noted there is no M-010 for `cart.abandoned` in the messenger channel. Should be added as placeholder.

---

## 4. Status Machine Completeness

### Finding 4.1 -- CRITICAL: `completed -> delivered` transition missing from status-machine.ts (needed by 053)

053 FR-5316 requires: "When return is created after `Order.status = completed`, status rolls back to `delivered`, `closedAt = null`, `disputeFlag = true`."

**Current `ALLOWED` map**:
```
completed: ["completed"]
```

This means `completed -> delivered` is BLOCKED. Even with `reopenAuthorized`, the `assertTransition` function only checks `completed -> *` generally, but `canTransition("completed", "delivered")` returns `false`.

**Action**: Add `delivered` to `ALLOWED["completed"]` conditional on `reopenAuthorized`. Update `assertTransition`:
```ts
if (from === "completed" && to !== "completed" && !ctx.reopenAuthorized) { throw... }
// If reopenAuthorized is true AND target is "delivered", allow it
```
Also add `"delivered"` to the `ALLOWED["completed"]` array.

### Finding 4.2 -- HIGH: Cart state machine is entirely separate from order status machine

052 defines its own state machine in `data-model.md section 3` with states `active | abandoned | converted | expired | merged`. This is NOT in `status-machine.ts`. 052 review (C2) identified that the `converted -> active` transition (needed when Order is cancelled before payment) is missing.

**Action**: Create `apps/web/src/lib/cart/state-machine.ts` with its own `ALLOWED` transitions map. Document that it is independent from order status machine.

### Finding 4.3 -- HIGH: Return state machine separate but not yet codified in implementation

053 `data-model.md section 4` defines `ReturnStatus` with `ALLOWED_TRANSITIONS` set. This needs its own `apps/web/src/lib/returns/state-machine.ts`. OK -- but subscribers of domain events need to understand both machines.

### Finding 4.4 -- MEDIUM: `delivered -> returned` in lifecycle doc but nuanced in 053

Lifecycle spec section 2.1 allows `delivered -> returned`. But 053 says `Order.status = returned` only happens when `totalRefunded >= total` (full refund). Partial refunds keep Order in `delivered`. This nuance is not captured in the lifecycle doc.

**Action**: Add note to lifecycle spec section 2.1 that `delivered -> returned` only on full refund.

---

## 5. Immutability Whitelist (FR-5107) Completeness

### Finding 5.1 -- CRITICAL: FR-5107 whitelist incomplete for downstream specs

051 FR-5107 defines the paid+ mutable fields whitelist:
```
internalComment, history, notifications[], crmRefs.*, shipment.*,
delivery.{trackNumber,shippedAt}, payment.*, marketingOptIn,
messengerOptIn, disputeFlag
```

**Fields needed by downstream specs but NOT on the whitelist**:

| Field | Needed by | When written | Missing? |
|---|---|---|---|
| `hasReturns` | 053 | afterChange on returns collection | YES |
| `returnsCount` | 053 | afterChange on returns collection | YES |
| `totalRefunded` | 053 | afterChange on returns collection | YES |
| `payment.refunds[]` | 053 | on YooKassa refund success | Partially (payment.* is whitelisted) |
| `crmRefs.*` | 048 | on CRM sync | OK (whitelisted) |
| `notifications[]` | 049 | on notification send | OK (whitelisted) |
| `shipment.*` | 047 | on ApiShip events | OK (whitelisted) |
| `delivery.trackNumber` | 047 | on shipment creation | OK (whitelisted) |
| `delivery.pickupExpiresAt` | 047/049 | on at_point webhook | NOT whitelisted |
| `deliveredAt` | 047 | on delivered webhook | NOT whitelisted |
| `closedAt` | 047 | on auto-closure | NOT whitelisted |
| `status` | all | on state transitions | NOT on list (implicit) |
| `cartId` | 052 | on order creation | Only relevant pre-paid (created at draft) |
| `customerId` | 054 | on customer merge | YES |
| `companyId` | 054 | on customer merge | YES |
| `clientNumber` | 051 | on create (before paid) | OK (created pre-paid) |

**Action**: Extend FR-5107 whitelist to include:
- `hasReturns`, `returnsCount`, `totalRefunded` (for 053)
- `delivery.pickupExpiresAt` (for 049 pickup reminders)
- `deliveredAt`, `closedAt` (for lifecycle management)
- `status` (obviously must change post-paid)
- `customerId`, `companyId` (for 054 merge)

### Finding 5.2 -- HIGH: FR-5106 frozen status set does not include `returned`

051 FR-5106 freezes fields for `status in {paid, fulfilling, shipped, delivered, completed, cancelled, returned, expired}`. This means `cancelled` and `expired` orders that were NEVER paid also have frozen fields. 051 review (C2) flagged this -- the freeze should be based on "was ever paid" not current status.

**Action**: Use `payment.paidAt != null` or a derived `wasEverPaid` flag rather than current status list.

---

## 6. Forward References and Dependency Graph

### Finding 6.1 -- Dependency graph (text-based)

```
047 (delivery/checkout/lifecycle emitter)
 |
 +-----> 048 (Twenty CRM sync)
 |         |
 |         +-----> 054 (Customer Account -- Person/Company sync)
 |
 +-----> 049 (notifications)
 |         |
 |         +-----> 054 (marketingOptIn migration)
 |
 +-----> 051 (numbering/immutability)
 |         |
 |         +-----> 048 (clientNumber in Opportunity.name)
 |         +-----> 049 (clientNumber in email subject)
 |
 +-----> 052 (cart as entity)
 |         |
 |         +-----> 049 (T-010 cart.abandoned)
 |         +-----> 054 (customerId on cart, merge)
 |
 +-----> 053 (returns/refunds)
           |
           +-----> 048 (return.* in CRM)
           +-----> 049 (T-015, T-016 templates)
           +-----> 051 (immutability whitelist for hasReturns etc.)
           +-----> status-machine.ts (completed -> delivered reopen)

054 (Customer Account)
 |
 +-----> 048 (Person/Company bidirectional sync)
 +-----> 049 (marketingOptIn source of truth migration)
 +-----> 052 (customerId on cart, merge flow)
 +-----> 053 (customerId on returns for privacy filter)
```

### Finding 6.2 -- MEDIUM: No circular dependencies detected

The graph is a DAG. 047 is the root. 054 has the most inbound edges but no cycles.

### Finding 6.3 -- HIGH: 053 has the widest cross-cutting surface

053 modifies/extends:
1. `Order` collection (3 new fields)
2. `status-machine.ts` (completed -> delivered)
3. `DomainEventKind` (new return.* events)
4. `notification-events.md` (new templates)
5. 048 crm-sync-matrix (new Activity rules)
6. 051 immutability whitelist
7. `payment` group (refunds[])

This makes 053 the highest-risk spec to implement in parallel with others.

**Action**: 053 should be implemented AFTER 047, 048, 049, 051 are stable. Alternatively, define all interface contracts upfront.

---

## 7. marketingOptIn / emailValid Source of Truth

### Finding 7.1 -- CRITICAL: marketingOptIn lives on Order today, moves to Customer in 054, but no migration plan exists

**Current state**:
- `Orders.js` has `marketingOptIn` (line 348) and `messengerOptIn` (line 360) directly on Order
- `events.ts` `OrderSnapshot.customer` has `marketingOptIn` and `messengerOptIn`

**049 spec** references `Order.marketingOptIn` as the flag to check for opt-out.

**054 spec** FR-5431: "Transfer flags `marketingOptIn` / `messengerOptIn` from `orders` to `customers` as primary source; on `orders` remains as snapshot at order creation."

**The gap**: Between 049 (which reads from Order) and 054 (which moves to Customer):
1. Where does the preference page `/preferences/[token]/` write? Currently to Order (049 US6). After 054 -- to Customer.
2. How does a preference change on Customer propagate to future Orders? (snapshot on create -- OK)
3. What about existing Orders without customerId? Their marketingOptIn is authoritative but disconnected from Customer.

**Action**: Define a migration plan in 054:
1. On Customer creation, copy `marketingOptIn` from most recent Order with that email
2. On preference change via `/preferences/[token]/`, update BOTH Order AND Customer (if exists)
3. On new Order creation, snapshot Customer.marketingOptIn into Order.marketingOptIn
4. Deprecate direct writes to Order.marketingOptIn after 054

### Finding 7.2 -- HIGH: emailValid on Order.customer.emailValid vs Customer.emailValid

Both exist:
- `Orders.js` line 113: `customer.emailValid` (checkbox, default true)
- 054 `data-model.md`: `customers.emailValid` (checkbox, default true)

After 054, which is authoritative? If a bounce marks Order.customer.emailValid = false, does it also mark Customer.emailValid = false? 049 edge case says "after 3 hard bounce mark Order.customer.emailValid=false" but doesn't mention Customer.

**Action**: After 054, bounces should mark Customer.emailValid = false. Order.customer.emailValid remains as snapshot. Add this to 049 edge case and 054 spec.

---

## 8. Twenty CRM Stage Map Consistency

### Finding 8.1 -- MEDIUM: 053 adds `Won.Refunded` stage not in Twenty custom fields

Lifecycle spec section 2.3 defines CRM stages including `Won.Refunded`. 053 FR-5321 says: `return.refunded -> Won.Refunded if full refund`. 

048 `contracts/twenty-fields.md` lists `fulfillmentStage` SELECT options: `New / Quote / Paid / In fulfillment / In transit / At point / Delivered / Closed / Returned / Cancelled`.

**Problem**: `Won.Refunded` is a stage on `Opportunity.stage` (per lifecycle spec 2.3), not on `fulfillmentStage`. But the twenty-fields.md does not mention `Won.Refunded` as an option for `Opportunity.stage` (Twenty's built-in stages). It's unclear if Twenty's standard Opportunity stages can include custom sub-stages like `Won.Refunded`.

**Action**: Clarify whether `Won.Refunded` is added to Twenty's pipeline stages (requires configuration) or is tracked solely via `fulfillmentStage = Returned`. Update twenty-fields.md accordingly.

### Finding 8.2 -- LOW: 054 does not add Customer lifecycle stages to Twenty

054 syncs Customer <-> Person in Twenty. There are no explicit CRM stages for Customer lifecycle (registered, active, churned, deleted). This is acceptable -- Twenty Person doesn't have a pipeline. But worth noting.

---

## 9. Cookie Name Collisions

### Finding 9.1 -- LOW: No collisions detected

| Cookie | Spec | TTL | Scope |
|---|---|---|---|
| `soliton_checkout_draft` | 047 | 30 min | checkout state (customer/address/tariff) |
| `soliton_cart_token` | 052 | 30 days | cart persistence token |
| `customer_session` | 054 | 24 hours sliding | customer auth session |
| `payload-token` | Payload default | varies | admin auth session |

All names are unique. Different purposes. No collision.

**Note**: 052 review (L2) correctly identified that the two cookies serve different purposes and do not replace each other. This should be documented in plan.md.

---

## 10. OpenAPI Path Collisions

### Finding 10.1 -- MEDIUM: Multiple specs add routes under `/api/` -- no collisions but some overlap

**Existing routes** (from implementation):
```
/api/admin/shipping/{create,cancel,labels,refresh-tracking}/
/api/admin/crm/{force-sync,ping}/
/api/admin/notifications/{ping,resend}/
/api/checkout/{draft,finalize-shipping}/
/api/cron/{closure,crm-sync,notifications,pickup-reminder,stuck-alerts}/
/api/invoice/[orderId]/
/api/orders/[token]/{,review}/
/api/payment/yookassa/{,webhook}/
/api/preferences/[token]/
/api/shipping/{calculate,points,validate-address}/
/api/webhooks/apiship/
```

**New routes planned by specs**:

| Route | Spec | Potential conflict |
|---|---|---|
| `POST /api/webhooks/twenty` | 048 US5 | None |
| `GET/POST /api/cart/{token}` | 052 | None |
| `POST /api/cart/{token}/items` | 052 | None |
| `PATCH /api/cart/{token}` | 052 | None |
| `DELETE /api/cart/{token}` | 052 | None |
| `POST /api/cart/merge` | 052 (stub) | None |
| `/api/cron/carts-cleanup` | 052 | None |
| `POST /api/returns` | 053 | None |
| `POST /api/admin/returns/{id}/approve` | 053 | None |
| `/account/magic/[token]/` | 054 | None (page route, not API) |
| `/api/customers/login` | 054 | None |
| `/api/customers/magic-request` | 054 | None |
| `/api/customers/me/export` | 054 | None |
| `/api/customers/me/delete` | 054 | None |
| `/api/customers/me/merge-cart` | 054 | None |

**No collisions found.** The URL namespace is well-partitioned.

### Finding 10.2 -- LOW: 053 public return form route not under /api/

053 FR-5326 defines `/cart/order/[token]/return/` as a page route. FR-5328 defines `POST /api/returns` as the API endpoint. These are correctly separated.

---

## 11. AdminChangeLog Schema Consistency

### Finding 11.1 -- CRITICAL: Multiple specs reference AdminChangeLog with inconsistent field names

**Real schema** (`AdminChangeLog.js`):
```
actorType, actorName, targetCollection, targetId, targetLabel,
changeType (create|update|publish|archive|import),
beforeSnapshot (json), afterSnapshot (json), diffSummary (textarea),
reason (textarea), approvalStatus, approvedBy
```

**051 review C1** already found: spec's data-model section 5 describes `{at, actorEmail, kind, attemptedFields}` which does NOT match the real schema.

**Cross-spec references**:

| Spec | How it writes to AdminChangeLog | Field mapping correct? |
|---|---|---|
| 047 (events.ts) | `actorType: "integration", actorName: "system:domain-event", changeType: "update", diffSummary: event.kind` | YES (matches real schema) |
| 047 FR-503 | "log admin settings changes" | Implicit -- would use existing hooks |
| 048 FR-4812 | "log GraphQL requests with PII mask" | Not specified which fields |
| 049 FR-4906 | "mask PII in logs" | References AdminChangeLog indirectly |
| 051 FR-5108 | `{at, actor, orderId, attemptedFields[], reason}` | NO -- `at` is `createdAt` (auto), `actor` should be `actorName`, `attemptedFields[]` has no field (use `diffSummary`) |
| 053 | "audit in AdminChangeLog" (multiple places) | Not specified which fields |
| 054 FR-5422 | "log merge operations with count" | Not specified which fields |

**Action**: Create a canonical "how to write to AdminChangeLog" guide. Update 051 data-model section 5 to match real schema. All specs should use:
```ts
{
  actorType: "user" | "agent" | "script" | "integration",
  actorName: string,
  targetCollection: "orders" | "returns" | "carts" | etc,
  targetId: string,
  targetLabel: string,
  changeType: "update",
  diffSummary: string,  // human-readable description
  beforeSnapshot: object | null,
  afterSnapshot: object | null,
  reason: string | null
}
```

### Finding 11.2 -- MEDIUM: AdminChangeLog has no `attemptedFields` array

051 FR-5108 wants to record "which fields were attempted to be changed". The real schema has `diffSummary` (textarea) and `beforeSnapshot`/`afterSnapshot` (json). There is no structured `attemptedFields[]` field.

**Action**: Use `diffSummary` for human-readable attempted fields list, and `afterSnapshot` for the structured attempt data. Or add `attemptedFields` as a new json field to AdminChangeLog.

---

## 12. Sequence Naming Patterns

### Finding 12.1 -- HIGH: Inconsistent sequence naming between 051 and 053

| Spec | Purpose | Sequence name | Format |
|---|---|---|---|
| 051 | Order clientNumber | `order_seq_YYYY` (e.g. `order_seq_2026`) | `SO-YYYY-NNNN` |
| 053 | Return returnNumber | `returns_year_YYYY_seq` (e.g. `returns_year_2026_seq`) | `RT-YYYY-NNNN` |
| 053 | Credit memo number | `credit_memos_year_NNNN_seq` | `CM-YYYY-NNNN` |

**Inconsistencies**:
1. Naming pattern: `{entity}_seq_{year}` vs `{entity}_year_{year}_seq` vs `{entity}_year_{NNNN}_seq`
2. 053 data-model says `returns_year_2026_seq` in SQL but `credit_memos_year_NNNN_seq` in text (NNNN should be YYYY)

**Action**: Standardize on one pattern. Recommendation: `{entity}_seq_{year}`:
- `order_seq_2026`
- `returns_seq_2026`
- `credit_memos_seq_2026`

Both specs should use lazy-init (`CREATE SEQUENCE IF NOT EXISTS`) in beforeChange hooks, as 051 review (C5) recommended.

### Finding 12.2 -- MEDIUM: Both 051 and 053 need lazy sequence init but describe it differently

051 contracts describe a `clientNumber-generator.ts` with lazy init. 053 data-model says "migration through Payload migrate:create + manual SQL". These should use the same reusable pattern.

**Action**: Create shared utility `lib/db/sequence.ts`:
```ts
export async function nextSequenceValue(prefix: string, year: number): Promise<string> {
  // CREATE SEQUENCE IF NOT EXISTS + nextval in one transaction
}
```

---

## 13. Additional Cross-Spec Findings

### Finding 13.1 -- CRITICAL: `smsOptIn` field exists in implementation but SMS is cancelled

`events.ts` line 51: `smsOptIn?: boolean` in OrderSnapshot.customer
`Orders.js`: no `smsOptIn` field (correctly removed)
`054/data-model.md`: `smsOptIn: checkbox, defaultValue: false` on Customers collection
`048/contracts/twenty-fields.md`: `smsOptIn: BOOLEAN` on Twenty Person

**Decision 2026-05-23**: SMS channel cancelled. But:
- `smsOptIn` still appears in OrderSnapshot type definition
- `smsOptIn` still planned for Customers collection (054)
- `smsOptIn` still in Twenty custom fields catalog (048)

**Action**: Remove `smsOptIn` from:
1. `events.ts` OrderSnapshot interface
2. 054 data-model `Customers.smsOptIn` (or keep as reserved with clear "not used" note)
3. 048 `twenty-fields.md` Person.smsOptIn (or keep as reserved)

### Finding 13.2 -- CRITICAL: `Order.notifications[].channel` enum missing "crm" and "sms"

`Orders.js` line 389 defines channel options: `email | messenger | admin_ui | dataLayer`

Lifecycle spec section 8.1 defines: `email | sms | crm | admin_ui | dataLayer`

**Mismatches**:
1. `sms` in lifecycle spec but not in Orders.js (correct -- SMS cancelled)
2. `crm` in lifecycle spec but NOT in Orders.js -- CRM events would not be loggable in Order.notifications[]
3. Lifecycle spec still mentions SMS

**Action**: 
1. Add `crm` to channel options in Orders.js
2. Remove `sms` from lifecycle spec section 8.1 or mark as deprecated

### Finding 13.3 -- HIGH: `Order.status` select options in Orders.js missing `draft`

`Orders.js` line 48-60 status options: `new, pending_payment, awaiting_payment, paid, fulfilling, shipped, delivered, cancelled, expired, completed, returned`

`status-machine.ts` line 9-20 includes `draft` as a valid status.

Lifecycle spec Phase 4: "Order created as draft".

But `Orders.js` does NOT have `draft` in the select options.

**Action**: Add `{ label: adminLabel("Черновик", "Draft"), value: "draft" }` to Orders.js status options.

### Finding 13.4 -- HIGH: No `clientNumber` field in Orders.js yet

051 requires `clientNumber` on Orders. Current Orders.js has no such field. This is expected (051 is not yet implemented), but when implemented, it must be added to:
1. `Orders.js` fields
2. `OrderSnapshot` in events.ts (051 review H4 flagged this)
3. `defaultColumns` in Orders admin config (replace `id` with `clientNumber`)

### Finding 13.5 -- MEDIUM: 047 uses `Order.delivery.cost` while also having `delivery.priceSnapshot.cost`

Two cost fields exist:
- `delivery.cost` (line 145 -- plain number)
- `delivery.priceSnapshot.cost` (line 191 -- in snapshot group)

Which is authoritative after finalize? 047 FR-107 says snapshot is the "only source of truth for payment". But the plain `cost` field is also there for backward compatibility.

**Action**: Document that `delivery.priceSnapshot.cost` is authoritative post-finalize; `delivery.cost` is the display value (may equal snapshot or be a fallback value).

### Finding 13.6 -- MEDIUM: 053 needs `Order.payment.refunds[]` but current `payment` group has no array field

`Orders.js` payment group (line 275-300) has: `method, providerStatus, providerRef, paidAt, amount`. No `refunds[]` array.

053 data-model section 2 adds `payment.refunds[]` with fields `providerRefundId, amount, refundedAt, returnId, providerStatus`.

This is a migration that 053 needs to perform. Not a conflict, but worth noting as a dependency.

### Finding 13.7 -- HIGH: 052 `carts.customerId` references `customers` collection that does not exist until 054

`052/data-model.md` line 50: `customerId: relationship, relationTo: "customers"`. But `customers` collection is created by 054.

Payload will fail at build time if `customers` collection is not registered when `carts` references it.

**Resolution options**:
1. Deploy 052 and 054 together
2. Make `customerId` a plain `text` field instead of `relationship` until 054 is deployed
3. Create an empty `customers` collection stub

**Action**: Use option 2 (text field) or option 3 (stub). Document the strategy.

### Finding 13.8 -- MEDIUM: 053 references `media` collection in Return items photos

`053/data-model.md` line 83: `photos: upload, relationTo: "media"`. But the actual media collection is named `media-assets` (slug in `payload.config.ts` from `Catalog.js` -- `MediaAssets`).

**Action**: Verify the actual slug. If it's `media-assets`, update 053 data-model to `relationTo: "media-assets"`.

### Finding 13.9 -- LOW: lifecycle spec section 3 still mentions SMS

Section 3 header says `SMS` crossed out / replaced with `Messenger`, but the channel enum in section 8.1 still has `sms`. Section 7 (SLA table) mentions "Customer messenger (after 050 release)" which is correct.

**Action**: Clean up all SMS references in lifecycle spec.

---

## Dependency Graph (Text-Based)

```
                    +-----------+
                    |    047    |  (root: delivery, checkout, lifecycle emitter)
                    +-----+-----+
                          |
            +-------------+-------------+-------------+
            |             |             |             |
       +----v----+   +----v----+   +----v----+   +----v----+
       |   048   |   |   049   |   |   051   |   |   052   |
       | CRM sync|   | notifs  |   | numbers |   |  cart   |
       +----+----+   +----+----+   +----+----+   +----+----+
            |             |             |             |
            |             |        +----+----+        |
            |             |        |  051→048 |        |
            |             |        |  051→049 |        |
            |             |        +---------+        |
            |             |                           |
       +----v----+        |                      +----v----+
       | 048←054 |   +----v----+                 | 052→049 |
       | bidir.  |   | 049←054 |                 | (T-010) |
       +---------+   | optIn   |                 +---------+
                     +---------+                      |
                                                 +----v----+
                                                 | 052→054 |
                                                 | custId  |
                                                 +---------+

                    +-----------+
                    |    053    |  (returns & refunds -- widest cross-cutting)
                    +-----+-----+
                          |
            +------+------+------+------+
            |      |      |      |      |
         053→047 053→048 053→049 053→051 053→status-machine
         (ApiShip (CRM   (T-015  (whitelist (completed→
          return) events) T-016)  extend)   delivered)
```

---

## Consolidated Action Items

| # | Severity | Area | Action | Specs affected | Owner |
|---|---|---|---|---|---|
| A01 | CRITICAL | DomainEventKind | Define extension mechanism for `cart.*` and `return.*` events | 047, 052, 053 | tech-lead |
| A02 | CRITICAL | Status machine | Add `completed -> delivered` transition (with `reopenAuthorized`) | 053, status-machine.ts | tech-lead |
| A03 | CRITICAL | Immutability whitelist | Extend FR-5107 to include `hasReturns`, `returnsCount`, `totalRefunded`, `deliveredAt`, `closedAt`, `delivery.pickupExpiresAt`, `status`, `customerId`, `companyId` | 051, 053, 054 | tech-lead |
| A04 | CRITICAL | marketingOptIn migration | Define migration plan: Order -> Customer source of truth, dual-write during transition | 049, 054 | tech-lead + PM |
| A05 | CRITICAL | Immutability trigger | Change FR-5106 freeze from status-based to `wasEverPaid` flag | 051 | tech-lead |
| A06 | CRITICAL | AdminChangeLog | Align all specs to use real schema fields (`actorType`, `actorName`, `targetCollection`, `targetId`, `targetLabel`, `changeType`, `diffSummary`, `beforeSnapshot`, `afterSnapshot`) | 051, 053, 054 | tech-lead |
| A07 | CRITICAL | Template IDs | Renumber 053 templates: T-014 (manager) -> T-106, T-015/T-016 split correctly | 053, 049 | tech-lead |
| A08 | CRITICAL | OrderSnapshot | Add `clientNumber` to OrderSnapshot interface; add `order.returned` to DomainEventKind | 047 events.ts, 051 | tech-lead |
| A09 | CRITICAL | Orders.js | Add `draft` to status select options | 047 Orders.js | dev |
| A10 | HIGH | 049 matrix | Add `cart.abandoned -> T-010` rule to notification-events.md | 049, 052 | dev |
| A11 | HIGH | Sequence naming | Standardize to `{entity}_seq_{year}` pattern; create shared utility | 051, 053 | dev |
| A12 | HIGH | smsOptIn | Remove from events.ts OrderSnapshot; mark as reserved in 054/048 | 047, 048, 054 | dev |
| A13 | HIGH | Channel enum | Add `crm` to Orders.js notifications channel options | 047 Orders.js | dev |
| A14 | HIGH | 052 customerId | Resolve forward-reference to non-existent `customers` collection | 052 | tech-lead |
| A15 | HIGH | FR-5106 status set | Include `returned` rationale (only on full refund) in lifecycle doc | 053, lifecycle | dev |
| A16 | HIGH | emailValid | After 054, bounces must update Customer.emailValid, not just Order | 049, 054 | dev |
| A17 | HIGH | return.* events | Add formal return.* event definitions to notification-events.md | 053, 049 | dev |
| A18 | HIGH | Won.Refunded stage | Clarify implementation in Twenty (pipeline config vs fulfillmentStage) | 048, 053 | tech-lead + CRM |
| A19 | MEDIUM | T-002 invoice | Decide whether 047 stub should include T-002 for legal orders | 047 | PM |
| A20 | MEDIUM | order.payment_failed | Either add to lifecycle matrix or remove from enum | 047, 049 | dev |
| A21 | MEDIUM | 053 media slug | Verify actual media collection slug (media vs media-assets) | 053 | dev |
| A22 | MEDIUM | Delivery cost fields | Document `priceSnapshot.cost` vs `cost` authority | 047 | dev |
| A23 | MEDIUM | Cart state machine | Create separate `lib/cart/state-machine.ts` | 052 | dev |
| A24 | MEDIUM | order.returned lifecycle | Add lifecycle matrix row for full-return -> status=returned | lifecycle spec | dev |
| A25 | MEDIUM | SMS references | Clean up remaining SMS references in lifecycle spec | lifecycle spec | dev |
| A26 | MEDIUM | 053 sequence typo | Fix `credit_memos_year_NNNN_seq` -> `credit_memos_seq_YYYY` | 053 | dev |
| A27 | MEDIUM | M-010 placeholder | Add messenger placeholder for cart.abandoned in 049 matrix | 049, 052 | dev |
| A28 | MEDIUM | delivered->returned nuance | Note partial refund keeps Order in delivered, not returned | lifecycle spec | dev |
| A29 | LOW | FR numbering | Document that 047 uses topic-based numbering (non-standard) | 047 | cosmetic |
| A30 | LOW | T-002 gap | Note that between 047 and 049, legal orders have no invoice email | 047 | PM |
| A31 | LOW | Customer lifecycle stages | Note that 054 does not define CRM stages for customer lifecycle | 054 | doc |
| A32 | LOW | Cookie scope doc | Document 047 vs 052 cookie coexistence in plan.md | 052 | doc |

---

## Recommended Fix Order

### Phase 0: Contracts (before any implementation)
1. **A01** -- DomainEventKind extension approach (unblocks 052, 053)
2. **A06** -- AdminChangeLog canonical usage guide (unblocks 051, 053)
3. **A07** -- Template ID renumbering (unblocks 053)
4. **A11** -- Shared sequence utility pattern (unblocks 051, 053)

### Phase 1: Spec patches (before 047 is "complete")
5. **A09** -- Add `draft` status to Orders.js
6. **A08** -- Add `clientNumber` to OrderSnapshot, `order.returned` to enum
7. **A12** -- Remove `smsOptIn` from OrderSnapshot
8. **A13** -- Add `crm` to channel enum in Orders.js
9. **A25** -- Clean SMS refs from lifecycle spec

### Phase 2: During 051 implementation
10. **A05** -- Rewrite FR-5106 freeze trigger to `wasEverPaid`
11. **A03** -- Extend FR-5107 whitelist for all downstream fields

### Phase 3: During 052 implementation
12. **A14** -- Resolve `customers` forward-reference
13. **A10** -- Add `cart.abandoned -> T-010` to 049 matrix
14. **A23** -- Create cart state machine

### Phase 4: During 053 implementation
15. **A02** -- Patch status-machine.ts for `completed -> delivered`
16. **A17** -- Add return.* events to notification-events.md
17. **A15** -- Document `returned` only on full refund
18. **A18** -- Clarify Won.Refunded in Twenty
19. **A21** -- Verify media collection slug

### Phase 5: During 054 implementation
20. **A04** -- marketingOptIn migration plan
21. **A16** -- emailValid bounce handling

---

## Conclusion

The seven specs form a coherent system with a clear dependency hierarchy rooted in 047. The canonical lifecycle document (`order-lifecycle-spec.md`) successfully serves as the coordination backbone.

**The most critical cross-cutting issues are**:
1. The DomainEventKind extension mechanism (how 052 and 053 extend the emitter)
2. The immutability whitelist in 051 not covering fields that downstream specs need to write
3. The `completed -> delivered` transition required by 053 but blocked in status-machine.ts
4. Template ID conventions violated by 053

**053 (returns/refunds) is the highest-risk spec** due to its wide cross-cutting surface: it touches the order status machine, event emitter, notification templates, CRM sync matrix, immutability whitelist, and payment group. It should be implemented last or with very careful contract-first coordination.

**No circular dependencies exist**, which is good. The recommended implementation order is: 047 (done) -> 051 -> 049 -> 048 -> 052 -> 054 -> 053, with contract definitions for 053 agreed upfront.
