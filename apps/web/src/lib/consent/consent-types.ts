/**
 * Embedded group `consent` для Orders / Carts / Customers / RfqRequests.
 * Заполняется server-side через makeConsentRecord(req) при создании сущности.
 * Read-only в админ-панели Payload.
 */
export interface ConsentRecord {
  /** ISO 8601 timestamp момента согласия */
  consentedAt: string;
  /** Версия политики конфиденциальности (формат: YYYY-MM-DD-vN) */
  policyVersionPrivacy: string;
  /** Версия публичной оферты */
  policyVersionOffer: string;
  /** SHA-256 хэш IP (PII protection, первые 32 hex-символа) */
  ipHash: string;
  /** User-Agent клиента, ≤ 200 символов */
  userAgent?: string;
}

/** Type guard: проверка наличия валидного согласия в сущности */
export function hasValidConsent(consent: unknown): consent is ConsentRecord {
  if (!consent || typeof consent !== "object") return false;
  const c = consent as Record<string, unknown>;
  return Boolean(
    c.consentedAt && c.policyVersionPrivacy && c.policyVersionOffer && c.ipHash,
  );
}
