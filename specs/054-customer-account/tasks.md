---
description: "Task list for 054-customer-account"
---

# Tasks: Customer Account & Identity

## Phase 1: Setup

- [ ] T001 Создать ветку `054-customer-account`, каталоги `apps/web/src/lib/customers/`, `apps/web/src/app/account/`, `apps/web/src/app/api/customers/`, `apps/web/src/components/account/`, `apps/web/src/components/admin/customers/`.
- [ ] T002 Добавить env-переменные из `data-model.md §8` в `.env.example` и `apps/web/.env.local`.
- [ ] T003 Закрыть Q1/Q2/Q4/Q5/Q7/Q8 в `research.md` до начала Phase 2. Решение по Q2 (адреса массивом или отдельной коллекцией) — критическое для дальнейших задач.
- [ ] T004 Lint-правило `import "server-only"` для всех `lib/customers/*` (кроме чистых типов).
- [ ] T005 Feature-flag `customerAccountsEnabled` в `admin-configuration` global.

## Phase 2: Foundational (коллекции и миграция)

- [ ] T010 Создать `apps/web/src/collections/Customers.ts` по `data-model.md §1` (auth=true, отдельная от Users). Подключить в `payload.config.ts`.
- [ ] T011 Создать `apps/web/src/collections/Companies.ts` по `data-model.md §2`. Подключить.
- [ ] T012 (опц.) Создать `apps/web/src/collections/CustomerAddresses.ts` по `data-model.md §3` — только если research.md решит вынести.
- [ ] T013 Расширить `apps/web/src/collections/Orders.js`: добавить `customerId`, `companyId`, `isPersonalOrder`, обновить `access.read` по privacy-matrix `data-model.md §9`.
- [ ] T014 Расширить `apps/web/src/collections/Carts.ts` (форвард-задел для 052) и `Returns.ts` (для 053): `customerId`, `companyId`, `anonymousId`. Если 052/053 ещё не есть — оставить как minimal stub-fields в Orders или TODO-комментарий.
- [ ] T015 Миграция БД: индексы `idx_orders_customer_id`, `idx_orders_company_id`, `idx_orders_customer_email_lower` (см. `data-model.md §4`).
- [ ] T016 Запустить `pnpm --filter @soliton/web generate:types` после изменений collections.
- [ ] T017 Сделать утилиту `lib/customers/auth.ts`: `getCurrentCustomer(req)`, `requireCustomer()`, `requireRole(role)`.
- [ ] T018 Cookie-конфигурация: customer-сессия = `customer_session` (отдельно от admin `payload-token`); проверить, что `/admin` и `/account` сессии независимы (юнит-тест).
- [ ] T018a Cookie isolation test (FR-5412a): verify `customer_session` cookie doesn't collide with `payload-token`. Тест: логин в admin + логин в customer одновременно -> обе сессии работают, logout одной не ломает другую.
- [ ] T018b Add CSRF protection FR-5417 to all `/api/customers/*` mutations (POST/PATCH/DELETE). Реализация через Payload-native CSRF token или custom double-submit cookie.
- [ ] T018c Implement `Customer.accountState` enum (`email-only | password-set | invited-stub | deleted`) и transitions: magic-link click -> `email-only`; set-password -> `password-set`; invite -> `invited-stub`; GDPR delete -> `deleted`.

## Phase 3: US1 — Magic-link для гостя (P1)

- [ ] T020 [US1] Реализовать `lib/customers/magic-link.ts`: `issueMagicLink(email, opts)`, `consumeMagicLink(token)`. TTL 30 мин, одноразовое consumption.
- [ ] T021 [US1] API `POST /api/customers/magic-request/route.ts`: rate-limit 3/15мин по email и по IP; создаёт/находит `customers` запись по email, генерирует токен, ставит notification-job через 049 на новый шаблон `T-301-magic-link`.
- [ ] T022 [US1] API `GET /api/customers/magic-consume?token=X`: валидирует, выдаёт `customer_session` cookie, redirect на `?next=` (default `/account/orders/[orderId]/` если в payload токена был `orderId`).
- [ ] T023 [US1] Страница `/account/magic/[token]/page.tsx`: server-component, валидирует токен, выдаёт сессию, редиректит.
- [ ] T024 [US1] Расширить 049-шаблоны `T-001` (paid) и `T-002` (invoice-issued): включать magic-link на email клиента (FR-5414/5415).
- [ ] T025 [US1] Добавить новый шаблон `T-301-magic-link.tsx` (универсальный, для magic-request UI и B2B-приглашений).
- [ ] T026 [US1] Кнопка «Создать пароль» на странице заказа в magic-сессии: form `/account/profile/set-password`.
- [ ] T027 [US1] Unit-тесты `magic-link.test.ts`: TTL, одноразовое consumption, идемпотентность, edge cases.
- [ ] T028 [US1] Playwright e2e: оформить guest-заказ → дойти до paid → mailtrap получает T-001 с magic-link → клик → `/account/orders/[orderId]/` открывается без логина.

## Phase 4: US2 — Регистрация и login (P1)

- [ ] T030 [US2] Страница `/account/register/page.tsx`: форма (email, password, firstName, lastName, phone, customerType, согласие 152-ФЗ). Server-action.
- [ ] T031 [US2] API `POST /api/customers/register/route.ts`: валидация zod, bcrypt-hash, создание `customers`, gdprConsentAt = now, выдача session, merge-call (см. Phase 5). **FR-5416a**: always return 200 с message «check your email». При duplicate email — отправлять «вы уже зарегистрированы, войдите» вместо 409 (anti-enumeration).
- [ ] T032 [US2] Страница `/account/login/page.tsx`: форма email + password + «Войти по magic-link» fallback.
- [ ] T033 [US2] API `POST /api/customers/login/route.ts`: проверка пароля, rate-limit 5/15мин, обновление `lastLoginAt`, `loginCount`.
- [ ] T034 [US2] API `POST /api/customers/logout/route.ts`: очистка session.
- [ ] T035 [US2] Страница `/account/orders/page.tsx`: server-component, рендерит список Order с учётом privacy-фильтра.
- [ ] T036 [US2] Страница `/account/orders/[orderId]/page.tsx`: карточка заказа read-only с учётом privacy-matrix (`data-model.md §9`).
- [ ] T037 [US2] API `GET /api/customers/me/route.ts`, `GET /api/customers/me/orders/route.ts`.
- [ ] T038 [US2] AccountNav компонент + layout `/account/layout.tsx`: header с email клиента, ссылками на разделы, кнопкой logout.
- [ ] T039 [US2] Playwright e2e: register → login → видит свои заказы, не видит чужие.
- [ ] T039a [US2a] Implement forgot-password flow: `POST /api/customers/forgot-password` — отправляет email с reset-link (opaque token, TTL 30 мин). Response always 200 (anti-enumeration).
- [ ] T039b [US2a] Implement reset-password flow: `POST /api/customers/reset-password?token=X` — обновляет passwordHash, инвалидирует все sessions кроме текущей.
- [ ] T039c [US2a] Unit-тест + Playwright e2e: forgot-password -> reset-password -> login с новым паролем.

## Phase 5: US3 — Merge гостевой истории (P1)

- [ ] T040 [US3] Реализовать `lib/customers/merge.ts`: `mergeGuestOrders(customerId, email)`, `mergeGuestCart(customerId, anonymousId)`, `mergeGuestReturns(customerId, email)`. Транзакционно, идемпотентно.
- [ ] T040a [US3] marketingOptIn migration (FR-5431a): при создании Customer — скопировать `marketingOptIn` из самого последнего Order с этим email. После 054: Customer = source of truth; Order.marketingOptIn = snapshot.
- [ ] T041 [US3] Hook `afterCreate` на `customers`: вызывает `mergeGuestOrders` для нового email.
- [ ] T042 [US3] Hook `afterLogin` на `customers`: проверяет, есть ли merge-кандидаты (orders с email и без customerId).
- [ ] T043 [US3] API `POST /api/customers/me/merge-cart/route.ts`: принимает `cartId` из localStorage, привязывает.
- [ ] T044 [US3] Hook `afterCreate` на `orders`: если `customerId IS NULL` — ищет `customers` по `customer.email`, проставляет (FR-5421).
- [ ] T045 [US3] Логирование merge-операций в `AdminChangeLog`.
- [ ] T046 [US3] Unit-тесты `merge.test.ts`: 0 orders, N orders, повторный logIN не дублирует, collision (email уже занят).
- [ ] T047 [US3] Playwright e2e: создать 3 guest-Order → register с тем же email → /account/orders показывает все 3.

## Phase 6: US4 — B2B-роли и команда компании (P2)

- [ ] T050 [US4] Страница `/account/company/page.tsx`: обзор компании (owner-only).
- [ ] T051 [US4] Страница `/account/company/team/page.tsx`: список Person + invite-form (owner-only).
- [ ] T052 [US4] API `POST /api/customers/company/team/route.ts`: invite через создание stub-customers + magic-link на email с шаблоном `T-302-invite`.
- [ ] T053 [US4] Шаблон `T-302-invite.tsx` (49 расширение).
- [ ] T054 [US4] Privacy-фильтр в `/account/orders/page.tsx`: по `customer.role` (`data-model.md §9`).
- [ ] T055 [US4] Toggle «Это личный заказ» в чекауте 047 (только для company-contact): `Order.isPersonalOrder = true` -> `companyId = null`. Реализовать как additive компонент `PersonalOrderToggle.tsx`, вставляемый в `PhysicalCheckoutForm` при наличии active customer session. 047 spec НЕ меняется.
- [ ] T056 [US4] Страница `/account/company/settings/page.tsx`: редактирование Company (taxId read-only после первого save).
- [ ] T057 [US4] API `PATCH /api/customers/company/[id]/route.ts`: только для owner.
- [ ] T058 [US4] Playwright e2e: создать Company + 3 Person → owner видит все Order, accountant видит только финансы, purchaser видит только свои.
- [ ] T059 [US4] Unit-тесты privacy-фильтра: для каждой роли — корректная фильтрация `orders.find()`.

## Phase 7: US5 — Профиль, адреса, preferences (P2)

- [ ] T060 [US5] Страница `/account/profile/page.tsx`: ФИО, телефон, languagePreference.
- [ ] T061 [US5] Страница `/account/profile/addresses/page.tsx`: CRUD адресов.
- [ ] T062 [US5] Страница `/account/profile/preferences/page.tsx`: marketingOptIn, messengerOptIn, language. Сводно: единая точка управления opt-in/opt-out, синхронизация с `/preferences/[token]/` из 049.
- [ ] T063 [US5] API `PATCH /api/customers/me/profile/route.ts`.
- [ ] T064 [US5] API `CRUD /api/customers/me/addresses/route.ts`.
- [ ] T065 [US5] API `PATCH /api/customers/me/preferences/route.ts`.
- [ ] T066 [US5] Интеграция в чекаут 047: если customer залогинен — предзаполнить форму из дефолтного адреса; добавить toggle «Сохранить этот адрес в моей адресной книге».
- [ ] T067 [US5] Sync-job на изменение marketingOptIn/messengerOptIn → Twenty Person через очередь 048.
- [ ] T068 [US5] Смена email — двухшаговое подтверждение (отправка confirm-ссылки на новый email).
- [ ] T068a [US5] Email change security FR-5433a: при `POST /api/customers/me/change-email` — (1) confirm-link на новый email, (2) notification с undo-link на старый email. Окно 72 часа. После change — все sessions кроме текущей закрыты.

## Phase 8: US6 — Admin-вью Customer (P2)

- [ ] T070 [US6] Custom field components в Payload admin для коллекции customers:
  - `CustomerOrdersPanel.tsx` — таблица Order по customerId.
  - `CustomerReturnsPanel.tsx` — таблица Return по customerId.
  - `CustomerCartsPanel.tsx` — таблица Cart по customerId.
- [ ] T071 [US6] Ссылка «Открыть в Twenty» в карточке (deep-link на `Person`).
- [ ] T072 [US6] Кнопка «Слить с другим Customer» — диалог выбора target + transaction merge.
- [ ] T073 [US6] API `POST /api/admin/customers/merge/route.ts`: source → target merge для всех `orders`, `carts`, `returns`, source.deletedAt = now.
- [ ] T074 [US6] Кнопка «Экспортировать данные (152-ФЗ)»: API `GET /api/admin/customers/export/[id]/route.ts` (admin-вариант FR-5440).
- [ ] T075 [US6] Кнопка «Удалить по GDPR»: API `POST /api/admin/customers/delete/[id]/route.ts` с confirmation.
- [ ] T076 [US6] Аналогичные ручки на самообслуживание: `GET /api/customers/me/export/route.ts`, `POST /api/customers/me/delete/route.ts` (FR-5440/5441).

## Phase 9: GDPR / 152-ФЗ

- [ ] T080 Реализовать `lib/customers/gdpr.ts`: `exportCustomerData(customerId)`, `deleteCustomerData(customerId)`.
- [ ] T081 Export-JSON со всеми табл (customer, addresses, orders metadata, returns, carts, notifications log).
- [ ] T082 Delete-проверка: блок если у customer есть Order в `pending_payment | paid | fulfilling | shipped` (FR-5442).
- [ ] T083 Cascade-delete на Twenty Person (через 048 sync-job, FR-4807a).
- [ ] T084 ПДн-обнуление: email → `deleted-{id}@gdpr.local`, phone → null, addresses → [], fullName → "Удалён".
- [ ] T085 AdminChangeLog запись с timestamp + initiator (self vs manager).
- [ ] T086 Тесты: export содержит все таблицы; delete с активным Order возвращает 409; delete с completed Order успешен.

## Phase 10: Twenty CRM sync (расширение 048)

- [ ] T090 Расширить очередь 048 `crm-sync-jobs` — добавить типы события `customer.created`, `customer.updated`, `customer.deleted`, `company.created`, `company.updated`.
- [ ] T091 Реализовать `lib/customers/twenty-sync.ts`: маппинг Customer → Person, Company → Company. Использовать существующие `lib/crm/twenty/mappers.ts`.
- [ ] T092 Hook `afterChange` на `customers` ставит sync-job.
- [ ] T093 Hook `afterChange` на `companies` ставит sync-job.
- [ ] T094 Расширить webhook-handler `/api/webhooks/twenty/route.ts` (из 048 US5): принимать обновления Person → синхронизировать в `customers` (last-write-wins по updatedAt).
- [ ] T095 Тесты: customer.updated → job попадает в очередь → Twenty Person upsert по email.
- [ ] T095a Backfill `crmPersonId` from existing Twenty Persons (FR-5446a): при первом sync Customer -> Twenty — lookup Person по email в Twenty; если найден — upsert (взять existing id), записать `crmPersonId` в Customer. Предотвращает дубликаты Person.

## Phase 11: Backfill (one-shot)

- [ ] T100 Написать скрипт `apps/web/scripts/backfill-customers.mjs`:
  - флаги `--dry-run | --apply | --batch-size=100`.
  - Шаги: `SELECT DISTINCT email FROM orders` → создать customers stub → `UPDATE orders SET customer_id`.
  - Аналогично для companies по ИНН.
  - Логи в `AdminChangeLog`.
  - Twenty-sync через очередь (не bypass).
- [ ] T101 Документация запуска в `quickstart.md`.
- [ ] T102 Тестовый прогон на dev-БД, метрики (count created, count updated, errors).
- [ ] T103 Идемпотентность: повторный run не плодит дубликатов (matches by email/ИНН).

## Phase 12: Privacy и security

- [ ] T110 Тест: API `/api/customers/me/orders` НЕ возвращает Order чужого customer.
- [ ] T111 Тест: API `/api/customers/me/orders` для accountant фильтрует чувствительные поля (items, address).
- [ ] T112 Тест: API `/api/customers/me/orders` для purchaser НЕ возвращает Order коллег.
- [ ] T113 Тест: isPersonalOrder=true НЕ виден owner коллеги.
- [ ] T114 Тест: customer удалён → его сессия истекает в течение 1 минуты (через cron `cleanup-expired-sessions`).
- [ ] T115 Тест: magic-link одноразовый и TTL соблюдается.
- [ ] T116 Тест: rate-limit на login и magic-request.
- [ ] T117 Тест: CSRF-токен на all POST/PATCH/DELETE на `/api/customers/*`.

## Phase 13: US7 — B2B approval flow (P3, отложено в отдельную фазу)

- [ ] T120 [US7] Создать коллекцию `PurchaseApprovals` (`data-model.md §6`).
- [ ] T121 [US7] Логика в `/account/cart/`: если `cart.total > company.approvalLimit` → CTA «Запросить апрув».
- [ ] T122 [US7] API `POST /api/customers/cart/request-approval/route.ts`.
- [ ] T123 [US7] Шаблон `T-303-approval-request` (49 расширение).
- [ ] T124 [US7] Страница `/account/company/approvals/page.tsx` для owner: список pending + кнопки approve/reject.
- [ ] T125 [US7] API `POST /api/customers/company/approvals/[id]/route.ts`.
- [ ] T126 [US7] Auto-expire cron: pending > 72 ч → status=expired.
- [ ] T127 [US7] Тесты.

## Phase N: Polish

- [ ] T130 [P] Документация: `quickstart.md` со сценариями (guest magic-flow, register-flow, backfill, B2B-setup).
- [ ] T131 [P] Screens `screens.md` S20-S25 wireframes (login, register, magic, orders, profile, B2B-team).
- [ ] T132 [P] OpenAPI-контракт `contracts/customer-api.openapi.yaml` — полное описание всех `/api/customers/*`.
- [ ] T133 [P] Обновить `07-build-specifications/document-register.md` — пометить 054 как «в работе».
- [ ] T134 [P] Обновить `apps/web/AGENTS.md` — добавить раздел про 054 и `lib/customers/`.
- [ ] T135 [P] Анализ performance: query `/account/orders` p95 — добавить индексы при необходимости.
- [ ] T136 [P] Анализ security: penetration-test на enumeration emails через magic-request (отвечать одинаковым timing независимо от существования).
- [ ] T137 [P] Алерт владельцу при merge-conflicts > 1% / неделю.
- [ ] T138 [P] Локализация EN-форм для `/account/*` (после MVP).

## Dependencies

- **Hard**:
  - 047 завершён (orders + event emitter).
  - 049 хотя бы в части email-sender для T-301/T-302 шаблонов.
  - 048 — желательно (для Twenty sync), но если ещё не готов — sync-jobs кладутся в очередь, обработаются после релиза 048.
- **Soft**: 052, 053 — добавляем customerId форвард-задел.

## MVP

US1 + US2 + US3 = минимум первого релиза (guest-magic, register, merge).
US5 (profile) + US6 (admin-вью) — второй релиз.
US4 (B2B-роли) — третий релиз.
US7 (approval flow) — отложено в отдельную спеку или последняя фаза.

## Risk Stops

- T013 (privacy в orders.access) — без unit-теста на изоляцию ролей в продакшен НЕ выкатывать.
- T100 (backfill) — обязательно сначала `--dry-run` на копии prod-БД, отчёт владельцу, потом `--apply`.
- T080 (GDPR delete) — никаких hard-delete на `customers` записях с pending Order.
