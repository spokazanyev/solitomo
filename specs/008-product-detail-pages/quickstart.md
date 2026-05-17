# Quickstart: Product Detail Pages

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
http://localhost:3000/product/s-16c13-2c19/
```

## Smoke Tests

```bash
curl -sI http://localhost:3000/product/s-16c13-2c19/
curl -s http://localhost:3000/product/s-16c13-2c19/ | rg -o 'Product|BreadcrumbList|Запросить КП|Характеристики|Документы|Похожие товары'
curl -s http://localhost:3000/sitemap.xml | rg -c '<loc>'
```

Expected sitemap URL count: `102`.
