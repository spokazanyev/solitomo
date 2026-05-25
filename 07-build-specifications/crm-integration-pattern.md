# CRM Integration Pattern

**Status**: Adopted — 2026-05-24
**Owner**: Soliton platform team
**Scope**: how Soliton service interoperates with Twenty CRM (and other future CRMs).

## TL;DR

- MVP ships **without Twenty**. Service is fully self-contained for sales + customer service.
- CRM is a **second-layer optional system** that adopts pieces of functionality as the business grows.
- Connection is **configurable** per functional area via a "capability matrix" (planned for Phase 1 onboarding, not implemented in MVP).
- **No silent dual-execution.** If a function is delegated, the originating subscriber is gated; CRM workflows do not duplicate.
- **Immutability is preserved.** Finance-relevant fields (Order.paid, payment.refunds, clientNumber) are frozen by 051 hooks. Even Twenty webhooks cannot mutate them.

## Principles

1. **Service is self-sufficient.** MVP launches with full sales-funnel coverage: checkout → payment → fulfilment → notifications → returns → customer account. CRM adds analytics + manager UX, not core capability.
2. **Domain events are the contract.** Both service-internal subscribers and CRM-bound subscribers consume the same `emitDomainEvent` stream from `apps/web/src/lib/lifecycle/events.ts`. CRM is just one more subscriber.
3. **Each capability has an explicit owner.** Not "CRM on/off" — per-area choice of who owns customer email, who owns order status, who owns returns approval.
4. **Reversible.** Toggling a capability from `payload` → `crm-primary` and back is a config change, not a migration.
5. **Source of truth for finance stays with the service.** Refunds, invoices, fiscal receipts, GDPR delete — never delegated. CRM gets a copy as Activity.

## Architecture

```
                        ┌────────────────────────────────────────────────┐
                        │  Domain event emitter (047)                    │
                        │  emitDomainEvent({ kind, order?, cart?, ... }) │
                        └──────────────┬─────────────────────────────────┘
                                       │
            ┌──────────────────┬───────┴──────┬──────────────────────────┐
            ▼                  ▼              ▼                          ▼
     047-email-stub     049-notifications   048-twenty             052-cart-recovery
     (default off,     (matrix → jobs +     (enqueue + cron        (order.cancelled/
      unregistered      real send via         → real Twenty sync   expired before paid
      after 049 ready)  email providers)      via GraphQL)         → restore cart)
                                                  │
                                                  ▼
                                          [crm-sync-jobs queue]
                                                  │
                                          /api/cron/crm-sync
                                                  │
                                                  ▼
                                            Twenty GraphQL
                                          ↑                    ↓
                                          │              Activity Note
                                          │
                                  /api/webhooks/twenty (inbound, phase 2+)
```

Each subscriber is **independent** — failures in one don't affect the others. The fan-out uses `Promise.all` with isolated try/catch per subscriber.

## Capability matrix (target architecture)

Each functional area has 3 possible owners. Stored in `crmCapabilities` (future Payload global; **not implemented in MVP**, default behavior is `payload` for everything).

| Area | `payload` (MVP default) | `mirror` (default once enabled) | `crm-primary` (advanced) |
|---|---|---|---|
| **customerProfile** | Customers/Companies collections own data | Payload writes, Twenty Person/Company gets upsert | Twenty primary, webhook updates Customer |
| **orderLifecycle** | status-machine.ts in Payload hooks | Payload primary, Opportunity.stage reflects | Twenty manager changes stage → webhook → Order.status |
| **customerEmails** (T-001..T-009, transactional) | 049 matrix → notification-jobs → ESP | 049 sends + Twenty receives Activity Note | ❌ forbidden (always service-side per ст. 22 timing SLAs) |
| **marketingEmails** (T-008 review, T-010 cart) | 049 sends, respects `marketingOptIn` | 049 sends + Twenty Activity | Twenty Workflow sends, 049 skips marketing templates |
| **managerTasks** | AdminChangeLog + Payload admin queries | Twenty creates Task per FR-4809 | Twenty primary |
| **activityTimeline** | Order.history[] + admin-change-log | + Activity Note in Twenty | Twenty primary, Payload only indexes |
| **returnsApproval** | /api/admin/returns/* in Payload | Payload primary, Twenty Activity «Return approved» | Twenty manager approves → webhook flips Return.status |

**Global switch**: `crmSettings.enabled = false` forces all areas into `payload` mode regardless of matrix values.

## Phased rollout

| Phase | When | What changes | What stays |
|---|---|---|---|
| **0 — MVP** (current) | `crmSettings.enabled = false` | Nothing. Service standalone. | Everything. |
| **1 — Onboarding** | Owner deploys Twenty self-hosted, runs `pnpm crm:migrate-fields`, flips `enabled = true` | Outbound sync activates. All capabilities default to `mirror`. Twenty Opportunity becomes visible mirror of every Order. | All critical flows stay in Payload. No webhooks yet. |
| **2 — Manager workflow** | Managers want to edit stages from Twenty | `orderLifecycle = crm-primary` → webhook handler implemented. Twenty.stage changes flow back to Order.status (filtered by status-machine + immutability guards). | Emails, returns, refunds remain in Payload. |
| **3 — Marketing hand-off** | Twenty + Mailchimp connector is set up | `marketingEmails = crm-primary` → 049 skips T-008/T-010. Twenty sends marketing. | Transactional emails (T-001..T-009) stay in 049. |
| **4 — Full CRM** | Mature operations | `returnsApproval = crm-primary`, `customerProfile = crm-primary` | Immutability + checkout flow + Order.paid + refund engine always in Payload. |

Every phase is reversible: toggle the area back to `mirror` or `payload`, no data migration needed.

## What lives where (data ownership)

### Always in Payload (never delegated):
- `payment.providerRef`, `payment.paidAt`, `payment.refunds[]` (financial truth)
- `payment.refunds[].providerRefundId` (YooKassa idempotency key)
- `clientNumber` after first payment (051 wasEverPaid)
- `Order.items[]` and `Order.totals.*` after paid (051 immutability)
- `Customer.passwordHash`, `magicLinkToken`, `resetPasswordToken` (auth secrets)
- `gdprConsentAt`, `gdprConsentVersion` (compliance audit)
- AdminChangeLog entries (immutable audit trail)
- `fiscal-corrections` (54-ФЗ chek correctioner traces)
- `clientRequestId` / dedup keys (idempotency proofs)

### Mirrored to Twenty (one-way, MVP+):
- Customer email, fullName, phone, marketingOptIn → Twenty Person
- Company name, taxId (ИНН), kpp, ogrn → Twenty Company
- Order clientNumber, totals.total, status (mapped to stage), shipping ref → Twenty Opportunity
- Lifecycle events as Twenty Activity Notes

### Eligible for inbound (phase 2+):
- Opportunity.stage changes → Order.status (filtered by status-machine)
- Person.firstName/lastName/phone changes → Customer (5-sec debounce; Soliton wins on tie)
- Return approval/rejection → Return.status (with audit log of CRM actor)

### Never inbound from CRM:
- payment.paidAt, payment.refunds[] (only YooKassa webhook + admin can mutate)
- Order.items[], Order.totals.*, clientNumber after paid (immutability)
- GDPR deletion (must originate from `/api/customers/me/delete` or admin action)
- New Orders (no "Twenty creates Order" path)

## Email policy (critical contract)

| Channel | Owner | When | Notes |
|---|---|---|---|
| Transactional client emails (T-001 paid, T-003 shipped, T-005 delivered, T-009 cancelled) | **Always Payload (049)** | Order/shipment events | Required by ст. 22 SLA + service has dedup, opt-in checks |
| Manager emails (T-101..T-108) | **Always Payload (049)** | All events with `recipient=manager` | Synchronized with `notificationsSettings.managers[]` |
| Marketing (T-008 NPS, T-010 cart-abandoned) | Default Payload; can be moved to Twenty in phase 3 | order.completed, cart.abandoned | When `marketingEmails=crm-primary`, 049 emitter skips marketing templates |
| Manager-customer reply | Twenty (when Gmail/Outlook integration is set up) | Direct conversation | Twenty side; Payload not aware. Future: ingest as Activity for unified history. |

**Anti-pattern (forbidden):** both 049 and Twenty Workflow sending the same template on the same event. Enforcement is the capability matrix + the email policy table.

## Inbound webhook contract (phase 2+)

When a capability is set to `crm-primary`, Twenty calls `POST /api/webhooks/twenty/{capability}`. The handler:

1. **Validates HMAC signature** against `crmSettings.webhookSecret` (constant-time compare).
2. **Checks capability is `crm-primary`** for the affected area. If not, returns 503 (silently ignore — useful for split-brain debugging).
3. **Applies guards**:
   - Order.status changes go through `status-machine.assertTransition` (rejects forbidden moves like Won→Quote).
   - Customer mutations go through Customer.beforeChange (Email format, password not allowed via webhook).
   - Financial fields rejected with 422.
4. **Writes to Payload** with `req.context.fromCrmWebhook = true` so internal hooks can skip duplicate work.
5. **Writes AdminChangeLog** with actor = `crm:twenty:${webhook.actor.email}` so the audit trail names a human.
6. Returns **2xx with the resulting state** so Twenty can reconcile if needed.

Conflict resolution: last-write-wins by `updatedAt`. Within a 5-second window after a Soliton-originated change, Soliton wins (tie-breaker for race conditions).

## Failure modes

| Scenario | Service behavior | CRM behavior |
|---|---|---|
| Twenty offline | Subscriber enqueues to `crm-sync-jobs`; cron retries with backoff up to 5 times | — |
| Cron stuck | Jobs accumulate; manager notices via `/admin/collections/crm-sync-jobs` failed-count | — |
| GraphQL field mismatch (Twenty version drift) | Job marked `failed`, error in `lastSyncError`; manager re-runs `crm:migrate-fields` | — |
| Twenty webhook signature invalid | 401, AdminChangeLog entry, alert | Twenty retries per its own policy |
| Order mutation rejected by immutability guard via webhook | 422, AdminChangeLog with violation list | Twenty surfaces error to manager |
| Soliton and Twenty wrote same field within 5s | Soliton wins, AdminChangeLog notes conflict | Twenty's webhook 200, but field reverts on next outbound sync |
| `crmSettings.enabled = false` mid-day (kill switch) | All new events skip enqueueing. Existing queued jobs drain naturally (cron also gates). | — |

## What the MVP currently does

- `crmSettings.enabled` defaults to `false`. **Service runs standalone.**
- `048-twenty-crm-sync` subscriber is registered, but **short-circuits before enqueueing** when `enabled=false` (see `apps/web/src/lib/crm/twenty/subscriber.ts`). Queue stays empty.
- The cron `/api/cron/crm-sync` reads `loadTwentySettings()` and returns early on `enabled=false` — no requests to Twenty.
- `/api/webhooks/twenty` returns 503 with a hint pointing to this document.
- All other behavior (orders, payments, shipping, notifications, returns, customer accounts) operates without any CRM dependency.

## What will need to be implemented in Phase 1 (Twenty onboarding)

When the owner is ready to deploy Twenty self-hosted (estimated 1-2 months post-launch):

1. **Deploy Twenty** at `crm.pdumarket.ru` per `specs/048-twenty-crm-sync/plan.md`.
2. **Run `pnpm crm:migrate-fields`** to create custom Opportunity fields. Already implemented; idempotent.
3. **Set environment variables**: `TWENTY_API_URL`, `TWENTY_API_KEY`, `TWENTY_WORKSPACE_ID`, `TWENTY_WEBHOOK_SECRET`.
4. **Flip `crmSettings.enabled = true`** in Payload Admin global.
5. **Verify mapper coverage** — extend `lib/crm/twenty/mappers.ts` for new event payloads from 052/053/054 (cart events, return events, customer.created/preferences_updated).
6. **Add `returnsCount`, `totalRefunded`, `lastReturnNumber`** fields to OpportunityInput (053 FR-5321a — currently spec'd, not in mapper).
7. **Add stages `Won.Refunded` / `Won.PartialRefund`** to `stageMap` (053 FR-4813).
8. **Add Customer.id as `externalCustomerId`** in Person mapper so identity survives email changes (054 edge case).
9. **Monitor `crm-sync-jobs` failed-count for 48 hours** — fix any field mismatches by re-running migration.

This is **Phase 1 only**. Phase 2 (inbound webhook handler) is a separate work item; phases 3-4 are further out.

## Open questions (to revisit at Phase 1 start)

| # | Question | Owner |
|---|---|---|
| Q1 | Are marketing emails (T-008, T-010) sent from Soliton or from Twenty/Mailchimp at Phase 1 launch, or only at Phase 3? | Product/marketing |
| Q2 | Filter for Twenty Activities: log all 25 event kinds or only key ones (paid/shipped/delivered/refunded/cancelled)? Default: all, configurable per `notificationsSettings`. | Operations |
| Q3 | When customer changes email — re-issue Twenty Person ID or keep historical link by `crmPersonId`? | Architecture |
| Q4 | Twenty workspace single-tenant or per-customer-segment? (B2C vs B2B) | Operations |
| Q5 | SLA for outbound sync latency: 1 min (current cron interval) or stricter? | Operations |
| Q6 | Where does Twenty's "Tasks completed" feed back to Soliton? Currently nowhere — manager closes task in Twenty UI, no echo. Acceptable? | UX |

## References

- `specs/048-twenty-crm-sync/spec.md` — original Twenty sync spec
- `specs/048-twenty-crm-sync/contracts/twenty-fields.md` — custom field definitions
- `specs/048-twenty-crm-sync/contracts/twenty-crm-sync.md` — event mapping
- `07-build-specifications/order-lifecycle-spec.md §4` — Person/Company mapping
- `apps/web/src/lib/crm/twenty/` — implementation
- `apps/web/src/globals/CrmSettings.ts` — runtime configuration
- `apps/web/src/lib/lifecycle/events.ts` — domain event emitter (047)
