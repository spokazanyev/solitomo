# Quickstart: ЮKassa Frontend Integration (056)

**Goal**: пройти полный customer-flow с реальным backend 055 и UI 056. От dev-setup до e2e на test-shop ЮKassa.

---

## 0. Prerequisites (один раз)

- ✅ Backend 055 implement'нут (см. `specs/055-yookassa-payments-integration/quickstart.md` §1-3)
- ✅ Test-shop ЮKassa создан, shopId+secret в `apps/web/.env.local`
- ✅ ngrok установлен для webhook tunneling
- ✅ Payload admin password: установлен initial user
- ✅ Database migration применена: `pnpm --filter @soliton/web payload migrate` (055 + 056 нет новых)
- ✅ `paymentSettings` global в admin: `enabled=true`, `taxSystemCode=1`, `defaultVatCode=12`, senderCompanyInfo заполнен

---

## 1. Branch setup

```bash
# Если 055 ещё на feature-branch
git checkout 055-yookassa-payments-integration
git pull
git checkout -b 056-yookassa-frontend-integration

# Когда 055 будет merged в main — rebase:
# git checkout 056-yookassa-frontend-integration
# git rebase main
```

---

## 2. Dev server + ngrok

```bash
# Terminal 1: Next.js
cd apps/web
pnpm dev   # → http://localhost:3000

# Terminal 2: ngrok tunnel
ngrok http 3000   # → https://abc123.ngrok.io

# Webhook URL (обновить в ЮKassa test-shop ЛК):
https://abc123.ngrok.io/api/payment/yookassa/webhook
```

**ВАЖНО**: ngrok URL **меняется каждый рестарт** на бесплатном плане. Обновлять в ЛК ЮKassa.

---

## 3. E2E US1 — Card payment (happy path)

### Step 1: Создать корзину

1. Открыть `http://localhost:3000/catalog/`
2. Кликнуть на любой PDU → добавить в корзину
3. Открыть `/cart/`

### Step 2: Checkout как физлицо

1. Кликнуть «Купить как физлицо»
2. Заполнить форму на `/cart/checkout/physical/`:
   - ФИО: «Иванов Иван»
   - Email: `test+1@example.com`
   - Phone: `+79001234567`
   - Адрес: «Москва, Тверская 1»
3. Выбрать тариф доставки → continue

### Step 3: Review + Оплата

1. На `/cart/checkout/physical/review/` проверить сводку Order
2. Кликнуть «Оплатить картой»
3. Ожидать: индикатор загрузки → редирект на ЮKassa-страницу

### Step 4: ЮKassa test card

1. На ЮKassa странице ввести:
   - Card: `5555 5555 5555 4477` (with 3DS)
   - Expiry: `12/27`
   - CVV: `123`
2. На 3DS-странице: пароль `12345678`
3. Customer redirected на `https://abc123.ngrok.io/payment/return/{orderId}`

### Step 5: Verify success-UI

Ожидаемое:
- Через 2-5 сек polling-tick видит `orderStatus=paid`
- UI shows:
  - Большой ✅ + «Заказ оплачен»
  - SO-номер (например `SO-2026-0042`)
  - «Чек 54-ФЗ отправлен на ваш email»
  - CTA «В личный кабинет» / «На главную»
- dataLayer `purchase` event fired (проверить в DevTools console: `window.dataLayer`)

### Step 6: Email verification

1. Проверить mailbox `test+1@example.com` — должен прийти email T-001 «Заказ оплачен»
2. Проверить admin → NotificationJobs → новая запись `template: T-001, status: sent`

---

## 4. E2E US2 — Retry payment

### Setup
1. Создать Order через US1 Step 1-3, но **не оплачивать** на ЮKassa
2. Закрыть browser tab
3. Подождать 30-60 секунд

### Test retry
1. Найти `Order.publicToken` в admin (Orders → последний → publicToken field)
2. Открыть `http://localhost:3000/cart/order/{publicToken}/retry-payment`
3. Click «Оплатить снова»
4. Ожидаемое: redirect на ТУ ЖЕ ЮKassa-страницу (same confirmationUrl)
5. Завершить оплату — success-UI

### Verify
- Только ОДНА запись в admin → Orders для этого checkout (не двойной)
- `Order.payment.idempotenceKey` — тот же

---

## 5. E2E US3 — Payment return UI states

### Test success (sync)
1. Открыть `/payment/return/{orderId}` для уже-paid Order
2. **Без polling** показывается success-UI
3. dataLayer `purchase` event **не** дублируется (если уже был fired ранее)

### Test polling (webhook delay)
1. Block webhook URL временно (через ngrok rules или firewall)
2. Создать Order + оплатить на ЮKassa
3. Customer redirected на `/payment/return/{orderId}`
4. Polling 30 раз = 60 сек
5. Если webhook unblock'нут during polling — UI updates на success
6. Если timeout — UI shows «Платёж обрабатывается, мы пришлём письмо»

### Test failure
1. На ЮKassa использовать decline-card: `5555 5555 5555 4485`
2. Redirect на `/payment/return/{orderId}`
3. UI shows failure-state с «Платёж не прошёл» + retry-button (если в window)

### Test 403
1. Открыть `/payment/return/{orderId}` БЕЗ cookies + БЕЗ `?token=`
2. UI shows «Не удалось проверить вашу сессию» + CTA «Войти»

### Test 404
1. Открыть `/payment/return/non-existent-id`
2. UI shows «Заказ не найден»

---

## 6. E2E US4 — Email templates

### T-015 (payment expired)
1. Создать Order, не оплачивать
2. Через `paymentRetryWindowMin + 5` минут — manually trigger cron:
   ```bash
   curl http://localhost:3000/api/cron/payments-expire \
     -H "Authorization: Bearer ${CRON_SECRET}"
   ```
3. Verify: NotificationJob T-015 создан, email доставлен на `test+1@...`
4. Открыть email — проверить 2 CTA (recovery + new-cart) рендерятся

### T-109 (amount mismatch)
1. Создать Order
2. Manually изменить `Order.totals.total` в admin → теперь сумма не совпадает
3. Оплатить через ЮKassa
4. Webhook handler сравнит amount → mismatch → T-109 уйдёт менеджеру
5. Verify: admin email получил T-109 с table {expected, actual}

### T-110 (receipt failed)
1. Test через webhook payload manipulation (`receipt_registration: "canceled"`) — нужен dev-stub
2. Verify: T-110 уходит менеджеру

### T-111 (refund failed)
1. Создать Return + approve refund
2. На ЮKassa simulate refund failure (refund.canceled event)
3. Verify: T-111 уходит менеджеру

---

## 7. Production deploy checklist

Перед prod-launch:
- [ ] 055 backend merged в main
- [ ] 056 frontend merged в main
- [ ] Webhook URL в ЛК ЮKassa = `https://pdumarket.ru/api/payment/yookassa/webhook`
- [ ] Return URL = `https://pdumarket.ru/payment/return/{orderId}` (verified in 055 create endpoint)
- [ ] `paymentSettings` в admin: `enabled=true`, `webhookSecret` ≥32 chars
- [ ] Vercel cron `/api/cron/payments-expire` зарегистрирован, расписание `*/5 * * * *`
- [ ] Email templates rendering для 4 новых типов (T-015/109/110/111) — проверено в staging
- [ ] dataLayer `purchase` event tracking настроен в GA4 + Yandex Metrica
- [ ] Accessibility Lighthouse audit на `/payment/return/[orderId]` ≥ 90
- [ ] E2E test scenario US1 проходит на test-shop production-grade flow

---

## 8. Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| `/payment/return/{id}` 404 | Server Component не нашёл Order по id | Проверить orderId в URL, проверить admin |
| Polling зависает 60 сек | Webhook не пришёл; ngrok URL устарел | Обновить ngrok URL в ЛК ЮKassa, проверить firewall |
| dataLayer purchase event не fire | `useRef` flag блокирует; SSR vs hydration mismatch | DevTools console: `window.dataLayer`; check React Strict Mode behavior |
| Customer видит «Не удалось проверить сессию» | cart_session expired; нет publicToken в URL | Add `?token=<publicToken>` к ЮKassa return_url |
| Email T-015 не приходит | NotificationJob status: `pending`/`failed` | Admin → NotificationJobs → найти job, проверить error |
| ReviewClient.tsx падает на «Оплатить» | API contract mismatch не fixed | Verify FR-5601 implementation |

---

**End of quickstart.md.**
