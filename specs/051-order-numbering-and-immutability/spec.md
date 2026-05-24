# Feature Specification: Order Numbering and Paid-Order Immutability

**Feature Branch**: `051-order-numbering-and-immutability`

**Created**: 2026-05-23

**Status**: Draft

**Input**: Ввести человекочитаемый номер заказа (`clientNumber` формата `SO-2026-0142`) для клиентского общения вместо длинного `publicToken` и заблокировать мутации финансово-значимых полей (`items[]`, `totals.snapshot*`, `delivery.priceSnapshot`, `customer.email`, `clientNumber`) после первой оплаты (`payment.paidAt != null`).

## Контекст и связи

- **Канонический документ**: `07-build-specifications/order-lifecycle-spec.md` (этап 6 «Review & confirm» — snapshot цены; этап 7 «Payment» — переход в `paid`).
- **Зависимости**:
  - 047 — поля `delivery.priceSnapshot`, `totals.*` и переход в `paid` уже существуют.
  - 048 — `Order.crmRefs` и mapper `Order → Opportunity` (нужно подмешать `clientNumber` в `Opportunity.name`).
  - 049 — email-stub `T-001/T-003/T-005/T-008` и матрица шаблонов (нужно подмешать `clientNumber` в subject).
- **Источник правды**: Payload `orders` коллекция (`apps/web/src/collections/Orders.js`).
- **Не меняем**: `publicToken` остаётся для URL `/cart/order/[token]/` (рандом нужен по security-причинам), `clientNumber` добавляется параллельно.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Менеджер диктует номер заказа по телефону (Priority: P1)

Клиент звонит в поддержку и не помнит ничего, кроме «я оплачивал что-то вчера». Менеджер открывает список заказов в Payload Admin, видит колонку «Номер» с человекочитаемым значением `SO-2026-0142`, фильтрует/ищет по нему за один тап. В исходящем email клиент видит тот же номер в теме `[SO-2026-0142] Ваш заказ оплачен` и в теле письма. В Twenty CRM Opportunity называется `SO-2026-0142 — Иван Петров (ООО Ромашка)`. В накладной ApiShip поле `clientNumber` совпадает с тем, что видит клиент.

**Why this priority**: критично для повседневной работы менеджера и поддержки; без этого приходится диктовать 16-символьный hex-токен.

**Independent Test**: оформить тестовый заказ → проверить, что новый `clientNumber` появился в колонке admin, в subject отправленного email и в `OrderRequest.clientNumber` при создании в ApiShip.

**Acceptance Scenarios**:

1. **Given** новый заказ создаётся через checkout, **When** beforeChange срабатывает на `operation=create`, **Then** поле `clientNumber` заполняется значением вида `SO-YYYY-NNNN`, уникальным в пределах года.
2. **Given** два заказа создаются одновременно (race), **When** оба beforeChange атомарно запрашивают следующий номер, **Then** получают **разные** номера без коллизий (FR-5102).
3. **Given** заказ переходит в `paid`, **When** инициируется email-stub `T-001`, **Then** `email.subject` содержит `[SO-YYYY-NNNN]`.
4. **Given** заказ синхронизируется в Twenty, **When** mapper строит `Opportunity.name`, **Then** имя начинается с `clientNumber`.
5. **Given** заказ передаётся в ApiShip, **When** mapper строит `OrderRequest`, **Then** `clientNumber` (а не `publicToken`) попадает в поле `clientNumber`.

---

### User Story 2 — Бухгалтер не может случайно изменить позиции оплаченного заказа (Priority: P1)

В Payload Admin бухгалтер открывает оплаченный заказ, чтобы посмотреть НДС, случайно кликает в количество позиции, меняет с 5 на 2 и нажимает «Сохранить». Сейчас изменение проходит — стоимость заказа становится неверной, а в ЮKassa уже зафиксирован оригинальный платёж. После 051 изменение блокируется hook'ом beforeChange (триггер: `wasEverPaid = true`, т.е. `payment.paidAt != null`): возвращается ошибка валидации `ORDER_IMMUTABLE_AFTER_PAID` с указанием полей, и запись об инциденте уходит в `admin-change-log` (audit).

**Why this priority**: финансовый риск — расхождение в учёте, налоговая отчётность, рекламации; нет технических причин разрешать такие изменения после фиксации оплаты.

**Independent Test**: заказ с `payment.paidAt != null` → попробовать через REST API Payload изменить `items[0].quantity` → получить 400 с кодом `ORDER_IMMUTABLE_AFTER_PAID` → запись в `admin-change-log` с попыткой и actor'ом.

**Acceptance Scenarios**:

1. **Given** заказ с `wasEverPaid = true` (`payment.paidAt != null`), **When** пользователь меняет `items[*]`, **Then** beforeChange бросает `ValidationError('items: immutable after payment')`.
2. **Given** заказ с `wasEverPaid = true`, **When** пользователь меняет `totals.snapshotTotal` или `totals.snapshotSubtotal`, **Then** beforeChange отклоняет.
3. **Given** заказ с `wasEverPaid = true`, **When** пользователь меняет `delivery.priceSnapshot.cost`, **Then** beforeChange отклоняет.
4. **Given** заказ с `wasEverPaid = true`, **When** пользователь меняет `customer.email`, **Then** beforeChange отклоняет (счёт уже выставлен на этот email).
5. **Given** заказ с `wasEverPaid = true`, **When** разрешённые поля (always-mutable whitelist из FR-5107) меняются, **Then** изменение проходит.
6. **Given** заказ с `wasEverPaid = true` и пользователь явно указал `reissueReason` (для legit-кейса перевыпуска), **When** меняет `clientNumber` через специальный admin-роут, **Then** изменение разрешается, audit-запись содержит причину.
7. **Given** заказ в статусе `new`/`pending_payment` (и `payment.paidAt == null`), **When** меняются те же поля, **Then** изменение проходит без ограничений.

**UX immutability**: hook beforeChange throws `Forbidden` → Payload toast. Admin UI использует `admin.condition` для readOnly на замороженных полях.

### Edge Cases

- **Гонка генерации номеров**: два чекаута завершаются в одну миллисекунду → атомарная sequence гарантирует разные значения; в случае retry/конфликта — повтор до 3 раз.
- **Backfill существующих заказов**: на момент релиза в БД уже есть заказы без `clientNumber`; скрипт `apps/web/scripts/backfill-client-numbers.mjs` назначает номера в порядке `createdAt ASC` группируя по году. Backfill должен передавать `req.context.skipImmutability = true` или временно отключать hook.
- **Переход через границу года**: 31 декабря 23:59 → 1 января 00:01 — номер сбрасывается на `0001` для нового года; sequence именуется per-year (`order_seq_2026`).
- **Ручной reissue** через админку: если менеджер обнаружил, что номер был ошибочно показан клиенту другого заказа, поле `clientNumberReissueReason` (text) обязательно для записи нового значения; старый номер записывается в `clientNumberHistory[]`.
- **Backfill и внешние системы**: Backfill заполняет только локальный `clientNumber`; ApiShip/Twenty не получают reissue. Синхронизация во внешних системах — отдельный sync-скрипт (опционально).
- **Дубликат при backfill**: уникальный индекс `unique(clientNumber)` ловит коллизию; скрипт пропускает с предупреждением.
- **Сохранение черновика без оплаты**: immutability hook молчит, пока `payment.paidAt == null` (заказ никогда не был оплачен).
- **Возврат и отмена после оплаты (`cancelled`, `returned`)**: если `wasEverPaid = true`, позиции остаются заблокированными (нельзя «переписать что вернули») — для возвратов будет отдельная коллекция `returns` (спека 053).
- **Длина sequence**: формат `NNNN` рассчитан на ≤9999 заказов в год; при превышении формат автоматически расширяется до `NNNNN` (FR-5103) — алерт владельцу за 30 дней до достижения.
- **Admin manual create**: при создании заказа вручную через Payload Admin триггерить hook генерации clientNumber как обычно.
- **PG sequences**: никогда не сбрасываются и не удаляются.

## Requirements *(mandatory)*

### Functional Requirements

#### Нумерация

- **FR-5101**: System MUST автоматически генерировать поле `clientNumber` формата `^SO-\d{4}-\d{4,}$` при `operation=create` для всех новых заказов.
- **FR-5102**: System MUST гарантировать атомарность генерации: при одновременном создании N заказов выдаются N различных номеров без gap'ов (или с допустимыми gap'ами при rollback'ах, но без дубликатов).
- **FR-5103**: System MUST автоматически расширять формат счётчика с `NNNN` до `NNNNN` при достижении 9999 в году.
- **FR-5104**: System MUST устанавливать year-компонент по `createdAt` заказа (по UTC; локальная TZ владельца — Europe/Moscow, фиксируется на момент создания).
- **FR-5105**: System MUST поддерживать **backfill** существующих заказов скриптом `apps/web/scripts/backfill-client-numbers.mjs`: idempotent, dry-run по умолчанию, `--apply` для записи, порядок `createdAt ASC`.

#### Иммутабельность

- **FR-5106**: System MUST блокировать в beforeChange изменение следующих полей когда `payment.paidAt != null` (т.е. заказ был хоть раз оплачен). Вводится derived concept `wasEverPaid: boolean` = `payment.paidAt != null`. Point-of-no-return = первая оплата, а не строка статуса. Замороженные поля (согласно lifecycle §13.5):
  - `items[]` (полностью),
  - `totals.snapshot*` (`snapshotSubtotal`, `snapshotVat`, `snapshotTotal`),
  - `delivery.priceSnapshot`,
  - `customer.email`,
  - `clientNumber`.
- **FR-5107**: System MUST разрешать при `wasEverPaid = true` изменения следующих полей (always-mutable whitelist):
  `internalComment`, `history`, `notifications[]`, `crmRefs.*`,
  `shipment.*`, `delivery.{trackNumber, shippedAt, pickupExpiresAt}`, `payment.*`,
  `marketingOptIn`, `messengerOptIn`, `disputeFlag`, `deliveredAt`, `closedAt`, `status`,
  `hasReturns`, `returnsCount`, `totalRefunded`, `customerId`, `companyId`, `cartId`.
- **FR-5108**: System MUST записывать каждую отклонённую попытку мутации в `admin-change-log` с полями `{actorType, actorName, targetCollection: "orders", targetId, changeType: "update", diffSummary, beforeSnapshot, afterSnapshot}` (для аудита и отчётов).

#### Использование номера

- **FR-5109**: System MUST использовать `clientNumber` (не `publicToken`):
  - в `email.subject` всех клиентских и менеджерских шаблонов 049 (`T-001/T-003/T-005/T-008/T-101..T-105` etc.). Email subject: `Заказ {clientNumber} оплачен`. Body: clientNumber в шапке + publicToken в ссылке.
  - в `Opportunity.name` Twenty при синхронизации 048 (формат `{clientNumber} — {customer.companyName || customer.fullName}`),
  - в `OrderRequest.clientNumber` ApiShip-маппере 047. Fallback: `order.clientNumber || String(order.id)`.
  - в admin-колонке `defaultColumns` коллекции `orders` (вместо `id`).
  - Format `SO-YYYY-NNNN` — whitelist. Тесты используют env-override или `SO-9999-XXXX`.
  - При unique violation на clientNumber — до 3 повторов с jitter; на третий — log `OrderNumberGenerationFailed` и escalation.
- **FR-5110**: System MUST поддерживать ручной reissue: при обновлении `clientNumber` через специальный admin-роут с обязательным заполнением `clientNumberReissueReason` (text, ≥10 символов) — старое значение пишется в `clientNumberHistory[]` (array of `{ oldNumber, reissuedAt, reason, actorEmail }`), новое — в `clientNumber`, audit обязателен. Уникальность сохраняется только на текущем `clientNumber`. `publicToken` не ротируется при reissue clientNumber.

### Key Entities

- **`Order.clientNumber`** — text, unique, indexed; формат `SO-YYYY-NNNN`. См. data-model.md.
- **`Order.clientNumberReissueReason`** — text, optional; заполняется только при ручном reissue.
- **`Order.clientNumberHistory[]`** — array of `{ oldNumber: text, reissuedAt: date, reason: text, actorEmail: text }`. Хранит историю перевыпусков.
- **`wasEverPaid`** — derived concept: `payment.paidAt != null`. Используется immutability hook вместо status-based проверки.
- **PG sequence `order_seq_YYYY`** — атомарный счётчик per-year. Создаётся lazy в beforeChange hook: `CREATE SEQUENCE IF NOT EXISTS order_seq_${year} START 1; SELECT nextval(...)`. Backfill не является обязательным для работы hook'а.
- **`admin-change-log`** — существующий аудит (или создаётся минимальный, если ещё нет); запись отклонённых мутаций.

## Success Criteria *(mandatory)*

- **SC-001**: 100% новых заказов (созданных после релиза 051) получают валидный `clientNumber` в формате `SO-YYYY-NNNN` — проверяется CI-тестом и query'ем `count(clientNumber IS NULL AND createdAt > release-date) == 0`.
- **SC-002**: 0% успешных мутаций `items[*]` / `totals.snapshotTotal` / `delivery.priceSnapshot.cost` для заказов с `wasEverPaid = true` за 90 дней наблюдения — проверяется выборкой из `admin-change-log` (все попытки должны быть в логе как `rejected`).
- **SC-003**: Backfill-скрипт завершает обработку 100% существующих заказов без потерь и без дубликатов — критерий приёмки скрипта: `count(orders) == count(orders WHERE clientNumber IS NOT NULL)` после `--apply`.
- **SC-004**: SLA добавления `clientNumber` к новому заказу p95 ≤ 50 мс (один доп. roundtrip в БД).
- **SC-005**: 100% писем 049 в шаблонах `T-001/T-003/T-005/T-008` имеют `[SO-YYYY-NNNN]` в subject — проверяется snapshot-тестом.

## Assumptions

- БД — PostgreSQL; доступны `CREATE SEQUENCE` и `nextval()`. Если в проекте появится не-PG backend — fallback на atomic SELECT FOR UPDATE + retry (described in `contracts/clientNumber-generator.ts`).
- Все существующие заказы создавались с консистентным `createdAt` — backfill полагается на этот порядок.
- TZ владельца — Europe/Moscow; year-компонент берётся в этом TZ (не UTC), чтобы `2026-01-01 02:00 MSK` попадал в год `2026`.
- Реализация — TypeScript / JS; без новых внешних зависимостей.
- Существующий `publicToken` остаётся для URL — security-чувствительный, его нельзя угадать.

## Out Of Scope

- **Возвраты и кредитовые ноты** — отдельная спека (053).
- **Перенумерация существующих заказов «как было бы по новым правилам»** — `clientNumber` присваивается backfill'ом в порядке `createdAt`, без перестановок.
- **Локализованные форматы** (например, `СЛ-2026-0001` кириллицей) — не делаем; формат латиницей универсален.
- **Custom prefix per channel** (b2c vs b2b) — потенциальное расширение, отложено в `deferred-content-track.md`.
