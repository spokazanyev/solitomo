# Quickstart: RFQ And Cart

## Run Checks

```bash
pnpm lint
pnpm typecheck
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm build
```

## Smoke Tests

```bash
curl -sI 'http://localhost:3000/b2b/request-quote/?sku=S-16C13%2B2C19&product=test'
curl -s 'http://localhost:3000/product/s-16c13-2c19/' | rg '/b2b/request-quote/\\?sku='
curl -s -X POST http://localhost:3000/api/rfq-submit/ \
  -H 'Content-Type: application/json' \
  --data '{"contactName":"Test","email":"test@example.com","items":[{"sku":"S-16C13+2C19","name":"Test","quantity":"2"}]}'
```
