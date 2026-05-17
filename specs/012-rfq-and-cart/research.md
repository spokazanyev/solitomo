# Research: RFQ And Cart

## Decisions

### RFQ Before Checkout

Implement request-for-quote before full cart/payment checkout.

**Reasoning**: Soliton’s main conversion path is B2B procurement, project selection, documents, and commercial proposal. A cart can later reuse the line-item model.

### Query-Based Product Handoff

Pass `sku` and `product` query parameters from product pages to RFQ.

**Reasoning**: This keeps the flow simple, static-page friendly, and easy to extend to a full quote cart later.

### Payload Collection

Store requests in Payload collection `rfq-requests`.

**Reasoning**: Managers can process requests in admin, and later integrations can export them to email, CRM, or MoySklad.

### Local JSONL Fallback

Fallback to local JSONL if Payload/Postgres is unavailable in development.

**Reasoning**: Codex and local demos should be able to verify the form without requiring Docker to be running.
