#!/usr/bin/env node
//
// 059 Phase 5 (FR-023): bulk-ping всех проиндексируемых URL в IndexNow.
//
// Читает sitemap.xml боевого сайта, извлекает все <loc> и отправляет их одним
// батчем (до 10 000) в IndexNow (Яндекс/Bing/Seznam/Naver). Используется:
//   1. сразу после первичной настройки IndexNow (первый массовый push);
//   2. для recovery, если IndexNow был недоступен во время точечных ping'ов.
//
// Запуск:
//   SITE_URL=https://pdumarket.ru node scripts/indexnow-bulk.mjs
//   (INDEXNOW_KEY переопределяет ключ по умолчанию при необходимости)

const SITE_URL = (process.env.SITE_URL ?? "https://pdumarket.ru").replace(/\/$/, "");
const INDEXNOW_KEY = process.env.INDEXNOW_KEY ?? "01b1f0dadb0b04b5a075de6e60714cc3";
const ENDPOINT = "https://api.indexnow.org/indexnow";

async function fetchSitemapUrls() {
  const res = await fetch(`${SITE_URL}/sitemap.xml`, { redirect: "follow" });
  if (!res.ok) throw new Error(`sitemap.xml → HTTP ${res.status}`);
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  // Берём только URL боевого хоста (защита от localhost в sitemap).
  return [...new Set(urls.filter((u) => u.startsWith(SITE_URL)))];
}

async function main() {
  const host = new URL(SITE_URL).host;
  if (host.includes("localhost") || host.startsWith("127.")) {
    console.error(`[indexnow-bulk] отказ: host=${host} (нужен боевой домен)`);
    process.exit(1);
  }

  const urls = await fetchSitemapUrls();
  if (urls.length === 0) {
    console.error("[indexnow-bulk] в sitemap нет URL боевого хоста — abort");
    process.exit(1);
  }

  console.log(`[indexnow-bulk] host=${host}, URL в sitemap: ${urls.length}`);

  const payload = {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urls.slice(0, 10000),
  };

  const res = await fetch(ENDPOINT, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json; charset=utf-8" },
    method: "POST",
  });

  // IndexNow возвращает 200 или 202 при успехе.
  if (res.ok) {
    console.log(`[indexnow-bulk] ✓ отправлено ${payload.urlList.length} URL — HTTP ${res.status}`);
  } else {
    console.error(`[indexnow-bulk] ✗ HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[indexnow-bulk] failed:", error);
  process.exit(1);
});
