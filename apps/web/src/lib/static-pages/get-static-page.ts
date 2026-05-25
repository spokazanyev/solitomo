// Server-only helper. See make-consent-record.ts for why we don't use
// `import "server-only"` — the same module is dynamically required by the
// StaticPages.afterChange hook running under the payload tsx bin.
import { getPayload } from "payload";
import configPromise from "@payload-config";

/**
 * Public-facing shape of a static-page document (057 contracts/static-pages-api.md).
 *
 * Payload generated types (`StaticPage`) are not yet available — until `pnpm
 * generate:types` runs, callers must rely on this interface. The helper uses
 * `as never` / `as unknown as` casts where TypeScript would block us from
 * referring to the un-generated collection slug; this is the documented repo
 * pattern.
 */
export interface StaticPageDoc {
  id: string | number;
  slug: string;
  section: "info" | "company" | "other";
  title: string;
  subtitle?: string;
  body: unknown; // Lexical rich-text JSON
  category: "policy" | "info" | "faq";
  version?: string;
  effectiveFrom?: string;
  seoTitle?: string;
  seoDescription?: string;
  indexingPolicy: "index" | "noindex";
  status: "draft" | "published";
  updatedAt: string;
  createdAt: string;
}

const cache: Map<string, { doc: StaticPageDoc; cachedAt: number }> = new Map();
const CACHE_TTL_MS = 60_000;

/**
 * Load a published static-page by slug. Returns `null` if no published doc
 * matches. Results are cached in-process for 60 s; the `static-pages`
 * collection's `afterChange` hook calls `invalidateStaticPageCache(slug)` so
 * edits in admin are reflected within the same process instantly.
 */
export async function getStaticPage(slug: string): Promise<StaticPageDoc | null> {
  const cached = cache.get(slug);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.doc;
  }

  // Graceful fallback: during `next build` (docker builder stage) Postgres is
  // unreachable. Match the pattern used by `lib/catalog.ts` for /catalog/* —
  // log and return null so the page renders `notFound()` instead of crashing
  // the whole build. At runtime the database is always up.
  try {
    const payload = await getPayload({ config: configPromise });
    const result = await payload.find({
      collection: "static-pages" as never,
      where: {
        and: [
          { slug: { equals: slug } },
          { status: { equals: "published" } },
        ],
      },
      limit: 1,
      depth: 0,
    });
    const doc = (result.docs[0] as unknown as StaticPageDoc | undefined) ?? null;
    if (doc) cache.set(slug, { doc, cachedAt: Date.now() });
    return doc;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[static-pages] Payload load failed for slug "${slug}"; rendering as notFound. Reason:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Drop cached entries for a slug, or clear the entire cache when no slug is
 * provided. Called from `StaticPages.afterChange` and from tests.
 */
export function invalidateStaticPageCache(slug?: string): void {
  if (slug) cache.delete(slug);
  else cache.clear();
}
