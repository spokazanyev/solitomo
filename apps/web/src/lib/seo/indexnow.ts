import { getSiteUrl } from "@/lib/seo/seo-registry";

/**
 * 059 Phase 5 — IndexNow push-протокол (FR-020..024).
 *
 * Мгновенно уведомляет Яндекс / Bing / Seznam / Naver о новых и изменённых
 * URL (вместо ожидания планового краула 2–4 недели). Google IndexNow не
 * поддерживает (на 2026) — для него работает sitemap + обычный краул.
 *
 * Ключ публичен по дизайну (он доступен по URL `/<key>.txt`), поэтому хранится
 * в коде. Файл `apps/web/public/<key>.txt` ДОЛЖЕН совпадать с этим значением.
 * Override через env `INDEXNOW_KEY` возможен, но тогда нужен совпадающий файл.
 */
export const INDEXNOW_KEY =
  process.env.INDEXNOW_KEY ?? "01b1f0dadb0b04b5a075de6e60714cc3";

const ENDPOINT = "https://api.indexnow.org/indexnow";

/**
 * Отправляет список абсолютных URL в IndexNow одним батчем (до 10 000, FR-024).
 * Fire-and-forget: любые ошибки логируются и проглатываются — ping НИКОГДА не
 * блокирует основную операцию (FR-022).
 */
export async function pingIndexNow(urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  const siteUrl = getSiteUrl();
  let host: string;
  try {
    host = new URL(siteUrl).host;
  } catch {
    return;
  }

  // С локалки / preview не пингуем — только боевой домен.
  if (host.includes("localhost") || host.startsWith("127.")) return;

  const payload = {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${siteUrl}/${INDEXNOW_KEY}.txt`,
    urlList: urls.slice(0, 10000),
  };

  try {
    const res = await fetch(ENDPOINT, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json; charset=utf-8" },
      method: "POST",
    });
    if (!res.ok) {
      console.error(`[indexnow] ping HTTP ${res.status} for ${urls.length} url(s)`);
    }
  } catch (error) {
    console.error("[indexnow] ping failed", error);
  }
}

/** Удобный хелпер: пингануть один относительный путь (строит абсолютный URL). */
export async function pingIndexNowPath(path: string): Promise<void> {
  await pingIndexNow([`${getSiteUrl()}${path}`]);
}
