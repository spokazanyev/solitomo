# Contract: Homepage B2B Trust Output

## Homepage Contract

`GET /`

Expected content:

- Product/manufacturer visual panel.
- Trust claims: 15-year history, Russian production, registry, B2B RFQ path.
- Proof metrics.
- Entry cards for catalog, engineering selection, and corporate purchasing.
- Real product cards linking to `/product/{slug}/`.
- Use-case cards linking to solutions and B2B pages.
- Existing `Organization` JSON-LD.

## B2B Contract

`GET /b2b/`

Expected content:

- Corporate purchasing explanation.
- RFQ CTA to `/b2b/request-quote/`.
- Buyer input checklist.
- Project workflow steps.
- Trust band.
- Links to catalog, documents, and company pages.

## Claim-Control Contract

Allowed on homepage/B2B:

- general 15-year history;
- Russian production;
- registry/document route;
- reliability and construction quality as positioning.

Not allowed without proof on a SKU:

- stock availability;
- exact certificate coverage;
- registry coverage for a specific SKU;
- absolute equivalence claims to a competitor.
