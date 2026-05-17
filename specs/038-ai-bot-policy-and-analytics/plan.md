# Implementation Plan: AI-bot Policy + Analytics

**Branch**: `038-ai-bot-policy-and-analytics`

**Spec**: [spec.md](./spec.md)

## Touchpoints

- `apps/web/src/app/robots.ts` — расширить под именованных AI-bot
- `apps/web/src/app/(site)/layout.tsx` — meta robots с `max-snippet:-1`
- `apps/web/src/middleware.ts` — детектирование AI-bot UA, лог
- New: `apps/web/scripts/report-ai-bots.mjs` — отчёт по логам

## Approach

1. **robots.ts**: вернуть массив `rules[]` с отдельными секциями для каждого AI-bot UA. Каждая секция содержит `userAgent`, `allow: "/"`, `disallow: ["/admin/", "/api/", "/_next/"]`.
2. **layout.tsx**: добавить `robots.other` в metadata.
3. **middleware**: если UA совпадает с одной из known-AI-bot строк (regex), пишем строку в файл `apps/web/.next/cache/ai-bot-log.jsonl` (или Payload коллекция — но это тяжело). В dev — `console.log`. В prod — append к файлу с rotation.
4. **report-ai-bots.mjs**: парсит лог, агрегирует по агенту и URL, выводит в `06-reports/ai-bots-YYYY-WW.md`.

## Notes

- Лог-файл не commit'ится в git.
- Для prod-инсталляции лучше: использовать Vercel Analytics или Cloudflare bot dashboard вместо собственного лога. Это документируем в deferred-content-track.

## Validation

- `pnpm typecheck`, `pnpm lint`, `pnpm build`
- `curl -A "ClaudeBot/1.0" http://localhost:3000/robots.txt` — видим `Allow:/`
- `curl -A "ClaudeBot/1.0" http://localhost:3000/catalog/pdu/` — visit логируется
- HTML главной содержит `max-snippet:-1`
