/**
 * Unit tests for client-number generator (051).
 *
 * Tests pure helpers (getBusinessYear, formatSequence, sequenceNameFor)
 * and the CLIENT_NUMBER_REGEX validator.
 *
 * NOTE: generateClientNumber() requires a real PG connection via payload.db.drizzle
 * and is tested via integration/e2e tests, not here.
 */

import { describe, expect, it } from "vitest";

// We can't import the actual module because of `import "server-only"`.
// Instead, inline-test the pure logic directly.

// ─── Pure helpers (copy from source to test without server-only) ──────────────

function getBusinessYear(date: Date, tz: string = "Europe/Moscow"): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
    }).format(date),
  );
}

function formatSequence(n: number): string {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Invalid sequence value: ${n}`);
  }
  return n < 10000 ? String(n).padStart(4, "0") : String(n);
}

function sequenceNameFor(year: number): string {
  return `order_seq_${year}`;
}

const CLIENT_NUMBER_REGEX = /^SO-\d{4}-\d{4,}$/;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getBusinessYear", () => {
  it("returns correct year for Europe/Moscow timezone", () => {
    // 2026-01-15 12:00 UTC → 2026-01-15 15:00 MSK → year 2026
    const date = new Date("2026-01-15T12:00:00Z");
    expect(getBusinessYear(date)).toBe(2026);
  });

  it("handles year boundary correctly — Dec 31 UTC that is Jan 1 MSK", () => {
    // 2026-12-31T22:00:00Z → 2027-01-01T01:00:00 MSK → year 2027
    const date = new Date("2026-12-31T22:00:00Z");
    expect(getBusinessYear(date)).toBe(2027);
  });

  it("handles year boundary — Dec 31 UTC that is still Dec 31 MSK", () => {
    // 2026-12-31T18:00:00Z → 2026-12-31T21:00:00 MSK → year 2026
    const date = new Date("2026-12-31T18:00:00Z");
    expect(getBusinessYear(date)).toBe(2026);
  });

  it("uses custom timezone", () => {
    // 2026-12-31T23:30:00Z → still 2026 in UTC, but test with UTC+14
    const date = new Date("2026-12-31T10:00:00Z");
    expect(getBusinessYear(date, "Pacific/Kiritimati")).toBe(2027); // UTC+14
  });
});

describe("formatSequence", () => {
  it("pads single digit to 4", () => {
    expect(formatSequence(1)).toBe("0001");
  });

  it("pads double digit to 4", () => {
    expect(formatSequence(42)).toBe("0042");
  });

  it("pads triple digit to 4", () => {
    expect(formatSequence(142)).toBe("0142");
  });

  it("returns 4-digit number without padding", () => {
    expect(formatSequence(9999)).toBe("9999");
  });

  it("returns 5-digit number without padding (FR-5103)", () => {
    expect(formatSequence(10000)).toBe("10000");
  });

  it("handles large numbers", () => {
    expect(formatSequence(99999)).toBe("99999");
  });

  it("throws on zero", () => {
    expect(() => formatSequence(0)).toThrow("Invalid sequence value: 0");
  });

  it("throws on negative", () => {
    expect(() => formatSequence(-1)).toThrow("Invalid sequence value: -1");
  });

  it("throws on non-integer", () => {
    expect(() => formatSequence(1.5)).toThrow("Invalid sequence value: 1.5");
  });
});

describe("sequenceNameFor", () => {
  it("returns correct sequence name", () => {
    expect(sequenceNameFor(2026)).toBe("order_seq_2026");
  });

  it("works for different years", () => {
    expect(sequenceNameFor(2027)).toBe("order_seq_2027");
    expect(sequenceNameFor(2030)).toBe("order_seq_2030");
  });
});

describe("CLIENT_NUMBER_REGEX", () => {
  it("matches valid 4-digit number", () => {
    expect(CLIENT_NUMBER_REGEX.test("SO-2026-0001")).toBe(true);
  });

  it("matches valid number at boundary", () => {
    expect(CLIENT_NUMBER_REGEX.test("SO-2026-9999")).toBe(true);
  });

  it("matches 5+ digit number (FR-5103)", () => {
    expect(CLIENT_NUMBER_REGEX.test("SO-2026-10000")).toBe(true);
    expect(CLIENT_NUMBER_REGEX.test("SO-2026-99999")).toBe(true);
  });

  it("rejects too few digits", () => {
    expect(CLIENT_NUMBER_REGEX.test("SO-2026-001")).toBe(false);
  });

  it("rejects wrong prefix", () => {
    expect(CLIENT_NUMBER_REGEX.test("XX-2026-0001")).toBe(false);
  });

  it("rejects missing prefix", () => {
    expect(CLIENT_NUMBER_REGEX.test("2026-0001")).toBe(false);
  });

  it("rejects non-numeric sequence", () => {
    expect(CLIENT_NUMBER_REGEX.test("SO-2026-abcd")).toBe(false);
  });

  it("rejects short year", () => {
    expect(CLIENT_NUMBER_REGEX.test("SO-26-0001")).toBe(false);
  });
});

describe("full clientNumber format", () => {
  it("assembles correctly with prefix + year + sequence", () => {
    const prefix = "SO";
    const year = 2026;
    const seq = formatSequence(42);
    const clientNumber = `${prefix}-${year}-${seq}`;
    expect(clientNumber).toBe("SO-2026-0042");
    expect(CLIENT_NUMBER_REGEX.test(clientNumber)).toBe(true);
  });

  it("assembles correctly at overflow boundary", () => {
    const clientNumber = `SO-2026-${formatSequence(10000)}`;
    expect(clientNumber).toBe("SO-2026-10000");
    expect(CLIENT_NUMBER_REGEX.test(clientNumber)).toBe(true);
  });
});
