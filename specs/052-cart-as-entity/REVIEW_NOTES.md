# Review 052 — итоговый отчёт

**Дата ревью**: 2026-05-23 (обновлено 2026-05-24)
**Reviewer**: agent (по запросу Sergey)
**Спека**: `specs/052-cart-as-entity/{spec.md, plan.md, data-model.md, tasks.md, contracts/cart-api.openapi.yaml}`
**Cross-ref**: 047 (checkout/finalize-shipping + lifecycle emitter), 048 (CRM), 049 (notifications matrix + T-010), 050 (Telegram bot — placeholder), 054 (Customer Account), `07-build-specifications/order-lifecycle-spec.md` (canonical), `apps/web/src/components/rfq/RfqCart.tsx`, `apps/web/src/lib/lifecycle/events.ts`.

## Сводка

**24 находки**: CRITICAL=7, HIGH=7, MEDIUM=7, LOW=3. **Готовность: WITH FIXES** — спека качественная, structure sound, но 7 критичных вопросов должны быть закрыты до начала T001 (особенно: момент конверсии Cart→Order, marketingOptIn field, расширение DomainEventKind).

## CRITICAL

| # | Файл / место | Описание | Предложение |
|---|---|---|---|
| C1 | `spec.md:20-22` (ссылка на 049 matrix) и `specs/049-customer-notifications/contracts/notification-events.md:103-140` | Фактическая некорректность: spec пишет «049 matrix содержит `cart.abandoned → T-010`», но в `notification-events.md` matrix этого правила НЕТ — только event-name в строке 15. См. подробно §C1 ниже. | Переформулировать в spec.md и явно указать, что rule добавляется задачей T032. |
| C2 | `spec.md` FR-5220, 047 `draft-order.ts` | Момент `Cart.status=converted` не зафиксирован: на `Order.draft` (после Identify) или на `pending_payment` (после finalize-shipping) или на `paid` (webhook). Влияет на recovery при cancellation. См. §C5. | Зафиксировать: переход на `pending_payment`; на `cancelled/expired` до `paid` возвращать `converted → active`. Расширить state-machine. |
| C3 | `data-model.md §1` items.priceAtAdd; `spec.md` Edge Cases | `priceAtAdd` revalidation описан только в Edge Cases, нет FR, не зафиксировано место (GET? finalize-shipping? оба?) и алгоритм; нет cache TTL. См. §A4. | Добавить FR-5232 с явным алгоритмом и кэшированием. |
| C4 | `data-model.md §1` (items) — поле отсутствует | `marketingOptIn` на Cart **отсутствует**, но T-010 (US5) требует его. Без поля US5.AS2 невыполним. См. §A8. | Добавить `marketingOptIn: boolean (default false)` в Cart fields + FR-5224a (источники true). |
| C5 | `apps/web/src/lib/lifecycle/events.ts:18-34` (`DomainEventKind`) | `OrderSnapshot` строго типизирован для Order. 052 хочет эмитить `cart.*` через тот же emitter, но контракт не позволяет (поле `order: OrderSnapshot` required). Не определено: ломаем сигнатуру или вводим `emitCartEvent`. См. §B5. | FR-5233 — выбрать вариант (A) отдельный `emitCartEvent` + `CartSnapshot` union, либо (B) сделать `order` optional. Решение нужно ДО T011. |
| C6 | `contracts/cart-api.openapi.yaml` — `PATCH` нет `If-Match` | Двухдевайс-сценарий «last-write-wins по updatedAt» приводит к скрытой потере удалений (см. §A6). Нет optimistic-lock в API. | Добавить FR-5214a, header `If-Match: {updatedAt}` для `PATCH ?op=setItems`, 409 `cart_stale` при mismatch. |
| C7 | `data-model.md §1` — поле отсутствует; 054 FR-5404 | 054 FR-5404 явно говорит «carts расширяется customerId И companyId». 052 содержит только `customerId`. Это означает миграцию в 054 (вторая миграция той же таблицы) ИЛИ blocking-gap. См. §C3 ниже. | Добавить `companyId?` в Carts.ts как fwd-ref nullable, чтобы 054 не делал миграцию. |

## HIGH

| # | Файл / место | Описание | Предложение |
|---|---|---|---|
| H1 | `spec.md` FR-5226, US2, US5 | «активность» для TTL/abandonment определена двусмысленно (см. §A1): GET pageview, finalize-shipping (047 не идёт через `/api/cart`) — не зашиты. Клиент, заполняющий адрес 70 минут, может получить T-010. | Добавить FR-5226a: явный список triggers + touch-эндпоинт `PATCH ?op=touch` на checkout-навигации. |
| H2 | `spec.md` US6.AS3, `data-model.md §1` (merge state) | Merge-rules (US6) при коллизиях по SKU не описаны полностью: что с разными priceAtAdd / name / utm / sourcePage / warning. См. §A3. | FR-5227b — таблица merge-rules; зафиксировать сигнатуру `mergeCarts()` в 052 (реализация в 054). |
| H3 | `spec.md` US3.AS2, FR transition matrix | Что делать с Cart при `order.cancelled` (до отгрузки) или `order.returned` (053). Сейчас `converted → active` запрещено — Cart нельзя восстановить. См. §A5. | FR-5223a — разрешить `converted → active` при `cancelled/expired` до paid в 24h окне; запретить при `returned` (053 cascade). |
| H4 | `spec.md` US5 vs 049 spec строка 115 | Cart-abandonment = маркетинговая коммуникация (требует opt-in 152-ФЗ). В 047 чекауте сейчас НЕТ checkbox согласия. Source of consent не определён. См. §A8. | FR-5224a — где собирается marketingOptIn (047 Identify step + restore page banner); default=false. Согласовать с юристом. |
| H5 | `contracts/cart-api.openapi.yaml` — нет rate-limit FR | OpenAPI описывает «60 req/min/IP mutate», но нет защиты на анонимный `POST /api/cart`: ботнет может надувать БД 86k cart/день/IP. См. §B2. | FR-5212a — на `POST /api/cart` без cookie: 5/min, 30/day на IP. Расширить T041. |
| H6 | 047 vs 052 — overlap с `soliton_checkout_draft` | После 052 draft-order.ts (047) дублирует items, которые теперь в Cart. Не описано, что draft хранит, а что — Cart. См. §C2. | FR-5234 — draft хранит только customer/address/tariff/snapshot; items всегда из Cart по token. Тесты на «cart изменился между шагами checkout». |
| H7 | `tasks.md` T032 vs C1 | T032 «расширить 049 matrix» — это изменение чужой спеки, но не помечено как cross-cutting (нет бампа версии 049 spec). | Явно указать в T032: апдейт `specs/049-customer-notifications/contracts/notification-events.md` matrix + bump 049 spec version. |

## MEDIUM

| # | Файл / место | Описание | Предложение |
|---|---|---|---|
| M1 | `spec.md` FR-5239+US1 | Стратегия cookie при logout/login (после 054): что с cart user A на устройстве после logout? Что с conflict «два user'а на одном устройстве»? См. §A2. | FR-5227a — clear cookie на logout; search active cart by customerId на login. |
| M2 | `contracts/cart-api.openapi.yaml` — оба POST и PATCH | Дублирующиеся endpoints (`POST /items` vs `PATCH ?op=mergeItems`, `DELETE /items/{sku}` vs `PATCH ?op=setItems`). Не описано когда что. См. §B1. | Зафиксировать в OpenAPI: POST/DELETE — для UI-add/remove + analytics granularity; PATCH — batch/migration. |
| M3 | `spec.md` FR-5228, OpenAPI delete | GDPR hard-delete для гостя без auth — как клиент инициирует, какие именно поля затираются. См. §B3. | FR-5228a — flow с `delete-request` + confirmToken по email; правила анонимизации. |
| M4 | `spec.md` FR-5215 / Edge Cases legacy migration | Legacy `soliton-rfq-items` localStorage очищается ТОЛЬКО при первой mutation. Pure-viewing user будет нести его навсегда. SSR-flicker не зашит. См. §B4. | FR-5215a — очищать legacy ключ при успешной гидратации из БД, не только при mutation. |
| M5 | `spec.md` US3.AS3 (abandoned→converted) | Не описан emit-flow: эмитить ли оба `cart.recovered` + `cart.converted`, или только `cart.converted`. Нет события `cart.recovered` в data-model §7. См. §D3. | Добавить `cart.recovered` в §7; правило: на возврат из `abandoned → active` — emit; на «прямой» путь `abandoned → converted` — оба. |
| M6 | 050 (Telegram) + 049 matrix | Нет M-010 messenger placeholder для `cart.abandoned`; spec.md формулирует «может». См. §B8. | Добавить assumption и заглушку в 049 matrix `cart.abandoned → messenger → M-010 (требует messengerOptIn, skipped до 050)`. |
| M7 | `spec.md` US5 priority P2 | Cart-abandonment = главная бизнес-мотивация 052 (вторая строка spec.md), но P2. Без US5 ROI = только funnel-аналитика. См. §D1. | Решение: либо повысить до P1, либо явно зафиксировать в plan «MVP ROI = funnel only, T-010 в Sprint 2». |

## LOW

| # | Файл / место | Описание | Предложение |
|---|---|---|---|
| L1 | `data-model.md §5` restore-tokens | Out-of-scope «signed short-tokens» для restore. Косвенно блокирует «share cart with colleague». См. §B7. | Зафиксировать «share cart» явно в Out Of Scope (сейчас просто умолчание). |
| L2 | 047 `soliton_checkout_draft` (30 мин) vs 052 `soliton_cart_token` (30 дней) | Cookie scope согласован, но в spec.md нет упоминания. Менеджер при чтении может перепутать. См. §B6. | Добавить в plan.md Risk / Out Of Scope: «draft cookie — отдельная сущность 047, не замещается». |
| L3 | `data-model.md §1` items.maxRows=100 vs RfqCart cap 50 | Текущая RfqCart capп 50 items. 052 — 100. Не критично, но расхождение. | Зафиксировать в migration-notes, что новый cap=100. |

## Заключение

- **Готовность**: WITH FIXES — спека готова к работе, но 7 критичных блокеров (C1-C7) должны быть закрыты до старта T001. Без C2/C5 архитектурные решения принимаются «на лету» во время реализации, что грозит rework.
- **Минимальный набор фиксов до старта**:
  1. Исправить C1 (factual error в spec.md ll. 18-22 + явно описать обязательность T032).
  2. Зафиксировать C2 (точка `converted` = `pending_payment`) + расширить state-machine `converted → active` для recovery (closes H3).
  3. Добавить C4 (marketingOptIn field в data-model + FR-5224a) и C5 (решение по `emitCartEvent` API).
  4. Добавить C6 (If-Match header в PATCH) и C7 (`companyId` в data-model как fwd-ref).
  5. Добавить C3 (FR-5232 — revalidation algorithm).
- **Главный риск**: расхождение между 052 (источник правды — Cart) и 047 (источник правды для checkout — `draft-order.ts` cookie) приведёт к ситуации, когда после finalize-shipping Cart содержит одни items, а draft (с финальными ценами от ApiShip) — другие. Без H6 (FR-5234) каждый шаг checkout должен явно решать «кому верить» → рискуем рассинхроном на UX-уровне. **Cart abandonment T-010 без явного marketing-consent flow в 047** — второй риск (152-ФЗ).
- **Что OK**: structure spec.md (US/FR/Edge Cases), HTTP-only cookie + SameSite=Lax, backward-compat с RfqCart, GDPR 90d hard-delete, idempotency, OpenAPI detail level, tasks.md MVP-path. Спека качественная, finding'и — про edge cases и cross-spec coordination, не про fundamentals.

---

## A. Ambiguous (требуют решения владельца до старта реализации)

### A1. Определение «активности» для TTL 30d / abandonment 60min
**Где**: spec.md FR-5224, US2, US5; data-model.md §1 `lastActivityAt`.
**Проблема**: `lastActivityAt` обновляется только на mutate-эндпоинтах (PATCH/POST items) и на restore-ссылке (FR-5226). Не учитывается:
- открытие `/cart/` (просмотр, без изменения) — продлевает ли TTL?
- продолжение чекаута (на `/cart/checkout/physical/`, без add_to_cart) — продлевает?
- finalize-shipping POST из 047 (не идёт через `/api/cart/*`) — продлевает?

**Текущая формулировка (FR-5226)**: «на каждом `GET /api/cart/{token}` обновлять `lastActivityAt` только если запрос содержит mutation OR cookie был только что выставлен» — двусмысленно: GET вообще не содержит mutation; «только что выставлен» — это какой временной интервал?

**Решение нужно**: явный список triggers, продлевающих `lastActivityAt`:
1. POST/PATCH/DELETE на `/api/cart/*` — да.
2. GET с `?activity=true` (restore link) — да.
3. Пассивный GET (`?activity=false`) при гидратации — НЕТ (текущая трактовка).
4. Pageview на `/cart/`, `/cart/checkout/*` — **не зашит**, решение?
5. finalize-shipping (047) — **не зашит**, решение?

**Рекомендация**: добавить FR-5226a — checkout-step навигация (`/cart/checkout/*`) и finalize-shipping вызывают `PATCH /api/cart/{token}` с пустым `op=touch` (или эквивалент), чтобы не дать корзине стать `abandoned` пока клиент проходит чекаут. Иначе клиент, заполняющий адрес 70 минут, получит T-010 в момент оформления.

---

### A2. `cartToken` — per browser vs per user; что при логине в середине сессии
**Где**: spec.md FR-5239 (FR-5201), US1, US6; data-model.md §1.
**Проблема**: токен — анонимный, лежит в HTTP-only cookie. При логине (после релиза 054) возможны сценарии:
1. У залогиненного customer'а **нет** активной корзины — анонимная привязывается (US6.AS1, описано).
2. У customer'а **есть** активная корзина — merge (US6.AS2, описано, но логика merge неполная — см. A3).
3. Customer **выходит** из аккаунта на том же устройстве — корзина продолжает жить (`customerId` сохраняется в БД, но cookie остаётся)? Или новый анонимный токен?
4. На одном устройстве **меняются** учётные записи (logout user A → login user B) — токен переключается на cart user B? Что с cart user A?

**Решение нужно**: явные правила для logout/swap user.

**Рекомендация**: добавить FR-5227a (после 054): при logout — клиринг `soliton_cart_token` cookie; при login — поиск активного `carts WHERE customerId = me.id`, если есть → cookie ← найденный; если нет → текущий cookie обновляется `customerId = me.id`.

---

### A3. Merge при логине (US6) — правила слияния items по SKU
**Где**: spec.md US6.AS3, FR-5226 (заглушка), data-model.md §1 (merge state).
**Проблема**: US6.AS3 пишет «берётся priceAtAdd из target Cart (Cu) — как «более свежий» (item.addedAt позже)». Но в `mergeRfqItems` (текущая логика, `apps/web/src/components/rfq/RfqCart.tsx:56-89`) — qty суммируются, цены не сравниваются. Не описано:
1. Что, если `priceAtAdd` в source ниже, чем в target — берём дешевле для клиента (best-effort UX)? Или дороже (anti-abuse)?
2. Что, если `Cu.items[SKU].qty + Cg.items[SKU].qty > 9999` (maxRows из data-model items)?
3. Что, если items пересекаются по `(sku, productId)` но **разные** в snapshot полях `name` или `image` (товар переименован)? Какая запись «выигрывает»?
4. Что с `warning` полем после merge — сбрасывается на `none`?
5. Что, если у source/target разные `utm{}` — какие сохраняются? (важно для атрибуции конверсии).

**Решение нужно**: matrix конфликтов с явными правилами.

**Рекомендация**: FR-5227b — таблица merge-rules:
- qty: sum, capped at max(qty).
- priceAtAdd: from latest `addedAt` (текущая трактовка); добавить fallback — если у одного null, берём другой.
- name/image/slug: from target (Cu) — он «активный».
- warning: reset to `none`, пересчёт на следующем GET.
- utm: от target Cu (он привязан к авторизованному, который мы оптимизируем).
- sourcePage: target.

Реализуется в 054, но **fixate в 052** контракт `lib/cart/merge.ts::mergeCarts()` сигнатуру и тест-сценарий.

---

### A4. `priceAtAdd` — фиксируется навсегда vs обновляется при просмотре
**Где**: data-model.md §1 items.priceAtAdd; spec.md Edge Cases «Цена в товаре изменилась».
**Проблема**: edge case говорит «`priceAtAdd` сохраняет историческую цену; на checkout re-validate; при delta > max(5%, 100₽) — UI запрашивает подтверждение». Однако:
1. **Не зашито в FR** — это только Edge Case description.
2. Где именно re-validate? На `GET /api/cart/{token}` (с warning=price_changed)? На finalize-shipping? На обоих?
3. Если делать re-validate на GET — это N запросов в `products` за N items на каждый GET → перф-проблема. data-model §1 hooks.beforeChange не описывает re-validation.
4. Какая «текущая» цена считается актуальной — `products.price` или `products.priceListPrice` (если есть динамика по контракту B2B)?

**Решение нужно**: точное место re-validation и алгоритм.

**Рекомендация**: добавить FR-5232 — re-validation выполняется **только** в afterRead hook на чтении API (cached 60s); алгоритм: `if (currentPrice - priceAtAdd) / priceAtAdd > 0.05 OR abs > 100 ₽ → items[i].warning='price_changed'`. На finalize-shipping (047) — повторная проверка с тем же порогом, аналогично PriceMismatchModal. `priceAtAdd` сам **не меняется** до явного «принять новую цену» клиентом.

---

### A5. Cart `status=converted` — что при возврате (053)
**Где**: spec.md US3.AS2 (отвергает мутации на converted); связан с 053 (returns).
**Проблема**: после возврата клиент может захотеть «купить заново те же позиции». В US3.AS2 написано «cookie сбрасывается, клиент получает новый пустой Cart». Не описано:
1. Есть ли UX «повторить заказ из предыдущей корзины»? Если да — где: на `/cart/`, на `/account/orders/[id]/` (054)?
2. При статусе `Order.returned` (053) → нужно ли восстанавливать `Cart.status` обратно в `active`? Скорее всего НЕТ (Cart converted = снимок прошлого), но это нужно зафиксировать.
3. Что если Order **отменён до отгрузки** (`order.cancelled`) — Cart восстанавливается? Сейчас в transition matrix (data-model §3) `converted → active` запрещено (нет admin-исключения).

**Решение нужно**: что делать с Cart при `order.cancelled` / `order.returned`.

**Рекомендация**: FR-5223a — при `order.cancelled` до отгрузки и в течение 24h после конверсии → восстанавливать Cart (`converted → active`, очистить `convertedToOrderId`). При `order.returned` (053) — НЕ восстанавливать, items snapshot уходит в 053 как `return.items[]`. Это требует расширения transition matrix.

---

### A6. Два устройства редактируют одну корзину — конкурентность
**Где**: spec.md Edge Cases «Два устройства редактируют одну корзину», plan.md Risk «Race condition при одновременных PATCH».
**Проблема**: «last-write-wins по `updatedAt`» — но это поведение **БД**, а не приложения. Сценарий:
- Устройство A: GET → state v1 (3 items). Локально удаляет item X (UI shows 2 items).
- Устройство B: GET → state v1 (3 items). Локально добавляет item Y (UI shows 4 items).
- A: PATCH `setItems=[2 items]` → DB v2.
- B: PATCH `setItems=[4 items]` → DB v3 (item X **возвращён**, item Y добавлен).

Пользователь A видит, что item X внезапно вернулся (или не видит, пока не сделает refresh — но он уже ушёл из приложения).

**Решение нужно**: оптимистичная блокировка или явная стратегия конфликта.

**Рекомендация**:
1. На PATCH `setItems` всегда требовать `If-Match: {updatedAt}` header (опц. fallback на «без проверки»).
2. На `mergeItems` / `setQuantity` / `removeItem` — операции коммутативны, last-write-wins ОК.
3. Это **новый FR-5214a** (расширяет FR-5214 idempotency).
4. В contracts: добавить header `If-Match` в `PATCH /api/cart/{token}` и ответ 409 `cart_stale` при mismatch.

Сейчас contracts/openapi не упоминает `If-Match`.

---

### A7. Cart без email + cartToken — но как «вы забыли корзину» послать
**Где**: spec.md US5.AS3, FR-5224.
**Проблема**: US5.AS3 пишет «cart `active`, `lastActivityAt > 65min`, но `customerEmail` пустой, **Then** `status=abandoned` (для аналитики), … 049 пропускает job с reason=no_recipient». То есть **переход состояния происходит без письма** — для funnel.

Это согласовано с 049's `requires: marketingOptIn` (см. notification-events.md), но **не описано** в матрице. В `49/contracts/notification-events.md` `cart.abandoned` упомянут только в Event names (строка 15), правила в matrix НЕТ.

**Решение нужно**: добавить правило в 049 matrix в рамках T032.

**См. C1** в Conflicts.

---

### A8. Согласие на маркетинговые письма для T-010 (транзакция или маркетинг?)
**Где**: spec.md US5; 049 spec.md строка 115 «Cart abandonment ... за feature-flag, отключаем по умолчанию».
**Проблема**: cart-abandonment — это **маркетинговая** коммуникация (нацелено на повторное вовлечение, не на статус заказа). Требует opt-in (152-ФЗ, ФЗ «О рекламе» ст. 18).

В чекауте 047 на этапе Identify клиент вводит email — есть ли там checkbox «согласен на маркетинговые рассылки»? В 047 spec и UI_IMPLEMENTATION_NOTES — нет упоминания такого чекбокса.

**Решение нужно**:
1. Определить: T-010 — маркетинг или нет.
2. Если маркетинг — где собирается consent? До email-сабмита в Identify-step?
3. Что делать если cart с email есть, но consent НЕ собран — отправлять или нет?

**Рекомендация**: T-010 = маркетинг → требует явный `marketingOptIn=true` на cart или customer. **Текущая трактовка** (FR-5224 + US5.AS2 «marketingOptIn=true») — корректна, но **отсутствует**:
- FR на сбор consent — где он живёт (в Cart как `marketingOptIn?`, в customer'е после 054, или один-раз в общей форме согласия?);
- FR на дефолт — `marketingOptIn` default **false** (Q8 в order-lifecycle открыт).

Добавить FR-5224a: «Cart.marketingOptIn = boolean, default false. Источники true: явный checkbox в checkout S04 (Identify) ИЛИ принятый клиентом consent-banner на /cart/restore/[token]/».

Поле `marketingOptIn` **отсутствует** в data-model §1 — баг.

---

## B. Недостающие детали

### B1. API endpoints item-level vs cart-level — неконсистентны
**Где**: contracts/cart-api.openapi.yaml.
**Проблема**: в OpenAPI есть и `PATCH /api/cart/{token}` с `op=mergeItems` (на батч), и `POST /api/cart/{token}/items` (single item). Дублируются. Не описано когда какой использовать. Из tasks.md T015 — «POST `/items` — добавить item (через merge)». OK, но:
1. Нужно ли клиенту выбирать? Лучше иметь один canonical.
2. `DELETE /api/cart/{token}/items/{sku}` — а на удаление через PATCH `setItems` (с исключением sku) — тоже работает. Двойной API.

**Рекомендация**: убрать `POST/DELETE` items-эндпоинты ИЛИ задокументировать «POST/DELETE — для UI, PATCH — для batch миграции/admin». Сейчас открыто.

---

### B2. Rate-limit для анонимного создания cart (spam protection)
**Где**: contracts/cart-api.openapi.yaml info-блок, spec.md FR — отсутствует.
**Проблема**: в OpenAPI описан rate-limit «60 req/min/IP на mutate». Это позволяет ботам создать ~86k cart за сутки с одного IP — раздутие БД, обход expiry. FR этого rate-limit нет.

**Рекомендация**: FR-5212a (или FR-5241):
- `POST /api/cart` без cookie: max 5 per minute per IP, max 30 per day per IP.
- При превышении — 429 + анти-bot header (рекомендуется CAPTCHA для очередного, но это вне MVP).
- Защита cron от наплыва: phase 9 polish T041 описывает rate-limit на GET, но не на POST.

Добавить в tasks.md (расширить T041).

---

### B3. GDPR — что хранится в cart.customerEmail и как удаляется
**Где**: spec.md FR-5228, FR-5229; data-model.md §1, §9.
**Проблема**: описано «admin action: hard delete + audit log без PII» (FR-5228), маска в логах (FR-5229), эндпоинт `DELETE /api/cart/{token}?hard=true` с confirmToken (openapi). НО:
1. Что **с другими полями** при hard-delete: items[].name (snapshot, не PII), userAgent, ipHash — удаляются полностью или анонимизируются?
2. Как клиент инициирует GDPR-удаление если у него **нет** auth (054 не релизнут)? Через email customerEmail — но он не подтверждён.
3. Соотношение с 054 FR-5441 (`/api/customers/me/delete` — soft delete + cascade) — там corner case `carts` упомянут (FR-5404), но не FR-5441 cascade.

**Рекомендация**: FR-5228a — для гостевой cart hard-delete доступен через:
1. Admin action в Payload (всегда).
2. Эндпоинт `POST /api/cart/{token}/delete-request` — генерирует confirmToken, шлёт на customerEmail; клиент подтверждает в email → DELETE с confirmToken проходит.
3. В 054 контексте — cascade при `customers.deletedAt`.

`ipHash` — сохраняется (псевдоним, не PII), `userAgent` — затирается (potential fingerprint).

---

### B4. Migration strategy: localStorage → БД для существующих клиентов
**Где**: spec.md FR-5215 (boot migration), Edge Cases «Импорт legacy».
**Проблема**: описана только для одного клиента в момент его mount. Не описано:
1. Что с **существующими** localStorage-корзинами клиентов, которые **не вернутся** в течение 30 дней — теряются (это OK, но зафиксировать).
2. Как переключение feature flag (`NEXT_PUBLIC_CART_PERSISTENCE=db`) ломает SSR — на SSR (без localStorage) cart всегда пустой, а на CSR mount гидратируется → flicker. Это упомянуто в plan.md как «localStorage-cache для optimistic first paint», но не зашито в FR.
3. Что с **legacy ключом** `soliton-rfq-items` (RfqCart.tsx) — он чистится в FR-5215, но **только при первой mutation**. Если клиент только смотрит — старая корзина в localStorage висит вечно.

**Рекомендация**:
- FR-5215a: «Если cookie `soliton_cart_token` есть и валидна, но в localStorage висит legacy ключ — он очищается на следующей загрузке (после успешной гидратации из БД)».
- Добавить assumption: «Корзины клиентов, не возвращавшихся на сайт за 30 дней до релиза 052, потеряны (acceptable for MVP)».

---

### B5. Domain event `cart.*` в DomainEventKind enum
**Где**: `apps/web/src/lib/lifecycle/events.ts:18-34` — текущий enum **не содержит** `cart.*`. tasks.md T011 предполагает расширение, но **в spec/data-model нет явного FR** на это (только в общей `Key Entities`).
**Проблема**: 052 предполагает использовать существующий `emitDomainEvent`, но контракт `OrderSnapshot` (events.ts:36-65) принимает Order, не Cart. Сейчас события cart.* потребуют **либо** изменения сигнатуры (breaking change для 048/049 subscribers), **либо** отдельной функции (e.g. `emitCartEvent`).

**Не зафиксировано в спеке**: какой подход выбран.

**Рекомендация**: FR-5233 — расширить emitter:
- Вариант A (предпочтительно): отдельная функция `emitCartEvent({ kind, cart, context })` с `CartSnapshot` типом; subscribers получают union `DomainEventPayload | CartEventPayload`.
- Вариант B: использовать существующий с обёрткой — `order: { id: cartId, ...synthetic }`. Хрупко.

Решение нужно ДО старта T011. Сейчас задача неоднозначна.

---

### B6. Согласованность с 047 `soliton_checkout_draft` cookie
**Где**: 047/UI_IMPLEMENTATION_NOTES.md строка 27: cookie `soliton_checkout_draft` TTL 30 минут, хранит черновик `draft-order.ts`. 052 cookie `soliton_cart_token` TTL 30 дней.
**Проблема**: две разные сущности с похожими названиями.
- `soliton_checkout_draft` — содержит **финальные** значения чекаута: customer.email/phone, адрес доставки, выбранный тариф, snapshot цены.
- `soliton_cart_token` — содержит только токен, по которому из БД достать items.

Согласовано: разные scope, разные TTL. **Но** в спеке 052 это **не упомянуто**. Менеджеру при чтении 052 может показаться, что draft cookie заменяется на cart token cookie.

**Рекомендация**: добавить в plan.md (Risk section) или Out Of Scope: «Cookie `soliton_checkout_draft` (047) — НЕ замещается; продолжает хранить checkout-state. Cart token — отдельная сущность.» Это снимает вопрос.

---

### B7. Что возвращает `Cart.cartToken` в API responses
**Где**: contracts/cart-api.openapi.yaml, schemas.Cart.
**Проблема**: в schema написано «cartToken: возвращается ТОЛЬКО при create. Для GET — не возвращается (anti-leak)». OK. Но:
1. На `PATCH` — возвращается? Не описано (видимо нет — это mutation на существующую).
2. На `POST /items` (добавление) — возвращается? Не описано.
3. Это означает, что **в restore-flow** (`/cart/restore/[token]/`) клиент уже знает token из URL → cookie ставится → потом он GET → не получает token обратно → если cookie исчезла (например, через 30 дней) → клиент не сможет дать ссылку другу.

Cookie HTTP-only ⇒ клиент НЕ знает свой токен (только сервер). Чтобы реализовать «поделиться корзиной с другом» (не явно в 052, но напрашивается) — нужен механизм.

**Рекомендация**: FR-5217a — отдельный эндпоинт `POST /api/cart/{token}/share` — генерирует короткоживущий signed-token (см. data-model §5, отложено). Это решает и анти-leak (короткоживущий token в URL), и share-flow.

Сейчас в Out Of Scope не зафиксировано «share between users».

---

### B8. Telegram/messenger канал для cart.abandoned (050)
**Где**: spec.md контекст «050 (Telegram bot) — может добавить messenger-канал».
**Проблема**: 049 matrix имеет M-001/M-003/M-004/M-005 для order-событий, **нет** M-010 для cart-abandoned. 050 ещё не релизнута. 052 пишет «может» — это намерение или контракт?

**Рекомендация**: добавить assumption: «050 messenger M-010 (cart abandoned messenger) — отложено в 050; в 049 matrix добавить заглушку правила с `channel=messenger, template=M-010, recipient=customer, requires=messengerOptIn` — будет skipped пока 050 не зарегистрирует sender».

Это **расширяет T032**.

---

## C. Противоречия

### C1. 049 matrix НЕ содержит `cart.abandoned → T-010`
**Где**: `specs/049-customer-notifications/contracts/notification-events.md:103-140` matrix; vs spec.md строка 21 «049 (notifications: matrix содержит `cart.abandoned → T-010`...)».
**Противоречие**: 052 spec пишет «matrix уже содержит» — это **ложь**. Matrix имеет cart.abandoned **только в Event names** (строка 15 как «отложено»), но **rule в matrix отсутствует**. T032 в 052 как раз закрывает этот gap, но контекст в spec.md строки 18-22 формально некорректен.

**Рекомендация**:
1. В spec.md строки 20-22 заменить: «049 (notifications: matrix **готова к расширению**, событие `cart.abandoned` зарезервировано в event names; правило `cart.abandoned → T-010` добавляется задачей T032 в рамках 052)».
2. Также 07-build-specifications/order-lifecycle-spec.md §3 уже содержит `cart.abandoned → T-010 (через 1 ч)` — это «канонический» источник; 049 matrix просто отстаёт. Это требует синхронизации (упомянуть в T039).

---

### C2. 047 `soliton_checkout_draft` (30 мин) vs 052 `soliton_cart_token` (30 дней)
**Где**: 047/UI_IMPLEMENTATION_NOTES.md строка 27 + 052/data-model.md §6.
**Согласование**: разные сущности, разные TTL — **не противоречие**. Но:
- В 047 draft хранит **items copy** (включая qty) для finalize-shipping.
- В 052 items — в БД, identified по cartToken.

После 052 — draft-order.ts должен использовать `cartToken` вместо собственного списка items? Или оба независимы?

**Рекомендация**: FR-5234 — после миграции `CartClient`, 047's `draft-order.ts` НЕ хранит items (только `customer/address/tariff/snapshot`); items берутся из cart по `cartToken`. Это упрощение требует:
1. Изменения `draft-order.ts` shape.
2. Изменения `CheckoutShippingClient.tsx`, `ReviewClient.tsx`.
3. Тестов на сценарий «cart изменился между шагами checkout».

**Не описано** в текущих tasks. Это потенциально критичный intercept-point.

---

### C3. 054 forward-ref `customerId` — 052 работает БЕЗ 054 ✓ OK
**Где**: data-model.md §1 `customerId: relationship → customers` без required. Spec.md FR-5234 «relation, nullable».
**Согласовано**: поле nullable, ничего не блокирует. ✓

**Проверка**: 054 spec.md FR-5404 пишет «расширять `carts` (из 052) полями `customerId` и `companyId`». В 052 data-model уже есть `customerId`, но **нет `companyId`**.

**Рекомендация**: 052 может добавить и `companyId?` как fwd-ref (минимальные правки) — чтобы 054 не делал миграцию. Либо явно оставить 054 owner'ом `companyId` (тогда 054 делает миграцию). Принять решение в плане.

---

### C4. 047 Order.cartId — required vs optional
**Где**: 052 spec.md FR-5221 «cartId, optional для legacy совместимости»; 052 tasks.md T012 «relationship → carts, optional, index».
**Согласовано** ✓. 047 ничего не требует, поле опционально.

**Проверка 047** (`apps/web/src/collections/Orders.js`): нет `cartId` поля. Добавляется в 052. Конфликта нет. ✓

**Соображение**: FR-5223 «Если Order создаётся БЕЗ cartToken — создать synthetic Cart» — это **расширение flow 047** (`/api/checkout/finalize-shipping` или `/api/payment/yookassa/create`). 047 spec этого не предусматривает. T026/T027 это закрывают, но **в 047 spec изменений нет** — это modification 047 features.

**Рекомендация**: добавить в T039 (обновление order-lifecycle-spec.md §13.2): отметить, что после 052 **все** Order имеют `cartId` (либо настоящий, либо synthetic).

---

### C5. 052 FR-5220 (cart→order conversion) vs 047 emit `order.paid` flow
**Где**: 052 FR-5220 «при создании Order ... принимать cartToken, находить cart, ставить status=converted, emit cart.converted».
**Проблема**: где **точно** в 047 flow это происходит?
- Order создаётся в `draft` на Phase 4 (адрес введён).
- `pending_payment` на Phase 7 (после finalize-shipping).
- `paid` на Phase 7 (после webhook ЮKassa).

Когда `Cart.status=converted`? На `draft` (Order создан, но не оплачен) — клиент может вернуться и редактировать. На `paid` — точка невозврата.

Если на `draft` — то если клиент бросает чекаут, Cart остаётся `converted`, его восстановить нельзя (см. A5). Если на `paid` — между Order.draft и Order.paid Cart всё ещё `active` → его могут изменить → разъезд с Order.items[].

**Рекомендация**: FR-5220a — `Cart.status=converted` на переходе `Order.status → pending_payment` (после finalize-shipping, до webhook). Cart **immutable** с этого момента (PATCH возвращает 409). Если Order переходит в `expired/cancelled` до `paid` → Cart возвращается в `active` (recoverable; см. A5).

Это требует:
1. Расширения transition matrix (data-model §3): `converted → active` разрешено при `Order.status ∈ {cancelled, expired}` AND `Order.paid IS NULL`.
2. Hook в 052 collection: при изменении relatedOrder.status → пересчёт Cart.status.

Сейчас **не описано**.

---

## D. SDD Compliance

### D1. Приоритезация US
**Текущая**: US1(P1), US2(P1), US3(P1), US4(P2), US5(P2), US6(P3).

**Замечания**:
- US5 (cart abandonment) — описан как P2, но в spec context «cart-abandonment (T-010 в 049 заглушено)» — это **ключевая бизнес-мотивация** 052 (вторая строка spec.md). Если P2 не блочит MVP — нет ROI 052 в первые недели. Рекомендация: повысить до P1 или явно зафиксировать «MVP = US1+US2+US3, ROI приходит с US5 в Sprint 2».
- US4 (admin UI) P2 — OK.
- US6 (merge) P3, stub — OK.

**Рекомендация**: оставить как есть, но в plan.md «Implementation Strategy» явно сказать: «Без US5 ROI 052 = funnel-аналитика + restore (но без активного outreach)».

---

### D2. Покрытие FR ↔ US
- FR-5201..5204 (schema) — US1, US2, US3 ✓
- FR-5210..5214 (API) — US1, US3, US5, US6 ✓
- FR-5215..5217 (migration) — US1 ✓
- FR-5220..5223 (conversion) — US3 ✓
- FR-5224..5225 (lifecycle) — US2, US5 ✓
- FR-5226..5227 (merge) — US6 ✓
- FR-5228..5230 (privacy) — пересекается с US1/US2 ✓

**Дыры**:
- FR на consent/marketingOptIn на cart — **отсутствует** (см. A8).
- FR на cart.marketingOptIn поле в data-model — **отсутствует** (см. A8).
- FR на event-emitter расширение (cart.*) — **отсутствует явно** (см. B5).
- FR на оптимистичную блокировку (If-Match) — **отсутствует** (см. A6).
- FR на rate-limit POST /cart — **отсутствует** (см. B2).
- FR на share-flow (signed-tokens) — out of scope, но не явно.

**Рекомендация**: добавить FR-5232..5234 (см. выше).

---

### D3. Acceptance Scenarios проверяемы
В целом **да** — большинство G/W/T корректные. Замечания:
- **US1.AS5** «localStorage пустой, но cookie существует → CartClient запрашивает GET» — нужен contract на flow CSR гидратации (где конкретно вызов происходит: useEffect mount? Suspense boundary? SSR-fetch?). Сейчас неоднозначно.
- **US3.AS3** «cart в `abandoned` → checkout → cart переходит из `abandoned` напрямую в `converted`» — корректно, но не описан **emit-flow**: эмитятся ли оба `cart.recovered` + `cart.converted`, или только `cart.converted`? data-model §7 не имеет `cart.recovered`.
- **US5.AS5** «клиент вернулся в abandoned cart → status → active, abandonedAt = null» — должен ли быть emit-event на recovery? Это полезно для voronka «recovered-from-abandoned vs converted-directly».

**Рекомендация**: добавить `cart.recovered` в event list (data-model §7).

---

### D4. tasks.md покрытие
- Все FR покрыты тасками: ✓
- Параллелизм маркирован [P]: ✓
- US-теги корректны: ✓

**Замечание**: T032 (расширение 049 matrix) — это **изменение чужой спеки**. Лучше явно сделать кросс-ссылку: «обновить `specs/049-customer-notifications/contracts/notification-events.md` с добавлением правила, бампнуть версию 049 spec».

T039 (обновление order-lifecycle-spec.md) — корректно.

T034 «подключить cart afterChange-hook к 049's emitter» — упоминает «049 emitter API» но в 049 emitter — это `notification-jobs.create()`, не отдельный API. Стоит уточнить интерфейс.

---

## Резюме (Summary)

### Критичные блокеры (требуют решения перед началом)

| # | Issue | Owner | Where |
|---|---|---|---|
| A1 | Определение «activity» для TTL | владелец/PM | spec.md FR-5226 |
| A4 | `priceAtAdd` revalidation algorithm | tech-lead | data-model.md §1 |
| A6 | Конкурентный PATCH (If-Match или нет) | tech-lead | contracts |
| A8 + B7 | marketingOptIn на cart — поле и FR | юрист + PM | data-model.md §1 (отсутствует) |
| B5 | event-emitter signature для cart.* | tech-lead | events.ts + 052 plan |
| C1 | 049 matrix НЕ содержит правила — fix копи в spec.md | reviewer | spec.md ll. 18-22 |
| C2 + C5 | соотношение draft-order ↔ cart, момент конверсии | tech-lead | spec.md FR-5220 |

### Уточнения средней важности

| # | Issue |
|---|---|
| A2 | Logout/login — cookie strategy |
| A3 | Merge rules при collision |
| A5 | Cancel/return — что с Cart.status |
| A7 | cart.abandoned без email — flow подтверждён, проверить 049 matrix |
| B1 | Дублирующиеся endpoints (PATCH vs POST/items) |
| B2 | Rate-limit POST /cart |
| B3 | GDPR hard-delete для гостя без auth |
| B4 | Legacy localStorage cleanup |
| B6 | Cookie scope согласован — упомянуть в плане |
| B8 | M-010 messenger placeholder |
| C3 | companyId fwd-ref в 052 vs 054 |
| C4 | OK ✓ |
| D1 | US5 приоритет — пересмотреть |
| D2 | FR-5232..5234 добавить |
| D3 | cart.recovered event |

### Что OK ✓

- Структура spec.md (User Stories, FR, Edge Cases) — sound.
- Backward-compat с RfqCart.tsx — описан корректно.
- Cookie HTTP-only + SameSite=Lax — правильный выбор.
- State machine — почти полная (нужна добавка `converted → active` для cancellation).
- GDPR (90d hard-delete) — соответствует best practice.
- Idempotency-Key — заложен правильно.
- Tasks.md — хорошо структурирован, MVP-path ясен.
- OpenAPI контракт — детальный, error-codes описаны.

### Рекомендованный action plan перед началом T001

1. **Закрыть A1, A4, A6, A8, B5** — критично, влияет на схему БД и API.
2. **Сделать pass по spec.md строки 18-22** (C1 — фактическая некорректность).
3. **Решить C2 + C5** — точка `converted` и интеграция с draft-order.
4. **Добавить FR-5232..5234** (consent, revalidate, emitter ext).
5. **Добавить `marketingOptIn` поле** в data-model §1.
6. **Добавить `cart.recovered` event** в §7.
7. **Расширить state machine** допуском `converted → active` при отмене Order.
8. Прогнать tasks.md по добавленным FR, расширить T011, T026, T032 деталями.
