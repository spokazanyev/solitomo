# Feature Specification: Cart as a First-Class Entity

**Feature Branch**: `052-cart-as-entity`

**Created**: 2026-05-23

**Status**: Draft

**Input**: Выделить «Корзину» в самостоятельную сущность БД (Payload collection `carts`).
Сейчас корзина живёт исключительно в `localStorage` (см. `apps/web/src/components/rfq/RfqCart.tsx`).
Это блокирует cart-abandonment (T-010 в 049 заглушено), кросс-устройство, аналитику funnel'а
«Cart → Order» и оперативную работу менеджеров с активными корзинами.

## Контекст и связи

- **Канонический документ**: `07-build-specifications/order-lifecycle-spec.md` — Phase 2 «Cart»
  и Phase 11 «Post-sale» (cart-abandonment как маркетинговое событие).
- **Уже реализованы**:
  - 047 (delivery + checkout + lifecycle emitter + Order model);
  - 048 (Twenty CRM sync, использует `Order.cartToken`-аналог в `customer.notes`);
  - 049 (notifications: matrix **готова к расширению**: событие `cart.abandoned` зарезервировано
    в event names; правило `cart.abandoned → T-010` добавляется задачей T032 в рамках 052).
- **Будущие зависимости**:
  - 054 (Customer Account) — потребует merge гостевой корзины при логине (US6).
  - 050 (Telegram bot) — может добавить messenger-канал для cart-abandonment.
    _Примечание (M6)_: M-010 messenger placeholder для `cart.abandoned` — заглушка до 050.
- **Существующий клиент**: `RfqCart.tsx` (localStorage, public API: `useCart`, `AddToCartButton`,
  `CartLink`, `addCartItem`, `mergeCartItems`, и т.д.). НЕ переписываем — оставляем как legacy
  fallback. Новый `CartClient.tsx` живёт рядом, постепенно вытесняет.
- **Источник правды**: после 052 — Payload `carts` collection. localStorage — client-side cache
  для оффлайн/первого тика рендера.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Корзина сохраняется в БД и доступна с любого устройства (Priority: P1)

Покупатель добавляет товар в корзину на сайте. Корзина мгновенно сохраняется в Payload
(`carts` collection), `cartToken` фиксируется в HTTP-only cookie. Если покупатель указал
email на любом шаге checkout, корзина связывается с этим email. С другого устройства
покупатель открывает ссылку из email («ваша корзина») и видит ту же корзину.

**Why this priority**: фундамент для всех остальных историй (US2-US6). Без БД-персистенции
ни abandonment, ни конверсия-аналитика, ни кросс-устройство не работают.

**Independent Test**: добавить товар на desktop → проверить запись в Payload Admin →
открыть `/cart/restore/[token]/` (или ссылку из письма) на другом браузере → корзина
восстановилась идентично.

**Acceptance Scenarios**:

1. **Given** анонимный посетитель, **When** жмёт «В корзину» на карточке товара,
   **Then** на сервере создаётся `carts` запись со `status=active`, `cartToken` сгенерирован
   и записан в HTTP-only cookie `soliton_cart_token`, ответ API содержит updated cart state.
2. **Given** активная корзина с `cartToken=T1`, **When** покупатель добавляет ещё один товар,
   **Then** `PATCH /api/cart/{T1}` мерджит позиции по SKU (как `mergeRfqItems`), `updatedAt`
   и `lastActivityAt` обновляются.
3. **Given** покупатель указал email на checkout-step Identify, **When** Order создан в `draft`,
   **Then** в `carts.customerEmail` записан email, при необходимости отправляется письмо
   «ваша корзина сохранена — продолжите оформление: /cart/restore/[token]/».
4. **Given** клиент открыл `/cart/restore/[token]/` с другого устройства, **When** токен валиден
   и cart не expired, **Then** `cartToken` устанавливается в cookie, items загружаются в UI
   и в localStorage-кэш.
5. **Given** localStorage пустой, но cookie `soliton_cart_token` существует, **When** клиент
   открывает любую страницу, **Then** `CartClient` запрашивает `GET /api/cart/{token}` и
   гидратирует UI из БД.

---

### User Story 2 — Корзина живёт 30 дней и восстанавливается по ссылке (Priority: P1)

Покупатель закрыл вкладку или сменил устройство. В течение 30 дней корзина доступна:
по cookie (то же устройство), по email-ссылке `/cart/restore/[token]/`, по auth (после 054).
После 30 дней без активности корзина переводится в `status=expired` и не показывается
в UI, но остаётся в БД 90 дней для аналитики, потом hard-delete (GDPR).

**Why this priority**: ключ к снижению churn'а и возвратов на сайт; основа для email-маркетинга.

**Independent Test**: создать корзину с `lastActivityAt = now() - 31 day` → запустить cron
`/api/cron/carts-cleanup` → status стал `expired`, GET /api/cart/{token} возвращает 410 Gone.

**Acceptance Scenarios**:

1. **Given** корзина с `lastActivityAt = now() - 29d`, **When** cron, **Then** статус сохраняется
   `active` (или `abandoned`, см. US5), expiresAt не наступил.
2. **Given** корзина с `lastActivityAt = now() - 31d`, **When** cron, **Then** статус становится
   `expired`, emit `cart.expired` (для будущих рассылок).
3. **Given** корзина в `expired`, **When** клиент пытается открыть `/cart/restore/[token]/`,
   **Then** показывается экран «Корзина устарела» с предложением начать заново и оффером.
4. **Given** корзина в `expired` со `lastActivityAt = now() - 91d`, **When** cron, **Then**
   запись физически удаляется (hard delete для GDPR), оставляется только summary-метрика
   в `analytics.cart_funnel` (если есть).

---

### User Story 3 — Конверсия Cart → Order для funnel-аналитики (Priority: P1)

Когда покупатель завершает чекаут, в Order сохраняется `cartId` (relation → `carts`),
а Cart переводится в `status=converted` с `convertedToOrderId`. Это даёт измеримый funnel:
created → active → abandoned/converted/expired, c per-step drop-off.

**Why this priority**: без cartId на Order невозможно построить funnel; без этого мы
не понимаем, какие SKU не доходят до checkout, и не можем оптимизировать конверсию.

**Independent Test**: пройти полный чекаут sandbox-заказа → проверить в Payload Admin
`Order.cartId` указывает на правильный Cart, `Cart.status = converted`, `Cart.convertedToOrderId`
указывает на Order. Через SQL/report-tool построить counts по статусам.

**Acceptance Scenarios**:

1. **Given** Cart `C1` в `active`, **When** Order создан с этим `cartToken`, **Then**
   `Order.cartId = C1.id`, `C1.status = converted`, `C1.convertedToOrderId = Order.id`,
   `C1.convertedAt = now()`.
2. **Given** Cart уже в `converted`, **When** клиент пытается ещё раз добавить товар через
   API того же токена, **Then** API возвращает 409 CART_ALREADY_CONVERTED со ссылкой на
   созданный Order; cookie сбрасывается, клиент получает новый пустой Cart.
3. **Given** Cart в `abandoned`, **When** клиент возвращается и завершает чекаут,
   **Then** Cart переходит из `abandoned` → `converted` напрямую (минуя `active`).
4. **Given** Order создан без `cartToken` (legacy localStorage), **When** Order сохраняется,
   **Then** создаётся synthetic Cart-запись (`status=converted` сразу), `Order.cartId` указывает
   на неё — для единообразия funnel'а.

---

### User Story 4 — Менеджер видит активные корзины в Payload Admin (Priority: P2)

В Payload Admin появляется список `carts` collection с фильтром по `status=active` или
`abandoned`, отсортированный по `lastActivityAt DESC`. Менеджер видит email клиента
(если есть), товары, сумму. Может вручную связаться с клиентом (телефон/email) или
вручную «прикрепить» к существующему Customer (после 054).

**Why this priority**: оперативный outreach увеличивает конверсию; небольшой объём UI-работы
поверх готовой коллекции.

**Independent Test**: открыть Payload Admin → `Carts` collection → фильтр `status=abandoned`,
`customerEmail != null` → видны корзины с CTA «Скопировать email», «Открыть восстановление».

**Acceptance Scenarios**:

1. **Given** менеджер в Admin, **When** открывает `Carts`, **Then** видит таблицу с колонками
   `customerEmail`, `itemCount`, `subtotal`, `status`, `lastActivityAt`, `sourcePage`.
2. **Given** менеджер кликнул «Открыть в режиме клиента», **When** UI генерирует
   `/cart/restore/[token]/` URL, **Then** менеджер может скопировать и отправить клиенту
   из своей почты / Twenty.

---

### User Story 5 — Cart abandonment → T-010 через 049 (Priority: P2)

_Примечание (M7)_: MVP ROI = funnel analytics + restore; US5 T-010 — в Sprint 2.

Через 1 час бездействия (`now() - lastActivityAt > 60min`) cron-задача переводит Cart
в `status=abandoned` и эмитит доменное событие `cart.abandoned`. 049's notification matrix
содержит правило `cart.abandoned → T-010` (email клиенту, только если есть `customerEmail`
и нет opt-out). Письмо со ссылкой `/cart/restore/[token]/`.

**Why this priority**: критично для возврата клиента, но без feature flag можно по умолчанию
выключить (`notificationsSettings.marketing.cartAbandonmentEnabled=false`).

**Independent Test**: создать корзину с email и `lastActivityAt = now() - 65min` → запустить
cron `carts-cleanup` → проверить: 1) статус стал `abandoned`, 2) в `notification-jobs` появилась
запись `event=cart.abandoned, template=T-010, channel=email`.

**Acceptance Scenarios**:

1. **Given** Cart `active`, `lastActivityAt = now() - 30min`, **When** cron, **Then** статус
   не меняется (порог 60min).
2. **Given** Cart `active`, `lastActivityAt = now() - 65min`, `customerEmail` указан,
   `marketingOptIn=true`, **When** cron, **Then** `status=abandoned`, `abandonedAt=now()`,
   emit `cart.abandoned`, в `notification-jobs` создаётся job для T-010.
3. **Given** Cart `active`, `lastActivityAt > 65min`, но `customerEmail` пустой, **When** cron,
   **Then** `status=abandoned` (для аналитики), emit `cart.abandoned`, но 049 пропускает job
   с `reason=no_recipient` (нет email).
4. **Given** уже отправлено T-010, **When** клиент НЕ возвращается, второй cron-tick проходит,
   **Then** повторного письма не отправляется (idempotency через
   `cartId+event+channel+recipient+bucket(24h)`, см. 049 FR-4922).
5. **Given** клиент вернулся, добавил товар, **When** API получил `PATCH /api/cart`,
   **Then** `lastActivityAt = now()`, `status` → `active` (если был `abandoned`),
   `abandonedAt = null`.

---

### User Story 6 — Anonymous → logged-in merge (Priority: P3)

После релиза 054 (Customer Account): гость добавил товары → залогинился → его гостевая
корзина мерджится с корзиной, привязанной к Customer (если такая есть). Логика merge'а
аналогична `mergeRfqItems` (sum quantities по SKU). Гостевая запись помечается `status=merged`
со ссылкой на target.

**Why this priority**: 054 ещё не релизнута; делаем architectural placeholder, но без UI/auth
не реализуется до 054.

**Independent Test**: после 054 — создать гостевую корзину `Cg`, создать аккаунт через 054,
залогиниться → проверить: items из `Cg` оказались в `Cu` (user cart), `Cg.status=merged`,
`Cg.mergedIntoId=Cu.id`.

**Acceptance Scenarios**:

1. **Given** гость с Cart `Cg`, customer C1 не имеет активной корзины, **When** C1 логинится,
   **Then** `Cg.customerId = C1.id`, `Cg.status = active` (просто привязка).
2. **Given** гость с Cart `Cg`, customer C1 имеет активную Cart `Cu`, **When** C1 логинится,
   **Then** items мерджатся в `Cu`, `Cg.status=merged`, `Cg.mergedIntoId=Cu.id`, cookie
   `soliton_cart_token` обновляется на `Cu.cartToken`.
3. **Given** конфликт SKU (разные `priceAtAdd`), **When** merge, **Then** берётся priceAtAdd
   из target Cart (`Cu`) — как «более свежий» (item.addedAt позже).

---

### Edge Cases

- **Товар удалён из каталога между add и checkout**: при `GET /api/cart/{token}` сервер делает
  re-validation каждого item.productId; если product удалён или snapshot цены изменился >5%,
  возвращает поле `items[].warning` ("removed" | "price_changed"), UI показывает баннер
  «состав корзины изменился».
- **Цена в товаре изменилась**: `priceAtAdd` сохраняет историческую цену; на checkout
  re-validate; при delta > max(5%, 100₽) — UI запрашивает подтверждение (аналогично 047
  Phase 6 для доставки).
- **Два устройства редактируют одну корзину**: last-write-wins по `updatedAt`; конфликт
  лога не строим (не e-commerce-критично). Каждое устройство получает свежий state через
  WebSocket-less polling каждые 30 сек (опц.) или просто на mutation.
- **Cookie потеряна (clear cookies), но в localStorage есть items**: на первой mutation
  создаём новую `carts` запись с теми items'ами как seed; старая (orphaned) cart остаётся
  в БД до expiry.
- **Анонимная корзина без email через 30 дней**: переходит в `expired`, никаких писем
  (нет recipient'а); просто dropped from funnel.
- **`cartToken` подобран злоумышленником**: токен генерируется как 128-bit URL-safe random
  (Node `crypto.randomUUID()` + дополнительный entropy); rate-limit на `GET /api/cart/{token}`
  10 req/min/IP; для GDPR — только `customerEmail` и items видны, никаких financial deltas.
- **Импорт legacy localStorage-only корзин**: при первой загрузке `CartClient` если есть
  `soliton-rfq-items` в localStorage, но нет cookie → автоматически создаёт `carts` запись
  с этими items, ставит cookie, очищает старый localStorage-ключ.
- **GDPR / 152-ФЗ**: эндпоинт `DELETE /api/cart/{token}` (или Admin action) — hard delete
  по запросу субъекта данных. Audit log в `AdminChangeLog` (без PII).

## Requirements *(mandatory)*

### Functional Requirements

#### Schema & Persistence

- **FR-5201**: System MUST создавать Payload collection `carts` (см. data-model §1) при первой
  mutation от анонимного посетителя; `cartToken` генерируется server-side как cryptographically
  secure random (минимум 128 bit) и записывается в HTTP-only, SameSite=Lax cookie
  `soliton_cart_token` с `Max-Age=30d`.
- **FR-5202**: System MUST хранить items в `carts.items[]` со snapshot полей:
  `{sku, name, qty, priceAtAdd, addedAt, productId?}`. Snapshot нужен, чтобы изменения
  каталога не влияли на исторические корзины.
- **FR-5203**: System MUST поддерживать статусы `active | abandoned | converted | expired | merged`
  с правилами переходов (см. data-model §3 «State machine»).
- **FR-5204**: System MUST индексировать `cartToken` (unique), `customerEmail`,
  `(status, lastActivityAt)`, `expiresAt` для производительности (см. data-model §4).

#### API surface

- **FR-5210**: System MUST экспонировать `GET /api/cart/{token}` для чтения корзины
  (без авторизации, по токену). 404 если token не существует, 410 если `expired`.
- **FR-5211**: System MUST экспонировать `POST /api/cart` для создания (server-generated token,
  если cookie нет) и `POST /api/cart/{token}/items` для добавления item.
- **FR-5212**: System MUST экспонировать `PATCH /api/cart/{token}` для изменения qty / mergePatch
  items, `DELETE /api/cart/{token}/items/{sku}` для удаления item, `DELETE /api/cart/{token}`
  для очистки/удаления всей корзины.
- **FR-5213**: System MUST экспонировать `POST /api/cart/merge` для US6 (logged-in merge,
  заглушка до 054). В 052 endpoint возвращает 501 NotImplemented с описанием.
  _Примечание (M2)_: POST/DELETE items — для UI (add/remove + analytics granularity);
  PATCH op — для batch/migration.
- **FR-5214**: Все mutate-эндпоинты MUST быть idempotent: повторный POST с тем же
  `Idempotency-Key` header (если задан) возвращает кешированный ответ в течение 5 минут.
- **FR-5214a**: `PATCH /api/cart/{token}` с `op=setItems` MUST принимать header
  `If-Match: {updatedAt}`. При mismatch — 409 `cart_stale`. Для `op=mergeItems/setQuantity/removeItem`
  (коммутативные) — If-Match не обязателен.
- **FR-5212a**: Rate-limit `POST /api/cart` без cookie: 5/min, 30/day per IP.

#### Migration from localStorage

- **FR-5215**: System MUST поддерживать «boot migration» в `CartClient.tsx`: на mount,
  если cookie `soliton_cart_token` отсутствует, но `localStorage["soliton-rfq-items"]` есть,
  делать `POST /api/cart` с seed-items, ставить cookie из ответа, очищать legacy localStorage key.
- **FR-5215a**: Legacy localStorage ключ очищается при успешной гидратации из БД,
  не только при mutation.
- **FR-5216**: System MUST оставить legacy `RfqCart.tsx` неизменным как fallback. Новый
  `CartClient.tsx` живёт параллельно. Переключение через feature flag
  `NEXT_PUBLIC_CART_PERSISTENCE=db`. Default в production после QA — `db`.
- **FR-5217**: localStorage остаётся как client-cache: после ответа API `CartClient` пишет
  state в `localStorage["soliton-cart-state"]` (новый ключ) для мгновенного рендера при следующем
  открытии страницы (источник правды — БД, кэш sync'ится на window focus и cart mutation).

#### Conversion to Order

- **FR-5220**: При создании Order (см. 047 Phase 7) System MUST принимать в payload `cartToken`,
  находить `carts` запись, копировать `Order.cartId = cart.id`, переводить `cart.status=converted`,
  `cart.convertedToOrderId = order.id`, `cart.convertedAt = now()`.
- **FR-5220a**: `Cart.status=converted` устанавливается на переходе `Order.status → pending_payment`
  (после finalize-shipping). Cart immutable с этого момента (PATCH возвращает 409).
  При `Order → expired/cancelled` до `paid` → Cart возвращается в `active` (recoverable).
  Расширить state-machine: `converted → active` при `Order.status ∈ {cancelled, expired}`
  AND `Order.payment.paidAt IS NULL`.
- **FR-5221**: System MUST расширить `orders` collection полем `cartId` (relation → `carts`,
  optional для legacy совместимости с до-052 заказами).
- **FR-5222**: Если Cart уже `converted`, при попытке снова создать Order по тому же токену
  → API возвращает 409 CART_ALREADY_CONVERTED с `orderId` в payload; клиент сбрасывает cookie
  и создаёт новую Cart.
- **FR-5223**: Если Order создаётся БЕЗ `cartToken` (legacy / прямой checkout), System MUST
  создать synthetic `carts` запись (`status=converted` сразу) — для единообразия аналитики.
- **FR-5223a**: При `Order.cancelled/expired` до `paid` (в 24h окне) → Cart `converted → active`,
  clear `convertedToOrderId`. При `Order.returned` (053) — НЕ восстанавливать Cart.

#### Lifecycle (TTL, abandonment, expiry)

- **FR-5224**: System MUST реализовать cron `/api/cron/carts-cleanup` с защитой `CRON_SECRET`
  (как остальные крон-эндпоинты в `apps/web/src/app/api/cron/`), запуск каждый час
  (Vercel cron или внешний scheduler). Cron делает:
  - переводит `active` → `abandoned` при `lastActivityAt < now()-60min` и `customerEmail`
    либо есть (email→рассылка), либо нет (только аналитика);
  - переводит `active|abandoned` → `expired` при `lastActivityAt < now()-30d`;
  - hard delete (или анонимизация) при `status=expired` и `lastActivityAt < now()-90d` (GDPR);
  - эмитит `cart.abandoned` и `cart.expired` через `emitDomainEvent` (047 emitter).
- **FR-5225**: Пороги (60min, 30d, 90d) MUST быть конфигурируемыми через Payload global
  `notificationsSettings.marketing.cartAbandonmentDelayMin` (уже есть в 049) и новые
  `cartExpiryDays`, `cartHardDeleteDays`.

#### Marketing consent

- **FR-5224a**: `Cart.marketingOptIn` = boolean, default false. Источники true: явный checkbox
  в checkout S04 (Identify) ИЛИ принятый consent-banner на `/cart/restore/[token]/`.

#### Merge / multi-device

- **FR-5226**: System MUST на каждом `GET /api/cart/{token}` обновлять `lastActivityAt`
  только если запрос содержит mutation OR cookie был только что выставлен; чтение через
  email-restore link обновляет `lastActivityAt = now()` (явный возврат интереса).
- **FR-5226a**: Checkout-step навигация и finalize-shipping вызывают
  `PATCH /api/cart/{token}` с `op=touch` (продление `lastActivityAt`). Предотвращает
  abandoned-статус во время оформления заказа.
- **FR-5227**: Multi-device merge (US6) на 052 — заглушка `POST /api/cart/merge` → 501
  NotImplemented. Полная реализация — в 054.
- **FR-5227a**: При logout — очищать `soliton_cart_token` cookie; при login — поиск active
  cart по `customerId`, если найдена → cookie ← найденный token; если нет → текущий cookie
  обновляется `customerId = me.id`. (Реализация в 054.)
- **FR-5227b**: Merge-rules при конфликтах по SKU (реализация в 054, контракт фиксируется в 052):

  | Поле | Правило |
  |------|---------|
  | qty | sum, capped at max |
  | priceAtAdd | from latest `addedAt` |
  | name/image/slug | from target (Cu) |
  | warning | reset to `none` |
  | utm/sourcePage | from target Cu |

#### Draft-order integration

- **FR-5234**: После 052 draft-order.ts (047) НЕ хранит items (только customer/address/tariff/snapshot);
  items берутся из Cart по `cartToken`.

#### Price revalidation

- **FR-5232**: Ревалидация `priceAtAdd` выполняется в afterRead hook (cached 60s). Алгоритм:
  если `|currentPrice - priceAtAdd| / priceAtAdd > 0.05` OR `abs > 100₽` →
  `items[i].warning = 'price_changed'`. На finalize-shipping — повторная проверка
  с PriceMismatchModal. `priceAtAdd` не меняется до явного подтверждения клиентом.

#### Privacy / GDPR

- **FR-5228**: System MUST поддерживать ручное удаление корзины по email клиента (admin action
  в Payload Admin / API): hard delete + audit log без PII.
- **FR-5228a**: GDPR hard-delete для гостя через `POST /cart/{token}/delete-request` +
  confirmToken по email.
- **FR-5229**: System MUST маскировать `customerEmail` в server-logs как `***@domain`
  (правило из 049 FR-4906).
- **FR-5230**: System MUST не помещать `cartToken` в URL clear-text для текущей корзины (только
  в restore-link, который короткоживущий через signed-token обвязку — см. data-model §5).
  Cookie — HTTP-only, не доступна через JS (защита от XSS).

### Key Entities

- **Cart**: новая Payload collection (`carts`). Атрибуты: id, cartToken (unique), customerEmail?,
  customerId? (relation → customers, fwd-ref для 054),
  companyId? (relation → companies, nullable, forward-ref для 054),
  marketingOptIn (boolean, default false), items[], totals, status,
  convertedToOrderId? (relation → orders), createdAt, updatedAt, lastActivityAt, abandonedAt,
  expiresAt, sourcePage, utm{}. См. `data-model.md` §1.
- **CartItem (embedded)**: `{sku, name, qty, priceAtAdd, addedAt, productId?, warning?}`.
- **Order расширение**: новое поле `cartId` (relation → carts, optional).
- **DomainEvent расширения** (через 047 emitter): `cart.created`, `cart.updated`, `cart.abandoned`,
  `cart.recovered`, `cart.converted`, `cart.expired`, `cart.merged`. Cart events используют
  отдельные типы `CartSnapshot` и `emitDomainEvent({ kind: 'cart.*', cart: CartSnapshot })`
  через расширенный emitter (решение: вариант A — union типа, `order` optional).
  Subscribers фильтруют по `kinds[]`. (FR-5233; см. 047 contracts/event-payload.ts).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% новых добавлений «в корзину» создают запись в `carts` (zero loss),
  проверяется sandbox-прогоном за 7 дней после rollout.
- **SC-002**: Cross-device restore success rate ≥ 95% (клиент кликнул ссылку из email
  и увидел корзину) — отслеживается через `cart_restore_success` event в DataLayer.
- **SC-003**: Funnel-репорт `created → abandoned → converted` доступен в Payload Admin за SQL ≤ 1 sec
  для last-30d window.
- **SC-004**: ≥ 80% корзин с `status=abandoned` и `customerEmail!=null` получают T-010
  в течение SLA (зависит от 049 SLA).
- **SC-005**: 0 потерянных корзин из-за expire (за 30 дней). Hard-delete после 90 дней — 100%
  для GDPR compliance.
- **SC-006**: Конверсия `cart.created → order.paid` (per-week) измерима и trend'ит к +5%
  после внедрения cart-abandonment T-010 (vs. baseline до 052).
- **SC-007**: TTL/abandonment cron не превышает 30 сек на 10 000 корзин (p95).

## Assumptions

- Email-провайдер выбран и работает (049 завершено) или включён feature flag
  `cartAbandonmentEnabled=false` до выбора.
- 047 emitter `emitDomainEvent` доступен для импорта из `src/lib/lifecycle/`.
- Добавить `clientNumber?: string` в `OrderSnapshot` и `buildOrderSnapshot()` (задача 051).
- Twenty CRM sync (048) на корзины НЕ распространяется (только Orders), но `cart.converted`
  event может в будущем создавать Activity «Lead converted from cart».
- `RfqCart.tsx` остаётся для legacy fallback; новый `CartClient.tsx` — отдельный файл.
- Customer Account (054) ещё не релизнут; `customerId` поле — fwd-ref, заполняется только
  для migrated/converted записей через ручные admin actions.
- Backfill: передавать `req.context.skipImmutability = true` при миграции существующих корзин.

## Out Of Scope

- **Cart promo codes / discounts** — отдельная спека (055?).
- **Wishlists** (избранное) — отдельная сущность, не carts.
- **Multi-currency** — все цены в RUB (как сейчас).
- **Bulk price tiers** — отдельная спека по B2B price lists.
- **Cart sharing между несколькими customers** (shared cart) — не нужен для B2B SMB сценария.
- **WebSocket sync** между устройствами в реальном времени — polling/refresh достаточно.
- **Реальная реализация `POST /api/cart/merge` для US6** — отложено до 054.
- **Cart-аналитика дашборд** — отдельный admin-плагин или Metabase view, не часть 052.
