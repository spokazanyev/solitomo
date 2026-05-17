#!/usr/bin/env node
//
// Walks /sitemap.xml and asserts each URL returns 200, has a unique title,
// meta description, an H1, a canonical and at least one JSON-LD block.
//
// Writes a dated markdown report into 06-reports/.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");
const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";
const SITEMAP_URL = `${SITE_URL.replace(/\/$/, "")}/sitemap.xml`;

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  return { ok: res.ok, status: res.status, body: await res.text() };
}

function extractFirst(re, html) {
  const match = html.match(re);
  return match ? match[1].trim() : null;
}

async function main() {
  const sitemap = await fetchText(SITEMAP_URL);
  if (!sitemap.ok) {
    console.error(`Sitemap fetch failed: ${sitemap.status}`);
    process.exit(2);
  }
  const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (urls.length === 0) {
    console.error("Sitemap is empty");
    process.exit(2);
  }

  const titles = new Map();
  const issues = [];

  for (const url of urls) {
    const page = await fetchText(url);
    const pageIssues = [];
    if (!page.ok) {
      pageIssues.push(`HTTP ${page.status}`);
      issues.push({ url, status: page.status, problems: pageIssues });
      continue;
    }
    const title = extractFirst(/<title[^>]*>([^<]*)<\/title>/i, page.body);
    const description = extractFirst(
      /<meta[^>]+name="description"[^>]+content="([^"]*)"/i,
      page.body,
    );
    const h1 = extractFirst(/<h1[^>]*>([\s\S]*?)<\/h1>/i, page.body)?.replace(
      /<[^>]+>/g,
      "",
    );
    const canonical = extractFirst(
      /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i,
      page.body,
    );
    const jsonLdCount = (page.body.match(/application\/ld\+json/g) ?? []).length;

    if (!title) pageIssues.push("missing title");
    if (!description) pageIssues.push("missing meta description");
    if (!h1) pageIssues.push("missing H1");
    if (!canonical) pageIssues.push("missing canonical");
    if (jsonLdCount === 0) pageIssues.push("no JSON-LD blocks");

    if (title) {
      const existing = titles.get(title);
      if (existing && existing !== url) {
        pageIssues.push(`duplicate title (also on ${existing})`);
      } else {
        titles.set(title, url);
      }
    }

    if (pageIssues.length > 0) {
      issues.push({ url, status: page.status, problems: pageIssues });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const reportPath = join(REPO_ROOT, "06-reports", `seo-audit-${today}.md`);
  await mkdir(dirname(reportPath), { recursive: true });
  const lines = [
    `# SEO Audit — ${today}`,
    "",
    `Site: ${SITE_URL}`,
    `URLs checked: ${urls.length}`,
    `Issues: ${issues.length}`,
    "",
  ];
  if (issues.length === 0) {
    lines.push("All checked URLs pass title/description/H1/canonical/JSON-LD presence.");
  } else {
    lines.push("## Issues");
    lines.push("");
    for (const issue of issues) {
      lines.push(`### ${issue.url}`);
      lines.push("");
      for (const problem of issue.problems) {
        lines.push(`- ${problem}`);
      }
      lines.push("");
    }
  }
  await writeFile(reportPath, lines.join("\n"));

  console.log(`URLs:   ${urls.length}`);
  console.log(`Issues: ${issues.length}`);
  console.log(`Report: ${reportPath}`);
  process.exit(issues.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
