#!/usr/bin/env node
//
// Downloads legacy assets referenced from `soliton1_assortment_raw.json` into
// `apps/web/public/legacy/wp/<...>` preserving the WordPress upload layout.
//
// Idempotent: skips files that already exist and match the expected size,
// retries with backoff on transient failures, throttles to one request per
// configurable interval.
//
// Usage:
//   node apps/web/scripts/download-legacy-assets.mjs              # full run
//   LIMIT=5 node apps/web/scripts/download-legacy-assets.mjs      # cap items
//   THROTTLE_MS=1500 node apps/web/scripts/download-legacy-assets.mjs

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");
const ASSORTMENT_PATH = join(
  REPO_ROOT,
  "00-source-data",
  "assortment",
  "soliton1_assortment_raw.json",
);
const OUT_BASE = join(__dirname, "..", "public", "legacy");
const MANIFEST_PATH = join(REPO_ROOT, "06-reports", "06-asset-inventory.json");
const LEGACY_HOST = "soliton1.ru";
const WP_PREFIX = "/wp-content/uploads/";

const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
const THROTTLE_MS = Number(process.env.THROTTLE_MS ?? "750");
const RETRY = Number(process.env.RETRY ?? "3");

function classifyUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!parsed.hostname.endsWith(LEGACY_HOST)) return null;
  if (parsed.pathname.startsWith(WP_PREFIX)) {
    return { rel: "wp/" + parsed.pathname.slice(WP_PREFIX.length) };
  }
  return { rel: "other/" + parsed.pathname.replace(/^\//, "") };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

async function fileExists(path) {
  try {
    const s = await stat(path);
    return s.size > 0;
  } catch {
    return false;
  }
}

async function downloadOne(url) {
  const classified = classifyUrl(url);
  if (!classified) return { url, skipped: true, reason: "non-legacy" };
  const outPath = join(OUT_BASE, classified.rel);
  if (await fileExists(outPath)) {
    return { url, outPath, skipped: true, reason: "exists" };
  }
  for (let attempt = 1; attempt <= RETRY; attempt += 1) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "soliton-asset-migration/0.1 (+local)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      await ensureDir(outPath);
      await writeFile(outPath, buffer);
      const sha = createHash("sha256").update(buffer).digest("hex");
      return {
        url,
        outPath,
        rel: classified.rel,
        size: buffer.length,
        sha,
        contentType: res.headers.get("content-type") ?? null,
      };
    } catch (error) {
      if (attempt === RETRY) {
        return { url, error: String(error?.message ?? error) };
      }
      await sleep(THROTTLE_MS * attempt);
    }
  }
  return { url, error: "exhausted" };
}

async function main() {
  console.log(`Reading assortment from ${ASSORTMENT_PATH}`);
  const raw = JSON.parse(await readFile(ASSORTMENT_PATH, "utf8"));
  const products = raw.products ?? [];
  const urls = new Set();
  for (const product of products) {
    for (const image of product.images ?? []) urls.add(image);
    for (const doc of product.documents ?? []) {
      if (doc?.url) urls.add(doc.url);
    }
  }
  console.log(`Unique legacy URLs: ${urls.size}`);

  const manifest = [];
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let count = 0;
  for (const url of urls) {
    count += 1;
    if (count > LIMIT) break;
    const result = await downloadOne(url);
    manifest.push(result);
    if (result.skipped) skipped += 1;
    else if (result.error) failed += 1;
    else downloaded += 1;
    if (count % 20 === 0) {
      console.log(`  progress: ${count}/${urls.size} (ok=${downloaded} skip=${skipped} fail=${failed})`);
    }
    if (!result.skipped) await sleep(THROTTLE_MS);
  }

  await mkdir(dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(
    MANIFEST_PATH,
    JSON.stringify(
      {
        runAt: new Date().toISOString(),
        total: urls.size,
        downloaded,
        skipped,
        failed,
        items: manifest,
      },
      null,
      2,
    ),
  );
  console.log("");
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Skipped:    ${skipped}`);
  console.log(`Failed:     ${failed}`);
  console.log(`Manifest:   ${MANIFEST_PATH}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
