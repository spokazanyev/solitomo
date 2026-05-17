# Implementation Plan: Yandex Business + Brand Presence

**Branch**: `041-yandex-business-and-brand-presence`

**Spec**: [spec.md](./spec.md)

## Состав работ

Большая часть — **organisational**, не код. Кодовая часть:

1. **`sameAs` в Organization JSON-LD** — расширить `contacts.json`, передать в `createOrganizationJsonLd()`.
2. **IndexNow интеграция** — endpoint + helper.

Остальное — задачи для владельца (см. deferred-content-track п.16-19 после этого спека).

## Code touchpoints

- `apps/web/src/lib/company/get-company-contacts.ts` — добавить поле `externalProfiles[]`
- `apps/web/src/lib/seo/structured-data.ts` — использовать в `sameAs`
- `00-source-data/company/contacts.json` — добавить плейсхолдеры externalProfiles
- New: `apps/web/src/app/[indexnowKey].txt/route.ts` — динамический верификационный токен (env `INDEXNOW_KEY`)
- New: `apps/web/src/lib/seo/notify-indexnow.ts`
- `.env.example` — `INDEXNOW_KEY=`

## Validation

- `pnpm typecheck`, `pnpm lint`
- `curl /` показывает `sameAs` array
- `curl /<key>.txt` отдаёт правильный токен
- `notifyIndexNow(['http://localhost:3000/'])` → лог об успехе (в dev — заглушка)
