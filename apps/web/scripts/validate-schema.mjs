#!/usr/bin/env node
//
// Validates JSON-LD blocks across a representative sample of public URLs.
// For each sampled URL the script verifies expected schema.org types and
// presence of required fields.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");
const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

const SAMPLE = [
  { path: "/", required: ["Organization", "BreadcrumbList"] },
  { path: "/catalog/pdu/", required: ["BreadcrumbList", "ItemList"] },
  { path: "/product/sp-8/", required: ["BreadcrumbList", "Product"] },
  { path: "/knowledge/kak-vybrat-pdu/", required: ["BreadcrumbList", "FAQPage"] },
  { path: "/b2b/", required: ["BreadcrumbList"] },
  { path: "/documents/", required: ["BreadcrumbList"] },
];

function extractJsonLd(html) {
  const blocks = [];
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch (error) {
      blocks.push({ __parseError: String(error?.message ?? error) });
    }
  }
  return blocks;
}

const REQUIRED_FIELDS = {
  Organization: ["name", "url"],
  BreadcrumbList: ["itemListElement"],
  ItemList: ["itemListElement"],
  Product: ["name", "sku"],
  FAQPage: ["mainEntity"],
  LocalBusiness: ["name", "url"],
};

function validateBlock(block) {
  if (block.__parseError) return [`JSON parse error: ${block.__parseError}`];
  const type = Array.isArray(block["@type"]) ? block["@type"][0] : block["@type"];
  if (!type) return ["missing @type"];
  const required = REQUIRED_FIELDS[type];
  if (!required) return [];
  const missing = required.filter((field) => block[field] === undefined || block[field] === null || block[field] === "");
  return missing.map((field) => `${type} missing ${field}`);
}

async function fetchPage(path) {
  const url = `${SITE_URL.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, { redirect: "follow" });
  return { url, ok: res.ok, status: res.status, body: await res.text() };
}

async function main() {
  const issues = [];
  for (const sample of SAMPLE) {
    const page = await fetchPage(sample.path);
    if (!page.ok) {
      issues.push({ url: page.url, problems: [`HTTP ${page.status}`] });
      continue;
    }
    const blocks = extractJsonLd(page.body);
    const types = blocks.map((b) => (Array.isArray(b["@type"]) ? b["@type"][0] : b["@type"]));
    const problems = [];
    for (const expected of sample.required) {
      if (!types.includes(expected)) {
        problems.push(`expected ${expected} JSON-LD not found`);
      }
    }
    for (const block of blocks) {
      problems.push(...validateBlock(block));
    }
    if (problems.length > 0) {
      issues.push({ url: page.url, problems });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const reportPath = join(REPO_ROOT, "06-reports", `schema-audit-${today}.md`);
  await mkdir(dirname(reportPath), { recursive: true });
  const lines = [
    `# Schema Audit — ${today}`,
    "",
    `Site: ${SITE_URL}`,
    `Pages sampled: ${SAMPLE.length}`,
    `Issues: ${issues.length}`,
    "",
  ];
  if (issues.length === 0) {
    lines.push("All sampled pages emit the required schema.org JSON-LD with required fields.");
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

  console.log(`Pages: ${SAMPLE.length}`);
  console.log(`Issues: ${issues.length}`);
  console.log(`Report: ${reportPath}`);
  process.exit(issues.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
