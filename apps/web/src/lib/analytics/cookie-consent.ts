/**
 * Cookie consent utilities (browser-only).
 *
 * Manages the `cookie_consent` cookie used to gate analytics loading
 * per US6 / FR-5750..5755 (spec 057-yookassa-buyer-info-compliance).
 *
 * All functions are NOOPs on the server (when `typeof document === "undefined"`).
 */

export type CookieConsentValue = "accepted" | "declined" | null;

export const COOKIE_CONSENT_NAME = "cookie_consent";
const DEFAULT_DAYS = 365;

function isBrowser(): boolean {
  return typeof document !== "undefined";
}

/**
 * Parse `document.cookie` for `cookie_consent`.
 * Returns `null` when the cookie is missing, has an unexpected value,
 * or when called server-side.
 */
export function readCookieConsent(): CookieConsentValue {
  if (!isBrowser()) return null;
  const raw = document.cookie ?? "";
  if (!raw) return null;
  const cookies = raw.split(";");
  for (const part of cookies) {
    const [rawName, ...rest] = part.split("=");
    const name = rawName?.trim();
    if (name !== COOKIE_CONSENT_NAME) continue;
    const value = decodeURIComponent((rest.join("=") ?? "").trim());
    if (value === "accepted" || value === "declined") return value;
    return null;
  }
  return null;
}

/**
 * Persist a consent decision to a first-party cookie.
 * Adds `Secure` only on https origins (so local http dev still works).
 */
export function setCookieConsent(
  value: "accepted" | "declined",
  days: number = DEFAULT_DAYS,
): void {
  if (!isBrowser()) return;
  const maxAge = Math.max(0, Math.floor(days * 86400));
  const isHttps =
    typeof window !== "undefined" && window.location?.protocol === "https:";
  const attrs = [
    `${COOKIE_CONSENT_NAME}=${encodeURIComponent(value)}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "SameSite=Lax",
  ];
  if (isHttps) attrs.push("Secure");
  document.cookie = attrs.join("; ");
}

/**
 * Clear the consent cookie (used by the footer "Manage cookies" action
 * to re-prompt the user).
 */
export function clearCookieConsent(): void {
  if (!isBrowser()) return;
  const attrs = [
    `${COOKIE_CONSENT_NAME}=`,
    "Max-Age=0",
    "Path=/",
    "SameSite=Lax",
  ];
  const isHttps =
    typeof window !== "undefined" && window.location?.protocol === "https:";
  if (isHttps) attrs.push("Secure");
  document.cookie = attrs.join("; ");
}
