/**
 * Programmatic analytics loaders (browser-only).
 *
 * Why not `next/script`? Even `strategy="lazyOnload"` requests the script
 * during idle. We need a hard gate: no network at all until the user
 * opts in via the cookies banner. See research.md §R4.
 *
 * Functions are idempotent (each id is loaded at most once per page) and
 * NOOP on the server.
 */

import { readCookieConsent } from "./cookie-consent";

const loadedGaIds = new Set<string>();
const loadedYmIds = new Set<string>();

function isBrowser(): boolean {
  return typeof document !== "undefined";
}

/**
 * Load Google Analytics 4 with the given measurement id (e.g. "G-XXXXXXX").
 * Safe to call multiple times — only the first call per id has an effect.
 */
export function loadGoogleAnalytics(measurementId: string): void {
  if (!isBrowser()) return;
  if (!measurementId) return;
  if (loadedGaIds.has(measurementId)) return;
  loadedGaIds.add(measurementId);

  const gtagSrc = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
    measurementId,
  )}`;

  const remote = document.createElement("script");
  remote.async = true;
  remote.src = gtagSrc;
  document.head.appendChild(remote);

  const init = document.createElement("script");
  init.text = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(measurementId)});`;
  document.head.appendChild(init);
}

/**
 * Load Yandex.Metrika counter using the standard initialiser snippet.
 * @see https://yandex.ru/support/metrica/code/counter-initialize.html
 */
export function loadYandexMetrika(counterId: string): void {
  if (!isBrowser()) return;
  if (!counterId) return;
  if (loadedYmIds.has(counterId)) return;
  loadedYmIds.add(counterId);

  const id = JSON.stringify(counterId);
  const init = document.createElement("script");
  init.text = `(function(m,e,t,r,i,k,a){
  m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j = 0; j < document.scripts.length; j++) {
    if (document.scripts[j].src === r) { return; }
  }
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
ym(${id}, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });`;
  document.head.appendChild(init);
}

/**
 * Convenience: read consent and load whichever analytics ids are configured
 * via `NEXT_PUBLIC_GA_MEASUREMENT_ID` / `NEXT_PUBLIC_YANDEX_METRIKA_ID`
 * (legacy `NEXT_PUBLIC_YANDEX_METRICA_ID` also accepted).
 * NOOP when consent is not `"accepted"`.
 */
export function loadAnalyticsFromConsent(): void {
  if (!isBrowser()) return;
  if (readCookieConsent() !== "accepted") return;

  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const ymId =
    process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ??
    process.env.NEXT_PUBLIC_YANDEX_METRICA_ID;

  if (gaId) loadGoogleAnalytics(gaId);
  if (ymId) loadYandexMetrika(ymId);
}

/** Test-only helper: forget which ids have already been loaded. */
export function __resetAnalyticsLoaderForTests(): void {
  loadedGaIds.clear();
  loadedYmIds.clear();
}
