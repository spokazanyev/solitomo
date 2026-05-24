# Review Notes — 054-customer-account

**Дата ревью**: 2026-05-23 (initial), повторная проверка 2026-05-24.
**Ревьюер**: agent (clarification + cross-spec consistency)
**Объём**: `spec.md`, `plan.md`, `data-model.md`, `tasks.md`, `contracts/customer-api.openapi.yaml`.
**Cross-check**: 047 / 048 / 049 / 052 / 053 + `07-build-specifications/order-lifecycle-spec.md §4, §13`, `apps/web/src/collections/Users.js`.

Легенда серьёзности: 🔴 блокер — нужно решить до Phase 2 · 🟡 средний — решить до релиза US1–US3 · 🟢 nit / clean-up.

**Сводный счёт находок (после повторной проверки 2026-05-24)**:
- Ambiguous (A1–A14): 5 🔴 блокеров, 7 🟡 средних, 2 🟢 nit
- Missing (B1–B11): 1 🔴, 5 🟡, 4 🟢/✅, 1 ✅ покрыто
- Contradictions (C1–C6): 3 🔴, 2 🟡, 1 🟢
- SDD (D1–D4): 2 🟡, 2 ✅
- **ИТОГО блокеров для Phase 2**: 9 (A1, A4, A5, A8, A9, A13, B9, C1, C2, C5).

---

## A. AMBIGUOUS — двусмысленность / противоречие внутри спеки

### A1 🔴 Magic-link TTL: «30 мин + 24 ч» — что это технически

Спека упоминает «TTL 30 мин» и «сессия 24 ч», но не разделяет на уровне терминологии:

- В `spec.md` US1.AS3 говорится «одноразовость — на consumption, но сессия уже выдана» — но AS3 также допускает «либо до истечения 30 минут — выдаётся повторно» (= неоднозначность).
- В `data-model.md §1` `customers.magicLinkToken` хранится в БД (opaque), но `plan.md` упоминает `jsonwebtoken@^9` «если Payload-native session не достаточно гибкая».
- `FR-5411` пишет «opaque строка ≥ 32 байта», `plan.md` — «JWT». Это **разные вещи**.
- `ENV` содержит `CUSTOMER_MAGIC_SECRET` — нужен только для HMAC/JWT, для opaque random не нужен.
- В контракте `/api/customers/magic-consume` отдаёт `302 + Set-Cookie` — `cookie` это Payload-default `customer_session` (FR-5412), но плейн-cookie или signed JWT-сессия? Auth-strategy Payload v3 умеет оба, нужно зафиксировать.

**Решение**: явно описать в `research.md` (Q4):
1. Magic-token = opaque random 256-bit в БД с `consumedAt` (рекомендация).
2. После consumption — Payload-native session cookie (JWT под капотом, но это деталь Payload), TTL 24 ч sliding.
3. Refresh-token **не используется** (sliding-window на основной cookie достаточно).
4. Поле `magicLinkRequestedFromIp` (есть в `data-model.md`) можно убрать или явно зафиксировать как audit-only (не используется для policy).

### A2 🟡 «Гость с email» → «Зарегистрированный» — переход не описан

Спека жонглирует двумя моделями:
- US1.AS2: «выдаёт session-cookie, создаёт/находит запись в `customers` по email» — то есть Customer создаётся уже при первом magic-clicke (даже без пароля).
- US1.AS5: «нажал "Создать пароль" — `passwordHash` записан».
- US3.AS1: backfill orders запускается «при первом регистрации с email X».
- `data-model.md §1` отмечает `passwordHash` опциональным (через Payload auth), но `gdprConsentAt` `required: true` создаётся при «register или первом magic-clicke».

Неясно: запись в `customers` после первого magic-clicke — это «registered customer без пароля» или «stub»? От этого зависит:
- Видна ли запись в Payload Admin (нужен фильтр «активные с паролем» vs «email-only»).
- Включён ли merge-flow US3 при первом magic-clicke или только при register/set-password.
- Уходит ли sync-job в Twenty при первом magic-clicke (FR-5446) — если да, то Twenty заполняется при каждом первом письме клиента, что может перегрузить CRM (даже для guest заказов).

**Рекомендация**: добавить состояние `customers.accountState` (enum: `email-only | password-set | invited-stub | deleted`); merge-flow и Twenty-sync завязать на `password-set` или явный `accountActivated` step.

### A3 🟡 «Email сменился» — что со старыми Orders

`Edge Cases`: «Клиент сменил email: запись в `customers.email` обновляется; прошлые Order сохраняют `customer.email` как snapshot, но связь через `customerId` сохраняется».

OK, но **что если у customer'а email изменился, а потом приходит guest-checkout со старым email**?
- `FR-5421` (afterCreate hook на orders) ищет customers по email → не найдёт (т.к. customer.email обновился).
- В итоге: новый Order остаётся с `customerId = NULL` навсегда.

И симметрично: при первом merge (US3) старые Order с `customer.email = старый_email` НЕ матчатся, если customer уже сменил email.

**Решение**: либо ввести `customers.previousEmails[]` (history), либо backfill-индекс через `orders.customer.email` идёт через **all-history match** (последние 30 дней email customer'а), либо явно зафиксировать в Open Questions что «smena email с историей — manual merge через US6». Сейчас спека утверждает, что merge идемпотентен (US3.AS3), но не описывает email-change-history.

### A4 🔴 B2B-роль `owner` vs `accountant` — privacy-matrix vs spec.md vs data-model §9 расходятся

| Документ | Owner видит личные заказы коллег? |
|---|---|
| `spec.md` US4.AS3 | «owner видит все Order, где `companyId = company.id`» — без оговорок |
| `spec.md` Edge Cases / personal toggle | «owner НЕ видит личные заказы своего accountant'а» |
| `data-model.md §9 privacy-matrix` | `Personal order` ✅ только owner, ❌ для всех |
| `data-model.md §4 access.read` | owner.or = `customerId=me OR (companyId=mine AND isPersonalOrder=false)` — то есть owner НЕ видит чужие personal |

Расхождение: privacy-matrix говорит «owner видит свои personal» (логично), но в той же строке колонка `Personal order` сложно интерпретируется (галочка в первой колонке «individual» неоднозначна).

**Решение**: переписать §9 явно как «Owner: видит все Order companyId, КРОМЕ isPersonalOrder коллег (но видит свои собственные)»; убедиться что `access.read` это явно реализует (текущий — OK, но требует двойной проверки).

### A5 🔴 Privacy для accountant — нарушение RBAC

`data-model.md §4 access.read` для accountant возвращает Payload-where-filter `{companyId AND isPersonalOrder=false}`. Это вернёт **весь Order document** (включая `items[]` и `delivery.address`).

В `data-model.md §9` написано «accountant НЕ видит items / delivery.address». Но это будет фильтрация **на UI**, не на API → нарушение FR-5445 «privacy-фильтр на API-уровне (не только UI)».

**Решение**: либо использовать Payload `read` field-level access на каждом sensitive field (items, delivery), либо обернуть в API `/api/customers/me/orders` ответ через server-mapper, который убирает поля по роли. Документировать в data-model явный список редактируемых полей и в task T-111 проверить именно на API-response.

### A6 🟡 `companies.approvalLimit` — workflow при превышении не описан в US7-only форме

`FR-5437` упоминает toggle «личный заказ», но approval-flow (US7) → P3. `data-model.md §2` уже содержит `approvalLimit` поле, `purchase-approvals` — отложенная коллекция (§6).

Но в `data-model.md §10 TTL и cleanup` упоминается `purchase-approvals.status = pending` — авто-expired через 72 часа — без описания, кто это enforced. Создаётся pre-emptive поле без enforcement.

**Решение**: либо вынести `approvalLimit` поле из MVP-data-model (отложить на US7), либо явно пометить как «inert до US7». Сейчас оно может ложно интерпретироваться как live-feature.

### A7 🟡 GDPR-удаление — что именно обнуляется

`FR-5441` и US6.AS5 описывают: `email → deleted-{id}@gdpr.local`, `phone → null`, `addresses → []`, `fullName → "Удалён"`. Но:

- `customers.phoneNormalized` — есть в данных, не указано в обнулении.
- `customers.crmPersonId`, `crmCompanyId` — не указано (но FR-5449 удаляет Twenty Person каскадно — то есть `crmPersonId` остаётся как «битый указатель»? Нужно обнулять или хранить для аудита).
- `customers.lastLoginIp`, `lastLoginUserAgent` — это тоже ПДн (косвенно).
- `customers.magicLinkRequestedFromIp` — то же.
- `customers.firstName / lastName` — fullName обнуляется, но компоненты не указаны.
- `Order.customer.fullName / phone / email` остаётся snapshot (для бухучёта) — спека это явно сохраняет, но **точный список** иммутабельных полей не зафиксирован (только «customer.*» в общем).

**Решение**: добавить в `data-model.md` явные таблицы:
- (a) полей `customers`, которые обнуляются при `deletedAt`;
- (b) полей `Order.customer.*`, которые иммутабельны для бухучёта (FZ-402 — счёт-фактура, УПД должны содержать ФИО или name юрлица + ИНН + адрес как на момент сделки);
- (c) полей, которые анонимизируются на Order.customer.* при GDPR (если есть).

Бухгалтерия по 152-ФЗ ст.6 ч.4 имеет основания хранить ПДн без согласия для исполнения обязательств — это нужно явно записать.

### A8 🔴 Источник истины для `marketingOptIn` — конфликт 049 vs 054

| Спека | Источник истины | Где хранится |
|---|---|---|
| 049 spec.md FR-4921 + data-model.md L111 | `Order.marketingOptIn` per заказу | `orders.marketingOptIn` |
| 049 data-model.md L114 | `Order.customer.emailValid` (per заказу snapshot) | `orders.customer.emailValid` |
| 054 FR-5431 | «переносит флаги `marketingOptIn` / `messengerOptIn` с `orders` на `customers` как первоисточник» | `customers.marketingOptIn` |
| 054 spec.md US5.AS5 | «изменения применяются к одной и той же записи в `customers`» | `customers.marketingOptIn` |

`054 FR-5431` явно говорит **переезжает**, но не описывает миграцию:
- Что делать с `Order.marketingOptIn`-полями существующих записей? Оставить snapshot? Удалить?
- При следующей рассылке `T-010 cart abandonment` (049) — какое поле читается: `Order.marketingOptIn` (049) или `Customer.marketingOptIn` (054)?
- 049 US6 описывает `/preferences/[token]/` — это всё ещё работает после 054, и обновляет Customer или Order? `054 US5.AS5` пишет «применяются к одной и той же записи в customers» — нужно явное API.

**Аналогично для `customer.emailValid`**: после 054 поле на Customer или Order?

**Решение**: в `054 spec.md` добавить раздел «Migration of preference fields» с явным:
1. После релиза 054 единственный источник истины — `Customer.marketingOptIn / messengerOptIn / emailValid` (если customer существует).
2. `Order.marketingOptIn` сохраняется как snapshot **на момент создания** для аудита (что заказ был сделан клиентом, который тогда согласился).
3. 049-emitter после 054 читает: если `Order.customerId != null` → `Customer.marketingOptIn`; иначе → `Order.marketingOptIn` (fallback для guest).
4. Перенести FR-4921 в 049 → отметить как «после 054 источник = Customer».
5. `Customer.emailValid` поле в data-model.md есть, но «помечается false после 3 hard bounce от 049» — нужно обновить 049 hooks чтобы писали в Customer тоже.

### A9 🔴 Twenty Person — кто кого ведёт, Soliton или Twenty

**Spec 048**:
- FR-4801: «создавать в Twenty Person по Order.customer.email».
- FR-4810 / US5 (фаза 2, P3): Twenty → Soliton webhook — обновление статусов Opportunity.
- FR-48 не описывает inbound для Person/Company (только Opportunity stage).

**Spec 054**:
- FR-5446: Customer → Twenty Person upsert.
- FR-5450: «синхронизировать обновления Person/Company **из** Twenty (при ручном изменении менеджером) обратно в `customers`/`companies` через webhook 048 US5; conflict-resolution: last-write-wins по `updatedAt`».
- Это **расширяет 048 US5** новым inbound каналом (Person/Company), которого в 048 нет.

**Проблема**:
- 048 US5 — webhook-handler `/api/webhooks/twenty` для **Opportunity.stage**.
- 054 FR-5450 предполагает что тот же handler принимает **Person.updated/Company.updated** webhooks.
- В 048 spec.md / data-model нет описания этих webhook-payloads.
- Last-write-wins по `updatedAt` — звучит просто, но 048 не описывает где хранить `updatedAt` для конфликт-резолюции.

**Решение**:
1. Либо вынести FR-5450 → отложить до 048 US5 завершения и зафиксировать в 048 как FR-4811 (новый).
2. Либо в 054 явно описать webhook-payload для Person.updated в `contracts/`, и пометить требования к 048 plan.md как **зависимость** (Phase 10 — расширение 048).
3. Обновить `08-twenty-fields.md` — добавить custom Person fields: `marketingOptIn`, `messengerOptIn`, `emailValid` (которые 054 хочет sync'ить), а также `lastSyncedAt` / `solitonCustomerId` для links.
4. Определить тай-брейкер для last-write-wins: если оба обновили в течение 5 секунд — Soliton wins (для безопасности ПДн).

### A10 🟢 Twenty Company — дедупликация ИНН (исправлено)

`spec.md` Edge Cases: «Конфликт ИНН между Company-записями: дедупликация по ИНН (как в FR-4802b 048)».

Перепроверено 2026-05-24: **FR-4802b в 048 spec.md существует** (line 121: «System MUST дедуплицировать Company по `taxId` (ИНН) — приоритетнее, чем по `name`»). Аналогично существует FR-4807a (cascade delete, line 128). Ссылки в 054 — валидны.

**Действий не требуется.** Найдка из изначального ревью была ложным срабатыванием.

### A11 🟢 053 returns связь с Customer

`053 data-model.md` показывает `customerNotes` (text) — это **поле** Return.customerNotes (комментарий клиента), не связь с Customer. На текущий момент `Return.customerId` НЕТ в 053. 054 FR-5405 проактивно добавляет `customerId` к returns — это OK как forward-compat, но: 053 spec.md / data-model.md нужно обновить (или 054 явно вносит это в data-model в Phase 10 backfill).

### A12 🔴 052 `cartId` becomes required after 054?

`052 data-model.md`: `customerId` — relationship, **nullable** (fwd-ref для 054).
`054 FR-5404`: «расширять `carts` полями `customerId` и `companyId`» — но не уточняет required/optional.
`054 plan.md`: «`carts.customerId` появляется в момент логина / merge гостевой корзины» — то есть остаётся nullable.

**Конфликт по US6 (052)**: если customer создал заказ с magic-link (US1) → email есть в `Order.customer.email` → backfill ставит `Order.customerId` → но **cart-to-order** конверсия не описана в 054.

**Решение**: явно описать в 054 US3:
- При conversion (cart → order) если cart.customerId != null → Order.customerId наследует.
- Если cart.customerId == null (anonymous) и customer создан позже через magic — backfill order по email **И** опционально обновить cart.customerId ретроспективно для аналитики `cart.converted` (052).

### A13 🟡 Payload `customers` (auth=true) vs `Users` (auth=true) — два auth-collections в одном проекте

Существующий `Users.js`:
```js
{ slug: "users", auth: true, ... }
```

054 data-model.md §1:
```js
{ slug: "customers", auth: true, cookies: { ... } }
```

**Payload v3 поддерживает несколько auth-collections** (`research.md Q1` это validates). Но:
- Payload-admin использует cookie `payload-token` (default) — нужно подтвердить что новая `customers` auth-collection использует другой cookie name (`customer_session`).
- Cookie domain в data-model.md: `process.env.COOKIE_DOMAIN` — это глобал для **обеих** collections; если разные домены не нужны, ОК, но при misconfiguration две сессии могут конфликтовать.
- В `auth.cookies` Payload v3 формат — нужно проверить, есть ли там `name: "customer_session"` (в data-model.md этого поля нет — только `domain, sameSite, secure`). По умолчанию cookie name = `payload-token` для всех auth-collections, и это **сломает admin-сессию**.

**Блокер**: явно добавить в Customers config:
```js
auth: {
  cookies: {
    name: "customer_session",   // ← MUST BE EXPLICIT
    ...
  }
}
```
Подтвердить в `research.md` Q1 что это поддерживается, и в T-018 (unit-тест на cookie-изоляцию) — это центральный риск.

### A14 🟡 `inviteToken` vs `magicLinkToken` — пересечение

В `data-model.md §1` два почти одинаковых механизма:
- `magicLinkToken` + `magicLinkExpiresAt` + `magicLinkConsumedAt` (US1).
- `inviteToken` + `inviteExpiresAt` + `inviteAcceptedAt` (US4 invitation).

Можно ли использовать один токен? Или нужно различать (TTL разные: 30 мин vs 7 дней, иначе семантика)?

**Решение**: либо унифицировать в `customers.tokens[]` (array), либо явно объяснить почему два разных поля (TTL, audit, multi-purpose). Сейчас выглядит как duplication.

---

## B. НЕДОСТАЮЩИЕ ДЕТАЛИ

### B1 🔴 Reset password flow — не описан вообще

Нет user story, нет FR, нет endpoint в OpenAPI:
- Если customer установил пароль (US1.AS5 или US2) — как сбросить?
- Payload v3 имеет `auth.forgotPassword` API — но в `data-model.md` `auth: { ... }` это не включает.

**Решение**: добавить US (2a или подраздел US2): forgot-password flow через email link (как magic-link, но для смены пароля). Endpoint `POST /api/customers/forgot-password`, `POST /api/customers/reset-password?token=X`.

### B2 🟢 2FA для B2B owner — отмечено в Out Of Scope

OK, явно вынесено в «после MVP, спека 056+». Никаких действий.

### B3 ✅ Rate-limit на magic-link

`FR-5416`: 3/15мин/email + 3/15мин/IP — есть. `OpenAPI` подтверждает. OK.

Дополнить только: на `/api/customers/register` тоже нужен rate-limit (предотвращение спам-регистраций) — в FR-5416 нет, в OpenAPI нет.

### B4 ✅ Throttle на login

`FR-5416 + data-model.md auth.maxLoginAttempts=5, lockTime=15 мин` — Payload-native. OK.

### B5 🟡 Email change flow — magic-link на старый или новый

OpenAPI `/api/customers/me/change-email` описывает: «на новый email отправляется confirm-ссылка». Но это **уязвимо** к account takeover: атакующий получил доступ к sessions (cookie stolen) → меняет email на свой → новый email подтверждает → старый владелец теряет аккаунт.

**Лучшая практика (Auth0, Google, Stripe)**: подтверждение на **оба** email — confirm-link на новый + notification (с undo-link) на старый.

**Решение**: в OpenAPI добавить — после `POST /api/customers/me/change-email`:
1. Письмо на новый email с confirm-link (как сейчас).
2. Письмо на старый email с notification «вы запросили смену email; если это не вы — нажмите undo».
3. Window — 72 часа: до consumption confirm-link и при отсутствии undo — email меняется.
4. После change-email — все sessions кроме текущей принудительно logout.

### B6 🟡 Account deletion vs deactivation — разница и UX

Спека описывает «soft delete» как single mode. Нет «deactivation» (временное отключение с восстановлением).

В Out Of Scope не указано. В Edge Cases: «Soft-delete клиент входит: login отклоняется… Чтобы восстановить — обращение к менеджеру».

**Решение**: либо добавить в Out Of Scope «отдельный deactivation mode — не реализуется» (одна кнопка = удалить), либо описать как US (Edge Case). Сейчас неоднозначно для UX-стейкхолдера.

Также не описано: что показывается клиенту **после** успешного `POST /api/customers/me/delete`? UI redirect на homepage? Уведомление по email на старый адрес? («Ваш аккаунт удалён, спасибо за время с нами»).

### B7 🟡 Cookies при logout

`/api/customers/logout` отдаёт 204 + clear cookie (предположительно `customer_session`).
Но:
- Anonymous `cart_token` cookie из 052 — оставляется или удаляется? Если оставить — следующий visit «продолжает» как guest с прошлой корзиной, что может быть неожиданно если был personal заказ.
- `localStorage` ключи — UI ответственность очистить (например, `cartId` для 052 backup).

**Решение**: добавить FR — на logout очищаются: `customer_session` (обязательно), `csrf-token` (если есть), **сохраняется** `cart_token` из 052 (cart остаётся anonymous для следующего сеанса) — задокументировать поведение явно.

### B8 🟡 Какие данные клиента ДОЛЖНЫ остаться в Order.customer.* после GDPR

Спека упоминает «Order.customer.* остаются как immutable snapshot (для бухучёта)». Но **точный список** не зафиксирован. Это важно для compliance.

Бухгалтерия (ст. 9 ФЗ-402 + НК РФ ст. 169) требует на счёте-фактуре / УПД:
- Наименование покупателя (физлицо — ФИО, юрлицо — наименование).
- Адрес покупателя.
- ИНН/КПП (для юрлица).
- Сумма.

Email и phone — **НЕ** требуются для счёта-фактуры. Их можно анонимизировать даже на Order.customer.* (заменить на placeholder).

**Решение**: добавить в `data-model.md` явный список:

```
Order.customer.* при GDPR Customer.delete:
  fullName       — ОСТАЁТСЯ (бухучёт)
  inn / kpp      — ОСТАЁТСЯ (бухучёт)
  legalAddress   — ОСТАЁТСЯ (бухучёт)
  companyName    — ОСТАЁТСЯ (бухучёт)
  email          — АНОНИМИЗИРУЕТСЯ на deleted-{id}@gdpr.local
  phone          — АНОНИМИЗИРУЕТСЯ на null
  emailValid     — ОСТАЁТСЯ (история bounce)
```

И обновить `apps/web/src/collections/Orders.js` immutability — добавить новую категорию `gdprErasable` поля.

### B9 🔴 CSRF protection — упомянуто в T-117, не в FR

`tasks.md T-117`: «CSRF-токен на all POST/PATCH/DELETE на `/api/customers/*`». Но в spec.md FR этого нет. Это **must-have для production**, должно быть в FR-541x раздел auth.

### B10 🟡 Email enumeration protection — описано только в /magic-request

OpenAPI `/api/customers/magic-request`: «возвращает 200 OK независимо от того, существует ли клиент» — хорошо.

Но `/api/customers/register` возвращает **409 если email уже зарегистрирован** — это **leak**: атакующий может проверить какие email уже в системе через регистрацию.

**Лучшая практика**: возвращать 200 с message «check your email to complete registration» **независимо**; если email уже занят — отправить «вы уже зарегистрированы, нажмите для login» вместо 409.

### B11 🟢 `Q9` UI расположение customers в admin

Решение отложено в Open Questions. OK.

---

## C. ПРОТИВОРЕЧИЯ С ДРУГИМИ СПЕКАМИ

### C1 🔴 048 Person/Company создаются по email из Order.customer; 054 создаёт Customer.email — кто wins при коллизии?

Сценарий:
- Сегодня (без 054): guest-заказ → 048 emit `order.identified` → Twenty Person создан с email `vasya@mail.ru`.
- Завтра (после 054 release без backfill): тот же `vasya@mail.ru` регистрируется → Customer создан → 054 FR-5446 sync-job: «upsert Twenty Person по email».
- **Конфликт**: Twenty Person уже есть с этим email — upsert находит — но 048 не передавал `crmPersonId` обратно в `customers` (т.к. customers тогда не существовали).

**Решение**:
1. Backfill (T-100): после создания Customer-stub из existing Order — сразу читать Twenty Person по email (через 048 API) и записывать `crmPersonId` в Customer.
2. Или: 054 hook первый раз делает `lookup-by-email` в Twenty перед `create-or-update`, если найден — берёт его id.

В spec.md это не описано. Нужно добавить FR-5446a «при первом sync проверять existence Person в Twenty по email перед create».

### C2 🔴 049 emailValid живёт на Order.customer.* (per snapshot); 054 переносит на Customer

049 `data-model.md L114`: `customer.emailValid` — на Order.
054 `data-model.md §1`: `customers.emailValid` — на Customer.

После 054 при bounce от Postmark webhook (049 US3.5 / FR-4906) — куда писать `emailValid=false`?
- Если на Order — не пересинхронизируется на Customer.
- Если на Customer — все старые Orders (snapshot) останутся с `emailValid=true` (стейл).

**Решение**: после 054 единственный источник `emailValid` = Customer. Update 049-hook писать в Customer (если найден по email), и Order.customer.emailValid становится snapshot-only.

Это FR-5431 пытается покрыть, но **не явно для `emailValid`** (только `marketingOptIn`/`messengerOptIn`). Нужно расширить FR-5431.

### C3 🟢 053 Returns customerId

OK, обсуждено в A11. Минорная задача — обновить 053 data-model.md.

### C4 🟡 052 Cart.customerEmail vs Cart.customerId

052 data-model.md имеет `customerEmail` (string) **и** `customerId` (relation). После 054:
- При registered customer добавляет в корзину — `customerId` set, `customerEmail` можно оставить null или для consistency = `customer.email`?
- При guest — `customerEmail` = из формы, `customerId` = null (пока).
- При merge (US3.AS2 054): `customerId` set, `customerEmail` остаётся как был (snapshot).

052 spec.md FR-5213 описывает merge как «отдельная фаза 054». Контракт `POST /api/customers/me/merge-cart` (054 OpenAPI) — описан, но **не описана** обратная связь к 052 collection state (`cart.status=merged | mergedIntoId`).

**Решение**: в 054 T-043 явно ссылаться на 052 FR-5213 контракт; в `lib/customers/merge.ts` `mergeGuestCart` — если customer уже имеет active cart, делать merge two cart records (по 052 US6 правилам — `Cg → Cu` + `Cg.status=merged`).

Сейчас T-043 пишет «принимает cartId из localStorage, привязывает» — недостаточно (не учитывает случай, когда у customer уже есть active cart).

### C5 🔴 047 чекаут toggle «личный заказ»

054 FR-5437: «toggle "личный заказ" в чекауте 047». Но 047 спека уже релизнута (см. git log). Это требует **обновления 047 спеки** или явного отметить как «047 не меняется; toggle живёт в новом form-component для logged-in customer-contact».

T-055 (US4): «Toggle в чекауте 047». Это либо breaking change в 047, либо additive (показывается только для company-contact). **Лучше additive — без правки 047 спеки**.

### C6 🟢 Customer auth — отдельная от admin Users

Уже обсуждено в A13. Critical fix: явно name cookie.

---

## D. SDD (Spec-Driven Development) — приоритеты, покрытие, размер

### D1 🟡 US1 magic-link → P1

Магистральный путь: гость оплатил → magic-link → видит заказ. Без US1 регистрация (US2) бесполезна для existing guest-base (нет смысла регистрироваться если нет email-trigger'а).

US2 (register) **тоже** P1 — нельзя строить admin/B2B без основы.
US3 (merge) P1 — без него регистрация бесполезна.

Текущее US1/2/3 → P1 — **оправдано**. Не P2. ✅

US4 (B2B-роли) P2 — оправдано (MVP B2C).
US5 (profile) P2 — оправдано (basic UX, не critical).
US6 (admin-вью) P2 — **спорно**: без admin-вью менеджер не может разбираться с merge-конфликтами US3.AS5. Возможно поднять до P1.5 (между US3 и US4). **Рекомендация**: внутри Phase 8 как часть MVP (не P2 запоздавший релиз).

US7 (approval flow) P3 — оправдано (отложено в отдельную спеку 055+).

### D2 ✅ Покрытие FR ↔ Tasks

Проверил 50 FR (5401-5450) против 80+ tasks:

| FR | Task(s) | Coverage |
|---|---|---|
| FR-5401 customers | T-010 | ✅ |
| FR-5402 companies | T-011 | ✅ |
| FR-5403 orders.customerId | T-013 | ✅ |
| FR-5404 carts | T-014 | ✅ |
| FR-5405 returns | T-014 | ✅ |
| FR-5410 password auth | T-031, T-033 | ✅ |
| FR-5411 magic-link | T-020, T-021, T-022, T-023 | ✅ |
| FR-5412 session cookie | T-018 | ✅ (нужно дополнить тестом cookie name) |
| FR-5413 не пересекаться с admin | T-018 | ✅ |
| FR-5414/5415 magic в T-001/T-002 | T-024 | ✅ |
| FR-5416 rate-limit | T-021, T-033 | ✅ (но рег + reset password rate-limit missing) |
| FR-5420 merge orders | T-040, T-041 | ✅ |
| FR-5421 hook on Order.create | T-044 | ✅ |
| FR-5422 AdminChangeLog | T-045 | ✅ |
| FR-5430 addresses | T-061 | ✅ |
| FR-5431 marketingOptIn migrate | T-062, T-067 | 🟡 **migration logic** не описана |
| FR-5432 sync to Twenty | T-067 | ✅ |
| FR-5433 email change | T-068 | ✅ |
| FR-5434 role | T-051, T-070 | ✅ |
| FR-5435 privacy filter | T-054, T-059, T-110-T-113 | ✅ |
| FR-5436 team invite | T-052 | ✅ |
| FR-5437 personal toggle | T-055 | ✅ |
| FR-5440 export | T-074, T-081 | ✅ |
| FR-5441 delete | T-075, T-084 | ✅ |
| FR-5442 block delete with active orders | T-082 | ✅ |
| FR-5443 admin GDPR | T-074, T-075 | ✅ |
| FR-5444 gdprConsentAt | в data-model + T-031 | ✅ |
| FR-5445 privacy matrix | T-013, T-110-T-113 | ⚠️ нужна явная **field-level** проверка (A5) |
| FR-5446 Customer → Twenty | T-091, T-092 | ⚠️ + missing lookup-by-email-first (C1) |
| FR-5447 Company → Twenty | T-093 | ✅ |
| FR-5448 crmPersonId/crmCompanyId | в data-model | ✅ |
| FR-5449 cascade delete | T-083 | ✅ |
| FR-5450 inbound webhook | T-094 | ⚠️ требует расширения 048 contracts (A9) |

**Missing tasks**:
- ❌ Forgot/reset password (B1).
- ❌ Migration of `Order.marketingOptIn` snapshot semantics (FR-5431 detail).
- ❌ CSRF protection — есть в T-117 как тест, но не реализация (отдельная задача в Foundational/Phase 2).
- ❌ Backfill `crmPersonId` from existing Twenty Persons (C1).
- ❌ Account deletion confirmation email (B6 UX).
- ❌ Logout-cookie-cleanup detail (B7).

### D3 🟡 80+ tasks — размер спринта

Текущая раскладка:
- Phase 1-2 (setup + foundational): ~18 задач.
- Phase 3-5 (US1+US2+US3 = MVP): ~28 задач.
- Phase 6-8 (US4+US5+US6): ~25 задач.
- Phase 9-12 (GDPR + Twenty + backfill + security): ~25 задач.
- Phase 13 (US7): ~8 задач (P3 отложено).

Без P3: ~96 задач для одного спринта.

`plan.md` оценивает «1–2 спринта (~10–15 рабочих дней)» — **нереалистично** для одного разработчика на full B2C+B2B+GDPR+sync+backfill.

**Реалистичная разбивка**:
- **Sprint 1 (10 дней)**: Setup + Foundational + US1 + US2 + US3 = MVP B2C → ~46 задач. Жёстко. Для одного — тесно, но возможно если без полировки.
- **Sprint 2 (10 дней)**: US5 + US6 + GDPR + Twenty sync + Backfill = админ-функции + 152-ФЗ → ~45 задач.
- **Sprint 3 (5-10 дней)**: US4 (B2B-роли) + Security audit + Polish → ~20 задач.
- **Sprint 4**: US7 (approval) — отдельно.

**Рекомендация**: разбить tasks.md на **3 спринта** в `tasks.md ## MVP` секции; либо вынести US4 / US6 в отдельную спеку 054b если приоритет ниже.

### D4 🟢 Архитектура tasks правильная

- Setup → Foundational → US1 (P1) → US2 (P1) → US3 (P1) — правильная зависимость.
- US4/5/6 — параллельные после US1-3 — OK.
- Phase 9-12 (compliance) — pre-release требование — OK.
- Phase 13 (US7) — отложено — OK.

---

## РЕЗЮМЕ И БЛОКЕРЫ ДЛЯ Phase 2

### 🔴 Блокеры (обязательно решить до старта Phase 2 коллекций):
1. **A1** — Magic-link: opaque vs JWT, явная архитектура session (research.md Q4 закрыть).
2. **A4 + A5** — Privacy-matrix owner/accountant: переписать `data-model.md §9`, ввести field-level access в Payload.
3. **A8** — Источник истины `marketingOptIn` / `emailValid` после 054: явная миграция и hook semantics; обновить 049-emitter.
4. **A9** — Twenty inbound (Person/Company webhook) — либо расширить 048 (новый FR-4811), либо вынести FR-5450 в follow-up.
5. **A13** — Customer auth cookie name **должен** быть явный (`customer_session`) — иначе сломает Payload Admin login.
6. **B9** — CSRF protection — поднять до FR.
7. **C1** — Backfill `crmPersonId` из существующих Twenty Persons при first-sync.
8. **C2** — `Customer.emailValid` как первоисточник — обновить 049 bounce-hook.
9. **C5** — 047 toggle: additive, без правки 047 спеки.

### 🟡 Средние (решить до релиза US1-3):
- A2, A3, A6, A7, A10, A12, A14
- B5, B6, B7, B8, B10
- C4
- D1 (US6 → P1.5), D3 (разбить tasks на 3 спринта)

### 🟢 Nit:
- A11, B2, B3, B4, B11, C3, C6, D2, D4

### Дополнительные требования
- Создать `research.md` с явными ответами на Q1, Q2, Q3, Q4, Q5, Q7, Q8 — **до Phase 2**.
- Создать `screens.md` — отложено до Phase 2 (UX-зависимость, не блокер для коллекций).
- Обновить `07-build-specifications/document-register.md` — добавить запись 054 со статусом «в работе».
- Обновить `49 spec.md / data-model.md` — пометить `marketingOptIn` / `emailValid` как "after 054 → Customer is source of truth".
- Обновить `48 spec.md / contracts/twenty-fields.md` — добавить `marketingOptIn`, `messengerOptIn` поля на Person + inbound webhook contract (если решено реализовать FR-5450 в 054).

### Положительные находки
- Структура спеки SDD-полная: все обязательные секции, 7 US с приоритетами, 50 FR с тегами, 8 SC, явные Open Questions.
- Хорошее покрытие edge cases (8 штук, осмысленные).
- Phase 11 backfill — продуманный (dry-run, idempotent, батчи).
- Risk & Mitigation таблица в plan.md — реалистична, без рoseiness.
- OpenAPI 3.1 контракт — детальный, с error codes, security schemes, GDPR endpoints.
- Privacy-matrix в data-model — попытка явной field-level RBAC (хотя нужна доработка A5).

Спека на **80%** готова к Phase 2 после закрытия 9 блокеров.
