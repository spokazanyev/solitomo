# Contract: RFQ And Cart Output

## Page Contract

`GET /b2b/request-quote/`

Expected:

- `200`;
- visible form;
- item rows;
- company/contact fields;
- project comment and technical specification fields;
- sidebar with data needed for faster quote.

## Product Handoff Contract

Product cards link to:

```text
/b2b/request-quote/?sku={sku}&product={productTitle}
```

The RFQ form uses these values to prefill the first line item.

## API Contract

`POST /api/rfq-submit/`

Required:

- `contactName`;
- at least one of `email` or `phone`.

Response:

```json
{
  "ok": true,
  "id": "request-id",
  "storage": "payload"
}
```

If Payload/Postgres is unavailable locally:

```json
{
  "ok": true,
  "id": "local-...",
  "storage": "local-jsonl",
  "fallback": true
}
```
