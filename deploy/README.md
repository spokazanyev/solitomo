# Soliton deploy

## Production target — pdumarket-prod (VPS TimeWeb Cloud, 45.144.220.45)

Боевой деплой публичного сайта pdumarket.ru. Выделен **2026-05-24**, готов к деплою (см. § «Состояние сервера»). До DNS-cutover (см. § «DNS cutover») продолжает работать mac-mini-ext по адресу `5.189.127.125`.

| Параметр | Значение |
|---|---|
| ОС | Ubuntu 24.04.4 LTS |
| Железо | 4 vCPU / 7.8 GB RAM / 77 GB SSD |
| IP | `45.144.220.45` |
| SSH | `ssh pdumarket-prod` (alias в `~/.ssh/config`, key-only, port 22) |
| User для деплоев | `server` (sudo nopasswd, в группе `docker`) |
| Корень приложений | `/home/server/apps/<service>/` |
| Traefik | `/home/server/traefik/` (запущен, listens 80/443, Let's Encrypt tlsChallenge) |
| Сеть Docker | external `proxy` (общая для Traefik и всех app-compose) |
| Секреты | `deploy/.secrets/production-server.md` + `deploy/.secrets/production-env.md` (gitignored) |

### Состояние сервера (post-bootstrap 2026-05-24)

- ✅ apt update + upgrade, timezone Europe/Moscow
- ✅ Docker 29.5.2 + Compose plugin
- ✅ ufw active (только 22 / 80 / 443)
- ✅ fail2ban (sshd jail, 5 попыток / 10 мин → бан 1 час)
- ✅ unattended-upgrades (security-patches автоматически)
- ✅ SSH key-only, password-auth выключен
- ✅ Traefik v3.6 запущен, отдаёт self-signed fallback на 443 (валидный cert получит при DNS-cutover)
- ✅ Папка `/home/server/apps/soliton/` готова, владелец `server`

## Что такое деплой Soliton

Два контейнера в одном compose-проекте:

- `soliton-postgres` — Postgres 16 (volume `./postgres-data`)
- `soliton-web` — Next.js 16 + Payload 3 (multi-stage Dockerfile)

Traefik labels на `soliton-web`:

- Один router на три Host: `pdumarket.ru` (canonical), `www.pdumarket.ru`, `soliton.${DOMAIN}` (legacy test host)
- Traefik v3 синтаксис: `Host(\`a\`) || Host(\`b\`) || Host(\`c\`)` — **запятые НЕ работают** в v3.
- Let's Encrypt SAN-cert на все три имени автоматически.

## Структура на сервере

```
/home/server/
├── traefik/                    # reverse-proxy (запущен)
│   ├── docker-compose.yml
│   ├── traefik.yml
│   ├── dynamic.yml
│   └── acme.json               # 600, Let's Encrypt-storage
└── apps/
    └── soliton/                # ← цель push.sh
        ├── docker-compose.yml
        ├── .env                # DOMAIN + SOLITON_DB_PASSWORD + SOLITON_PAYLOAD_SECRET
        ├── Dockerfile
        ├── postgres-data/      # volume для postgres
        └── source/             # build context (apps/web + 00-source-data + package files)
```

## Шаги деплоя

> **TODO:** скрипт `deploy/push.sh` ещё не написан (упоминается в этом README исторически). Пока — ручная процедура ниже. Создание автоматического push.sh — в `07-build-specifications/deferred-content-track.md` § п. 26.

1. **Пушим .env с секретами** (один раз, при смене):
   ```bash
   scp deploy/.secrets/production-env pdumarket-prod:/home/server/apps/soliton/.env
   ssh pdumarket-prod 'chmod 600 /home/server/apps/soliton/.env'
   ```
2. **rsync source-кода** (без node_modules, .next, .git):
   ```bash
   rsync -avz --delete \
     --exclude='node_modules' --exclude='.next' --exclude='.git' --exclude='coverage' \
     --exclude='*.log' --exclude='.DS_Store' \
     ./apps/web/ ./00-source-data/ ./package.json ./pnpm-lock.yaml ./pnpm-workspace.yaml \
     ./deploy/Dockerfile ./deploy/docker-compose.yml ./deploy/.dockerignore \
     pdumarket-prod:/home/server/apps/soliton/source/
   ```
3. **Build + старт**:
   ```bash
   ssh pdumarket-prod 'cd /home/server/apps/soliton && docker compose up -d --build'
   ```
4. **Дождаться healthcheck postgres** (несколько секунд).
5. **Сиид каталога** (только при первом деплое):
   ```bash
   ssh pdumarket-prod 'docker exec soliton-web pnpm --filter @soliton/web seed:catalog'
   ```
6. **Проверка**: `curl -sI https://pdumarket.ru` → 200 (после DNS-cutover) или `curl -skI -H 'Host: pdumarket.ru' https://45.144.220.45` → 200 (до cutover).

## DNS cutover (перенос pdumarket.ru с mac-mini на pdumarket-prod)

На 2026-05-24: `dig +short pdumarket.ru` = `5.189.127.125` (mac-mini-ext). Чтобы Traefik получил cert и сайт пошёл с нового хоста:

1. Снизить TTL для A-записей `pdumarket.ru`, `www.pdumarket.ru` до 300 сек (минимум за час до cutover).
2. Дождаться, чтобы старый TTL истёк.
3. Переключить A на `45.144.220.45`.
4. Подождать 60–120 сек после смены DNS — Traefik сам инициирует ACME-вызов при первом запросе, Let's Encrypt валидирует, сохранит cert в `acme.json`.
5. Проверить: `curl -sI https://pdumarket.ru` → 200, Server certificate подписан Let's Encrypt.
6. mac-mini-ext продолжает обслуживать `soliton.heado.tech` (legacy test host) — менять не надо.

## Откат

```bash
ssh pdumarket-prod 'cd /home/server/apps/soliton && docker compose down'
# DNS можно откатить на mac-mini-ext (5.189.127.125), он продолжит обслуживать.
```

Удалить полностью:
```bash
ssh pdumarket-prod 'cd /home/server/apps/soliton && docker compose down -v && rm -rf source postgres-data .env'
```

## Заметки по конфигу

- **`NEXT_PUBLIC_SITE_URL`** прокинут в `environment:` контейнера (runtime). Это работает, потому что у нас все маршруты `dynamic = "force-dynamic"` и метаданные генерятся на каждый render — Next подхватывает runtime env. Если когда-то понадобится статика — добавить `ARG NEXT_PUBLIC_SITE_URL` в `Dockerfile` и `args:` в `build:` блок compose, иначе bundle запечётся с fallback `http://localhost:3000`.
- **Traefik v3 multi-host:** только OR-комбинация `Host(\`a\`) || Host(\`b\`)`. Запятые внутри `Host()` — синтаксис v2, в v3 валит router в state `disabled`.
- **Build на сервере vs CI:** сейчас `docker compose up --build` запускается на проде, пик RAM при сборке ~1.5–2 GB. На VPS с 7.8 GB места хватает, но при появлении CI лучше пушить готовый image, а не source.

## Изоляция от других сервисов на сервере

- На pdumarket-prod пока только два проекта: `traefik` и `soliton`. Если будем подключать Twenty CRM — отдельный compose в `/home/server/apps/twenty/`, та же сеть `proxy`.
- Контейнеры `soliton-web`, `soliton-postgres` имеют уникальные имена.
- Volume `./postgres-data` локален для соliton-compose.
- Внешние порты НЕ открываются (только через Traefik по labels).

## Legacy: mac-mini-ext

До 2026-05-24 публичный сайт обслуживался с mac-mini-ext (`/Users/server/server/apps/soliton/`). После DNS-cutover mac-mini-ext остаётся работающим под `soliton.heado.tech` (legacy test host) и может использоваться как fallback / staging. Удалять не планируется, пока не появится отдельный staging-env.
