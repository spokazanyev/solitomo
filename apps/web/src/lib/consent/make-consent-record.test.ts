import { describe, it, expect, vi, beforeEach } from "vitest";

const getPayloadMock = vi.fn();

vi.mock("payload", () => ({
  getPayload: getPayloadMock,
}));

vi.mock("@payload-config", () => ({
  default: {},
}));

beforeEach(() => {
  getPayloadMock.mockReset();
  getPayloadMock.mockResolvedValue({
    find: vi
      .fn()
      .mockResolvedValue({ docs: [{ version: "2026-05-25-v1" }] }),
  });
});

describe("makeConsentRecord", () => {
  it("returns ISO timestamp", async () => {
    const { makeConsentRecord, invalidatePolicyVersionCache } = await import(
      "./make-consent-record"
    );
    invalidatePolicyVersionCache();
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "1.2.3.4", "user-agent": "test" },
    });
    const r = await makeConsentRecord(req);
    expect(r.consentedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("hashes IP with sha256 (32 hex chars)", async () => {
    const { makeConsentRecord, invalidatePolicyVersionCache } = await import(
      "./make-consent-record"
    );
    invalidatePolicyVersionCache();
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "192.168.1.1" },
    });
    const r = await makeConsentRecord(req);
    expect(r.ipHash).toMatch(/^[a-f0-9]{32}$/);
  });

  it("truncates userAgent to 200 chars", async () => {
    const { makeConsentRecord, invalidatePolicyVersionCache } = await import(
      "./make-consent-record"
    );
    invalidatePolicyVersionCache();
    const longUA = "a".repeat(300);
    const req = new Request("http://localhost/", {
      headers: { "user-agent": longUA },
    });
    const r = await makeConsentRecord(req);
    expect(r.userAgent?.length).toBeLessThanOrEqual(200);
    expect(r.userAgent?.length).toBe(200);
  });

  it("returns 32-hex-char hash for IP when no headers present (fallback to 'unknown')", async () => {
    const { makeConsentRecord, invalidatePolicyVersionCache } = await import(
      "./make-consent-record"
    );
    invalidatePolicyVersionCache();
    const req = new Request("http://localhost/");
    const r = await makeConsentRecord(req);
    expect(r.ipHash).toMatch(/^[a-f0-9]{32}$/);
  });

  it("fail-closed: throws ConsentPolicyMissingError when any policy version is missing", async () => {
    const { makeConsentRecord, invalidatePolicyVersionCache, ConsentPolicyMissingError } =
      await import("./make-consent-record");
    invalidatePolicyVersionCache();
    // First call: privacy missing.
    getPayloadMock.mockResolvedValueOnce({
      find: vi.fn().mockImplementation((args: { where: { and: Array<{ slug: { equals: string } }> } }) => {
        const slug = args.where.and[0]?.slug.equals;
        if (slug === "privacy") return Promise.resolve({ docs: [] });
        return Promise.resolve({ docs: [{ version: "2026-05-25-v1" }] });
      }),
    });
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    await expect(makeConsentRecord(req)).rejects.toBeInstanceOf(ConsentPolicyMissingError);
  });

  it("does NOT alias pd-policy into policyVersionPrivacy", async () => {
    const { makeConsentRecord, invalidatePolicyVersionCache } = await import(
      "./make-consent-record"
    );
    invalidatePolicyVersionCache();
    getPayloadMock.mockResolvedValueOnce({
      find: vi.fn().mockImplementation((args: { where: { and: Array<{ slug: { equals: string } }> } }) => {
        const slug = args.where.and[0]?.slug.equals;
        const map: Record<string, string> = {
          offer: "2026-05-25-v1",
          privacy: "2026-05-25-v2",
          "pd-policy": "2026-05-25-v3",
        };
        return Promise.resolve({ docs: [{ version: map[slug ?? ""] }] });
      }),
    });
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    const r = await makeConsentRecord(req);
    expect(r.policyVersionPrivacy).toBe("2026-05-25-v2");
    expect(r.policyVersionOffer).toBe("2026-05-25-v1");
  });

  it("IP_HASH_SALT changes the resulting hash for the same IP", async () => {
    const { makeConsentRecord, invalidatePolicyVersionCache } = await import(
      "./make-consent-record"
    );
    invalidatePolicyVersionCache();
    delete process.env.IP_HASH_SALT;
    const reqA = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    const a = await makeConsentRecord(reqA);

    invalidatePolicyVersionCache();
    process.env.IP_HASH_SALT = "deploy-salt-xyz";
    const reqB = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    const b = await makeConsentRecord(reqB);

    delete process.env.IP_HASH_SALT;
    expect(a.ipHash).not.toBe(b.ipHash);
  });

  it("invalidatePolicyVersionCache() forces a fresh payload lookup", async () => {
    const { makeConsentRecord, invalidatePolicyVersionCache } = await import(
      "./make-consent-record"
    );
    invalidatePolicyVersionCache();

    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    await makeConsentRecord(req);
    const callsAfterFirst = getPayloadMock.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThanOrEqual(1);

    // Second call without invalidation — should hit the cache (no new getPayload call).
    await makeConsentRecord(req);
    expect(getPayloadMock.mock.calls.length).toBe(callsAfterFirst);

    // After invalidation — next call must re-fetch.
    invalidatePolicyVersionCache();
    await makeConsentRecord(req);
    expect(getPayloadMock.mock.calls.length).toBe(callsAfterFirst + 1);
  });
});
