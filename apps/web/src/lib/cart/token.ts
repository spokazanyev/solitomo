import "server-only";

/**
 * Cart token generation and hashing (052 FR-5201).
 *
 * Tokens are 128-bit (16 byte) URL-safe random strings — high entropy to prevent
 * brute-force enumeration via /api/cart/{token}.
 *
 * Hash is used for PII-safe logging (cartTokenHash = sha256(token).slice(0, 12)).
 */

import { createHash, randomBytes } from "node:crypto";

/**
 * Generate a cryptographically-secure URL-safe cart token.
 * Returns a 22-character base64url string (16 bytes of entropy).
 */
export function generateCartToken(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * Hash a cart token for PII-safe logging.
 * Returns first 12 chars of SHA-256 hex digest.
 */
export function hashCartToken(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}

/**
 * Mask cart token for log output: shows first 4 chars + hash suffix.
 */
export function maskCartToken(token: string): string {
  if (!token || token.length < 8) return "***";
  return `${token.slice(0, 4)}...${hashCartToken(token).slice(0, 6)}`;
}

/**
 * Validate cart token format (basic sanity check — does not check existence).
 * Returns true if the token looks like a valid base64url string of expected length.
 */
export function isValidTokenFormat(token: unknown): token is string {
  if (typeof token !== "string") return false;
  if (token.length < 16 || token.length > 64) return false;
  return /^[A-Za-z0-9_-]+$/.test(token);
}
