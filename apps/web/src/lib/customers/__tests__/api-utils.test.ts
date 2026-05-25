import { describe, expect, it } from "vitest";
import { randomBytes, timingSafeEqual } from "node:crypto";

// ─── Inline CSRF logic ────────────────────────────────────────────────────────

const CSRF_COOKIE_NAME = "customer_csrf_token";

function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

function verifyCsrfToken(req: Request): boolean {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieMatch = cookieHeader.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]+)`));
  const cookieValue = cookieMatch?.[1];
  const headerValue = req.headers.get("x-csrf-token");
  if (!cookieValue || !headerValue) return false;
  if (cookieValue.length !== headerValue.length) return false;
  try {
    return timingSafeEqual(Buffer.from(cookieValue), Buffer.from(headerValue));
  } catch {
    return false;
  }
}

// ─── Inline trusted-proxy IP extraction ───────────────────────────────────────

function getCustomerClientIp(req: Request, trustProxy: boolean): string {
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]!.trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  if (trustProxy) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }
  return "unknown";
}

// ─── Inline rate-limit ────────────────────────────────────────────────────────

const buckets = new Map<string, { count: number; resetAt: number }>();

function customerRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}

describe("generateCsrfToken", () => {
  it("returns base64url string of 43 chars (32 bytes)", () => {
    const t = generateCsrfToken();
    expect(t).toHaveLength(43);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns unique values", () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
  });
});

describe("verifyCsrfToken (double-submit)", () => {
  function makeReq(cookie: string | null, header: string | null): Request {
    const headers: HeadersInit = {};
    if (cookie) headers["cookie"] = cookie;
    if (header) headers["x-csrf-token"] = header;
    return new Request("http://example.com/api/x", { headers });
  }

  it("returns true when cookie matches header", () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(makeReq(`${CSRF_COOKIE_NAME}=${token}`, token))).toBe(true);
  });

  it("returns false when cookie missing", () => {
    expect(verifyCsrfToken(makeReq(null, "abc"))).toBe(false);
  });

  it("returns false when header missing", () => {
    expect(verifyCsrfToken(makeReq(`${CSRF_COOKIE_NAME}=abc`, null))).toBe(false);
  });

  it("returns false when values differ", () => {
    expect(verifyCsrfToken(makeReq(`${CSRF_COOKIE_NAME}=abc`, "xyz"))).toBe(false);
  });

  it("returns false when cookie name doesn't match", () => {
    expect(verifyCsrfToken(makeReq("other=abc", "abc"))).toBe(false);
  });
});

describe("getCustomerClientIp (trusted proxy)", () => {
  function makeReq(headers: Record<string, string>): Request {
    return new Request("http://example.com/x", { headers });
  }

  it("prefers x-vercel-forwarded-for unconditionally", () => {
    expect(
      getCustomerClientIp(
        makeReq({ "x-vercel-forwarded-for": "1.2.3.4", "x-forwarded-for": "5.6.7.8" }),
        false,
      ),
    ).toBe("1.2.3.4");
  });

  it("uses cf-connecting-ip unconditionally", () => {
    expect(getCustomerClientIp(makeReq({ "cf-connecting-ip": "9.9.9.9" }), false)).toBe("9.9.9.9");
  });

  it("rejects x-forwarded-for when TRUST_PROXY=false", () => {
    expect(getCustomerClientIp(makeReq({ "x-forwarded-for": "1.2.3.4" }), false)).toBe("unknown");
  });

  it("accepts x-forwarded-for when TRUST_PROXY=true", () => {
    expect(getCustomerClientIp(makeReq({ "x-forwarded-for": "1.2.3.4" }), true)).toBe("1.2.3.4");
  });

  it("returns 'unknown' fallback when no headers", () => {
    expect(getCustomerClientIp(makeReq({}), false)).toBe("unknown");
  });

  it("strips whitespace from comma-separated list", () => {
    expect(
      getCustomerClientIp(makeReq({ "x-vercel-forwarded-for": "1.2.3.4 , 5.6.7.8" }), false),
    ).toBe("1.2.3.4");
  });
});

describe("customerRateLimit", () => {
  it("allows first request", () => {
    buckets.clear();
    expect(customerRateLimit("k1", 3, 60_000)).toBe(true);
  });

  it("allows up to max", () => {
    buckets.clear();
    expect(customerRateLimit("k2", 3, 60_000)).toBe(true);
    expect(customerRateLimit("k2", 3, 60_000)).toBe(true);
    expect(customerRateLimit("k2", 3, 60_000)).toBe(true);
  });

  it("blocks at max+1", () => {
    buckets.clear();
    customerRateLimit("k3", 2, 60_000);
    customerRateLimit("k3", 2, 60_000);
    expect(customerRateLimit("k3", 2, 60_000)).toBe(false);
  });

  it("independent buckets per key", () => {
    buckets.clear();
    customerRateLimit("a", 1, 60_000);
    expect(customerRateLimit("a", 1, 60_000)).toBe(false);
    expect(customerRateLimit("b", 1, 60_000)).toBe(true);
  });
});
