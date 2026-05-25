import { describe, expect, it } from "vitest";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Inline pure logic
function generateMagicLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashMagicLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}

function isValidTokenFormat(token: unknown): token is string {
  if (typeof token !== "string") return false;
  if (token.length < 32 || token.length > 64) return false;
  return /^[A-Za-z0-9_-]+$/.test(token);
}

function tokensEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function magicLinkExpiresAt(now: Date = new Date(), ttlMin: number = 30): string {
  return new Date(now.getTime() + ttlMin * 60_000).toISOString();
}

function isMagicLinkExpired(expiresAt: string | Date | null | undefined): boolean {
  if (!expiresAt) return true;
  const ts = typeof expiresAt === "string" ? new Date(expiresAt).getTime() : expiresAt.getTime();
  return Date.now() >= ts;
}

describe("generateMagicLinkToken", () => {
  it("returns 43-char base64url string (32 bytes)", () => {
    const t = generateMagicLinkToken();
    expect(t).toHaveLength(43);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns unique tokens", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) tokens.add(generateMagicLinkToken());
    expect(tokens.size).toBe(100);
  });
});

describe("hashMagicLinkToken", () => {
  it("returns deterministic 12-char hex", () => {
    const a = hashMagicLinkToken("abc");
    const b = hashMagicLinkToken("abc");
    expect(a).toBe(b);
    expect(a).toHaveLength(12);
    expect(a).toMatch(/^[0-9a-f]+$/);
  });

  it("differs for different inputs", () => {
    expect(hashMagicLinkToken("a")).not.toBe(hashMagicLinkToken("b"));
  });
});

describe("isValidTokenFormat", () => {
  it("accepts valid base64url tokens", () => {
    expect(isValidTokenFormat(generateMagicLinkToken())).toBe(true);
  });

  it("rejects too short", () => {
    expect(isValidTokenFormat("short")).toBe(false);
  });

  it("rejects too long", () => {
    expect(isValidTokenFormat("a".repeat(65))).toBe(false);
  });

  it("rejects non-string", () => {
    expect(isValidTokenFormat(undefined)).toBe(false);
    expect(isValidTokenFormat(123)).toBe(false);
    expect(isValidTokenFormat(null)).toBe(false);
  });

  it("rejects invalid chars", () => {
    // 32 chars but containing @
    expect(isValidTokenFormat("a".repeat(31) + "@")).toBe(false);
  });
});

describe("tokensEqual (constant-time)", () => {
  it("returns true for equal tokens", () => {
    const t = generateMagicLinkToken();
    expect(tokensEqual(t, t)).toBe(true);
  });

  it("returns false for different tokens", () => {
    expect(tokensEqual(generateMagicLinkToken(), generateMagicLinkToken())).toBe(false);
  });

  it("returns false for different length", () => {
    expect(tokensEqual("abc", "abcd")).toBe(false);
  });
});

describe("magicLinkExpiresAt / isMagicLinkExpired", () => {
  it("expiresAt is now + 30 minutes by default", () => {
    const now = new Date("2026-05-24T10:00:00Z");
    expect(magicLinkExpiresAt(now)).toBe("2026-05-24T10:30:00.000Z");
  });

  it("expired token returns true", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isMagicLinkExpired(past)).toBe(true);
  });

  it("non-expired token returns false", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isMagicLinkExpired(future)).toBe(false);
  });

  it("null/undefined treated as expired", () => {
    expect(isMagicLinkExpired(null)).toBe(true);
    expect(isMagicLinkExpired(undefined)).toBe(true);
  });
});
