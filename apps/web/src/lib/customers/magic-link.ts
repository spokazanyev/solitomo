import "server-only";

/**
 * Magic-link token utilities (054 FR-5411, RD-1).
 *
 * Tokens are **opaque** 256-bit random strings stored in `customers.magicLinkToken`.
 * They are NOT JWTs — no signing, no payload, no client-side parsing.
 *
 * Lifecycle:
 *   1. Customer requests magic-link (or system creates one in afterCreate)
 *   2. Token + expiresAt persisted on Customer row
 *   3. Customer clicks link → server validates token + expiry, sets cookie
 *   4. magicLinkConsumedAt = now (audit; sliding cookie session lives 24h)
 *
 * Single-use semantics: after consumption the token is cleared. Customer
 * can keep the session via cookie; a new magic-link is required only after
 * cookie expiry or explicit logout.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32; // 256 bits of entropy

export const MAGIC_LINK_TTL_MIN = Number(process.env.CUSTOMER_MAGIC_TTL_MIN ?? 30);

/**
 * Generate a cryptographically-secure opaque token.
 * Returns 43-character base64url string (32 bytes → 43 chars unpadded).
 */
export function generateMagicLinkToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Hash a token for PII-safe logging.
 * Returns first 12 chars of SHA-256 hex digest (collision-resistant for audit).
 */
export function hashMagicLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}

// ─── At-rest hashing (054 H5 fix) ──────────────────────────────────────────────
//
// Plaintext tokens at rest mean any DB leak / replication tap exposes live tokens
// until expiry. Industry practice: store HMAC-SHA256(token, server-key) and
// compare hashes at verify time. Comparison still uses timingSafeEqual.

let _hashKey: Buffer | null = null;

function getTokenHashKey(): Buffer {
  if (_hashKey) return _hashKey;
  const secret =
    process.env.MAGIC_LINK_HASH_SECRET ??
    process.env.PAYLOAD_SECRET ??
    "soliton-default-magic-hash-key";
  _hashKey = Buffer.from(secret, "utf-8");
  return _hashKey;
}

/**
 * Hash a token for at-rest storage. Returns hex digest (64 chars).
 * Use the plain token in the URL/cookie; store hashStoredToken(plain) in DB.
 */
export function hashStoredToken(plainToken: string): string {
  return createHmac("sha256", getTokenHashKey()).update(plainToken).digest("hex");
}

/**
 * Validate token format. Returns true if it looks like a valid base64url string
 * of the expected length. Constant-time format check, not a DB lookup.
 */
export function isValidTokenFormat(token: unknown): token is string {
  if (typeof token !== "string") return false;
  // 32 bytes → 43 chars in base64url (no padding)
  if (token.length < 32 || token.length > 64) return false;
  return /^[A-Za-z0-9_-]+$/.test(token);
}

/**
 * Constant-time string comparison for token matching.
 * Prevents timing attacks on stored vs. submitted token.
 */
export function tokensEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Compute an absolute expiry ISO string based on TTL.
 */
export function magicLinkExpiresAt(now: Date = new Date()): string {
  return new Date(now.getTime() + MAGIC_LINK_TTL_MIN * 60_000).toISOString();
}

/**
 * Is a magic-link expired? Accepts ISO string or Date.
 */
export function isMagicLinkExpired(expiresAt: string | Date | null | undefined): boolean {
  if (!expiresAt) return true;
  const ts = typeof expiresAt === "string" ? new Date(expiresAt).getTime() : expiresAt.getTime();
  return Date.now() >= ts;
}
