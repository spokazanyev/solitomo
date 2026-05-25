# Research: ЮKassa Frontend Integration (056, Phase 0)

**Date**: 2026-05-25
**Sources**: existing codebase (047/052/054/055 patterns), Next.js 16 docs, React 19 docs, ЮKassa frontend recommendations.

---

## R1 — Polling strategy: native fetch vs SWR/react-query

**Decision**: Native `fetch` + `setInterval` clean-up in `useEffect`. Без SWR/react-query.

**Rationale**:
- Single-purpose polling — нет необходимости в полноценной cache-library
- Avoiding new dependency (bundle bloat) — критично для mobile
- Polling-page имеет finite lifecycle (60 сек max) — heavy caching layer overkill
- Existing `RetryPaymentButton.tsx` использует native `fetch` — consistency

**Alternatives considered**:
- **SWR** — отвергнут: 5KB+ bundle, focusOn revalidation для polling-only не нужно
- **react-query** — отвергнут: too heavy для one-shot polling
- **Server-Sent Events (SSE)** — отвергнут: 055 backend не предоставляет SSE-endpoint; webhook → poll достаточно

---

## R2 — Server/Client Component split

**Decision**:
- **Server Component** (`page.tsx`): загружает Order через Payload Local API, проверяет auth (customer_session / cart_session / publicToken), извлекает initial state (orderId, clientNumber, status, retryAvailable). Передаёт props в Client Component.
- **Client Component** (`PaymentReturnClient.tsx`): использует props как initial state, делает polling через `fetch('/api/orders/${id}/payment-status')`, управляет UI states.

**Rationale**:
- SSR-first: customer видит initial state мгновенно (paid / pending / etc) даже если JS не загружен
- Client polling: live updates через webhook без full-page reload
- Auth check на server: безопаснее (нет client-side secrets), faster (один RTT)

**Alternatives considered**:
- Full client-side с loader — slower initial render, SEO impossible
- Full server-side с `revalidatePath` — невозможно polling без сложной server-actions choreography

---

## R3 — Existing ReviewClient.tsx contract migration

**Current state** (line 68-90):
```ts
const payRes = await fetch("/api/payment/yookassa/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ cartId: finalizeBody.cartId }),
});
const payBody = (await payRes.json()) as { redirectUrl?: string };
if (payBody.redirectUrl) window.location.href = payBody.redirectUrl;
```

**New contract (055)**:
- Request: `{orderId, retryNonce?}` — нужно сначала получить orderId
- Response: `{confirmationUrl, confirmationType, providerRef, retryNonce, availableMethods}`

**Decision (migration path)**:
1. ReviewClient уже после `finalize-shipping`. Нужен между finalize и create-payment вызов `POST /api/orders` для создания Order.
2. Поток becomes:
   ```ts
   // 1) finalize-shipping → snapshot
   await fetch("/api/checkout/finalize-shipping", {...});
   // 2) create Order
   const orderRes = await fetch("/api/orders", {...customer + items + delivery...});
   const { order } = await orderRes.json();
   // 3) create payment
   const payRes = await fetch("/api/payment/yookassa/create", {
     method: "POST",
     body: JSON.stringify({ orderId: order.id }),
   });
   const { confirmationUrl } = await payRes.json();
   window.location.assign(confirmationUrl);
   ```
3. UI loading state: spinner + step indicator («Создаём заказ» → «Подключаемся к ЮKassa») для feedback.

**Alternatives considered**:
- Combined endpoint `POST /api/checkout/pay` — отвергнут: добавляет complexity backend без преимуществ
- Pre-create Order при first `/cart/checkout/physical/review/` visit — отвергнут: создаёт «leak» Order'ов которые customer не закажет

---

## R4 — 404/403 handling on /payment/return

**Decision**: 3 distinct error UIs based on response:
- **404 (Order not found)**: «Заказ не найден. Возможно, ссылка устарела или ID некорректен» + CTA «В каталог» (`/catalog/`)
- **403 (Forbidden)**: «Не удалось проверить вашу сессию. Войдите в личный кабинет либо проверьте email с прямой ссылкой» + CTA «Войти» (`/me/login`)
- **5xx (Server error)**: «Что-то пошло не так. Если деньги списались, мы пришлём подтверждение email-ом» + CTA «На главную»

**Rationale**:
- 404 — admin/user error (typo, expired link). Direct customer к catalog.
- 403 — typically expired cart_session или missing token. Direct к login.
- 5xx — backend issue. Reassuring tone (платёж может быть обработан async через webhook).

---

## R5 — dataLayer purchase event (Constitution V Analytics)

**Decision**: GA4-compliant `purchase` event с full payload, fire only ONCE при first success-state transition. Анти-double-fire через `useRef` flag.

**Format**:
```ts
window.dataLayer = window.dataLayer ?? [];
window.dataLayer.push({
  event: 'purchase',
  transaction_id: order.clientNumber, // SO-2026-0042
  value: order.totals.total,
  currency: 'RUB',
  payment_type: order.payment.paymentMethodSnapshot.type, // bank_card | sbp
  items: order.items.map((i) => ({
    item_id: i.sku,
    item_name: i.title,
    price: i.price,
    quantity: i.quantity,
  })),
});
```

**Why GA4 schema**: Yandex Metrica и Twenty CRM Activity могут принимать этот формат либо его адаптацию. Forward-compatible.

**Alternatives**: server-side событие через webhook → external — отвергнут: backend 055 уже эмитит `payment.succeeded` domain event для server-side analytics; dataLayer — для client-side measurement (heat-map, session replay).

---

## R6 — Email template pattern from T-001

**Decision**: Re-use existing utility functions из `templates/helpers.ts`:
- `customerName(order)` — извлекает имя
- `formatPrice(rub)` — «12 000 ₽» format
- `orderPageUrl(order)` — `${BASE_URL}/cart/order/{publicToken}`
- `renderHtmlShell()` — outer HTML wrapper (header, footer, styles)
- `escapeHtml()` — XSS-safe escape
- `styles.h1 / styles.p / styles.cta` — inline-style constants

**T-015 structure** (customer, payment_expired):
- `subject`: `Заказ {clientNumber} аннулирован — оплата не получена`
- `preheader`: `Хотите попробовать снова? Корзина сохранена.`
- Body: 4 параграфа + 2 CTA кнопки + footer
- 2 CTAs (OQ-6): primary «Вернуться к вашему заказу» (link на `/cart/checkout/physical/review` через cart-recovery), secondary «Начать заново» (link на `/cart/`)

**T-109/110/111** (manager alerts):
- Subject prefix: `⚠️ ...`
- Body: structured table с {field: value} placeholders для quick triage
- Manager CTA: link на admin Order page + PaymentEvents filter

---

## R7 — `POST /api/orders/route.ts` customer_session binding (FR-5609)

**Current state** (line 144-180):
- Принимает `{type, items, customer, delivery, cartToken}`
- Никаких cookies не читает (guest-only flow)
- Cart token из cookie через `getCartTokenFromCookie()`
- Создаёт Order, помечает Cart converted через `markConverted`

**Decision**: Read `customer_session` cookie через existing 054 `loadCustomerSession()` utility. Если valid → extract `customerId` из JWT claims → set `Order.customerId = customerId`. Если no session → текущее поведение (guest).

**Implementation sketch**:
```ts
import { loadCustomerSession } from "@/lib/customers/session";

// inside POST handler, before payload.create:
const session = await loadCustomerSession(request);
const customerId = session?.customer?.id;

await payload.create({
  collection: "orders",
  data: {
    // ... existing fields
    customerId, // ← NEW (optional)
  },
});
```

**Backward compatibility**:
- Guest checkout: `customerId` будет `undefined` → Order.customerId стейтит null (existing behaviour)
- Auth'd checkout: `customerId` присваивается → enables `/me/orders` listing later (054 chain)
- No breaking changes для existing tests

**Alternatives considered**:
- Force-auth (only authenticated можно создать Order) — отвергнут, ломает guest checkout
- Separate endpoint `/api/orders/authenticated` — отвергнут, лишний branching

---

## R8 — Reusable utilities

**Available для re-use**:

| Utility | Location | Use case |
|---|---|---|
| `loadCustomerSession(req)` | `lib/customers/session.ts` | Server Component auth on `/payment/return` |
| `getCartTokenFromCookie(req)` | `lib/cart/cookie.ts` | Guest cart-session auth |
| `customerName(order)` | `lib/notifications/templates/helpers.ts` | Email templates |
| `escapeHtml()` | `lib/notifications/templates/helpers.ts` | XSS safety |
| `renderHtmlShell()` | `lib/notifications/templates/helpers.ts` | Email outer wrapper |
| `formatPrice(rub)` | `lib/notifications/templates/helpers.ts` | «12 000 ₽» display |
| `Loader2`, `CheckCircle2`, `XCircle` icons | `lucide-react` | UI iconography |

---

## R9 — Accessibility for polling page

**Decision**: WCAG AA compliance через 5 принципов:

1. **`role="status"` + `aria-live="polite"`** на главном container'е polling — screen readers announce state changes
2. **Focus management**: на success-state focus moves to primary CTA («В личный кабинет»)
3. **Loading state** имеет `<span aria-hidden="false">Идёт проверка платежа…</span>` plus `Loader2` icon (spinner)
4. **Color contrast ≥ 4.5:1** для всех текстов (Tailwind `text-sky-700` на `bg-sky-50` соответствует)
5. **Keyboard nav**: все CTA — `<a>` или `<button>`, full keyboard accessible, focus rings visible

**Lighthouse audit target**: ≥ 90 на /payment/return (SC-5606).

---

## R10 — Test-shop ЮKassa testing (e2e в quickstart)

**Test cards** (для quickstart.md):
- Card success без 3DS: `5555 5555 5555 4444`
- Card success WITH 3DS: `5555 5555 5555 4477` (3DS pass `12345678`)
- Card decline: `5555 5555 5555 4485` (insufficient funds)
- Card 3DS failure: `5555 5555 5555 4493`

**SBP testing**:
- На test-shop SBP simulator показывает «Подтвердите оплату» — нажимаем сразу
- Webhook за ~2-3 сек

**Refund testing**:
- Открыть admin → Returns → Approve refund → проверить refund.succeeded webhook → Returns.status: refunded

---

## Сводка решений

| ID | Тема | Решение | Покрывает FR |
|---|---|---|---|
| R1 | Polling | native fetch + setInterval | FR-5622 |
| R2 | RSC/Client split | Server `page.tsx` + Client `PaymentReturnClient.tsx` | FR-5620 |
| R3 | ReviewClient migration | 3-step: finalize → create-order → create-payment | FR-5601 |
| R4 | Error UI | 3 distinct UIs (404 / 403 / 5xx) | FR-5605 |
| R5 | dataLayer purchase | GA4 schema, fire-once via useRef | FR-5630 (new) |
| R6 | Email templates | re-use T-001 helpers | FR-5640..5645 |
| R7 | POST /api/orders session binding | loadCustomerSession() integration | FR-5609 |
| R8 | Utilities | re-use existing | Foundation |
| R9 | A11y | role=status + aria-live + focus mgmt | NFR-5604 |
| R10 | E2E testing | ЮKassa test cards via ngrok | quickstart |

**Все NEEDS CLARIFICATION resolved.** Готово к Phase 1.

---

**End of research.md.**
