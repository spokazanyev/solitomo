# Tasks: Performance Audit

- [ ] T001 Run Lighthouse Mobile against `/`, `/catalog/pdu/`, `/product/sp-8/`, `/b2b/request-quote/`, `/company/contacts/`.
- [ ] T002 Aggregate into `06-reports/lighthouse-audit-YYYY-MM-DD.md`.
- [ ] T003 If any URL fails Performance ≥ 85, identify bottleneck and apply targeted fix.
- [ ] T004 Re-run after fixes; update report.
- [ ] T005 Confirm `pnpm validate:seo`, `pnpm validate:schema`, `pnpm public-copy-audit` remain green.
