import { describe, expect, it, beforeEach, vi } from "vitest";

// vi.mock is hoisted above the top-level `import` lines, so we use
// vi.hoisted() to declare the shared mock fn so it is initialised before
// the factory below runs.
const { findMock } = vi.hoisted(() => ({ findMock: vi.fn() }));

vi.mock("payload", () => ({
  getPayload: vi.fn().mockResolvedValue({
    find: findMock,
  }),
}));

vi.mock("@payload-config", () => ({
  default: Promise.resolve({}),
}));

import {
  getStaticPage,
  invalidateStaticPageCache,
  type StaticPageDoc,
} from "../get-static-page";

function makeDoc(slug: string, overrides: Partial<StaticPageDoc> = {}): StaticPageDoc {
  return {
    id: 1,
    slug,
    section: "info",
    title: `Title for ${slug}`,
    body: { root: { children: [] } },
    category: "info",
    indexingPolicy: "index",
    status: "published",
    updatedAt: "2026-05-25T00:00:00.000Z",
    createdAt: "2026-05-25T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  findMock.mockReset();
  invalidateStaticPageCache();
});

describe("getStaticPage", () => {
  it("returns null when no published doc matches", async () => {
    findMock.mockResolvedValueOnce({ docs: [] });

    const result = await getStaticPage("missing");

    expect(result).toBeNull();
    expect(findMock).toHaveBeenCalledTimes(1);
  });

  it("returns the doc when one published doc matches", async () => {
    const doc = makeDoc("payment");
    findMock.mockResolvedValueOnce({ docs: [doc] });

    const result = await getStaticPage("payment");

    expect(result).toEqual(doc);
    expect(findMock).toHaveBeenCalledTimes(1);

    // Verify the filter applied — slug + status=published
    const callArg = findMock.mock.calls[0][0] as {
      collection: string;
      where: { and: Array<Record<string, unknown>> };
      limit: number;
    };
    expect(callArg.collection).toBe("static-pages");
    expect(callArg.limit).toBe(1);
    expect(callArg.where.and).toEqual([
      { slug: { equals: "payment" } },
      { status: { equals: "published" } },
    ]);
  });

  it("caches results within TTL — second call does not re-query", async () => {
    const doc = makeDoc("delivery");
    findMock.mockResolvedValueOnce({ docs: [doc] });

    const first = await getStaticPage("delivery");
    const second = await getStaticPage("delivery");

    expect(first).toEqual(doc);
    expect(second).toEqual(doc);
    // Only one payload.find — second call served from cache.
    expect(findMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache misses — every null lookup re-queries", async () => {
    findMock.mockResolvedValue({ docs: [] });

    await getStaticPage("nope");
    await getStaticPage("nope");

    expect(findMock).toHaveBeenCalledTimes(2);
  });
});

describe("invalidateStaticPageCache", () => {
  it("with a slug removes only that entry", async () => {
    findMock.mockResolvedValueOnce({ docs: [makeDoc("offer")] });
    findMock.mockResolvedValueOnce({ docs: [makeDoc("privacy")] });

    await getStaticPage("offer");
    await getStaticPage("privacy");
    expect(findMock).toHaveBeenCalledTimes(2);

    invalidateStaticPageCache("offer");

    // offer must re-query, privacy must still come from cache
    findMock.mockResolvedValueOnce({ docs: [makeDoc("offer")] });
    await getStaticPage("offer");
    await getStaticPage("privacy");

    expect(findMock).toHaveBeenCalledTimes(3);
  });

  it("with no argument clears all entries", async () => {
    findMock.mockResolvedValueOnce({ docs: [makeDoc("offer")] });
    findMock.mockResolvedValueOnce({ docs: [makeDoc("privacy")] });

    await getStaticPage("offer");
    await getStaticPage("privacy");
    expect(findMock).toHaveBeenCalledTimes(2);

    invalidateStaticPageCache();

    findMock.mockResolvedValueOnce({ docs: [makeDoc("offer")] });
    findMock.mockResolvedValueOnce({ docs: [makeDoc("privacy")] });

    await getStaticPage("offer");
    await getStaticPage("privacy");

    expect(findMock).toHaveBeenCalledTimes(4);
  });
});
