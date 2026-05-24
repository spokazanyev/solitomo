# Data Model: Customer Account & Identity (054)

## 1. Payload collection `customers` (auth=true)

Файл: `apps/web/src/collections/Customers.ts`.

```ts
const Customers = {
  slug: "customers",
  auth: {
    tokenExpiration: 60 * 60 * 24,            // 24 ч sliding session
    cookies: {
      name: "customer_session",               // MUST BE EXPLICIT (FR-5412a) — prevents collision with admin payload-token
      domain: process.env.COOKIE_DOMAIN,
      sameSite: "Lax",
      secure: process.env.NODE_ENV === "production",
    },
    useAPIKey: false,
    verify: false,                              // email confirmation — опционально (Q3)
    maxLoginAttempts: 5,
    lockTime: 1000 * 60 * 15,                   // 15 минут блокировки после 5 неудач
  },
  admin: {
    group: "Sales",
    useAsTitle: "email",
    defaultColumns: ["email", "fullName", "customerType", "companyId", "lastLoginAt"],
  },
  access: {
    // Чтение: либо admin (Users), либо сам Customer, либо owner той же Company.
    read: ({ req }) => {
      if (req.user) return true;                 // admin user
      if (req.customer) {
        return {
          or: [
            { id: { equals: req.customer.id } },
            ...(req.customer.role === "owner" && req.customer.companyId
              ? [{ companyId: { equals: req.customer.companyId } }]
              : []),
          ],
        };
      }
      return false;
    },
    create: () => true,                           // публичная регистрация открыта
    update: ({ req }) => {
      if (req.user) return true;
      if (req.customer) {
        return { id: { equals: req.customer.id } };
      }
      return false;
    },
    delete: ({ req }) => Boolean(req.user),       // только admin
  },
  fields: [
    // ----- Email уже создаётся auth=true; добавляем валидацию -----
    { name: "emailValid", type: "checkbox", defaultValue: true,
      admin: { description: "Помечается false после 3 hard bounce (от 049)." } },

    // ----- Magic-link -----
    { name: "magicLinkToken", type: "text", admin: { readOnly: true, hidden: true },
      index: true,
      admin_description: "Одноразовый. Очищается после consumption." },
    { name: "magicLinkExpiresAt", type: "date", admin: { readOnly: true } },
    { name: "magicLinkConsumedAt", type: "date", admin: { readOnly: true } },
    { name: "magicLinkRequestedFromIp", type: "text", admin: { readOnly: true } },

    // ----- Profile -----
    { name: "firstName", type: "text" },
    { name: "lastName", type: "text" },
    { name: "fullName", type: "text",
      admin: { description: "Compute from firstName + lastName в hook." } },
    { name: "phone", type: "text" },
    { name: "phoneNormalized", type: "text",
      admin: { readOnly: true, description: "E.164 form (+7XXXXXXXXXX). Compute из phone." } },

    // ----- Account state (A2) -----
    { name: "accountState", type: "select", required: true, defaultValue: "email-only",
      options: [
        { label: "Email-only (magic-link, без пароля)", value: "email-only" },
        { label: "Пароль установлен", value: "password-set" },
        { label: "Stub (приглашён, ещё не принял)", value: "invited-stub" },
        { label: "Удалён (GDPR)", value: "deleted" },
      ],
      admin: { description: "Merge-flow (US3) и Twenty sync (FR-5446) привязаны к password-set или явному accountActivated." } },

    // ----- Тип клиента и компания -----
    { name: "customerType", type: "select", required: true, defaultValue: "individual",
      options: [
        { label: "Физлицо", value: "individual" },
        { label: "Контактное лицо юрлица", value: "company-contact" },
      ] },
    { name: "companyId", type: "relationship", relationTo: "companies",
      admin: { description: "Required, если customerType=company-contact." } },
    { name: "role", type: "select", defaultValue: "contact",
      options: [
        { label: "Владелец компании", value: "owner" },
        { label: "Бухгалтер", value: "accountant" },
        { label: "Закупщик", value: "purchaser" },
        { label: "Контакт (default)", value: "contact" },
      ],
      admin: { description: "Имеет смысл только если customerType=company-contact." } },

    // ----- Adresses -----
    // Q2: оставляем массив на customers до подтверждения в research.md.
    { name: "addresses", type: "array",
      admin: { description: "До 5 адресов. Если больше — отдельная коллекция." },
      maxRows: 10,
      fields: [
        { name: "label", type: "text", required: true,
          admin: { description: "«Дом», «Дача», «Работа» и т.п." } },
        { name: "city", type: "text", required: true },
        { name: "fullAddress", type: "textarea", required: true },
        { name: "postalCode", type: "text" },
        { name: "addressNormalized", type: "json",
          admin: { description: "DaData fullAddress response." } },
        { name: "isDefault", type: "checkbox", defaultValue: false },
      ],
    },
    { name: "defaultAddressIndex", type: "number", admin: { readOnly: true } },

    // ----- Preferences (мигрируют с Order на Customer как primary) -----
    { name: "marketingOptIn", type: "checkbox", defaultValue: false },
    { name: "messengerOptIn", type: "checkbox", defaultValue: false,
      admin: { description: "Placeholder для 050 (мессенджеры)." } },
    { name: "smsOptIn", type: "checkbox", defaultValue: false,
      admin: { description: "(deprecated — SMS отменён). Поле сохраняется для обратной совместимости, но не используется в 049/054. Не показывать в UI." } },
    { name: "languagePreference", type: "select", defaultValue: "ru",
      options: ["ru", "en"] },

    // ----- CRM refs -----
    { name: "crmPersonId", type: "text", admin: { readOnly: true,
      description: "Twenty Person id после первого sync (FR-5446)." } },
    { name: "crmLastSyncedAt", type: "date", admin: { readOnly: true } },
    { name: "crmLastSyncStatus", type: "select",
      options: ["queued", "in_progress", "success", "failed"],
      admin: { readOnly: true } },

    // ----- GDPR / compliance -----
    { name: "gdprConsentAt", type: "date", required: true,
      admin: { readOnly: true, description: "При register или первом magic-clicke." } },
    { name: "gdprConsentVersion", type: "text", defaultValue: "1.0",
      admin: { description: "Версия privacy policy на момент согласия." } },
    { name: "deletedAt", type: "date", admin: { readOnly: true,
      description: "Soft delete. ПДн обнуляются. Order.customer.* snapshot сохраняется." } },

    // ----- Activity -----
    { name: "lastLoginAt", type: "date", admin: { readOnly: true } },
    { name: "lastLoginIp", type: "text", admin: { readOnly: true } },
    { name: "lastLoginUserAgent", type: "text", admin: { readOnly: true } },
    { name: "loginCount", type: "number", defaultValue: 0, admin: { readOnly: true } },

    // ----- Invitation (для B2B приглашений US4) -----
    { name: "invitedBy", type: "relationship", relationTo: "customers",
      admin: { description: "Кто пригласил (owner)." } },
    { name: "inviteToken", type: "text", admin: { readOnly: true, hidden: true } },
    { name: "inviteExpiresAt", type: "date", admin: { readOnly: true } },
    { name: "inviteAcceptedAt", type: "date", admin: { readOnly: true } },
  ],
  indexes: [
    { fields: ["email"], unique: true },         // на самом деле auth=true автоматически создаёт unique
    { fields: ["companyId"] },
    { fields: ["magicLinkToken"] },
    { fields: ["deletedAt"] },                   // фильтрация активных
  ],
  hooks: {
    beforeChange: [
      ({ data, operation, req }) => {
        if (data.firstName || data.lastName) {
          data.fullName = `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
        }
        if (data.phone) {
          data.phoneNormalized = normalizeToE164(data.phone);
        }
        if (operation === "create") {
          data.gdprConsentAt = new Date().toISOString();
        }
        // Privacy на адресах: только один isDefault.
        if (data.addresses) {
          const defaults = data.addresses.filter((a) => a.isDefault);
          if (defaults.length > 1) {
            data.addresses = data.addresses.map((a, i) => ({
              ...a, isDefault: i === data.addresses.findIndex((x) => x.isDefault),
            }));
          }
        }
        return data;
      },
    ],
    afterChange: [
      // 1) AdminChangeLog запись.
      // 2) Sync-job в crm-sync-jobs (Customer → Twenty Person).
      // 3) Backfill orders при первом создании (merge по email).
    ],
    afterLogin: [
      ({ req, user }) => {
        // Обновить lastLoginAt, lastLoginIp, loginCount, merge cart/orders.
      },
    ],
  },
};
```

## 2. Payload collection `companies`

Файл: `apps/web/src/collections/Companies.ts`.

```ts
const Companies = {
  slug: "companies",
  admin: {
    group: "Sales",
    useAsTitle: "name",
    defaultColumns: ["name", "taxId", "kpp", "ogrn", "contactEmail"],
  },
  access: {
    read: ({ req }) => {
      if (req.user) return true;                  // admin
      if (req.customer?.companyId) {
        return { id: { equals: req.customer.companyId } };
      }
      return false;
    },
    create: ({ req }) => Boolean(req.user) || Boolean(req.customer),
    update: ({ req }) => {
      if (req.user) return true;
      // Только owner может править свою company.
      if (req.customer?.role === "owner" && req.customer.companyId) {
        return { id: { equals: req.customer.companyId } };
      }
      return false;
    },
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "taxId", type: "text", required: true,
      admin: { description: "ИНН (10 или 12 цифр). Используется для дедупа с Twenty Company." } },
    { name: "kpp", type: "text" },
    { name: "ogrn", type: "text" },
    { name: "legalAddress", type: "textarea" },
    { name: "billingAddress", type: "textarea",
      admin: { description: "Если отличается от legalAddress." } },
    { name: "contactEmail", type: "email" },
    { name: "contactPhone", type: "text" },

    // ----- Approval limit для US7 (отложено) -----
    { name: "approvalLimit", type: "number", defaultValue: 0,
      admin: { description: "Сумма (₽), выше которой требуется approval от owner. 0 = без лимита." } },

    // ----- CRM refs -----
    { name: "crmCompanyId", type: "text", admin: { readOnly: true } },
    { name: "crmLastSyncedAt", type: "date", admin: { readOnly: true } },
    { name: "crmLastSyncStatus", type: "select",
      options: ["queued", "in_progress", "success", "failed"],
      admin: { readOnly: true } },

    // ----- Lifecycle -----
    { name: "deletedAt", type: "date", admin: { readOnly: true } },
  ],
  indexes: [
    { fields: ["taxId"], unique: true },
    { fields: ["name"] },
  ],
  hooks: {
    afterChange: [
      // 1) AdminChangeLog.
      // 2) Sync-job → Twenty Company (FR-5447).
    ],
  },
};
```

## 3. Опциональная коллекция `customer-addresses` (если research.md решит вынести)

Файл: `apps/web/src/collections/CustomerAddresses.ts`.

```ts
const CustomerAddresses = {
  slug: "customer-addresses",
  admin: { group: "Sales", useAsTitle: "label" },
  access: {
    read: ({ req }) => {
      if (req.user) return true;
      if (req.customer) {
        return { customerId: { equals: req.customer.id } };
      }
      return false;
    },
    create: ({ req }) => Boolean(req.customer) || Boolean(req.user),
    update: ({ req }) => Boolean(req.customer) || Boolean(req.user),
    delete: ({ req }) => Boolean(req.customer) || Boolean(req.user),
  },
  fields: [
    { name: "customerId", type: "relationship", relationTo: "customers", required: true,
      index: true },
    { name: "label", type: "text", required: true },
    { name: "city", type: "text", required: true },
    { name: "fullAddress", type: "textarea", required: true },
    { name: "postalCode", type: "text" },
    { name: "addressNormalized", type: "json" },
    { name: "isDefault", type: "checkbox", defaultValue: false },
  ],
  hooks: {
    beforeChange: [
      // Гарантировать единственный default per customerId.
    ],
  },
};
```

> **Решение между §1.addresses и §3 — в research.md (Q2)**. На MVP — массив на customers (проще миграция, не нужен join для типичного запроса). Если в продакшене у клиентов в среднем > 5 адресов — выносим в отдельную коллекцию.

## 4. Расширение `orders`

Добавляются в существующую `apps/web/src/collections/Orders.js`:

```ts
// В корне fields[]:
{ name: "customerId", type: "relationship", relationTo: "customers",
  admin: { description: "FK на customers. Null для guest-заказов до merge." } },
{ name: "companyId", type: "relationship", relationTo: "companies",
  admin: { description: "FK на companies. Null для физлиц и личных заказов company-contact." } },
{ name: "isPersonalOrder", type: "checkbox", defaultValue: false,
  admin: { description: "Toggle в чекауте (FR-5437): личный заказ company-contact, owner не видит." } },
```

Существующая группа `customer.*` (fullName, email, phone, companyName, inn, kpp, ogrn, legalAddress, emailValid) — **остаётся как immutable snapshot** на момент создания заказа. После `paid` не редактируется. Это нужно для:
- Бухгалтерии (счёт-фактура должна содержать актуальные на момент сделки данные).
- GDPR-удаления (мы обнуляем `customers.email`, но `orders.customer.email` сохраняется для бухучёта).

```ts
// access на orders:
read: ({ req }) => {
  if (req.user) return true;                      // admin
  if (!req.customer) return false;
  const c = req.customer;
  // Owner — все Order своей company, кроме isPersonalOrder коллег.
  if (c.role === "owner" && c.companyId) {
    return {
      or: [
        { customerId: { equals: c.id } },         // свои
        {
          and: [
            { companyId: { equals: c.companyId } },
            { isPersonalOrder: { equals: false } },
          ],
        },
      ],
    };
  }
  // Accountant — все Order company, кроме personal. (UI скрывает sensitive поля.)
  if (c.role === "accountant" && c.companyId) {
    return {
      and: [
        { companyId: { equals: c.companyId } },
        { isPersonalOrder: { equals: false } },
      ],
    };
  }
  // Purchaser и contact — только свои.
  return { customerId: { equals: c.id } };
},
```

Индексы (миграция):
```sql
CREATE INDEX idx_orders_customer_id ON orders (customer_id);
CREATE INDEX idx_orders_company_id  ON orders (company_id);
CREATE INDEX idx_orders_customer_email_lower ON orders (LOWER((customer->>'email')));  -- для backfill / merge
```

## 5. Расширение `carts` (из 052) и `returns` (из 053)

Если 052/053 ещё не реализованы — поля добавляются авансом в их data-model:

```ts
// carts (052):
{ name: "customerId", type: "relationship", relationTo: "customers" },
{ name: "companyId", type: "relationship", relationTo: "companies" },
{ name: "anonymousId", type: "text",
  admin: { description: "localStorage cartId до логина." } },

// returns (053):
{ name: "customerId", type: "relationship", relationTo: "customers" },
```

## 6. Опциональная коллекция `purchase-approvals` (US7, отложено)

```ts
const PurchaseApprovals = {
  slug: "purchase-approvals",
  admin: { group: "Sales" },
  fields: [
    { name: "companyId", type: "relationship", relationTo: "companies", required: true },
    { name: "cartId", type: "relationship", relationTo: "carts", required: true },
    { name: "requestedBy", type: "relationship", relationTo: "customers", required: true },
    { name: "approver", type: "relationship", relationTo: "customers" },
    { name: "status", type: "select", required: true, defaultValue: "pending",
      options: ["pending", "approved", "rejected", "expired"] },
    { name: "amount", type: "number", required: true },
    { name: "limit", type: "number", required: true },
    { name: "approverComment", type: "textarea" },
    { name: "approverToken", type: "text", admin: { hidden: true } },
    { name: "approverTokenExpiresAt", type: "date" },
    { name: "approvedAt", type: "date" },
    { name: "rejectedAt", type: "date" },
  ],
};
```

## 7. Миграция (БД)

```text
1. CREATE TABLE customers (...)           -- Payload автогенерация.
2. CREATE TABLE companies (...)
3. CREATE TABLE customer_addresses (...)  -- если выбран отдельный путь.
4. ALTER TABLE orders ADD COLUMN customer_id ..., company_id ..., is_personal_order BOOLEAN DEFAULT false.
5. ALTER TABLE carts ADD COLUMN customer_id, company_id, anonymous_id.
6. ALTER TABLE returns ADD COLUMN customer_id.
7. CREATE INDEX idx_orders_customer_id, idx_orders_company_id, idx_orders_customer_email_lower.
8. Backfill:
   a. SELECT DISTINCT customer->>'email' FROM orders WHERE customer->>'email' IS NOT NULL.
   b. Для каждого email — создать customers (stub без password, customerType=individual).
   c. UPDATE orders SET customer_id = $c WHERE customer->>'email' = $email AND customer_id IS NULL.
9. Backfill companies (по orders.customer.inn).
   a. SELECT DISTINCT customer->>'inn' FROM orders WHERE customer->>'inn' IS NOT NULL.
   b. Создать companies (stub).
   c. UPDATE orders SET company_id = $c WHERE customer->>'inn' = $inn.
10. Очередь sync-job в Twenty (Person/Company) — через 048.
```

## 8. ENV

```bash
COOKIE_DOMAIN=pdumarket.ru                 # для cross-subdomain если нужен
# CUSTOMER_MAGIC_SECRET — НЕ нужен для opaque tokens (см. RD-1 в spec.md).
# Если потребуется HMAC-подпись restore-links — repurpose.
CUSTOMER_MAGIC_TTL_MIN=30
CUSTOMER_SESSION_TTL_HOURS=24
CUSTOMER_RATE_LIMIT_LOGIN=5                # за 15 мин
CUSTOMER_RATE_LIMIT_MAGIC=3                # за 15 мин
PRIVACY_POLICY_VERSION=1.0                 # для gdprConsentVersion
PRIVACY_POLICY_URL=/privacy/
```

## 9. Privacy-matrix (FR-5445, FR-5445a)

> **FR-5445a**: Privacy enforcement MUST быть на **API level**, не только UI.
> Для accountant: field-level access на Orders ограничивает `items[]` и `delivery.address`
> через Payload `read` field-level access или server-mapper в `/api/customers/me/orders`.

| Поле | individual (свой) | company-contact (свой) | owner (заказа коллеги) | owner (свой personal) | accountant (заказа компании) | purchaser (чужого) | manager (admin) |
|---|---|---|---|---|---|---|---|
| `id, status, total, createdAt` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `items[]` | ✅ | ✅ | ✅ | ✅ | ❌ **API-level** | ❌ | ✅ |
| `delivery.address, delivery.city` | ✅ | ✅ | ✅ | ✅ | ❌ **API-level** | ❌ | ✅ |
| `customer.email, customer.phone` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `documents[] (invoice, upd)` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `shipment.trackingNumber` | ✅ | ✅ | ✅ | ✅ | ❌ **API-level** | ❌ | ✅ |
| **Personal order** (`isPersonalOrder=true`) | ✅ (свой) | ✅ (свой) | ❌ (коллеги) | ✅ (свой) | ❌ | ❌ | ✅ |

**Правила доступа к Order (сводка)**:
- **Owner**: видит все Order с `companyId = my.companyId`, **КРОМЕ** `isPersonalOrder=true` коллег. Свои personal orders видит.
- **Accountant**: видит все Order компании (кроме personal коллег), но API **НЕ возвращает** поля `items[]`, `delivery.address`, `delivery.city`, `shipment.trackingNumber`. Видит только финансовый блок (id, status, total, documents, customer contact).
- **Purchaser**: видит ТОЛЬКО свои Order (`customerId = my.id`).
- **Contact (default)**: видит ТОЛЬКО свои Order.
- **Individual**: видит ТОЛЬКО свои Order.

**Реализация field-level restriction для accountant**: в server-mapper `/api/customers/me/orders` (или Payload field-level `read` access) -- проверить `req.customer.role === 'accountant'` и strip sensitive fields из response. Тест T-111 ДОЛЖЕН проверять именно API-response body, а не UI-rendering.

## 10. companyId forward-ref note

`customers.companyId` -- nullable relationship. Set by 054 for B2B customers (`customerType = company-contact`). Для `individual` customers -- always null.

При создании Company-contact через приглашение (US4) `companyId` устанавливается из invite-payload. При self-registration с `customerType = company-contact` -- `companyId` передаётся из формы или наследуется из invite-token.

## 11. GDPR Anonymization Table (A7, B8)

### On Customer soft-delete (`deletedAt = now`):

| Поле | Действие | Обоснование |
|---|---|---|
| `email` | ANONYMIZE -> `deleted-{id}@gdpr.local` | ПДн |
| `phone` | NULLIFY -> `null` | ПДн |
| `phoneNormalized` | NULLIFY -> `null` | ПДн (производное) |
| `firstName` | NULLIFY -> `null` | ПДн |
| `lastName` | NULLIFY -> `null` | ПДн |
| `fullName` | SET -> `"Удалён"` | Placeholder для UI |
| `addresses` | CLEAR -> `[]` | ПДн |
| `lastLoginIp` | NULLIFY -> `null` | Косвенные ПДн |
| `lastLoginUserAgent` | NULLIFY -> `null` | Косвенные ПДн |
| `magicLinkRequestedFromIp` | NULLIFY -> `null` | Косвенные ПДн |
| `magicLinkToken` | NULLIFY -> `null` | Security |
| `inviteToken` | NULLIFY -> `null` | Security |
| `crmPersonId` | RETAIN | Для аудита (Twenty Person удаляется каскадно через FR-5449) |
| `crmCompanyId` | NULLIFY (dangling ref) | Company связь теряет смысл |
| `accountState` | SET -> `"deleted"` | Lifecycle |
| `gdprConsentAt` | RETAIN | Аудит |
| `createdAt` | RETAIN | Аудит |

### On `Order.customer.*` after Customer GDPR delete:

Основание для сохранения: ст. 9 ФЗ-402 (бухучёт), НК РФ ст. 169 (счёт-фактура/УПД).

| Поле | Действие | Обоснование |
|---|---|---|
| `fullName` | RETAIN | Бухучёт ФЗ-402 (ФИО покупателя на счёте) |
| `companyName` | RETAIN | Бухучёт (наименование юрлица) |
| `inn` | RETAIN | Бухучёт НК 169 (ИНН на счёте-фактуре) |
| `kpp` | RETAIN | Бухучёт НК 169 |
| `legalAddress` | RETAIN | Бухучёт (адрес покупателя на счёте) |
| `email` | ANONYMIZE -> `deleted-{id}@gdpr.local` | НЕ требуется для счёта-фактуры |
| `phone` | NULLIFY -> `null` | НЕ требуется для счёта-фактуры |
| `emailValid` | RETAIN | История bounce (non-PII) |

## 12. TTL и cleanup (was §10)

- `customers.magicLinkToken` — очищается через 30 мин после `magicLinkExpiresAt` (cron-задача `cleanup-expired-tokens` раз в час).
- `customers.inviteToken` — очищается через 7 дней после `inviteExpiresAt`.
- `customers.deletedAt` — soft delete, запись остаётся, ПДн обнулены. Хранится бессрочно (нужно для аудита `orders.customerId` связи).
- `purchase-approvals.status = pending` — авто-expired через 72 часа.
