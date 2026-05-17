const command = process.argv[2] ?? "unknown";

const messages = {
  "agent:apply-change":
    "agent:apply-change is intentionally not implemented yet. Use dry-run planning and manual code/data changes until audit-backed apply workflow is built.",
  "agent:propose-change":
    "agent:propose-change is intentionally not implemented yet. Prepare owner-readable diffs manually until structured propose workflow is built.",
  "export:catalog":
    "export:catalog placeholder: Payload catalog export will be implemented after product seeding.",
  "smoke:public-pages":
    "smoke:public-pages placeholder: use curl/browser checks manually until the smoke runner is implemented.",
  "validate:catalog":
    "validate:catalog placeholder: Payload catalog validation will be implemented after product seeding.",
  "validate:schema":
    "validate:schema placeholder: schema.org validation will be implemented after Payload-backed rendering.",
  "validate:seo":
    "validate:seo placeholder: SEO validation will be implemented after Payload-backed categories and pages.",
};

console.log(messages[command] ?? `Unknown placeholder command: ${command}`);
