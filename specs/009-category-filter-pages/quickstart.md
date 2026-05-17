# Quickstart: Category Filter Pages

## Run Checks

```bash
pnpm lint
pnpm typecheck
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm build
```

## Run Site

```bash
pnpm dev
```

Open:

```text
http://localhost:3000/catalog/iec-c13-c19/
http://localhost:3000/catalog/vertical-pdu/
http://localhost:3000/catalog/pdu-uzip/
```

## Smoke Tests

```bash
curl -sI http://localhost:3000/catalog/iec-c13-c19/
curl -s http://localhost:3000/catalog/iec-c13-c19/ | rg -o 'ItemList|Найдено моделей|/product/'
curl -s http://localhost:3000/catalog/iec-c13-c19/ | rg '\\?'
```

The last command should not find query-string filter URLs in the catalog filter panel.
