// Server-only helper. Avoid `import "server-only"` because this module is
// also imported via the `payload` bin (tsx runtime) at seed/admin time, where
// the React server-only guard throws. Path discipline keeps it server-side.
import { createHash } from "node:crypto";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import type { NextRequest } from "next/server";
import type { ConsentRecord } from "./consent-types";

const POLICY_SLUGS = ["offer", "privacy", "pd-policy"] as const;

let policyVersionCache:
  | { offer: string; privacy: string; pdPolicy: string; cachedAt: number }
  | null = null;
const CACHE_TTL_MS = 60_000; // 1 min

async function loadPolicyVersions(): Promise<{
  offer: string;
  privacy: string;
  pdPolicy: string;
}> {
  if (
    policyVersionCache &&
    Date.now() - policyVersionCache.cachedAt < CACHE_TTL_MS
  ) {
    return policyVersionCache;
  }
  const payload = await getPayload({ config: configPromise });
  const [offer, privacy, pdPolicy] = await Promise.all(
    POLICY_SLUGS.map((slug) =>
      payload.find({
        collection: "static-pages" as never,
        where: {
          and: [
            { slug: { equals: slug } },
            { status: { equals: "published" } },
          ],
        },
        limit: 1,
      }),
    ),
  );
  policyVersionCache = {
    offer:
      (offer.docs[0] as { version?: string } | undefined)?.version ?? "unknown",
    privacy:
      (privacy.docs[0] as { version?: string } | undefined)?.version ??
      "unknown",
    pdPolicy:
      (pdPolicy.docs[0] as { version?: string } | undefined)?.version ??
      "unknown",
    cachedAt: Date.now(),
  };
  return policyVersionCache;
}

/** Invalidate cache after admin updates a policy. Called from static-pages afterChange hook. */
export function invalidatePolicyVersionCache(): void {
  policyVersionCache = null;
}

/**
 * Sentinel thrown when a consent record cannot be assembled because policy
 * documents are missing from the database. The API route should turn this
 * into HTTP 503 ("service unavailable, retry") rather than persisting a junk
 * `"unknown"` policy version into a legally-binding record (FR-5737, FR-5741).
 *
 * Operational fix: run `pnpm --filter @soliton/web seed:static-pages` so the
 * three policy slugs (`offer`, `privacy`, `pd-policy`) exist and are
 * published.
 */
export class ConsentPolicyMissingError extends Error {
  constructor(missing: string[]) {
    super(
      `Cannot record consent: policy versions missing for ${missing.join(", ")}. ` +
        `Run \`pnpm seed:static-pages\` and ensure pages are published.`,
    );
    this.name = "ConsentPolicyMissingError";
  }
}

export async function makeConsentRecord(
  req: NextRequest | Request,
): Promise<ConsentRecord> {
  const { offer, privacy, pdPolicy } = await loadPolicyVersions();

  // Fail-closed: if any of the policy documents the user is consenting to
  // is missing or unpublished, refuse to fabricate a record. A consent
  // record without a real version string is legally worthless.
  const missing: string[] = [];
  if (offer === "unknown") missing.push("offer");
  if (privacy === "unknown") missing.push("privacy");
  if (pdPolicy === "unknown") missing.push("pd-policy");
  if (missing.length > 0) {
    throw new ConsentPolicyMissingError(missing);
  }

  const headers = "headers" in req ? req.headers : new Headers();
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown";
  const userAgent = headers.get("user-agent") ?? undefined;

  // Per-deploy salt makes the IP hash non-correlatable across deploys and
  // resistant to rainbow-table re-identification by anyone with DB read
  // access. Pattern matches 052 cart-IP hashing.
  const salt = process.env.IP_HASH_SALT ?? "";

  return {
    consentedAt: new Date().toISOString(),
    policyVersionOffer: offer,
    // Privacy policy and pd-policy are conceptually distinct (FR-5737 ties
    // policyVersionPrivacy to /info/privacy/ specifically). Do NOT alias
    // pd-policy into the privacy slot — the legal-team query "what version
    // of the privacy policy did user X accept?" must resolve unambiguously.
    policyVersionPrivacy: privacy,
    ipHash: createHash("sha256").update(salt).update(ip).digest("hex").slice(0, 32),
    userAgent: userAgent?.slice(0, 200),
  };
}
