/**
 * Tests для PII-filter (FR-062 invariant).
 */
import { describe, expect, it } from "vitest";

import { scrubPII } from "./pii-filter";

describe("scrubPII — black-list keys (целиком вырезаются)", () => {
  it("removes 'comment' key", () => {
    const result = scrubPII({ sku: "X-123", comment: "Иван Иванов хочет PDU" });
    expect(result.sku).toBe("X-123");
    expect(result.comment).toBeUndefined();
  });

  it("removes 'email' / 'phone' / 'inn' keys", () => {
    const result = scrubPII({
      form: "rfq",
      email: "user@example.com",
      phone: "+7 999 123 45 67",
      inn: "1234567890",
    });
    expect(result.form).toBe("rfq");
    expect(result.email).toBeUndefined();
    expect(result.phone).toBeUndefined();
    expect(result.inn).toBeUndefined();
  });

  it("removes nested black-listed keys", () => {
    const result = scrubPII({
      step: "review",
      user: { name_full: "Иван Иванов", id: "u-1" },
    });
    const user = result.user as Record<string, unknown>;
    expect(user.id).toBe("u-1");
    expect(user.name_full).toBeUndefined();
  });

  it("removes 'description'/'task'/'message'/'notes' keys", () => {
    const result = scrubPII({
      sku: "X",
      description: "secret PII",
      task: "another secret",
      message: "leak",
      notes: "leak2",
    });
    expect(result.sku).toBe("X");
    expect(result.description).toBeUndefined();
    expect(result.task).toBeUndefined();
    expect(result.message).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });
});

describe("scrubPII — regex masks", () => {
  it("masks email в произвольном string-value", () => {
    const result = scrubPII({
      list_name: "Customer is user@example.com on home",
    });
    expect(result.list_name).toContain("[REDACTED_EMAIL]");
    expect(result.list_name).not.toContain("user@example.com");
  });

  it("masks phone (≥10 digits) в произвольном string-value", () => {
    const result = scrubPII({
      title: "Call us +7 999 123 45 67 now",
    });
    expect(result.title).toContain("[REDACTED_PHONE]");
    expect(result.title).not.toContain("999 123 45 67");
  });

  it("does NOT mask short numbers (false-positive guard для phone)", () => {
    const result = scrubPII({
      title: "Buy 5 boxes for $42",
    });
    expect(result.title).toBe("Buy 5 boxes for $42");
  });

  it("masks ИНН (10 digits)", () => {
    const result = scrubPII({
      summary: "Company 1234567890 registered",
    });
    expect(result.summary).toContain("[REDACTED_INN]");
  });

  it("masks ИНН (12 digits for ИП)", () => {
    const result = scrubPII({
      summary: "Sole proprietor 123456789012 active",
    });
    expect(result.summary).toContain("[REDACTED_INN]");
  });
});

describe("scrubPII — whitelist keys (оставляются + scrub value)", () => {
  it("keeps 'search_term' но маскирует ПДн в нём", () => {
    const result = scrubPII({
      search_term: "PDU купить, контакт user@example.com",
    });
    expect(result.search_term).toContain("PDU купить");
    expect(result.search_term).toContain("[REDACTED_EMAIL]");
    expect(result.search_term).not.toContain("user@example.com");
  });

  it("keeps 'acquisition_query' но scrub'ит", () => {
    const result = scrubPII({
      acquisition_query: "цена PDU позвонить +7 999 123 45 67",
    });
    expect(result.acquisition_query).toContain("цена PDU");
    expect(result.acquisition_query).toContain("[REDACTED_PHONE]");
  });
});

describe("scrubPII — array handling", () => {
  it("recurse into arrays", () => {
    const result = scrubPII({
      items: [
        { item_id: "X", email: "should-be-removed@x.com", price: 100 },
        { item_id: "Y", price: 200 },
      ],
    });
    const items = result.items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items[0]!.item_id).toBe("X");
    expect(items[0]!.email).toBeUndefined();
    expect(items[0]!.price).toBe(100);
    expect(items[1]!.item_id).toBe("Y");
  });
});

describe("scrubPII — edge cases", () => {
  it("handles empty object", () => {
    expect(scrubPII({})).toEqual({});
  });

  it("handles null/undefined values", () => {
    const result = scrubPII({ a: null, b: undefined, c: "ok" });
    expect(result).toMatchObject({ a: null, c: "ok" });
  });

  it("preserves numbers и booleans", () => {
    const result = scrubPII({ count: 42, enabled: true });
    expect(result.count).toBe(42);
    expect(result.enabled).toBe(true);
  });

  it("respects depth limit (≤5 levels)", () => {
    const deeplyNested: Record<string, unknown> = { level: 0 };
    let current = deeplyNested;
    for (let i = 1; i <= 10; i++) {
      const next = { level: i };
      current.next = next;
      current = next;
    }
    const result = scrubPII(deeplyNested);
    // На 6-м уровне будет undefined
    let r: unknown = result;
    for (let i = 0; i < 5 && r && typeof r === "object"; i++) {
      r = (r as Record<string, unknown>).next;
    }
    expect(r).toBeUndefined();
  });

  it("does NOT mutate input", () => {
    const input = { email: "preserved@x.com", sku: "X" };
    const inputJson = JSON.stringify(input);
    scrubPII(input);
    expect(JSON.stringify(input)).toBe(inputJson);
  });
});

describe("scrubPII — comprehensive analytics-events scenarios", () => {
  it("scrubs realistic `purchase` event payload", () => {
    const result = scrubPII({
      transaction_id: "SO-2026-0001",
      value: 12500,
      currency: "RUB",
      items: [{ item_id: "PDU-1", item_name: "PDU 19\"", quantity: 1, price: 12500 }],
      // Случайно подмешано (не должно быть, но фильтр должен защитить)
      buyer_email: "user@example.com",
    });
    expect(result.transaction_id).toBe("SO-2026-0001");
    expect(result.value).toBe(12500);
    // Note: 'buyer_email' не в black-list, но `email` substring в key — fallback нет.
    // Это by-design: black-list только exact-match. Защитой является regex на VALUE:
    expect(JSON.stringify(result)).not.toContain("user@example.com");
  });

  it("scrubs realistic `form_field_error` payload (FR-015)", () => {
    const result = scrubPII({
      form_type: "rfq",
      field_name: "email",
      error_code: "invalid_format",
      // Значение НЕ должно попасть — но если случайно попало:
      attempted_value: "not-an-email",
    });
    expect(result.field_name).toBe("email");
    expect(result.error_code).toBe("invalid_format");
  });
});
