import "server-only";

/**
 * Customer session JWT signer (054 C1 fix).
 *
 * Magic-link verification cannot use `payload.login` because there's no
 * plaintext password to compare against — the placeholder password is random
 * and unknown to anyone. Calling login on it would (a) always fail, (b)
 * increment the login-attempts counter, and (c) lock the account after 5
 * magic-link clicks.
 *
 * Instead, we mint a HS256 JWT directly using `process.env.PAYLOAD_SECRET`,
 * matching the shape Payload's JWT-Auth strategy expects. The strategy
 * decodes `id` + `collection` and loads the user from DB.
 *
 * Uses Node's built-in crypto (HMAC-SHA256) — no jsonwebtoken dependency.
 */

import { createHmac } from "node:crypto";

interface CustomerSessionPayload {
  id: string | number;
  collection: "customers";
  email: string;
}

function base64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf) : buf;
  return b.toString("base64url");
}

/**
 * Sign a Payload-compatible HS256 JWT for a customer session.
 *
 * @param payload - customer id, collection, email
 * @param ttlSeconds - token lifetime (default: matches CUSTOMER_SESSION_TTL_HOURS)
 * @returns signed JWT string suitable for the `customer_session` cookie value
 */
export function signCustomerSessionToken(
  payload: CustomerSessionPayload,
  ttlSeconds: number = Number(process.env.CUSTOMER_SESSION_TTL_HOURS ?? 24) * 60 * 60,
): string {
  const secret = process.env.PAYLOAD_SECRET;
  if (!secret) {
    throw new Error("PAYLOAD_SECRET is not set — cannot sign customer session token");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    id: typeof payload.id === "string" && /^\d+$/.test(payload.id) ? Number(payload.id) : payload.id,
    collection: payload.collection,
    email: payload.email,
    iat: now,
    exp: now + ttlSeconds,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const bodyB64 = base64url(JSON.stringify(body));
  const signingInput = `${headerB64}.${bodyB64}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");

  return `${signingInput}.${signature}`;
}
