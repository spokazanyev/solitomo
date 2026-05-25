# Review Fixes Applied — Consolidated Report

**Дата**: 2026-05-24
**Контекст**: Применены все CRITICAL, HIGH и MEDIUM фиксы из 5 ревью (051-054 индивидуальные + кросс-спечное)

## Статистика

| Источник ревью | CRITICAL | HIGH | MEDIUM | Всего применено |
|----------------|----------|------|--------|----------------|
| 051 review (34 findings) | 5 | 8 | 12 | 25 |
| 052 review (24 findings) | 7 | 7 | 7 | 21 |
| 053 review (27 findings) | 4 | 9 | 8 | 21 |
| 054 review (28 findings) | 9 | 0 | 14 | 23 |
| Cross-spec (44 findings) | 9 | 12 | 15 | 36 |
| **Итого** | **34** | **36** | **56** | **126** |

> LOW findings (31 шт.) остаются как backlog — косметика, документация, доп. тесты.

---

## Изменённые файлы

### Implementation (3 файла)

| Файл | Изменения |
|------|-----------|
| `apps/web/src/lib/lifecycle/events.ts` | Extended DomainEventKind (cart.*, return.*, order.returned); added CartSnapshot, ReturnSnapshot; made order optional; added clientNumber to OrderSnapshot; removed smsOptIn; updated logToAdminChangeLog for multi-entity |
| `apps/web/src/lib/lifecycle/status-machine.ts` | Added completed→delivered/returned under reopenAuthorized; added returned→* guard |
| `apps/web/src/collections/Orders.js` | Added draft status; clientNumber + clientNumberHistory[]; hasReturns/returnsCount/totalRefunded; payment.refunds[]; crm channel in notifications |

### Cross-spec coordination (4 файла)

| Файл | Изменения |
|------|-----------|
| `specs/049-customer-notifications/contracts/notification-events.md` | Added cart.abandoned T-010, return.* events T-011..T-014/T-106..T-108; removed SMS refs; added marketingOptIn migration note |
| `specs/048-twenty-crm-sync/spec.md` | FR-4804 extended with return.* events; added FR-4813 (Won.Refunded stages) |
| `specs/048-twenty-crm-sync/contracts/twenty-fields.md` | Opportunity fields (returnsCount, totalRefunded, lastReturnNumber); Won.Refunded/PartialRefund stages; smsOptIn deprecated |
| `07-build-specifications/order-lifecycle-spec.md` | completed→delivered note; 10+ new matrix rows; SMS→messenger throughout |

### Spec 051 — Order numbering + immutability (4 файла)

| Файл | Ключевые фиксы |
|------|----------------|
| `spec.md` | C2: wasEverPaid trigger вместо status-list; C4: backfill edge case; H3: FR-5107 whitelist расширен downstream полями; H1-H8 все уточнения; M1-M12 notes |
| `data-model.md` | C1: AdminChangeLog real schema; C3: snapshot decision; C5: lazy sequence; clientNumberHistory[]; wasEverPaid concept |
| `tasks.md` | 5 new tasks (T-NEW-1..5) |
| `contracts/clientNumber-generator.ts` | lazy init; getBusinessYear rename; jitter retry |

### Spec 052 — Cart as entity (4 файла)

| Файл | Ключевые фиксы |
|------|----------------|
| `spec.md` | C1: factual error fix; C2: FR-5220a (conversion point); C3: FR-5232 (price revalidation); C4: marketingOptIn; C5: FR-5233 (CartSnapshot); C6: FR-5214a (If-Match); C7: companyId; H1-H7; M1-M7 |
| `data-model.md` | companyId, marketingOptIn; converted→active transition; cart.recovered event; merge-rules table |
| `tasks.md` | T032 expanded; 6 new tasks (T044-T049) |
| `contracts/cart-api.openapi.yaml` | If-Match header; op=touch; 409 cart_stale; companyId; marketingOptIn |

### Spec 053 — Returns and refunds (5 файлов)

| Файл | Ключевые фиксы |
|------|----------------|
| `spec.md` | C1: FR-5316a (status-machine patch); C2: FR-5316b (051 whitelist); C3: FR-5322a (049 matrix); C4: FR-5321a (048 contracts); H1-H9; US7 (manager create); M1-M8 |
| `data-model.md` | payment.refunds[].providerStatus; payerBankDetails; disputeFlag sync; qtyAvailableForReturn formula; lazy sequence |
| `plan.md` | CRM reverse transition; fiscal stub scope; auto-cancel-stale fix |
| `tasks.md` | 11 new items (T058-T065 + updates) |
| `contracts/returns-api.openapi.yaml` | POST /api/admin/returns; clientRequestId clarification; MIME+EXIF |

### Spec 054 — Customer account (4 файла)

| Файл | Ключевые фиксы |
|------|----------------|
| `spec.md` | A1: magic-link architecture (opaque, not JWT); A4+A5: FR-5445a (API-level privacy); A8: FR-5431a (marketingOptIn migration plan); A13: FR-5412a (customer_session cookie); B1: US2a (forgot password); B9: FR-5417 (CSRF); C1: FR-5446a (CRM Person dedup); 22 changes total |
| `data-model.md` | accountState enum; customer_session cookie name; smsOptIn deprecated; GDPR anonymization table; privacy matrix rewrite; companyId forward-ref |
| `tasks.md` | 9 new tasks (T018a-c, T039a-c, T040a, T068a, T095a) |
| `contracts/customer-api.openapi.yaml` | forgot-password + reset-password endpoints; register always-200; accountState; X-CSRF-Token on 18 endpoints |

---

## Топ решения (architectural decisions)

1. **DomainEventKind** — расширяем через typed union families (OrderEventKind | ShipmentEventKind | CartEventKind | ReturnEventKind). Payload — discriminated: `order?`, `cart?`, `returnData?` (keyword-safe).

2. **Immutability trigger** — `wasEverPaid` (payment.paidAt != null) вместо status-list. Покрывает cancelled/expired до оплаты.

3. **FR-5107 whitelist** — расширен 9 полями для downstream спек: hasReturns, returnsCount, totalRefunded, deliveredAt, closedAt, status, customerId, companyId, cartId.

4. **Template ID convention** — T-0xx для customer, T-1xx для manager. Return templates: T-011..T-014 (customer), T-106..T-108 (manager). Cart: T-010.

5. **marketingOptIn migration** — после 054 источник = Customer; Order сохраняет snapshot; emitter читает Customer → fallback Order для гостей.

6. **Magic-link** — opaque random 256-bit (не JWT). Session через Payload-native cookie `customer_session`.

7. **Cart conversion point** — на pending_payment (после finalize-shipping). Recovery converted→active при Order cancelled/expired до paid.

---

## Порядок реализации (рекомендуемый)

```
047 (done) → 051 → 049 patch → 048 patch → 052 → 054 → 053
```

053 последний — самая широкая кросс-спечная поверхность (6 точек пересечения).

---

## Оставшийся backlog (LOW, 31 шт.)

Не применено — косметика и доп. тесты:
- 051: L1-L9 (title, regex note, SQL IF NOT EXISTS, lint rule, perf metric, error types, seed data)
- 052: L1-L3 (share cart scope, cookie scope doc, maxRows consistency)
- 053: L1-L6 (race tests, template ID consistency, kopecks description, fiscal criterion, lifecycle update, lazy sequence)
- 054: Nit items (2FA scope, rate-limit on register, admin placement)
- Cross-spec: L1-L8 (FR numbering docs, cookie scope, CRM stages, paths)

Все LOW зафиксированы в соответствующих REVIEW_NOTES.md.
