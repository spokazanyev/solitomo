# Quickstart: Homepage B2B Trust

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
http://localhost:3000/
http://localhost:3000/b2b/
```

## Smoke Tests

```bash
curl -sI http://localhost:3000/
curl -s http://localhost:3000/ | rg -o '15-летняя история|Российское производство|Реальные модели Soliton|/product/'
curl -s http://localhost:3000/b2b/ | rg -o 'Корпоративная закупка|Запрос КП|ТЗ|Коммерческое предложение'
```
