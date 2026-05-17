#!/usr/bin/env node

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";
const SITEMAP_URL = `${SITE_URL.replace(/\/$/, "")}/sitemap.xml`;

const FORBIDDEN_MARKERS = [
  "RFQ-макет",
  "Быстрый RFQ-макет",
  "RFQ макет",
  "B2B-процесс",
  "Brand trust",
  "B2B use-case",
  "B2B custom",
  "B2B integrators",
  "B2B tenders",
  "органический трафик",
  "органическая",
  "Популярные входы",
  "внутренней перелинков",
  "Внутренняя перелинковка",
  "Листинги по",
  "Conversion",
  "demandCluster",
];

const WARNING_MARKERS = ["RFQ"];

async function readSitemap() {
  let xml;
  try {
    const res = await fetch(SITEMAP_URL);
    if (!res.ok) {
      throw new Error(`sitemap fetch returned ${res.status}`);
    }
    xml = await res.text();
  } catch (error) {
    console.error(`Cannot fetch sitemap from ${SITEMAP_URL}:`, error.message);
    process.exit(2);
  }
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

async function fetchHtml(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    return { ok: false, status: res.status, html: "" };
  }
  return { ok: true, status: res.status, html: await res.text() };
}

function stripScripts(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
}

function scan(html) {
  const text = stripScripts(html);
  const found = [];
  for (const marker of FORBIDDEN_MARKERS) {
    if (text.includes(marker)) {
      found.push({ marker, level: "error" });
    }
  }
  for (const marker of WARNING_MARKERS) {
    const wordRe = new RegExp(`\\b${marker}\\b`);
    if (wordRe.test(text)) {
      found.push({ marker, level: "warning" });
    }
  }
  return found;
}

async function main() {
  console.log(`Public Copy Audit — site: ${SITE_URL}`);
  const urls = await readSitemap();
  if (urls.length === 0) {
    console.error("Sitemap is empty");
    process.exit(2);
  }
  console.log(`Checking ${urls.length} URLs...`);

  let errors = 0;
  let warnings = 0;
  const report = [];

  for (const url of urls) {
    const { ok, status, html } = await fetchHtml(url);
    if (!ok) {
      console.error(`  FETCH ${status} ${url}`);
      errors += 1;
      report.push({ url, status, findings: [{ marker: "FETCH_FAILED", level: "error" }] });
      continue;
    }
    const findings = scan(html);
    if (findings.length === 0) continue;
    for (const finding of findings) {
      if (finding.level === "error") {
        errors += 1;
        console.error(`  FAIL ${url} → ${finding.marker}`);
      } else {
        warnings += 1;
        console.warn(`  WARN ${url} → ${finding.marker}`);
      }
    }
    report.push({ url, status, findings });
  }

  console.log("");
  console.log(`Errors:   ${errors}`);
  console.log(`Warnings: ${warnings}`);

  if (process.env.OUTPUT_JSON) {
    const fs = await import("node:fs/promises");
    await fs.writeFile(process.env.OUTPUT_JSON, JSON.stringify(report, null, 2));
  }

  process.exit(errors === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
