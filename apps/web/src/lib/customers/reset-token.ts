import "server-only";

/**
 * Password reset tokens (054 US2a, FR-5410 forgot/reset flow).
 *
 * Same opaque-token pattern as magic-link but stored in a separate field
 * (`customers.resetPasswordToken`) so flows don't interfere.
 *
 * TTL: 30 minutes. Single-use: cleared on consumption.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;
const RESET_TTL_MIN = 30;

export function generateResetToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

let _resetHashKey: Buffer | null = null;
function getResetHashKey(): Buffer {
  if (_resetHashKey) return _resetHashKey;
  const secret =
    process.env.MAGIC_LINK_HASH_SECRET ??
    process.env.PAYLOAD_SECRET ??
    "soliton-default-reset-hash-key";
  _resetHashKey = Buffer.from(secret, "utf-8");
  return _resetHashKey;
}

/** 054 H5 fix: hash for at-rest storage. */
export function hashStoredResetToken(plainToken: string): string {
  return createHmac("sha256", getResetHashKey()).update(plainToken).digest("hex");
}

export function isValidResetTokenFormat(token: unknown): token is string {
  if (typeof token !== "string") return false;
  if (token.length < 32 || token.length > 64) return false;
  return /^[A-Za-z0-9_-]+$/.test(token);
}

export function resetTokenExpiresAt(now: Date = new Date()): string {
  return new Date(now.getTime() + RESET_TTL_MIN * 60_000).toISOString();
}

export function isResetTokenExpired(expiresAt: string | Date | null | undefined): boolean {
  if (!expiresAt) return true;
  const ts = typeof expiresAt === "string" ? new Date(expiresAt).getTime() : expiresAt.getTime();
  return Date.now() >= ts;
}

export function resetTokensEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
