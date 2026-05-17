# Технический Фундамент Проекта Soliton

Дата: 2026-05-14.

## Назначение

Документ фиксирует результат SDD-этапа `005-technical-project-foundation`: создана базовая кодовая структура нового сайта Soliton, чтобы следующие функции разрабатывать уже внутри реального приложения.

## Реализовано

- Корневой pnpm workspace: `package.json`, `pnpm-workspace.yaml`.
- Next.js приложение в `apps/web`.
- TypeScript, App Router, ESLint, Tailwind CSS 4.
- Payload CMS 3 с PostgreSQL adapter.
- Минимальная коллекция `users` для будущей админки.
- Payload routes:
  - `/admin/[[...segments]]`
  - `/api/[...slug]`
  - `/api/graphql`
  - `/api/graphql-playground`
- PostgreSQL service в `docker-compose.yml`.
- `.env.example` с базовыми переменными.
- Стартовая публичная страница Soliton вместо стандартной страницы Next.js.

## Текущий Стек

| Уровень | Решение |
|---|---|
| Frontend / backend | Next.js 16.2.6 |
| CMS | Payload CMS 3.84.1 |
| DB adapter | `@payloadcms/db-postgres` |
| Database | PostgreSQL 16 через Docker Compose |
| Package manager | pnpm 10.32.1 |
| Runtime, проверенный локально | Node.js 22.16.0 |

## Локальный Запуск

```bash
pnpm install
cp .env.example apps/web/.env.local
docker compose up -d postgres
pnpm dev
```

Публичная часть будет доступна по адресу:

```text
http://localhost:3000/
```

Админка Payload:

```text
http://localhost:3000/admin
```

Для полноценной проверки админки должен быть запущен PostgreSQL. В текущей среде Docker CLI установлен, но Docker daemon не был запущен, поэтому подключение к базе не проверялось.

## Проверки

Выполнены из корня проекта:

```bash
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm --filter @soliton/web generate:importmap
pnpm lint
pnpm typecheck
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm build
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm dev
curl -I http://localhost:3000/
```

Результат:

| Проверка | Статус | Комментарий |
|---|---|---|
| `generate:importmap` | pass | Payload import map создан в `apps/web/src/app/(payload)/admin/importMap.js`. |
| `pnpm lint` | pass | Ошибок ESLint нет. |
| `pnpm typecheck` | pass | TypeScript проходит. |
| `pnpm build` | pass | Сборка видит маршруты `/`, `/admin`, `/api`, `/api/graphql`, `/api/graphql-playground`. |
| `pnpm dev` + `curl -I /` | pass | Главная страница отвечает `HTTP/1.1 200 OK`. |
| `docker compose up -d postgres` | blocked | Docker daemon не запущен: `Cannot connect to the Docker daemon`. |

## Важные Технические Решения

- `apps/web/package.json` переведен в `"type": "module"`. Без этого Payload CLI на Node 22 падал при генерации import map.
- В `payload.config.ts` используется относительный импорт коллекции `./collections/Users.js`, потому что Payload CLI не резолвит Next alias `@/*` при загрузке конфига.
- Коллекция `Users` сейчас в `.js`, чтобы ее стабильно загружал Payload CLI. При добавлении следующих коллекций нужно придерживаться этой схемы или отдельно проверить ESM/TS загрузку.

## Источники По Стеку

- Payload installation docs: https://payloadcms.com/docs/getting-started/installation
- Payload PostgreSQL adapter docs: https://payloadcms.com/docs/database/postgres
- Next.js `create-next-app` docs: https://nextjs.org/docs/app/api-reference/cli/create-next-app

## Следующий Этап

Следующий SDD-этап: `006-seo-site-structure`.

Цель: превратить подтвержденный спрос и карту ассортимента в финальную SEO-структуру URL, категорий, фильтров, посадочных страниц, sitemap, robots, canonical и JSON-LD требования.
