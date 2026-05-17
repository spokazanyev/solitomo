# Quickstart: Content Production System

## Run Checks

```bash
pnpm lint
pnpm typecheck
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm build
```

## Smoke Tests

```bash
curl -s http://localhost:3000/knowledge/kak-vybrat-pdu/ | rg -o 'Материал по выбору PDU|Частые вопросы|FAQPage'
curl -s http://localhost:3000/catalog/iec-c13-c19/ | rg -o 'FAQPage|Вопросы перед заказом|Когда выбирать IEC C13'
rg -n 'Этот блок будет раскрыт|placeholder|skeleton|SEO-роль' apps/web/src
```
