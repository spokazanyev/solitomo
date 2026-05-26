# Production Deploy Plan — pdumarket.ru

**Target:** VPS TimeWeb Cloud (`45.144.220.45`, Ubuntu 24.04 LTS, 4 vCPU / 7.8 GB RAM / 77 GB SSD)
**SSH alias:** `pdumarket-prod` (user `server`, key-only)
**Created:** 2026-05-25
**Source spec:** `07-build-specifications/deferred-content-track.md` § п. 26
**Last completed feature:** спека 057 (Buyer-info compliance + 152-ФЗ consent + cookies opt-in)

---

## Что уже сделано на сервере (bootstrap 2026-05-24)

✅ Ubuntu 24.04 LTS · Europe/Moscow · Docker 29.5.2 + Compose · Traefik v3.6 (LE tlsChallenge, listens 80/443) · ufw (22/80/443, default deny) · fail2ban (sshd jail) · unattended-upgrades · SSH password-auth off · non-root `server` user (sudo nopasswd, docker group) · папка `/home/server/apps/soliton/` готова.

## Что НЕ сделано

❌ Сам деплой Soliton (код) · DNS на старом mac-mini (`5.189.127.125`) · backup-стратегия отсутствует · мониторинг отсутствует · root password в TimeWeb-панели backup-only (надо ротировать) · Traefik security headers + rate-limit · `IP_HASH_SALT` envvar (057 P0).

---

## Приоритет выполнения

| 🚦 | Этап | Тэг |
|---|---|---|
| 🔴 Critical (до DNS cutover) | 0, 1 | pre-deploy + first push |
| 🟠 High (24 ч после cutover) | 2, 3.3, 4.1, 5.1 | DNS + WAF + snapshots + uptime |
| 🟡 Medium (неделя 1) | 3.1–3.6 (кроме 3.3), 4.2, 5.2–5.3 | hardening + S3 backup + cron alerts |
| 🟢 Nice-to-have (неделя 2–4) | 5.4, 6, 7 | error tracking + 2FA + post-deploy verification |

---

# Этап 0 — Pre-deploy подготовка (локально)

## [ ] 0.1 Добавить P0-секреты 057 в production .env

Файл: `deploy/.secrets/production-env.md`. Добавить в env-блок:

```env
# 057 P0: salt для sha256(IP) в consent records.
# Без salt rainbow-table re-identification IP-адресов тривиальна.
IP_HASH_SALT=<openssl rand -hex 32>

# 057 US6: programmatic GA4/Metrika (загружаются ТОЛЬКО после opt-in).
# Если ID пустой — соответствующий трекер не грузится.
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXX
NEXT_PUBLIC_YANDEX_METRIKA_ID=XXXXXXXX
```

Сгенерировать соль: `openssl rand -hex 32` → положить в env.
GA/YM ID — реальные значения из аккаунтов аналитики.

**Acceptance:** `production-env.md` содержит 3 новые переменные.

## [ ] 0.2 Прокинуть IP_HASH_SALT + GA/YM IDs в compose

Файл: `deploy/docker-compose.yml`. В блок `environment:` сервиса `soliton-web` добавить:

```yaml
IP_HASH_SALT: ${IP_HASH_SALT}
NEXT_PUBLIC_GA_MEASUREMENT_ID: ${NEXT_PUBLIC_GA_MEASUREMENT_ID:-}
NEXT_PUBLIC_YANDEX_METRIKA_ID: ${NEXT_PUBLIC_YANDEX_METRIKA_ID:-}
```

**Acceptance:** `docker compose config` локально показывает три новые env-переменные на `soliton-web`.

## [ ] 0.3 Написать `deploy/push.sh`

Минимальная имплементация (см. план в чате). Должен делать: scp .env → rsync source → docker compose up --build → wait healthcheck → seed (только при `--seed` флаге) → итог.

**Acceptance:** `chmod +x deploy/push.sh && bash -n deploy/push.sh` (syntax check проходит).

## [ ] 0.4 Финальный pre-flight + git tag

```bash
pnpm --filter @soliton/web typecheck   # 0 errors
pnpm --filter @soliton/web lint        # 0 errors
pnpm --filter @soliton/web test        # 351/352 OK
git status                              # commit все 057 + deploy changes
git tag -a v057-buyer-info -m "057: ЮKassa buyer-info compliance, ready for prod cutover"
```

**Acceptance:** typecheck+lint+test зелёные, tag создан.

---

# Этап 1 — Первый pre-cutover deploy

## [ ] 1.1 push.sh --seed: первый деплой + seed catalog + seed static-pages

```bash
deploy/push.sh --seed
```

**Acceptance:** на сервере 2 контейнера healthy (`docker compose ps` → soliton-postgres + soliton-web), 9 строк в `static_pages` с `status=published`, catalog seeded.

## [ ] 1.2 Pre-cutover smoke-test через IP (DNS ещё на mac-mini)

```bash
curl -skI -H 'Host: pdumarket.ru' https://45.144.220.45/                  # → 200
curl -skI -H 'Host: pdumarket.ru' https://45.144.220.45/info/payment/     # → 200 (057)
curl -sk  -H 'Host: pdumarket.ru' -X POST https://45.144.220.45/api/orders/ \
  -H "Content-Type: application/json" -d '{}'                              # → CONSENT_REQUIRED 400
curl -sk  -H 'Host: pdumarket.ru' https://45.144.220.45/ | grep -c "ИНН 6659009140"  # → ≥1
ssh pdumarket-prod 'docker exec soliton-postgres psql -U soliton -d soliton -c \
  "SELECT count(*) FROM static_pages WHERE status='\''published'\''"'      # → 9
```

**Acceptance:** все проверки pass. До DNS cutover Traefik отдаёт self-signed cert — это нормально, `-k` ignores.

---

# Этап 2 — DNS cutover

## [ ] 2.1 TTL ↓ до 300 секунд за час до cutover

В DNS-провайдере (см. `deploy/.secrets/` или DNS-консоль) для `pdumarket.ru` и `www.pdumarket.ru`: TTL = 300 (5 мин). Подождать ~1 час, чтобы старый TTL истёк у всех резолверов.

**Acceptance:** `dig +noall +answer pdumarket.ru | awk '{print $2}'` показывает значение ≤ 600.

## [ ] 2.2 Switch A-records + verify cert

```bash
# 1. В DNS panel: pdumarket.ru → A 45.144.220.45
#                 www.pdumarket.ru → A 45.144.220.45
# 2. Подождать 60-120 сек после смены DNS
# 3. Verify:
curl -sI https://pdumarket.ru/ | head -3                                       # 200, валидный LE cert
echo | openssl s_client -connect pdumarket.ru:443 -servername pdumarket.ru 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates                                # issuer=Let's Encrypt
curl -sI https://www.pdumarket.ru/ | head -3                                   # 200, тот же SAN cert
```

**Acceptance:** оба домена 200, cert от Let's Encrypt (не self-signed), Subject = pdumarket.ru / SAN включает www.

---

# Этап 3 — Production hardening

## [ ] 3.1 SSH / fail2ban tightening

```bash
ssh pdumarket-prod 'sudo tee -a /etc/ssh/sshd_config.d/99-hardening.conf <<EOF
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers server
EOF
sudo systemctl reload ssh

sudo tee /etc/fail2ban/jail.d/sshd-aggressive.conf <<EOF
[sshd]
enabled = true
maxretry = 3
findtime = 600
bantime = 86400
EOF
sudo systemctl restart fail2ban'
```

**Acceptance:** `ssh pdumarket-prod 'sshd -T | grep -E "maxauth|allowusers"'` показывает `maxauthtries 3` + `allowusers server`. `sudo fail2ban-client status sshd` показывает enabled.

## [ ] 3.2 Docker daemon log rotation

```bash
ssh pdumarket-prod 'sudo tee /etc/docker/daemon.json <<EOF
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "5" },
  "live-restore": true,
  "userland-proxy": false
}
EOF
sudo systemctl restart docker

# Restart контейнеров чтобы подхватили новые log-opts
cd /home/server/apps/soliton && docker compose up -d'
```

**Acceptance:** `docker info | grep -E "Logging|Live"` → `Logging Driver: json-file`, `Live Restore Enabled: true`.

## [ ] 3.3 Traefik middleware: security headers + rate-limit + admin whitelist 🟠

Создать/обновить `/home/server/traefik/dynamic.yml`:

```yaml
http:
  middlewares:
    secure-headers:
      headers:
        stsSeconds: 31536000
        stsIncludeSubdomains: true
        stsPreload: true
        forceSTSHeader: true
        contentTypeNosniff: true
        browserXssFilter: true
        referrerPolicy: "strict-origin-when-cross-origin"
        frameDeny: true
        customResponseHeaders:
          X-Permitted-Cross-Domain-Policies: "none"
          Permissions-Policy: "camera=(), microphone=(), geolocation=()"
    api-rate-limit:
      rateLimit:
        average: 30
        burst: 60
        period: 1s
        sourceCriterion:
          ipStrategy:
            depth: 1
    admin-ipwhitelist:
      ipAllowList:
        sourceRange:
          - "5.189.127.0/24"
          - "127.0.0.1/32"
```

В `deploy/docker-compose.yml` дополнить labels у `soliton-web` (см. план в чате, секция 3.3).

**Acceptance:** `curl -sI https://pdumarket.ru/ | grep -iE "strict-transport|x-frame|x-content"` → 3 заголовка присутствуют. 61-й POST к `/api/orders/` за секунду возвращает 429.

## [ ] 3.4 Postgres hardening + tuning + resource limits

В `deploy/docker-compose.yml` блок `soliton-postgres`:

```yaml
environment:
  POSTGRES_HOST_AUTH_METHOD: scram-sha-256
  POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256 --auth-local=scram-sha-256"
command: >
  postgres
  -c shared_buffers=2GB
  -c effective_cache_size=5GB
  -c work_mem=16MB
  -c maintenance_work_mem=256MB
  -c log_min_duration_statement=500
  -c log_connections=on
  -c log_disconnections=on
  -c log_lock_waits=on
  -c log_statement=ddl
deploy:
  resources:
    limits:
      memory: 3G
      cpus: '1.5'
```

⚠️ `POSTGRES_HOST_AUTH_METHOD: scram-sha-256` применяется только при `initdb` — на существующей БД нужен `ALTER USER soliton WITH PASSWORD '<new>';` после смены `password_encryption=scram-sha-256` в postgresql.conf.

**Acceptance:** `docker exec soliton-postgres psql -U soliton -d soliton -c "SHOW password_encryption"` → `scram-sha-256`. `docker stats soliton-postgres --no-stream` показывает memory limit 3 GB.

## [ ] 3.5 Application resource limits

В `deploy/docker-compose.yml` блок `soliton-web`:

```yaml
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '2'
    reservations:
      memory: 512M
```

**Acceptance:** `docker stats soliton-web --no-stream` показывает memory limit 2 GB.

---

# Этап 4 — Backup & Disaster Recovery

## [ ] 4.1 TimeWeb snapshots — daily / 7 retention 🟠

В панели TimeWeb Cloud → VPS pdumarket-prod → Snapshots:

- Расписание: **1 раз / 24 ч** (например, 02:00 МСК)
- Retention: **7 копий**
- Подтвердить доплату (~10–30% от тарифа)

**Acceptance:** в панели TimeWeb видно расписание snapshots active. Первый snapshot создан в течение 24 часов.

## [ ] 4.2 pg_dump → S3 cron (Yandex Object Storage / Selectel S3)

1. Создать bucket (private, SSE-S3, lifecycle policy = delete after 30 days) и service account → access_key/secret_key.
2. На сервере установить awscli (`sudo apt install awscli`) и положить скрипт `/home/server/bin/backup-postgres.sh` (см. план в чате, секция 4.2). chmod 700, секреты внутри.
3. Cron: `30 3 * * * /home/server/bin/backup-postgres.sh >> /var/log/backup-postgres.log 2>&1`.
4. Через 24 часа проверить, что в S3-bucket появился `postgres/2026/MM/DD/soliton-*.sql.gz`.

**Acceptance:** в S3-bucket за прошедшие сутки есть свежий dump, размер > 0.

## [ ] 4.3 Restore runbook + первый тест восстановления

Создать `deploy/RESTORE_RUNBOOK.md` с пошаговой процедурой (см. план в чате, секция 4.3). Прогнать восстановление на staging-копии (НЕ на prod).

**Acceptance:** runbook закоммичен, тест на staging успешен (восстановленная БД содержит те же `static_pages` rows и orders что и на prod в момент дампа).

---

# Этап 5 — Мониторинг и алерты

## [ ] 5.1 UptimeRobot HTTP-keyword monitor 🟠

- Аккаунт на uptimerobot.com (free-тариф).
- Monitor #1: `https://pdumarket.ru/` (HTTP-keyword, search «Солитон» в HTML, interval 5 мин).
- Monitor #2: `https://pdumarket.ru/info/payment/` (keyword «Способы оплаты», interval 5 мин) — verify 057 routes.
- Alert: email на `svp@heado.tech` + Telegram-bot (опц).

**Acceptance:** в UptimeRobot 2 monitor'а active, искусственная остановка контейнера на 5 мин триггерит alert.

## [ ] 5.2 Disk usage cron + Container health cron

Положить на сервер 2 скрипта (`check-disk.sh`, `check-containers.sh` — см. план в чате 5.2 + 5.3) и cron:

```
0 * * * * /home/server/bin/check-disk.sh
*/15 * * * * /home/server/bin/check-containers.sh
```

Threshold disk = 80%. Alert via mail или Telegram bot.

**Acceptance:** `crontab -l | grep -c check-` → 2. Симуляция: создать большой файл (`fallocate -l 65G /tmp/big`) и убедиться что alert приходит. Затем `rm`.

## [ ] 5.3 (опц) Error tracking — GlitchTip self-hosted или Sentry SaaS free 🟢

GlitchTip: self-hosted compose в `/home/server/apps/glitchtip/`. Хост через Traefik как `errors.pdumarket.ru`. Поправить `apps/web/instrumentation.ts` чтобы слать ошибки в DSN.

ИЛИ Sentry SaaS — free-tier (5k events/month), быстрее start, но платный после порога.

**Acceptance:** искусственная ошибка (поломанный `/api/test-error`) появляется в dashboard в течение минуты.

---

# Этап 6 — TimeWeb-panel security 🟢

## [ ] 6.1 Включить 2FA на аккаунте TimeWeb Cloud

В разделе «Безопасность» аккаунта TimeWeb — Google Authenticator / Telegram. Все рестарты VPS / snapshot-операции теперь требуют 2FA.

**Acceptance:** Login на TimeWeb panel требует 2FA-код.

## [ ] 6.2 Ротация root-пароля + обновить production-server.md

В TimeWeb-панели сгенерировать длинный случайный root-пароль (24+ chars). Обновить `deploy/.secrets/production-server.md`. Старый «m,mdCKg,qWZmz1» — удалить из всех источников.

**Acceptance:** новый пароль работает через TimeWeb-консоль (VNC), документирован в `.secrets/`.

## [ ] 6.3 PTR-запись (reverse-DNS) через тикет TimeWeb

Запросить у поддержки TimeWeb: PTR-запись `45.144.220.45 → pdumarket.ru` (или `mail.pdumarket.ru` если планируется собственный SMTP в будущем).

**Acceptance:** `dig -x 45.144.220.45 +short` возвращает `pdumarket.ru.` (или mail.pdumarket.ru).

---

# Этап 7 — Post-deploy verification

## [ ] 7.1 Day-0 smoke-test (сразу после cutover)

Полный bash-скрипт:

```bash
# HTTPS + LE cert
curl -sI https://pdumarket.ru/ | head -3
echo | openssl s_client -connect pdumarket.ru:443 2>/dev/null | grep "Verify return code"

# Security headers (этап 3.3)
curl -sI https://pdumarket.ru/ | grep -iE "strict-transport-security|x-frame|x-content"

# 057 spec runtime
curl -sI https://pdumarket.ru/info/payment/                                            # → 200
curl -s  https://pdumarket.ru/ | grep -c "ИНН 6659009140"                              # → ≥1
curl -sX POST https://pdumarket.ru/api/orders/ -H 'Content-Type: application/json' \
  -d '{}' | grep CONSENT_REQUIRED                                                       # → match

# Rate-limit (61-й запрос должен получить 429)
for i in $(seq 1 70); do
  curl -sI -X POST https://pdumarket.ru/api/orders/ \
    -H 'Content-Type: application/json' -d '{}' | head -1
done | tail -10                                                                        # → последние строки 429
```

**Acceptance:** все проверки pass.

## [ ] 7.2 Week-1 verification

- Полный smoke checkout: положить товар → checkout → оплата (sandbox ЮKassa) → email-уведомление → admin-видимость в `/admin/`.
- `consent.consented_at` непуст, `policy_version_offer` и `policy_version_privacy` — реальные строки (не `unknown`).
- Первый `pg_dump` в S3 (на следующее утро).
- UptimeRobot alerts работают (искусственно отключить контейнер на 5 мин).
- Restore-тест на staging-копии (НЕ на prod).

**Acceptance:** checklist выше пройден, найденные проблемы залогированы в `07-build-specifications/deferred-content-track.md`.

## [ ] 7.3 ЮKassa moderation + paymentSettings.enabled=true 🟢

После прохождения модерации ЮKassa (требования 057 закрыты):

1. Подать заявку в кабинет ЮKassa: footer/реквизиты/политики/cookies/consent — всё на месте.
2. После одобрения: `/admin/` → Globals → Payment / ЮKassa → `enabled: true`.
3. `AdminChangeLog` зафиксирует изменение (audit).
4. Cron `payment-create` начнёт работать с боевым API ЮKassa (не stub).

**Acceptance:** реальный заказ → реальная оплата → реальный чек 54-ФЗ в email клиента.

---

## Что НЕ покрывает этот план (deferred)

- **WAF (CrowdSec)** — после первой волны атак.
- **CDN (Cloudflare)** — если будут DDoS. Сейчас Traefik напрямую.
- **Production secrets management** (Vault / SOPS) — scp + chmod 600 норма для single-developer.
- **CI/CD (GitHub Actions)** — пока push.sh локально.
- **Blue-green deploy** — пока `compose up --build` с downtime ~30 сек.

---

**Окончание плана.**

Связанные документы:
- `deploy/README.md` — архитектура и базовая процедура деплоя
- `deploy/.secrets/production-server.md` — SSH / root credentials
- `deploy/.secrets/production-env.md` — DB password / Payload secret / 057 envvars
- `07-build-specifications/deferred-content-track.md` § п. 26 — backlog
- `specs/057-yookassa-buyer-info-compliance/spec.md` — 152-ФЗ requirements
