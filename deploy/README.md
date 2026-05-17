# Soliton deploy (mac-mini, soliton.heado.tech)

## Что это

Тестовый деплой публичного сайта Soliton на mac-mini-ext через Traefik. Включает:

- `soliton-postgres` — отдельный Postgres 16 контейнер (volume `./postgres-data`)
- `soliton-web` — Next.js 16 + Payload 3 (multi-stage Dockerfile)
- Traefik labels для `soliton.heado.tech` через Let's Encrypt

## Структура на сервере

```
/Users/server/server/apps/soliton/
├── docker-compose.yml
├── .env                    # DOMAIN + SOLITON_DB_PASSWORD + SOLITON_PAYLOAD_SECRET
├── Dockerfile -> source/Dockerfile (или копия)
├── postgres-data/          # volume для postgres (создаётся при первом старте)
└── source/                 # build context (apps/web + 00-source-data + package files)
```

## Шаги деплоя (выполняются скриптом `deploy/push.sh`)

1. rsync source-кода (без node_modules, .next, специфик) на mac-mini.
2. `docker compose up -d --build` — сборка образа + старт postgres.
3. Ожидание healthcheck postgres.
4. `docker exec soliton-web pnpm --filter @soliton/web seed:catalog` — заливка ассортимента.
5. `curl https://soliton.heado.tech` — проверка.

## Откат

```bash
ssh mac-mini-ext "cd /Users/server/server/apps/soliton && \
  export DOCKER_HOST=unix://\$HOME/.colima/default/docker.sock && \
  /opt/homebrew/bin/docker compose down"
```

Удалить полностью:
```bash
ssh mac-mini-ext "rm -rf /Users/server/server/apps/soliton"
```

## Изоляция от других сервисов на mac-mini

- Имя контейнера `soliton-web` и `soliton-postgres` — уникальные (не пересекаются с `traefik`, `test`, `urv`, `efes-checkup`).
- Сеть `soliton-internal` — отдельная (postgres недоступен извне).
- Сеть `proxy` — общая с Traefik, но это контракт всех приложений.
- Traefik router `soliton` — уникальное имя.
- Volume `./postgres-data` — локальный bind-mount, не пересекается с другими.
- Внешние порты НЕ открываются (только через Traefik).
