// Rewrites legacy soliton1.ru asset URLs to locally cached paths
// under /public/legacy/wp/<path>. The download script in
// `apps/web/scripts/download-legacy-assets.mjs` mirrors the directory layout
// from `soliton1.ru/wp-content/uploads/<...>` to `public/legacy/wp/<...>`.
//
// During the migration window, missing local files fall back to the original
// URL when `process.env.LEGACY_MEDIA_FALLBACK === "true"`. By default we serve
// only from the project origin so the public site has no third-party dependency.

const LEGACY_HOST = "soliton1.ru";
const WP_PREFIX = "/wp-content/uploads/";
const LOCAL_PREFIX = "/legacy/wp/";

export function rewriteLegacyAssetUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (!url.includes(LEGACY_HOST)) return url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  if (!parsed.hostname.endsWith(LEGACY_HOST)) return url;

  if (parsed.pathname.startsWith(WP_PREFIX)) {
    return LOCAL_PREFIX + parsed.pathname.slice(WP_PREFIX.length);
  }

  // Anything else under soliton1.ru — preserve path under /legacy/other/
  return "/legacy/other/" + parsed.pathname.replace(/^\//, "");
}

export function isLegacyAssetUrl(url: string | null | undefined): boolean {
  return Boolean(url && url.includes(LEGACY_HOST));
}
