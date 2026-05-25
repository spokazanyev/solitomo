# Contract: Consent Embedded Group

**Назначение:** общая структура группы `consent` для всех 4 целевых коллекций.

## TypeScript-тип (shared)

```typescript
// apps/web/src/lib/consent/consent-types.ts

/**
 * Embedded group `consent` для Orders / Carts / Customers / RfqRequests.
 * Заполняется server-side через makeConsentRecord(req) при создании сущности.
 * Read-only в админ-панели Payload.
 */
export interface ConsentRecord {
  /** ISO 8601 timestamp момента согласия */
  consentedAt: string;
  /** Версия политики конфиденциальности (формат: YYYY-MM-DD-vN) */
  policyVersionPrivacy: string;
  /** Версия публичной оферты */
  policyVersionOffer: string;
  /** SHA-256 хэш IP (PII protection, первые 32 hex-символа) */
  ipHash: string;
  /** User-Agent клиента, ≤ 200 символов */
  userAgent?: string;
}

/** Type guard: проверка наличия валидного согласия в сущности */
export function hasValidConsent(consent: unknown): consent is ConsentRecord {
  if (!consent || typeof consent !== "object") return false;
  const c = consent as Record<string, unknown>;
  return Boolean(c.consentedAt && c.policyVersionPrivacy && c.policyVersionOffer && c.ipHash);
}
```

## Payload field definition (shared snippet)

```typescript
// apps/web/src/lib/consent/consent-field.ts
import type { Field } from "payload";
import { adminLabel } from "../collections/admin-i18n.js";

/**
 * Возвращает Payload field definition для группы `consent`.
 * Подключается в Orders.js / Carts.ts / Customers.ts / RfqRequests.ts.
 */
export function consentField(): Field {
  return {
    name: "consent",
    type: "group",
    label: adminLabel("Согласие на обработку ПДн", "Consent (PDPA)"),
    admin: {
      readOnly: true,
      description: adminLabel(
        "Заполняется автоматически при создании. Фиксация в соответствии с 152-ФЗ ст. 9.",
        "Auto-filled on creation. Compliance with Federal Law 152-FZ Art. 9.",
      ),
    },
    fields: [
      {
        name: "consentedAt",
        type: "date",
        admin: { readOnly: true },
      },
      {
        name: "policyVersionPrivacy",
        type: "text",
        admin: { readOnly: true },
      },
      {
        name: "policyVersionOffer",
        type: "text",
        admin: { readOnly: true },
      },
      {
        name: "ipHash",
        type: "text",
        admin: { readOnly: true },
      },
      {
        name: "userAgent",
        type: "text",
        maxLength: 200,
        admin: { readOnly: true },
      },
    ],
  };
}
```

## API: makeConsentRecord(req)

```typescript
// apps/web/src/lib/consent/make-consent-record.ts
import "server-only";
import { createHash } from "node:crypto";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import type { NextRequest } from "next/server";
import type { ConsentRecord } from "./consent-types";

const POLICY_SLUGS = ["offer", "privacy", "pd-policy"] as const;

let policyVersionCache: { offer: string; privacy: string; pdPolicy: string; cachedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1 min

async function loadPolicyVersions(): Promise<{ offer: string; privacy: string; pdPolicy: string }> {
  if (policyVersionCache && Date.now() - policyVersionCache.cachedAt < CACHE_TTL_MS) {
    return policyVersionCache;
  }
  const payload = await getPayload({ config: configPromise });
  const [offer, privacy, pdPolicy] = await Promise.all(
    POLICY_SLUGS.map((slug) =>
      payload.find({
        collection: "static-pages" as never,
        where: { and: [{ slug: { equals: slug } }, { status: { equals: "published" } }] },
        limit: 1,
      }),
    ),
  );
  policyVersionCache = {
    offer: (offer.docs[0] as { version?: string } | undefined)?.version ?? "unknown",
    privacy: (privacy.docs[0] as { version?: string } | undefined)?.version ?? "unknown",
    pdPolicy: (pdPolicy.docs[0] as { version?: string } | undefined)?.version ?? "unknown",
    cachedAt: Date.now(),
  };
  return policyVersionCache;
}

/** Invalidate cache after admin updates a policy. Called from static-pages afterChange hook. */
export function invalidatePolicyVersionCache(): void {
  policyVersionCache = null;
}

export async function makeConsentRecord(req: NextRequest | Request): Promise<ConsentRecord> {
  const { offer, privacy, pdPolicy } = await loadPolicyVersions();
  const headers = "headers" in req ? req.headers : new Headers();
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown";
  const userAgent = headers.get("user-agent") ?? undefined;
  return {
    consentedAt: new Date().toISOString(),
    policyVersionOffer: offer,
    policyVersionPrivacy: privacy === "unknown" && pdPolicy !== "unknown" ? pdPolicy : privacy,
    ipHash: createHash("sha256").update(ip).digest("hex").slice(0, 32),
    userAgent: userAgent?.slice(0, 200),
  };
}
```

## Контракт API использования

**POST endpoints (создание сущностей с consent):**

| Endpoint | Что добавить |
|---|---|
| `POST /api/orders` | После валидации тела — `const consent = await makeConsentRecord(req); ... payload.create({ data: { ..., consent } })` |
| `POST /api/cart` | То же |
| `POST /api/rfq` (или RFQ submission endpoint) | То же |
| `POST /api/customers/register` | То же |
| `POST /api/customers/magic-request` | Аналогично — фиксируем согласие на первой попытке login |

**Тело запроса:**

Все эти endpoints должны принимать в body **`consent: true`** (boolean от checkbox) — это **подтверждение** согласия. Если `consent !== true` → 400 Bad Request с кодом `CONSENT_REQUIRED`.

```json
POST /api/orders
{
  "type": "physical",
  "items": [...],
  "customer": {...},
  "delivery": {...},
  "consent": true
}
```

Server-side проверяет:
1. `body.consent === true` → продолжаем
2. Генерируем `ConsentRecord` через `makeConsentRecord(req)`
3. Передаём в `payload.create({ data: { ..., consent: record } })`

**Если `consent !== true`:**
```json
{ "error": "CONSENT_REQUIRED", "message": "Consent to PDPA and offer is required" }
```
HTTP 400.

## Тесты unit (Vitest)

```typescript
// apps/web/src/lib/consent/make-consent-record.test.ts
import { describe, it, expect, vi } from "vitest";
import { makeConsentRecord } from "./make-consent-record";

describe("makeConsentRecord", () => {
  it("returns ISO timestamp", async () => {
    const req = new Request("http://localhost/", { headers: { "x-forwarded-for": "1.2.3.4", "user-agent": "test" } });
    const r = await makeConsentRecord(req);
    expect(r.consentedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("hashes IP with sha256 (32 hex chars)", async () => {
    const req = new Request("http://localhost/", { headers: { "x-forwarded-for": "192.168.1.1" } });
    const r = await makeConsentRecord(req);
    expect(r.ipHash).toMatch(/^[a-f0-9]{32}$/);
  });

  it("truncates userAgent to 200 chars", async () => {
    const longUA = "a".repeat(300);
    const req = new Request("http://localhost/", { headers: { "user-agent": longUA } });
    const r = await makeConsentRecord(req);
    expect(r.userAgent?.length).toBeLessThanOrEqual(200);
  });

  it("returns 'unknown' for IP when no headers", async () => {
    const req = new Request("http://localhost/");
    const r = await makeConsentRecord(req);
    // sha256("unknown") = "1d1f...", any 32-hex-char string
    expect(r.ipHash).toMatch(/^[a-f0-9]{32}$/);
  });
});
```
