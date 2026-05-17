# Implementation Plan: Performance Audit

**Branch**: `036-performance-audit`

**Spec**: [spec.md](./spec.md)

## Tools

- Lighthouse CLI (`npx lighthouse <url> --preset=desktop|mobile --output=json`).
- Reports stored under `06-reports/lighthouse-audit-YYYY-MM-DD.md`.

## Approach

1. Run Lighthouse Mobile against five URLs.
2. Aggregate metrics into the report.
3. If any URL fails the ≥85 threshold, apply targeted optimization (mostly image-related) and re-run.
4. Commit the report.

## Optimization Toolkit (if needed)

- Replace remaining plain `<img>` with `next/image` where reasonable.
- Add `fetchPriority="high"` on hero image.
- Ensure preload of hero only on `/`.
- Consider lazy-loading offscreen `legacy/wp/` images.

## Validation

- Lighthouse Mobile and Desktop both meet thresholds.
- No regression in `pnpm public-copy-audit`, `pnpm validate:seo`, `pnpm validate:schema`.
