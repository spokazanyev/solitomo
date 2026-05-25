# Implementation Plan: Customer Account & Identity

**Branch**: `054-customer-account` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

## Summary

Ввести в Soliton сущности `customers` (Payload auth-collection, отдельная от admin Users) и `companies` (relational ref для B2B). Реализовать публичный личный кабинет `/account/*` с двумя путями входа: (а) magic-link для гостей после оформления заказа (US1) — снижение барьера до нуля, (б) email+password для постоянных клиентов (US2). Merge гостевой истории по email при первом логине (US3, идемпотентно). Двусторонний sync с Twenty Person/Company через расширение очереди 048. B2B-роли (owner/accountant/purchaser/contact) с privacy-фильтром в `/account/orders/` (US4). GDPR-экспорт и soft-delete (US6).

## Technical Context

**Language/Version**: TypeScript 5, Node 20, Next.js 16 App Router.

**Primary Dependencies**:
- Payload v3 `auth` API — встроенная поддержка bcrypt, JWT-сессий, password-reset (используем как основу для magic-link и password-flow).
- `jsonwebtoken@^9` — для magic-link токенов (если Payload-native session не достаточно гибкая для одноразового token + долгой session).
- `bcryptjs` (через Payload-default) — хэширование паролей.
- `zod@^3` — валидация форм login/register/profile.
- `@payloadcms/richtext-lexical` уже подключен — используем для дисплея в admin.
- Email-провайдер из 049 (Postmark/Mailgun) для рассылки magic-link.

**Storage**: PostgreSQL (через Payload). Новые таблицы: `customers`, `companies`, опционально `customer_addresses` и `purchase_approvals` (US7).

**Testing**: Vitest (unit для merge-логики, privacy-фильтра, magic-token TTL); Playwright e2e (guest-magic-flow, register-flow, merge-on-login, B2B-role-isolation).

**Target Platform**: server-side Next.js API + Payload auth. Браузерные страницы — React server components с client islands для форм.

**Performance Goals**:
- Login response p95 ≤ 300 мс (включая bcrypt verify).
- Magic-link issue ≤ 100 мс (DB write + queue notification).
- `/account/orders/` рендер ≤ 500 мс p95 (с N=50 заказов клиента).
- GDPR export p95 ≤ 5 с (для клиента с ≤ 100 заказов).

**Constraints**:
- Customer auth — **строго отдельная** от admin Users (разные cookies, разные middleware).
- Magic-link токен — **одноразовый consumption** + TTL 30 минут (decision Q4 — рекомендуем 30 мин).
- Privacy: B2B-роли проверяются на API-уровне (не только UI) — обязательный hook в Payload `access` функциях.
- GDPR-удаление — **необратимое** обнуление ПДн; Order.customer.* snapshot **сохраняется** для бухгалтерии.

**Scale/Scope**:
- 1–2 спринта (~10–15 рабочих дней).
- ~3 новые коллекции (customers, companies, опционально customer-addresses).
- ~10 новых публичных страниц (`/account/*`).
- ~12 API-endpoint (login, register, magic-issue, magic-consume, profile, addresses, preferences, merge-cart, export, delete, company-team, company-invite).
- Расширение 048 очереди (Customer-sync-jobs piggyback на crm-sync-jobs).
- Расширение 049 templates (T-001/T-002/T-301 invitation/T-302 email-confirmation).

## Project Structure

```text
specs/054-customer-account/
├── spec.md
├── plan.md
├── data-model.md
├── research.md            # Q1 (Payload vs next-auth), Q2 (addresses storage), Q5 (roles)
├── screens.md             # S20 login/register/magic, S21 orders list, S22 profile, S23 B2B team
├── quickstart.md          # локальный setup, magic-link тестирование, backfill
├── tasks.md
└── contracts/
    └── customer-api.openapi.yaml
```

```text
apps/web/src/
├── collections/
│   ├── Customers.ts            # auth=true, отдельная от Users
│   ├── Companies.ts
│   ├── CustomerAddresses.ts    # опционально (если решение Q2 = «отдельная коллекция»)
│   └── PurchaseApprovals.ts    # для US7 (отложено)
├── lib/customers/
│   ├── auth.ts                 # session-helpers, getCurrentCustomer()
│   ├── magic-link.ts           # issue, consume, expire
│   ├── merge.ts                # backfill orders/carts/returns по email
│   ├── privacy.ts              # фильтр для B2B-ролей
│   ├── gdpr.ts                 # export + delete
│   └── twenty-sync.ts          # piggyback на 048 очередь
├── app/account/
│   ├── layout.tsx              # CustomerSessionProvider + редирект на login если не залогинен
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── magic/[token]/page.tsx
│   ├── orders/
│   │   ├── page.tsx            # список заказов с privacy-фильтром
│   │   └── [orderId]/page.tsx  # карточка заказа (read-only)
│   ├── profile/
│   │   ├── page.tsx
│   │   ├── addresses/page.tsx
│   │   └── preferences/page.tsx
│   ├── company/
│   │   ├── page.tsx            # обзор компании (owner-only)
│   │   ├── team/page.tsx       # пригласить/удалить Person
│   │   └── settings/page.tsx   # approvalLimit, billing
│   └── logout/route.ts
├── app/api/customers/
│   ├── login/route.ts          # POST { email, password }
│   ├── logout/route.ts
│   ├── register/route.ts
│   ├── magic-request/route.ts  # POST { email } → issue magic-link to email
│   ├── magic-consume/route.ts  # GET ?token=X → set session, redirect
│   ├── me/route.ts             # GET текущий клиент
│   ├── me/profile/route.ts     # PATCH
│   ├── me/addresses/route.ts   # CRUD
│   ├── me/preferences/route.ts # PATCH marketingOptIn etc.
│   ├── me/merge-cart/route.ts  # POST { cartId } после логина
│   ├── me/export/route.ts      # GET GDPR-экспорт
│   ├── me/delete/route.ts      # POST GDPR-удаление
│   ├── me/orders/route.ts      # GET с privacy-фильтром
│   ├── company/team/route.ts   # POST invite (owner-only)
│   └── company/[id]/route.ts   # GET/PATCH (owner-only)
├── app/api/admin/customers/
│   ├── merge/route.ts          # ручной merge двух Customer (US6)
│   ├── export/[id]/route.ts    # admin вариант FR-5440
│   └── delete/[id]/route.ts
└── components/
    ├── account/
    │   ├── LoginForm.tsx
    │   ├── RegisterForm.tsx
    │   ├── MagicLinkRequestForm.tsx
    │   ├── OrdersList.tsx
    │   ├── OrderDetailCard.tsx
    │   ├── ProfileForm.tsx
    │   ├── AddressBook.tsx
    │   ├── PreferencesForm.tsx
    │   ├── CompanyTeam.tsx
    │   └── AccountNav.tsx
    └── admin/customers/
        ├── CustomerOrdersPanel.tsx
        ├── CustomerReturnsPanel.tsx
        ├── CustomerCartsPanel.tsx
        └── CustomerMergeDialog.tsx
```

```text
apps/web/scripts/
└── backfill-customers.mjs      # one-shot миграция: создать Customer для каждого уникального Order.customer.email
```

## Constitution Check

- ПДн: customer-record содержит ПДн → access-функции на Payload коллекции `customers` строго ограничивают чтение (`req.user` ИЛИ `req.customer.id === doc.id` ИЛИ `req.customer.role === 'owner' AND req.customer.companyId === doc.companyId`).
- Секреты: bcrypt-salt в env, magic-token-secret в env (`CUSTOMER_MAGIC_SECRET`). Не утекают в client.
- AdminChangeLog: создание/удаление customers, merge-операции, изменение `role`, импорт/экспорт по GDPR.
- Не выводить ничего PII в client bundle (server-only utilities помечены `import "server-only"`).
- 152-ФЗ: согласие `gdprConsentAt` записывается при register/первом-magic-clicke; ссылка на privacy policy — обязательное поле формы.

## Phase 0 Research (research.md)

1. **Q1**: Payload v3 native auth для нескольких collections — проверить, что admin Users и customer Customers могут сосуществовать с разными cookies. Если есть конфликт — использовать next-auth + custom strategy с Payload как backend. Рекомендация по умолчанию — Payload native (меньше movable parts).
2. **Q2**: Addresses — массив на customers (`array` field в Payload) vs отдельная коллекция. Pro массива: проще join, проще migrations. Pro отдельной: scalable, легче для search, аудит изменений. Решение зависит от ожидаемого размера (≤ 5 адресов на клиента в 95% случаев — массива хватит).
3. **Q3**: Email confirmation — выбрать UX (sliding, optional, mandatory). Рекомендация: opt-in, обязательно только при смене email и для подписки на маркетинг.
4. **Q4**: Magic-link TTL — confirm 30 мин. Сравнить со стандартами Shopify (24 ч), Stripe (1 ч), Auth0 (15 мин).
5. **Q5**: B2B-роли — финализировать список и матрицу прав; решить, нужны ли custom-permissions (для очень крупных B2B).
6. **Q7**: backfill стратегия — что делать с RFQ-формами (`/api/rfq`) без полноценного email; пропустить или создать с placeholder.

## Phase 1 Outputs

- `data-model.md` — финальные схемы customers, companies, customer-addresses (если выбрано), расширения orders/carts/returns.
- `screens.md` — S20-S25 wireframes для `/account/*` и admin-карточки customer.
- `contracts/customer-api.openapi.yaml` — REST-контракты для всех `/api/customers/*` и `/api/admin/customers/*` endpoint'ов.
- `quickstart.md` — локальный setup, как протестировать magic-flow в dev, как запустить `backfill-customers.mjs`.

## Phase 2 Tasks

Создаётся `/speckit-tasks`. Группировка по US.

## Dependencies

- **Hard**:
  - 047 завершён (есть `orders` collection и event emitter).
  - 048 — должен быть как минимум каркас (очередь `crm-sync-jobs`), чтобы 054 расширил её customer/company-sync. Если 048 ещё в работе — 054 ставит свой sync через тот же интерфейс.
  - 049 готов хотя бы в части email-sender — magic-link письма используют его.
- **Soft**:
  - 052 (`carts.customerId`) — если ещё не реализовано, добавляем поле в рамках 054 forward-compatible. 053 (`returns.customerId`) — аналогично.

## Risk & Mitigation

| Риск | Митигация |
|---|---|
| Конфликт сессий admin Users vs customer Customers | Разные cookie names (`payload-token` vs `customer_session`), разные middleware. Тест: открыть `/admin` и `/account` в одной вкладке — обе сессии работают независимо. |
| Утечка ПДн между Person одной Company | Privacy-фильтр в Payload `access` функциях (server-side), unit-тесты + Playwright e2e на каждую роль. |
| Magic-link перехвачен (отправлен на не тот ящик) | TTL 30 мин, одноразовое consumption, IP/UA logging (опционально). Образовательный текст в письме: «если вы не запрашивали эту ссылку — игнорируйте». |
| Merge-конфликт при autobackfill (один email → несколько Person) | Backfill только при отсутствии `customerId IS NULL`; collision-handler собирает кандидатов и предлагает менеджеру в admin (US6 «Слить»). |
| Performance: запрос `/account/orders/` на клиенте с 1000+ заказов | Pagination (50 на страницу), индексы на `orders.customerId` и `orders.companyId`. |
| GDPR-удаление ломает бухучёт (счёт оплачен, но Customer удалён) | Order.customer.* snapshot — immutable после `paid` (FR-051 / FR-5403); Customer.deletedAt не каскадит на Order. |
| Большой backfill старых guest-Order падает по таймауту | Скрипт `backfill-customers.mjs` работает батчами (default 100 за raz), retry, idempotent. Сухой run по умолчанию. |
| Twenty Person rate-limit при массовом backfill | Уважаем 60 rpm из 048; backfill использует общую очередь, не bypass'ит. |

## Migration Strategy

1. **Pre-deploy**:
   - Создать коллекции `customers`, `companies` в Payload (миграция БД).
   - Расширить `orders` полями `customerId`, `companyId` (nullable).
   - Расширить `carts` (052) и `returns` (053) аналогично.
2. **Deploy**:
   - Релиз публичных страниц `/account/*` (feature-flag `customerAccountsEnabled`).
   - Magic-link отключен в email-шаблонах T-001/T-002 до завершения backfill (предотвращаем выдачу ссылок до миграции).
3. **Backfill**:
   - Запустить `pnpm tsx scripts/backfill-customers.mjs --dry-run` — отчёт о N уникальных email.
   - Запустить `--apply` — создать Customer-stub для каждого, проставить Order.customerId.
   - Twenty sync на created Person (через очередь 048) — может занять часы для большой базы.
4. **Post-deploy**:
   - Включить magic-link в T-001/T-002 (FR-5414/5415).
   - Снять feature-flag.
5. **Monitoring** (первые 30 дней):
   - Дашборд: count(customers), magic-link CTR, login-rate, merge-conflicts/день.
   - Алерт на merge-failures > 1% от регистраций.

## Open Decisions To Confirm Before Coding

- Q1 / Q2 / Q4 / Q5 / Q7 / Q8 закрыть в research.md до старта Phase 2.
- Q9 (UI-расположение customers в admin sidebar) согласовать с менеджментом перед UX-implementation.
- Confirm feature-flag name: `customerAccountsEnabled` или `accountModuleEnabled`.
