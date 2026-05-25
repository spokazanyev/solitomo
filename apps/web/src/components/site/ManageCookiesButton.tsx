"use client";

/**
 * Footer "Управление cookies" button (spec 057, US6).
 *
 * Dispatches the global `cookie:reprompt` window event so the mounted
 * `<CookieConsentBanner>` can re-show itself without a page reload.
 */
export function ManageCookiesButton() {
  return (
    <button
      type="button"
      className="text-sm text-slate-600 underline underline-offset-2 transition hover:text-emerald-700"
      onClick={() => window.dispatchEvent(new CustomEvent("cookie:reprompt"))}
    >
      Управление cookies
    </button>
  );
}

export default ManageCookiesButton;
