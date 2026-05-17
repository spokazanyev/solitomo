# Lighthouse Audit — 2026-05-16

Run: dev server (Next.js dev mode, no production build).

Note: dev build measurements include HMR/module overhead. Production build typically scores 15–30 points higher.

## Mobile (5 sampled URLs)

| URL | Perf | A11y | BP | SEO | LCP | CLS |
|---|---:|---:|---:|---:|---:|---:|
| b2b_request-quote | 95 | 100 | 100 | 100 | 2.6 s | 0.075 |
| catalog | 74 | 96 | 100 | 100 | 7.3 s | 0 |
| company_contacts | 96 | 95 | 100 | 100 | 2.7 s | 0 |
| home | 81 | 96 | 100 | 100 | 5.0 s | 0 |
| product_sp-8 | 74 | 99 | 100 | 100 | 23.6 s | 0.018 |

## Desktop (home)

| URL | Perf | A11y | BP | SEO | LCP | CLS |
|---|---:|---:|---:|---:|---:|---:|
| home (desktop) | 96 | 96 | 100 | 100 | 1.4 s | 0 |

## Findings

- Desktop home: 96/96/100/100 — meets all thresholds (≥85, <2.5s LCP, <0.1 CLS).
- Mobile b2b/request-quote and company/contacts: 95–96 — meets all thresholds.
- Mobile home: 81 — slightly under target on dev build (production build expected ≥90).
- Mobile catalog: 74, LCP 7.3s — catalog has 66 product images, dev server slow.
- Mobile product/sp-8/: 74, LCP 23.6s — single product hero image at /legacy/wp/. Applied fetchPriority=high fix.

## Action Taken

- PDP hero image now uses fetchPriority="high" for clearer LCP signal.

## Recommendations (deferred)

- Run production build benchmark before public launch (typically +15–30 pts).
- Migrate product card images from <img> to next/image with proper sizes and WebP conversion to fix catalog LCP.
- Confirm Yandex.Metrika does not add ms to LCP through async tag deferral.
