import "server-only";

/**
 * Customer repository — Payload local API wrapper (054).
 */

import type { Payload } from "payload";

import {
  generateMagicLinkToken,
  hashStoredToken,
  magicLinkExpiresAt,
} from "./magic-link";
import {
  generateResetToken,
  hashStoredResetToken,
  resetTokenExpiresAt,
} from "./reset-token";

export interface CustomerRecord {
  id: string;
  email: string;
  emailValid: boolean;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  customerType: "individual" | "company-contact";
  companyId?: string;
  role: "owner" | "accountant" | "purchaser" | "contact";
  accountState: "email-only" | "password-set" | "invited-stub" | "deleted";
  magicLinkToken?: string;
  magicLinkExpiresAt?: string;
  magicLinkConsumedAt?: string;
  resetPasswordToken?: string;
  resetPasswordExpiresAt?: string;
  marketingOptIn: boolean;
  messengerOptIn: boolean;
  deletedAt?: string;
  gdprConsentAt?: string;
  lastLoginAt?: string;
  loginCount: number;
}

function resolveRelId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const id = (value as { id?: string | number }).id;
    if (id !== undefined) return String(id);
  }
  return undefined;
}

export function toCustomerRecord(doc: Record<string, unknown>): CustomerRecord {
  return {
    id: String(doc.id),
    email: String(doc.email ?? ""),
    emailValid: Boolean(doc.emailValid),
    firstName: typeof doc.firstName === "string" ? doc.firstName : undefined,
    lastName: typeof doc.lastName === "string" ? doc.lastName : undefined,
    fullName: typeof doc.fullName === "string" ? doc.fullName : undefined,
    phone: typeof doc.phone === "string" ? doc.phone : undefined,
    customerType: (doc.customerType as CustomerRecord["customerType"]) ?? "individual",
    companyId: resolveRelId(doc.companyId),
    role: (doc.role as CustomerRecord["role"]) ?? "contact",
    accountState: (doc.accountState as CustomerRecord["accountState"]) ?? "email-only",
    magicLinkToken: typeof doc.magicLinkToken === "string" ? doc.magicLinkToken : undefined,
    magicLinkExpiresAt:
      typeof doc.magicLinkExpiresAt === "string" ? doc.magicLinkExpiresAt : undefined,
    magicLinkConsumedAt:
      typeof doc.magicLinkConsumedAt === "string" ? doc.magicLinkConsumedAt : undefined,
    resetPasswordToken:
      typeof doc.resetPasswordToken === "string" ? doc.resetPasswordToken : undefined,
    resetPasswordExpiresAt:
      typeof doc.resetPasswordExpiresAt === "string" ? doc.resetPasswordExpiresAt : undefined,
    marketingOptIn: Boolean(doc.marketingOptIn),
    messengerOptIn: Boolean(doc.messengerOptIn),
    deletedAt: typeof doc.deletedAt === "string" ? doc.deletedAt : undefined,
    gdprConsentAt: typeof doc.gdprConsentAt === "string" ? doc.gdprConsentAt : undefined,
    lastLoginAt: typeof doc.lastLoginAt === "string" ? doc.lastLoginAt : undefined,
    loginCount: typeof doc.loginCount === "number" ? doc.loginCount : 0,
  };
}

/** Lowercase + trim email; canonical form for lookups. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Find customer by email (case-insensitive). Excludes deleted by default.
 */
export async function findByEmail(
  payload: Payload,
  email: string,
  options: { includeDeleted?: boolean } = {},
): Promise<CustomerRecord | null> {
  const norm = normalizeEmail(email);
  if (!norm.includes("@")) return null;

  const where: Record<string, unknown> = { email: { equals: norm } };
  if (!options.includeDeleted) {
    where.deletedAt = { exists: false };
  }

  const result = await payload.find({
    collection: "customers" as never,
    where: where as never,
    limit: 1,
    overrideAccess: true,
  });
  const doc = result.docs[0] as unknown as Record<string, unknown> | undefined;
  return doc ? toCustomerRecord(doc) : null;
}

/**
 * Find customer by magic-link token (used for verification).
 * 054 H5 fix: looks up by HMAC hash, not the plaintext token.
 */
export async function findByMagicToken(
  payload: Payload,
  plainToken: string,
): Promise<CustomerRecord | null> {
  if (!plainToken || plainToken.length < 32) return null;
  const tokenHash = hashStoredToken(plainToken);
  const result = await payload.find({
    collection: "customers" as never,
    where: { magicLinkToken: { equals: tokenHash } } as never,
    limit: 1,
    overrideAccess: true,
  });
  const doc = result.docs[0] as unknown as Record<string, unknown> | undefined;
  return doc ? toCustomerRecord(doc) : null;
}

/**
 * Find customer by reset-password token.
 * 054 H5 fix: lookup by HMAC hash.
 */
export async function findByResetToken(
  payload: Payload,
  plainToken: string,
): Promise<CustomerRecord | null> {
  if (!plainToken || plainToken.length < 32) return null;
  const tokenHash = hashStoredResetToken(plainToken);
  const result = await payload.find({
    collection: "customers" as never,
    where: { resetPasswordToken: { equals: tokenHash } } as never,
    limit: 1,
    overrideAccess: true,
  });
  const doc = result.docs[0] as unknown as Record<string, unknown> | undefined;
  return doc ? toCustomerRecord(doc) : null;
}

/**
 * Get or create a customer in `email-only` state.
 * Idempotent: if a customer with this email exists (not deleted), returns it.
 */
export async function getOrCreateEmailOnlyCustomer(
  payload: Payload,
  email: string,
  // 057 US4: optional embedded consent record (152-ФЗ Art. 9). Persisted only
  // when a NEW row is created — existing customers keep their original consent.
  consent?: import("../consent/consent-types").ConsentRecord,
): Promise<CustomerRecord> {
  const norm = normalizeEmail(email);
  const existing = await findByEmail(payload, norm);
  if (existing) return existing;

  // Payload auth-collection requires a password. Generate a random one
  // (customer doesn't know it; they'll set their own via reset/register flow).
  const placeholderPassword = generateMagicLinkToken();

  const doc = (await payload.create({
    collection: "customers" as never,
    data: {
      email: norm,
      password: placeholderPassword,
      accountState: "email-only",
      customerType: "individual",
      role: "contact",
      gdprConsentAt: new Date().toISOString(),
      ...(consent ? { consent } : {}),
    } as never,
    overrideAccess: true,
  })) as unknown as Record<string, unknown>;

  return toCustomerRecord(doc);
}

/**
 * Issue a fresh magic-link token for a customer.
 * 054 H5 fix: stores HMAC hash; returns plaintext token (caller emails it).
 */
export async function issueMagicLink(
  payload: Payload,
  customerId: string,
  ip?: string,
): Promise<{ token: string; expiresAt: string }> {
  const token = generateMagicLinkToken();
  const expiresAt = magicLinkExpiresAt();
  await payload.update({
    collection: "customers" as never,
    id: customerId,
    data: {
      magicLinkToken: hashStoredToken(token),
      magicLinkExpiresAt: expiresAt,
      magicLinkConsumedAt: null,
      magicLinkRequestedFromIp: ip,
    } as never,
    overrideAccess: true,
  });
  return { token, expiresAt };
}

/**
 * Consume a magic-link token: clear it and set consumedAt.
 * Should be called after the caller has validated expiry and emitted the cookie.
 */
export async function consumeMagicLink(
  payload: Payload,
  customerId: string,
): Promise<void> {
  await payload.update({
    collection: "customers" as never,
    id: customerId,
    data: {
      magicLinkToken: null,
      magicLinkConsumedAt: new Date().toISOString(),
    } as never,
    overrideAccess: true,
  });
}

/**
 * Issue a password-reset token.
 * 054 H5 fix: stores HMAC hash; returns plaintext for the email.
 */
export async function issueResetToken(
  payload: Payload,
  customerId: string,
): Promise<{ token: string; expiresAt: string }> {
  const token = generateResetToken();
  const expiresAt = resetTokenExpiresAt();
  await payload.update({
    collection: "customers" as never,
    id: customerId,
    data: {
      resetPasswordToken: hashStoredResetToken(token),
      resetPasswordExpiresAt: expiresAt,
    } as never,
    overrideAccess: true,
  });
  return { token, expiresAt };
}

/**
 * Record a successful login (audit trail).
 */
export async function recordLogin(
  payload: Payload,
  customerId: string,
  ip: string | undefined,
  userAgent: string | undefined,
  previousLoginCount: number,
): Promise<void> {
  await payload.update({
    collection: "customers" as never,
    id: customerId,
    data: {
      lastLoginAt: new Date().toISOString(),
      lastLoginIp: ip,
      lastLoginUserAgent: userAgent?.slice(0, 200),
      loginCount: previousLoginCount + 1,
    } as never,
    overrideAccess: true,
  });
}
