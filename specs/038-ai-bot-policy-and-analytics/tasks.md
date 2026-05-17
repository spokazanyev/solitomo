# Tasks: AI-bot Policy + Analytics

- [ ] T001 Расширить `apps/web/src/app/robots.ts`: вернуть массив правил с явными секциями для ClaudeBot, GPTBot, Google-Extended, PerplexityBot, CCBot, YandexBot, Yandex-AI, GigaChat-Bot, Bytespider, cohere-ai, Meta-ExternalAgent. Для каждой — `allow: "/"`, общий disallow.
- [ ] T002 Обновить `apps/web/src/app/(site)/layout.tsx` metadata: добавить robots.other с `max-snippet:-1`, `max-image-preview:large`, `max-video-preview:-1`.
- [ ] T003 Создать `apps/web/src/middleware.ts` (или дополнить существующий): detect AI-bot UA через regex, добавить response header `X-Detected-AI-Bot: <name>` + при включённом env-флаге `LOG_AI_BOTS=true` логировать в `apps/web/.next/cache/ai-bot-log.jsonl`.
- [ ] T004 Создать `apps/web/scripts/report-ai-bots.mjs`: парсит JSONL, выводит markdown-отчёт в `06-reports/ai-bots-YYYY-WW.md`.
- [ ] T005 Добавить `report:ai-bots` script в `package.json`.
- [ ] T006 Проверить `curl` под 3 разными UA, что robots.txt отдаёт корректные правила и middleware логирует.
- [ ] T007 Документировать в `agent-project-context.md` пункт «AI-bot аналитика» в Команды.
