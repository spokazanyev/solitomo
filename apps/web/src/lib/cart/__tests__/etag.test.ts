import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

// Inline pure logic mirror of etag.ts
function computeCartETag(cart: { id: string; updatedAt: string }): string {
  const digest = createHash("sha256")
    .update(`${cart.id}:${cart.updatedAt}`)
    .digest("hex")
    .slice(0, 16);
  return `W/"${digest}"`;
}

function matchesETag(ifMatch: string | null, currentETag: string): boolean {
  if (!ifMatch) return false;
  const trimmed = ifMatch.trim();
  if (trimmed === "*") return true;
  if (trimmed === currentETag) return true;
  const bareDigest = currentETag.replace(/^W\/"|"$/g, "");
  if (trimmed === bareDigest) return true;
  if (trimmed === `"${bareDigest}"`) return true;
  return false;
}

describe("computeCartETag", () => {
  it("produces deterministic output", () => {
    const a = computeCartETag({ id: "1", updatedAt: "2026-05-24T10:00:00Z" });
    const b = computeCartETag({ id: "1", updatedAt: "2026-05-24T10:00:00Z" });
    expect(a).toBe(b);
  });

  it("differs when updatedAt changes", () => {
    const a = computeCartETag({ id: "1", updatedAt: "2026-05-24T10:00:00Z" });
    const b = computeCartETag({ id: "1", updatedAt: "2026-05-24T10:00:01Z" });
    expect(a).not.toBe(b);
  });

  it("differs when id changes", () => {
    const a = computeCartETag({ id: "1", updatedAt: "2026-05-24T10:00:00Z" });
    const b = computeCartETag({ id: "2", updatedAt: "2026-05-24T10:00:00Z" });
    expect(a).not.toBe(b);
  });

  it("uses W/ weak ETag format", () => {
    const etag = computeCartETag({ id: "1", updatedAt: "2026-05-24T10:00:00Z" });
    expect(etag).toMatch(/^W\/"[0-9a-f]{16}"$/);
  });
});

describe("matchesETag", () => {
  const tag = `W/"abcdef0123456789"`;

  it("matches exact ETag", () => {
    expect(matchesETag(tag, tag)).toBe(true);
  });

  it("matches bare digest", () => {
    expect(matchesETag("abcdef0123456789", tag)).toBe(true);
  });

  it("matches strong-form (no W/)", () => {
    expect(matchesETag(`"abcdef0123456789"`, tag)).toBe(true);
  });

  it("matches wildcard *", () => {
    expect(matchesETag("*", tag)).toBe(true);
  });

  it("rejects mismatched ETag", () => {
    expect(matchesETag(`W/"1111111111111111"`, tag)).toBe(false);
  });

  it("rejects null", () => {
    expect(matchesETag(null, tag)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(matchesETag("", tag)).toBe(false);
  });

  it("strips whitespace", () => {
    expect(matchesETag(`  ${tag}  `, tag)).toBe(true);
  });
});
