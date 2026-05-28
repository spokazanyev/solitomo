# Soliton cron via systemd timers (pdumarket-prod)

На проде нет внешнего cron-оркестратора — периодические задачи (`/api/cron/*`)
дёргаются systemd-таймерами на хосте через `docker exec soliton-web wget …`.

## Активные таймеры

| Timer | Endpoint | Интервал | Назначение |
|-------|----------|----------|------------|
| `soliton-notifications.timer` | `POST /api/cron/notifications` | 3 мин | Обработка очереди email-уведомлений (049) |

> Остальные cron-эндпоинты (`closure`, `pickup-reminder`, `stuck-alerts`,
> `carts-cleanup`, `returns-overdue`) пока **не** заведены таймерами — добавить
> по мере необходимости тем же паттерном.

## Установка (выполняется на pdumarket-prod, user `server`, sudo nopasswd)

Подставьте реальный `CRON_SECRET` (из `deploy/.secrets/production-env`) вместо
`<CRON_SECRET>`.

```ini
# /etc/systemd/system/soliton-notifications.service
[Unit]
Description=Soliton: process notification queue (049 email)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/bin/docker exec soliton-web wget -qO- --header="Authorization: Bearer <CRON_SECRET>" --post-data="" http://localhost:3000/api/cron/notifications
```

```ini
# /etc/systemd/system/soliton-notifications.timer
[Unit]
Description=Soliton: run notification queue every 3 min

[Timer]
OnBootSec=2min
OnUnitActiveSec=3min
Unit=soliton-notifications.service

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now soliton-notifications.timer
systemctl list-timers soliton-notifications.timer --no-pager
```

## Диагностика

```bash
# Последний прогон
sudo systemctl status soliton-notifications.service --no-pager
# Когда следующий
systemctl list-timers soliton-notifications.timer --no-pager
# Ручной прогон
sudo systemctl start soliton-notifications.service
```

## Ротация CRON_SECRET

1. Обновить `CRON_SECRET` в `deploy/.secrets/production-env` + redeploy (`push.sh`).
2. Обновить `ExecStart` в `.service` (тот же секрет) → `daemon-reload` →
   `restart` таймера.

> **Note**: секрет сейчас захардкожен в `.service` (root-only, chmod 644 в
> `/etc/systemd/system/`). Возможное улучшение — `EnvironmentFile=` ссылка на
> `.env` + `${CRON_SECRET}` в ExecStart, чтобы не дублировать. Записано как
> follow-up в deferred-tracker.
