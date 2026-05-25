# Clarification + Review Notes: 053-returns-and-refunds

**Дата ревью**: 2026-05-24
**Reviewer**: agent (по запросу Sergey)
**Спека**: `specs/053-returns-and-refunds/{spec.md, plan.md, data-model.md, tasks.md, contracts/returns-api.openapi.yaml}`
**Cross-ref**: 047 (ApiShip + `Order.status=returned` + `disputeFlag`), 048 (Twenty CRM matrix), 049 (notification matrix + T-XXX IDs), 051 (immutability whitelist FR-5106/5107), 052 (T-010 reserved), `07-build-specifications/order-lifecycle-spec.md §2.1 / §6`, `apps/web/src/lib/lifecycle/{status-machine.ts, events.ts}`, `apps/web/src/collections/Orders.js`.

Формат: **CRITICAL** — блокеры, без правки которых имплементация 053 невозможна; **HIGH** — серьёзные пробелы, требующие решения до старта; **MEDIUM** — gaps в скоупе/UX/legal compliance; **LOW** — полировка / тесты / документация. В конце — таблица action items и заключение.

---

## CRITICAL — блокеры имплементации

### C1. `status-machine.ts` не разрешает `completed → delivered` даже под `reopenAuthorized`

**Где**: spec.md §Edge Cases «Возврат после `Order.status = completed`»; data-model.md §2 «Откат от completed к delivered» (хук afterChange returns); FR-5316.

**Что не так**: `apps/web/src/lib/lifecycle/status-machine.ts:31` — `completed: ["completed"]`. `assertTransition` (строка 51) проверяет `reopenAuthorized` **только** как право выйти из completed, но всё равно потом дёргает `canTransition`, который запрещает любой переход кроме `completed → completed`. Тест `__tests__/status-machine.test.ts:33-39` это явно подтверждает: «still throws when reopenAuthorized=true if status-machine doesn't allow it».

При этом order-lifecycle-spec.md §2.1 строка 186 декларирует: `delivered/completed → returned ... менеджер вручную`. Декларация vs реализация — рассинхрон, и 053 на эту декларацию опирается.

**Без правки FR-5316 принципиально нереализуем** — afterChange returns не сможет вернуть Order на delivered.

**Fix**: расширить `ALLOWED["completed"] = ["completed", "delivered", "returned"]` под условием `reopenAuthorized`, либо ввести отдельный whitelist «reopen-only transitions». Обновить unit-тесты (positive case `completed → delivered` под `reopenAuthorized + disputeFlag = true`). Добавить task в `tasks.md` 053 (в Phase 1 / FND). Зафиксировать как FR в 053 (например, FR-5316a «При наличии `reopenAuthorized=true` от хука returns.afterChange разрешён переход `completed → delivered` с заполнением `closedAt = null`, `disputeFlag = true`»).

---

### C2. 051 FR-5107 whitelist не включает `hasReturns / returnsCount / totalRefunded`

**Где**: 051 spec.md FR-5106 (строки 84-88) блокирует мутации в paid+; FR-5107 (строка 89) разрешает `internalComment, history, notifications[], crmRefs.*, shipment.*, delivery.{trackNumber,shippedAt}, payment.*, marketingOptIn, messengerOptIn, disputeFlag`. **Не указаны** computed-поля 053: `hasReturns`, `returnsCount`, `totalRefunded`.

**Что не так**: data-model.md 053 §2 расширяет Orders тремя computed-полями и пишет их из `returns.afterChange` через `payload.update({ collection: "orders", ... })`. Эта запись пройдёт через Orders.beforeChange и будет **отклонена** immutability-хуком 051 (FR-5106 блокирует «прочее»; FR-5108 запишет это в admin-change-log как rejected).

**Fix**: patch к 051 spec.md FR-5107 — добавить `hasReturns, returnsCount, totalRefunded` в whitelist; также `payment.refunds[]` (формально под `payment.*` уже разрешено, но лучше явно упомянуть). Добавить явный task в 053 `tasks.md`: «Patch к 051 spec — обновить FR-5107 whitelist + регрессионный тест в Orders.beforeChange».

---

### C3. 049 matrix не содержит `return.*` событий и `T-014..T-017` шаблонов

**Где**: 049 `contracts/notification-events.md:13-30` (events table) и строки 108-129 (matrix) — событий `return.*` **нет**; templates T-010..T-013 и T-014..T-017 **не зарегистрированы**. 049 spec.md по grep — ноль упоминаний `T-014/T-015/T-016/T-017/return.*`.

**Что не так**: spec 053 FR-5322 и plan.md §Integration §4 опираются на шаблоны T-014/T-015/T-016/T-017 и события `return.created/approved/rejected/refunded/overdue`. Если матрица не расширена, 049's `notification-jobs` scheduler не найдёт правила и dropнет события без отправки.

Дополнительно: T-010 уже зарезервирован за 052 (`cart.abandoned`). T-011..T-013 — пустые слоты. T-014 (053 plan.md) — для **manager**, что нарушает соглашение 049 (T-0xx = customer, T-1xx = manager — см. notification-events.md строки 108-129).

**Fix**:
1. Patch к 049 `notification-events.md`: добавить events `return.created/approved/rejected/refunded/overdue` в events table; добавить в matrix правила (customer + manager rows). **Переименовать** T-014 → T-114 (manager-side `return.created`), оставить T-015/T-016/T-017 как customer-side. Согласовать нумерацию (предложение: T-015-return-approved, T-015b-return-rejected, T-016-return-refunded, T-017-overdue, T-114-return-received-manager).
2. Patch к 053 plan.md §Integration §4 и tasks.md T027/T028/T034/T035: исправить ID.
3. Добавить explicit task в 053 tasks.md: «Patch 049 matrix — расширить событиями return.* и зарегистрировать шаблоны».

Без этих правок шаблоны не зарегистрируются и спека 053 «молча» опирается на ещё не существующий контракт.

---

### C4. 048 не содержит `return.*` событий и стадий `Won.Refunded` / `Won.PartialRefund`

**Где**: 048 spec.md FR-4804 (строка 123) явно перечисляет события из 047 — `return.*` отсутствуют. 048 `contracts/twenty-crm-sync.md:182-195` (event → action mapping) — нет `return.created`, `return.approved`, `return.rejected`, `return.refunded`. Stage map (строки 39, 161-162) использует `Won`, `Won.Delivered`, `Won.Closed`, `Lost` — `Won.Refunded` / `Won.PartialRefund` **отсутствуют**.

**Что не так**: 053 plan.md (Integration §3, строки 156-170) и FR-5321 прямо требуют этих событий и стадий, но в 048 контрактах их нет — 048's `crm-sync-jobs` scheduler их dropнет. Также plan.md упоминает кастомные поля Opportunity (`returnsCount`, `totalRefunded`, `lastReturnNumber`) — они должны быть в 048 `contracts/twenty-fields.md`, иначе `crm-migrate-fields` не создаст их.

**Fix**:
1. Patch к 048 spec.md FR-4804 — расширить список событий `return.created/approved/rejected/refunded`.
2. Patch к 048 contracts: добавить стадии `Won.Refunded` (полный возврат) и `Won.PartialRefund` (или решить не вводить — спорно для Twenty workflow), описать переходы.
3. Patch к 048 contracts/twenty-fields.md: новые fields Opportunity.
4. Добавить explicit task в 053 tasks.md (расширить существующий T055): «Patch 048 spec + contracts; запустить `crm-migrate-fields`».

---

## HIGH — серьёзные пробелы

### H1. `DomainEventKind` в `lib/lifecycle/events.ts` не содержит `return.*`

**Где**: `apps/web/src/lib/lifecycle/events.ts:18-34` — union содержит 15 значений (`order.*` + `shipment.*`); `return.*` **отсутствует**. `OrderSnapshot` тоже не содержит полей `returns` / `currentReturn`.

**Что не так**: spec 053 plan.md и tasks.md T010 предполагают создать `lib/returns/events.ts` как обёртку над `emitDomainEvent`. Но **сам тип `DomainEventKind` не расширен**, TypeScript отвергнет `emitDomainEvent({ kind: "return.created", ... })`. Ни одного explicit task на расширение этого типа в spec нет.

**Fix**: добавить task в Phase 1 FND: «Расширить `apps/web/src/lib/lifecycle/events.ts:DomainEventKind` значениями `return.created`, `return.approved`, `return.rejected`, `return.received`, `return.refunded`, `return.cancelled`, `return.overdue`; добавить поле `currentReturn?: ReturnSnapshot` в `OrderSnapshot` (или ввести отдельный `ReturnEventPayload`); обновить subscribers (`notifications/subscriber.ts`, `crm/twenty/subscriber.ts`) — `kinds[]` фильтр + handlers». Также определить, останется ли `OrderSnapshot` достаточным для return-событий или нужен `ReturnSnapshot` тип.

---

### H2. Стартовая точка окна (ст. 26.1) — не зафиксирована явно

**Где**: spec.md FR-5340 («10 календарных дней с момента предъявления требования») + US1 AS2 «delivered 20 дней назад». tasks.md T011 декларирует функцию `isWithinShortWindow(deliveredAt: Date)`.

**Что не так**: закон РФ № 2300-1 ст. 26.1 — отсчёт **с момента передачи товара**. Это `Order.deliveredAt`. В spec.md это **подразумевается**, но явно не зафиксировано как FR. Нужно зафиксировать поведение и для `pickup` доставок (момент = `shipment.deliveredAt` при вручении в ПВЗ), и для случая `deliveredAt = null` (например, ручной перевод менеджером в `completed` без webhook'а — нужен fallback на `closedAt - closureWindowDays`).

**Fix**: новый FR (например, FR-5341) «Окно возврата отсчитывается от `Order.deliveredAt`; для pickup-доставок — от момента вручения в ПВЗ (webhook ApiShip `delivered`); при отсутствии `deliveredAt` — fallback на `Order.createdAt + закладка`. Все формулы и тесты используют именно это поле».

---

### H3. Менеджер создаёт Return вручную — UI/API не описаны

**Где**: data-model.md §1 — enum `createdVia` имеет значение `manager-manual`, но ни User Story, ни FR, ни OpenAPI **не описывают** механику. В contracts/returns-api.openapi.yaml есть только публичный `POST /api/returns` (создаёт `customer-public`).

**Что не так**: enum-значение без поддержки в UI/API — мёртвый код; либо нужна US7 «Менеджер вручную создаёт Return от имени клиента» с admin-формой и POST'ом (`createdVia=manager-manual`), либо `manager-manual` нужно удалить из enum для упрощения скоупа MVP. На практике клиент часто звонит/пишет — кейс реалистичен, рекомендация — оставить и описать.

**Fix**: добавить US7 P2 «Менеджер создаёт возврат от имени клиента». Добавить `POST /api/admin/returns` в OpenAPI (admin-auth, body — расширенный CreateReturnRequest + `orderId` вместо `orderToken`). Добавить task в Phase 2.

---

### H4. `Order.disputeFlag` ↔ `hasReturns` — нет правила синхронизации/сброса

**Где**: spec.md §Input («Сейчас возврат отражается единственным флагом `Order.disputeFlag`»); data-model.md §2 — хук поднимает `disputeFlag = true` при создании Return из completed (строки 273-279). Нигде не описано: **кто и когда сбрасывает `disputeFlag = false`**, если все returns ушли в `rejected/cancelled`.

**Что не так**: после 053 в системе два сигнала «есть открытые возвраты»: `Order.disputeFlag: bool` (FR-902 из 047, нужен для cron-closure) и `Order.hasReturns: bool` (053 FR-5310). При расхождении (например, return перешёл в rejected, но disputeFlag остался true) cron `closure.ts` не закроет заказ.

**Fix**: новый FR — «`Order.disputeFlag` рассматривается как derived fast-flag: `true` ⟺ существует хотя бы один Return со статусом ∈ {requested, approved, received}. Синхронизируется в `recomputeOrderReturnAggregates(orderId)` (data-model.md §7). При терминальных статусах всех returns → `disputeFlag = false`, cron-closure снова имеет право закрыть заказ». Связать с FR-5310.

---

### H5. Иммутабельность `Return.items[]` после approved — не описана

**Где**: spec.md US1 («чекбоксы напротив позиций») vs §Edge Cases «Частичный возврат + остаток в пути»; FR-5308 («менеджер может корректировать `refundAmount` ±»). data-model.md §1 — `items[]` без явного immutability.

**Что не так**: spec позволяет клиенту выбрать состав, потом менеджер может корректировать `refundAmount`, но **может ли менеджер менять `items[]`**? Если да — это разрушает audit-trail и snapshot для КСФ (US5 строит КСФ на `items[].priceSnapshot`). Если нет — нужно явно зафиксировать.

**Fix**: новый FR «`Return.items[]` иммутабельны после перехода `approved`. До `approved` — менеджер может скорректировать состав через action ‘Скорректировать заявку’ с обязательным `managerNotes`; история изменений пишется в `history[]`». Добавить валидацию в Returns.beforeChange.

---

### H6. Валидация `Sum(refundAmount) ≤ Order.totals.total` отсутствует

**Где**: data-model.md §7 — `recompute` агрегирует `totalRefunded` из всех `refunded` returns. §Edge Cases «Полностью возвращённый заказ» — переводит Order в `returned` при `totalRefunded >= total`.

**Что не так**: при ошибке менеджера (`refundAmountOverride` в OpenAPI `/received`, плюс ещё один Return) сумма возвратов может **превысить** `Order.totals.total`. Нет валидации. В худшем случае ЮKassa тоже примет такой refund (если у Order есть несколько payments) — фактический ущерб.

**Fix**: новый FR (например, FR-5308b) «`Sum(returns[refunded ∪ pending].refundAmount) ≤ Order.totals.total` — валидация в Returns.beforeChange при создании/изменении `refundAmount`; при превышении — error + admin escalation. Также проверка в `/refund` route перед вызовом ЮKassa».

---

### H7. Refund-механика для оплат БЕЗ ЮKassa (счёт ПП, юрлица)

**Где**: spec.md §Edge Cases «Возврат при оплате наличными / счётом»; tasks.md T033 пункт 3 — `refundMethod = bank-transfer` → переход в `refunded` с `manualRefundConfirmation`.

**Что не так**:
- Поля `manualRefundConfirmation`: `byUser`, `at`, `paymentDoc` — но **нет реквизитов** счёта получателя. Для юрлица возврат должен идти на тот же расчётный счёт, с которого пришла оплата (НК РФ + банковская практика). Нет ни snapshot'а реквизитов плательщика на момент `paid`, ни формы ввода для менеджера.
- Не описана генерация **платёжного поручения PDF** (нужна ли — или бухгалтер делает сам в банке?).

**Fix**:
1. Расширить `manualRefundConfirmation` группу полями `bankAccount`, `bik`, `recipientName`, `purpose` (формат «Возврат по заказу № ...»).
2. Новый FR — «При `paid` (юрлицо) snapshot реквизитов плательщика сохраняется в `Order.payment.payerBankDetails` (если есть в платёжке); при создании Return с `refundMethod=bank-transfer` поля предзаполняются».
3. (Опц.) генерация PDF платёжки — отметить как nice-to-have или out-of-scope.

---

### H8. 54-ФЗ чек коррекции — scope MVP vs FR-5339 («нельзя пропустить»)

**Где**: spec.md FR-5323 («MVP — заглушка с логом и admin-уведомлением»), FR-5339 («нельзя пропустить даже если ККТ временно недоступна, в retry-очереди»). plan.md §Fiscal — «stub-модуль».

**Что не так**: FR-5323 и FR-5339 противоречат друг другу. На практике без реального коннектора к ККТ (Атол / Эвотор) MVP может **только** создать запись `fiscal-corrections.status = pending_manual` + письмо менеджеру; **физическое пробитие** чека — ручное в личке ККТ. FR-5339 «retry-очередь» при отсутствии коннектора бессмысленна.

**Fix**: уточнить FR-5339 — «MVP scope: запись в `fiscal-corrections` + email менеджеру; SLA на ручное пробитие = 24 часа с момента `refunded` (требование 54-ФЗ — «в день расчёта»); при отсутствии отметки `status=issued` за 24 ч — escalate владельцу; коннектор к ККТ — out-of-scope follow-up». Юридическая ответственность остаётся на владельце, но **след** в системе обязателен.

---

### H9. УПД корректировочный — PDF only vs ЭДО (Диадок / СБИС / Такском)

**Где**: spec.md US5, FR-5338, FR-5324; plan.md `lib/documents/credit-memo.ts`; tasks.md T045, T049.

**Что не так**: «КСФ» в реальном РФ-документообороте B2B — это формализованный документ (XML по формату ФНС) для обмена через операторов ЭДО. PDF — только визуальное представление, для крупного клиента-юрлица **не закрывает** потребность (бухгалтерия не примет к вычету без ЭДО-копии или подписанного бумажного оригинала).

**Fix**: spec.md явно объявить MVP scope — «PDF УПД-1 (печатная форма) для ручной отправки клиенту по email и подписания при необходимости в бумажном виде; обмен через операторов ЭДО (Диадок / СБИС / Такском) — follow-up спека 056+». В US5 AS1 и FR-5338 добавить эту пометку.

---

## MEDIUM — gaps в scope/UX/legal

### M1. Перечень невозвратных товаров (ПП 2463) — нет поля на Product

**Где**: spec.md §Edge Cases «Возврат товара из перечня ПП РФ № 2463»; tasks.md T011 — `isNonReturnableSku(product): boolean // stub`.

**Что не так**: спека ссылается на ПП 2463, но нет поля на products. Менеджер US2 AS3 видит баннер «товар из перечня ПП 2463», но баннер строится на `false` стабе.

**Fix**: новый FR — «Добавить поле `Product.returnability: select [returnable | non-returnable | defect-only]` (default `returnable`); seed-значения проставить через спеку product-import (`07-build-specifications/product-import-spec.md`) по категориям из ПП 2463». Для MVP допустим stub, но с TODO.

---

### M2. Multi-shipment Order — частичный возврат при `in_transit` остатке

**Где**: spec.md §Edge Cases «Частичный возврат + остаток в пути».

**Что не так**: констатируется проблема, но не описано **как форма US1** определяет «доступные к возврату» позиции. В Order может быть split (несколько `shipments[]`); часть delivered, часть in_transit. tasks.md T017 (`ReturnableItemRow`) использует `qtyAvailableForReturn` — но эта величина нигде не определена.

**Fix**: новый FR — «`qtyAvailableForReturn(orderItem) = orderItem.qty - sum(returns[*].items[orderItemSku=this.sku].qty for non-terminal returns) - qty в позициях, чей shipment.status ∈ {pending, created, in_transit}` (т.е. ещё не доставленные не подлежат возврату, но доступны для cancel)». Добавить unit-тест.

---

### M3. Idempotency key для public `POST /api/returns`

**Где**: contracts/returns-api.openapi.yaml — `CreateReturnRequest.clientRequestId` (UUID, 10 минут). Spec.md FR-5328 говорит «rate-limit 3/час».

**Что не так**: 10 минут окно идемпотентности vs реальный сценарий — клиент может оставить заявку, передумать, через час оформить ещё одну на ту же позицию. Это не идемпотентность, а defensive против double-click. Нужно явно отметить.

**Fix**: уточнить в OpenAPI description: «`clientRequestId` — окно дедупликации против двойного клика (10 мин); rate-limit 3/час на токен — против abuse; обычные повторные заявки клиента создают новый Return с собственным `returnNumber`». Также добавить FR в спеке.

---

### M4. Photos upload — validation/EXIF/virus-scan

**Где**: spec.md FR-5330 («до 5 файлов × 5 МБ»).

**Что не так**: нет ограничения по MIME (только `image/*`?), нет EXIF-strip (геолокация — персональные данные по 152-ФЗ), нет virus-scan.

**Fix**: расширить FR-5330: «MIME: `image/jpeg, image/png, image/heic, image/webp`; EXIF-strip обязателен (152-ФЗ — геолокация = ПДн); virus-scan — отметить как nice-to-have / out-of-scope». Также — антифрод: фото без EXIF не может быть использовано клиентом против магазина (нет «доказательства даты»).

---

### M5. Public `/policies/returns/` — нет описания контента

**Где**: spec.md FR-5336, tasks.md T023.

**Что не так**: страница декларирована, но **что именно** на ней (структура секций, выдержки из ст. 26.1, ссылки на ПП 2463, реквизиты склада, согласие 152-ФЗ при загрузке фото) — не описано. Это копирайт-задача с юристом владельца.

**Fix**: добавить в spec.md §Owner-content section с TODO-перечнем; T023 пометить `[needs-content]` с тегом `owner-review-required`.

---

### M6. Refund при возврате части позиций — `Order.shipment.status` не меняется

**Где**: data-model.md §2 — описан полный возврат → `Order.status = returned`. Шипмент **не упомянут**.

**Что не так**: в 047 `Order.shipment.status` включает `returned` (для webhook ApiShip — посылка вернулась к отправителю). При **клиентском** возврате (не возврат недоставленного) исходный shipment.status остаётся `delivered` (логистически посылка дошла). Return-shipment (US4) — отдельный объект, его статус хранится в `Return.apiShipReturnOrderId / shipment status` — не описан явно.

**Fix**: явно прописать в spec.md (Edge Cases или новый FR) — «При возврате клиента `Order.shipment.status` исходной отгрузки **не меняется**; return-shipment ApiShip — отдельный объект, его статус не агрегируется в `Order.shipment.status`».

---

### M7. Twenty stage transition — рассинхрон со spec 048

**Где**: 053 plan.md (строки 156-170) — таблица с `return.refunded → Won.Refunded`. 048 contracts/twenty-crm-sync.md строки 39, 91, 161-162, 184-195 — стадии без `Won.Refunded`.

См. **C4** — это критично, но также имеет MEDIUM-аспект: **переход обратно**. Если потом часть Return отменена / отказана (например, бухгалтерия выяснила что КСФ ошибочен), нужен ли откат стадии `Won.Refunded → Won`? Не описано.

**Fix**: 048 patch (см. C4) + отдельно описать в 053 plan.md правило обратного перехода: «При cancel/reject Return после `refunded` — стадия Twenty не возвращается автоматически, требует ручного решения менеджера (баннер ‘Return reverted — проверьте стадию Opportunity’)».

---

### M8. Cron `auto-cancel-stale` — конфликт с FR-5340 (10-day overdue)

**Где**: plan.md §Cron Jobs:
- 1: `auto-reminder-manager` — каждые 24 ч, `requested > 24h`
- 2: `overdue-refund-alert` — каждые 24 ч, > 10 дней.
- 3: `auto-cancel-stale` — каждые 7 дней, `approved > 30 дней`.

**Что не так**: cron #3 cancel'нет approved-Return через 30 дней. Cron #2 (FR-5340) к этому моменту уже 20 дней шлёт пометки о нарушении ст. 22 (10-day deadline на refund). Авто-cancel approved-Return — потенциально юридически опасный (клиент в претензии может потребовать refund + неустойку, а админ может отрицать на основании авто-cancel).

**Fix**: уточнить FR — `auto-cancel-stale` не действует, если истёк 10-day deadline (тогда оставляем заявку открытой + escalate владельцу). Либо явно требовать `managerNotes` при авто-cancel.

---

## LOW — полировка, тесты, документация

### L1. Тесты не покрывают ряд FR

По tasks.md — Vitest юниты: state-machine (T004), policies (T013), yookassa (T029), credit-memo (T044), apiship return (T039); integration: returns-api (T014), refund (T030); E2E (T015, T057).

**Не покрыты**:
- FR-5302 (атомарность `RT-YYYY-NNNN` при concurrent inserts) — нет race-теста. См. 051 как референс (там был race test через `Promise.all` 5 параллельных creates).
- FR-5316 (rollback `completed → delivered`) — нет теста на полный сценарий (depends on C1 fix).
- FR-5321 (CRM-sync `return.*`) — нет integration-теста (зависит от C4).
- FR-5333 (audit trail `history[]` — корректность records).
- FR-5340 (cron overdue — 10-day timing).
- FR-5310 (computed-поля Orders — recompute идемпотентность).

**Fix**: добавить tasks T-X..T-Y с unit/integration-тестами.

---

### L2. ID шаблонов в spec.md не консистентны с plan.md table

spec.md FR-5337 упоминает `T-015` («одобрено») как single template; plan.md notification table содержит **T-014 (manager-on-create)**, T-015 (customer-approved), T-016 (customer-refunded), T-017 (overdue); spec.md US2 AS2 «T-015-rejected» — это уже **второй** T-015. tasks.md T028 — `T-014-return-received.tsx`, `T-015-return-approved.tsx`, `T-015-return-rejected.tsx`.

**Fix**: свести нумерацию в один FR и таблицу:
- T-114-return-received (manager, on create)
- T-015-return-approved (customer)
- T-015b-return-rejected (customer) — либо T-018
- T-016-return-refunded (customer + manager BCC)
- T-017-return-overdue (customer + manager)

Решить с автором 049 + обновить spec/plan/tasks одновременно.

---

### L3. Order.totals — fixed-point arithmetic для `totalRefunded`

data-model.md §2 — `totalRefunded: number defaultValue: 0`. Поле в копейках (как везде в проекте). Но это не указано в `admin.description` (как у `payment.refunds[].amount`).

**Fix**: добавить `admin: { description: "В копейках." }` к Orders.totalRefunded и ко всем суммам, относящимся к деньгам.

---

### L4. `correctionReceiptStatus = not_required` — критерий

tasks.md T037 описывает «если providerPaymentId отсутствует — `correctionReceiptStatus=not_required`». Но это **не всегда корректно**: ИП на УСН без ККТ или плательщик на ОСН без обязательной ККТ — разные кейсы. Нужно опираться на `paymentsSettings.useCashRegister` (новый флаг?) либо на `Order.payment.fiscalReceiptId` (если фискализация исходной оплаты была).

**Fix**: FR — «`correctionReceiptStatus = not_required`, если исходная оплата не была фискализирована (нет `Order.payment.fiscalReceiptId`). Если фискализирована — `pending`».

---

### L5. Документация — обновить `order-lifecycle-spec.md §6`

tasks.md T054 запланировано. Хорошо. Но также нужно обновить:
- `order-lifecycle-spec.md §2.1` — пометить, что `completed → delivered` теперь возможен под `reopenAuthorized`.
- `order-lifecycle-spec.md §3` — добавить блок «Return notifications T-014..T-017».
- `apps/web/AGENTS.md` — добавить «053 — модуль возвратов».

**Fix**: расширить T054 на все три файла.

---

### L6. Sequence на год — переход через 31 декабря

data-model.md §1.5 «При смене года — создаётся новая sequence (миграция через Payload migrate:create + ручной SQL)».

**Что не так**: «ручной SQL» — это операционный риск (забыл — заказы не создаются 1 января). 051 решает это lazy-init'ом, но 053 не указывает явно.

**Fix**: реализовать lazy-init в `number-generator.ts` (T005) — при первом обращении в новом году создавать sequence `returns_year_NNNN_seq` через `CREATE SEQUENCE IF NOT EXISTS ... START 1`. То же для credit-memos (T006). Зафиксировать как FR.

---

## SDD-чеки

### User Stories — приоритизация (6)
- US1 (P1) — публичная форма ✅.
- US2 (P1) — admin approve/reject ✅.
- US3 (P1) — refund + 54-ФЗ ✅.
- US4 (P2) — ApiShip return-shipment ✅ (зависит от US2).
- US5 (P2) — КСФ для юрлица. **Спорно**: для юрлица без КСФ контрагент не сможет принять вычет — возможно P1. Зависит от структуры клиентской базы владельца.
- US6 (P3) — аналитика ✅ ops/polish.

**Gap**: нет US «Менеджер вручную создаёт Return от имени клиента» (см. H3).

### Tasks ↔ US (57 задач)
Формально все связаны. Отсутствуют explicit tasks:
- Patch к 049 (matrix + templates).
- Patch к 048 (events + Won.Refunded stage + fields).
- Patch к 051 (FR-5107 whitelist).
- Patch к `status-machine.ts` + tests (C1).
- Extend `DomainEventKind` (H1).
- Multi-shipment `qtyAvailableForReturn` formula (M2).

### FR ↔ tests (40 FR)
См. **L1** — 5 ключевых FR без покрытия тестами.

### Edge cases
Хорошо покрыты. Не покрыты:
- Refund > paid (что если клиент доплачивал? в Order нет нескольких payments сейчас, но архитектурно — что блокирует?).
- Возврат после `cancelled` (Order был отменён до отгрузки и потом возврат — невозможен, OK).
- Возврат в условиях `Order.status = expired` (счёт не оплачен — невозможен, OK).
- Refund при наличии `Lost` в Twenty (если 048 sync уже двинул Opportunity на Lost после `order.cancelled` — но Order не cancelled при возврате; OK).

---

## Сводная таблица action items

| #   | Severity   | Action                                                                                                              | Где (anchor) |
|-----|------------|----------------------------------------------------------------------------------------------------------------------|--------------|
| C1  | **CRITICAL** | Расширить `ALLOWED["completed"] = ["completed", "delivered", "returned"]` под `reopenAuthorized`; обновить тесты; добавить task. | spec.md §Edge Cases, lib/lifecycle/status-machine.ts |
| C2  | **CRITICAL** | Patch к 051 spec.md FR-5107 — добавить `hasReturns, returnsCount, totalRefunded` в whitelist; добавить task.            | 051 spec.md L89 |
| C3  | **CRITICAL** | Patch к 049 `notification-events.md` — события `return.*` + шаблоны (правильная нумерация); добавить task.             | 049 contracts |
| C4  | **CRITICAL** | Patch к 048 spec FR-4804 + contracts (events + stage `Won.Refunded` + fields Opportunity); добавить task.              | 048 spec.md L123, contracts |
| H1  | **HIGH**   | Расширить `DomainEventKind` в `lib/lifecycle/events.ts` 7 событиями `return.*`; обновить subscribers.                     | apps/web/src/lib/lifecycle/events.ts |
| H2  | **HIGH**   | Зафиксировать в FR — окно отсчитывается от `Order.deliveredAt` (+fallback).                                              | spec.md FR-5340 |
| H3  | **HIGH**   | Описать US7 «Менеджер создаёт Return вручную» + `POST /api/admin/returns` в OpenAPI; либо удалить `manager-manual` enum. | data-model.md §1, openapi |
| H4  | **HIGH**   | FR — `disputeFlag` ↔ `hasReturns` derived rule; явный сброс при терминальных returns.                                    | data-model.md §2, §7 |
| H5  | **HIGH**   | FR — иммутабельность `Return.items[]` после `approved` + admin action ‘Скорректировать заявку’.                          | spec.md FR-5308 |
| H6  | **HIGH**   | FR — валидация `Sum(returns.refundAmount) ≤ Order.totals.total`; unit-тест.                                              | data-model.md §7 |
| H7  | **HIGH**   | Расширить `manualRefundConfirmation` полями `bankAccount/bik/recipientName`; FR — snapshot реквизитов плательщика.       | data-model.md §1 |
| H8  | **HIGH**   | Уточнить FR-5339 — MVP track-only scope; SLA 24 ч на ручной чек коррекции.                                              | spec.md FR-5339 |
| H9  | **HIGH**   | Уточнить FR-5338 — PDF only, без ЭДО; ЭДО — follow-up 056+.                                                            | spec.md FR-5338 |
| M1  | **MEDIUM** | Новое поле `Product.returnability` + seed по ПП 2463 (новый FR-5341).                                                  | tasks.md T011 |
| M2  | **MEDIUM** | FR — `qtyAvailableForReturn` формула с учётом non-terminal returns + in_transit shipments.                              | spec.md Edge Cases |
| M3  | **MEDIUM** | OpenAPI clarify — `clientRequestId` = idempotency 10min vs rate-limit 3/час.                                            | contracts/returns-api.openapi.yaml |
| M4  | **MEDIUM** | FR-5330 расширить: MIME-whitelist + EXIF strip; virus-scan — out-of-scope.                                              | spec.md FR-5330 |
| M5  | **MEDIUM** | T023 пометить `[needs-content]`; добавить TODO для юриста владельца.                                                   | tasks.md T023 |
| M6  | **MEDIUM** | Явно прописать — `Order.shipment.status` не меняется при возврате клиента.                                              | spec.md Edge Cases |
| M7  | **MEDIUM** | Описать обратный переход Twenty `Won.Refunded → Won` при cancel/reject Return.                                          | plan.md §CRM |
| M8  | **MEDIUM** | Cron `auto-cancel-stale` не действует после 10-day deadline; escalation к владельцу.                                    | plan.md §Cron Jobs |
| L1  | **LOW**    | Тесты — race на `RT-YYYY-NNNN`, rollback `completed→delivered`, history audit, overdue cron, recompute идемпотентность.   | tasks.md |
| L2  | **LOW**    | Свести нумерацию шаблонов T-114/T-015/T-015b/T-016/T-017 — обновить spec/plan/tasks.                                     | spec.md FR-5337 |
| L3  | **LOW**    | `Order.totalRefunded` admin.description — указать «в копейках».                                                          | data-model.md §2 |
| L4  | **LOW**    | FR — критерий `correctionReceiptStatus=not_required` через `Order.payment.fiscalReceiptId`, не `providerPaymentId`.       | tasks.md T037 |
| L5  | **LOW**    | T054 расширить: обновить `order-lifecycle-spec.md §2.1+§3` и `apps/web/AGENTS.md`.                                       | tasks.md T054 |
| L6  | **LOW**    | Lazy-init sequence для нового года (вместо ручного SQL); FR + реализация в `number-generator.ts`.                        | data-model.md §1.5 |

---

## Заключение

Спека 053 — **сильная по охвату**: реальный legal-compliance (ст. 26.1, ст. 22, ПП 2463, 54-ФЗ, НК ст. 169), полноценный цикл с idempotency, snapshot'ы, audit-trail, чёткое разграничение customer-public / admin / cron, продуманные edge-cases (multi-shipment, не-ЮKassa оплаты, КСФ для юрлица, фискальный track).

Но **четыре блокера** (C1–C4) делают спеку **не готовой к старту имплементации**:
- C1 — `status-machine.ts` физически блокирует ключевой переход `completed → delivered`, на котором держится FR-5316.
- C2 — 051 immutability whitelist отвергнет любые мутации новых computed-полей Order из 053 afterChange.
- C3 — 049 matrix не содержит ни одного `return.*` события и шаблонов T-014..T-017 (их там нет — нужно патчить).
- C4 — 048 не знает про события возвратов и стадии `Won.Refunded`, sync будет терять события.

Помимо этого, 9 **HIGH-пробелов** (H1–H9) — каждый требует решения до Phase 1, иначе придётся возвращаться. Особенно: расширение `DomainEventKind` (H1), правило `disputeFlag` ↔ `hasReturns` (H4), валидация `Sum(refundAmount) ≤ total` (H6) и MVP-scope для 54-ФЗ и КСФ (H8/H9).

**Рекомендация**: перед стартом — **patch-round-сессия** (одно заседание):
1. PATCH 051 FR-5107 — whitelist (5 минут).
2. PATCH 047 / `status-machine.ts` — разрешить `completed → delivered` под `reopenAuthorized` (1 час с тестами).
3. PATCH 048 spec/contracts — `return.*` events + Won.Refunded stage + Opportunity fields (1-2 часа).
4. PATCH 049 contracts/notification-events.md — добавить события и шаблоны с согласованной нумерацией (T-114/T-015/T-016/T-017) (1 час).
5. PATCH 053 spec.md / plan.md / tasks.md — добавить explicit tasks на эти 4 патча + закрыть HIGH-пробелы (FR-5316a, FR-5308b, FR-5341, и пр.) (2-3 часа).

После такого patch-round'а 053 готова к Phase 1 / FND. Полный имплементационный цикл — 1.5–2 спринта, как и заложено в plan.md.

**Sign-off**: на текущий момент я бы **не давал зелёный свет** на старт Phase 2+ tasks до закрытия CRITICAL и согласования HIGH с владельцем.
