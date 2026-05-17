# Research: Content Production System

## Decisions

### First-Release Drafts In Code

Use typed content objects in `template-content.ts` for the first release.

**Reasoning**: CMS content modeling comes later, but public pages must stop showing template placeholders now.

### FAQPage Only When FAQ Is Visible

Emit `FAQPage` JSON-LD only for visible FAQ blocks.

**Reasoning**: This follows search-quality expectations and avoids hidden structured data.

### Claim-Control

Keep registry, certificate, stock, and competitor-equivalence claims out of generic article text unless linked to proof.

**Reasoning**: Technical/B2B trust must be defensible.
