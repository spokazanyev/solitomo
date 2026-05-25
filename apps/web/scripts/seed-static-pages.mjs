import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getPayload } from "payload";

/**
 * Seed script for `static-pages` collection (spec 057, US1).
 *
 * Runs through the Payload bin (`pnpm seed:static-pages`) so it shares
 * the configured Payload runtime / DB pool with the live admin app.
 *
 * Idempotent: if a doc with the slug already exists the slug is
 * skipped — re-running is safe.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(
  __dirname,
  "../../../specs/057-yookassa-buyer-info-compliance/contracts/content-templates",
);

const POLICY_EFFECTIVE_FROM = "2026-05-25";

const PAGES = [
  { slug: "payment", section: "info", category: "info", title: "Способы оплаты", template: "payment.md" },
  { slug: "delivery", section: "info", category: "info", title: "Доставка", template: "delivery.md" },
  { slug: "return", section: "info", category: "info", title: "Возврат товара", template: "return.md" },
  { slug: "warranty", section: "info", category: "info", title: "Гарантийное обслуживание", template: "warranty.md" },
  { slug: "offer", section: "info", category: "policy", title: "Публичная оферта", template: "offer.md", version: "2026-05-25-v1" },
  { slug: "privacy", section: "info", category: "policy", title: "Политика конфиденциальности", template: "privacy.md", version: "2026-05-25-v1" },
  { slug: "pd-policy", section: "info", category: "policy", title: "Политика обработки персональных данных", template: "pd-policy.md", version: "2026-05-25-v1" },
  { slug: "terms", section: "info", category: "policy", title: "Пользовательское соглашение", template: "terms.md", version: "2026-05-25-v1" },
  { slug: "faq", section: "info", category: "faq", title: "Вопросы и ответы", template: "faq.md" },
];

// ─── Lexical builders ───────────────────────────────────────────────

function textNode(text, format = 0) {
  return {
    type: "text",
    text,
    format,
    mode: "normal",
    style: "",
    detail: 0,
    version: 1,
  };
}

// Inline parsing: handles **bold**, [link](href). Pragmatic — Owner
// polishes in admin. Returns array of inline nodes for a paragraph.
function parseInlineSegments(line) {
  const nodes = [];
  let i = 0;
  const len = line.length;

  while (i < len) {
    // Link [text](href)
    if (line[i] === "[") {
      const close = line.indexOf("]", i + 1);
      if (close !== -1 && line[close + 1] === "(") {
        const hrefEnd = line.indexOf(")", close + 2);
        if (hrefEnd !== -1) {
          const text = line.slice(i + 1, close);
          const href = line.slice(close + 2, hrefEnd);
          nodes.push({
            type: "link",
            version: 3,
            format: "",
            indent: 0,
            direction: "ltr",
            fields: { linkType: "custom", newTab: false, url: href },
            children: parseInlineSegments(text),
          });
          i = hrefEnd + 1;
          continue;
        }
      }
    }
    // Bold **...**
    if (line[i] === "*" && line[i + 1] === "*") {
      const close = line.indexOf("**", i + 2);
      if (close !== -1) {
        nodes.push(textNode(line.slice(i + 2, close), 1));
        i = close + 2;
        continue;
      }
    }
    // Plain text run until next special marker
    let j = i;
    while (j < len) {
      if (line[j] === "[") break;
      if (line[j] === "*" && line[j + 1] === "*") break;
      j += 1;
    }
    if (j > i) {
      nodes.push(textNode(line.slice(i, j)));
      i = j;
    } else {
      // Unmatched marker — emit literally and advance
      nodes.push(textNode(line[i]));
      i += 1;
    }
  }

  return nodes.length > 0 ? nodes : [textNode("")];
}

function paragraphNode(children) {
  return {
    type: "paragraph",
    format: "",
    indent: 0,
    version: 1,
    direction: "ltr",
    textFormat: 0,
    children,
  };
}

function headingNode(tag, children) {
  return {
    type: "heading",
    tag,
    format: "",
    indent: 0,
    version: 1,
    direction: "ltr",
    children,
  };
}

function listItemNode(children) {
  return {
    type: "listitem",
    format: "",
    indent: 0,
    version: 1,
    direction: "ltr",
    value: 1,
    children,
  };
}

function listNode(listType, items) {
  return {
    type: "list",
    listType,
    start: 1,
    tag: listType === "number" ? "ol" : "ul",
    format: "",
    indent: 0,
    version: 1,
    direction: "ltr",
    children: items.map((inline) => listItemNode(inline)),
  };
}

function rootNode(children) {
  return {
    root: {
      type: "root",
      format: "",
      indent: 0,
      version: 1,
      direction: "ltr",
      children,
    },
  };
}

/**
 * Convert simple markdown → Lexical SerializedEditorState.
 *
 * Supports: `#`/`##`/`###` headings, `-`/`*` bullet lists, `1.` ordered
 * lists, blank-line paragraph breaks, inline `**bold**` and
 * `[text](url)` links. Top-level `#` is demoted to <h2> because the
 * page template already renders the title as <h1>.
 */
function markdownToLexicalSimple(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const children = [];
  let i = 0;

  function flushParagraph(paragraphLines) {
    if (paragraphLines.length === 0) return;
    const joined = paragraphLines.join(" ").trim();
    if (!joined) return;
    children.push(paragraphNode(parseInlineSegments(joined)));
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      children.push(headingNode("h3", parseInlineSegments(trimmed.slice(4).trim())));
      i += 1;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      children.push(headingNode("h2", parseInlineSegments(trimmed.slice(3).trim())));
      i += 1;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      // Demote top-level title — page renders its own <h1>.
      children.push(headingNode("h2", parseInlineSegments(trimmed.slice(2).trim())));
      i += 1;
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^[-*]\s+/, "");
        items.push(parseInlineSegments(itemText));
        i += 1;
      }
      children.push(listNode("bullet", items));
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^\d+\.\s+/, "");
        items.push(parseInlineSegments(itemText));
        i += 1;
      }
      children.push(listNode("number", items));
      continue;
    }

    // Paragraph — gather consecutive non-empty lines until blank or
    // structural marker.
    const paragraphLines = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t) break;
      if (
        t.startsWith("#") ||
        /^[-*]\s+/.test(t) ||
        /^\d+\.\s+/.test(t)
      ) {
        break;
      }
      paragraphLines.push(t);
      i += 1;
    }
    flushParagraph(paragraphLines);
  }

  return rootNode(children);
}

// ─── Payload bin entrypoint ─────────────────────────────────────────

export async function script(config) {
  const payload = await getPayload({ config });

  let created = 0;
  let skipped = 0;

  for (const p of PAGES) {
    const existing = await payload.find({
      collection: "static-pages",
      where: { slug: { equals: p.slug } },
      limit: 1,
      depth: 0,
    });
    if (existing.docs.length > 0) {
      console.log(`[seed:static-pages] ${p.slug} already exists, skipping`);
      skipped += 1;
      continue;
    }

    const templatePath = path.join(TEMPLATES_DIR, p.template);
    const markdown = readFileSync(templatePath, "utf8");
    const body = markdownToLexicalSimple(markdown);

    const data = {
      slug: p.slug,
      section: p.section,
      category: p.category,
      title: p.title,
      body,
      indexingPolicy: "index",
      status: "published",
    };

    if (p.category === "policy") {
      data.version = p.version;
      data.effectiveFrom = POLICY_EFFECTIVE_FROM;
    }

    await payload.create({
      collection: "static-pages",
      data,
    });
    console.log(`[seed:static-pages] created ${p.slug}`);
    created += 1;
  }

  console.log(
    `[seed:static-pages] done — created=${created}, skipped=${skipped}, total=${PAGES.length}`,
  );
}
