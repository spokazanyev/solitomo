import { describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";

// Inline pure logic
function generateCartToken(): string {
  return randomBytes(16).toString("base64url");
}

function hashCartToken(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}

function isValidTokenFormat(token: unknown): token is string {
  if (typeof token !== "string") return false;
  if (token.length < 16 || token.length > 64) return false;
  return /^[A-Za-z0-9_-]+$/.test(token);
}

describe("generateCartToken", () => {
  it("returns a base64url string", () => {
    const token = generateCartToken();
    expect(typeof token).toBe("string");
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns 22 characters for 16 bytes (base64url, no padding)", () => {
    expect(generateCartToken()).toHaveLength(22);
  });

  it("returns unique tokens across calls", () => {
    const tokens = new Set();
    for (let i = 0; i < 100; i++) tokens.add(generateCartToken());
    expect(tokens.size).toBe(100);
  });
});

describe("hashCartToken", () => {
  it("returns deterministic 12-char hex", () => {
    const a = hashCartToken("abc");
    const b = hashCartToken("abc");
    expect(a).toBe(b);
    expect(a).toHaveLength(12);
    expect(a).toMatch(/^[0-9a-f]+$/);
  });

  it("differs for different inputs", () => {
    expect(hashCartToken("abc")).not.toBe(hashCartToken("abd"));
  });
});

describe("isValidTokenFormat", () => {
  it("accepts valid base64url tokens", () => {
    expect(isValidTokenFormat(generateCartToken())).toBe(true);
  });

  it("rejects too short", () => {
    expect(isValidTokenFormat("short")).toBe(false);
  });

  it("rejects non-string", () => {
    expect(isValidTokenFormat(undefined)).toBe(false);
    expect(isValidTokenFormat(123)).toBe(false);
  });

  it("rejects invalid chars", () => {
    expect(isValidTokenFormat("abcdefghijklmnop@!#")).toBe(false);
  });
});
