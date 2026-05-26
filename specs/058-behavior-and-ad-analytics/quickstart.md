# Quickstart: Behavior & Ad Analytics (v1 / MVP-Lite)

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md) | **Contracts**: [contracts/](./contracts/)

Это пошаговая инструкция для валидации v1 (MVP-Lite) в течение **30 минут happy-path** после реализации. Если все шаги проходят — критерии SC-001…SC-006, SC-008, SC-010, SC-017 (частично), SC-028, SC-029 для v1-приёмки выполнены.

---

## Предусловия

Перед запуском quickstart должно быть выполнено:

- ✅ Все задачи v1 из `tasks.md` (генерируется `/speckit-tasks`).
- ✅ ENV-переменные в `.env.local` (см. ниже).
- ✅ Я.Метрика-счётчик создан (test или production).
- ✅ В Метрике созданы цели согласно goal-mapping.md.
- ✅ `pnpm install` && `pnpm --filter @soliton/web generate:types`.

### ENV-переменные (Clarification Q3 — всё в env)

```bash
# .env.local
NEXT_PUBLIC_YANDEX_METRIKA_ID=12345678          # ID счётчика
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXX          # GA4 (secondary)
NEXT_PUBLIC_ANALYTICS_DEBUG=true                 # вывод в console (dev)
YM_API_TOKEN=AQAAAAxxxxxxx                       # Метрика API token (только server-side, без NEXT_PUBLIC_)
YM_COUNTER_ID=12345678                           # дублирует NEXT_PUBLIC_, нужен в server-tracker
CRON_SECRET=<random-256-bit>                     # уже существует от других cron-эндпоинтов
ADMIN_ALERT_CHANNEL=                             # пусто в v1 (defer goal-webhook)
```

### Seed Payload Globals (FR-101)

```bash
pnpm --filter @soliton/web seed:analytics-settings
```

Создаёт `AnalyticsSettings` Global со значениями по умолчанию (см. data-model.md §3.1).

---

## Шаг 1: Smoke-test проходит (5 минут)

```bash
pnpm --filter @soliton/web test:analytics:unit
```

**Ожидается**:
- ✅ Все ~60 event-helper'ов проходят shape-проверку.
- ✅ PII-filter работает (тест-кейсы с email/phone/inn маскируются).
- ✅ Goal-mapping artifact парсится без ошибок.
- ✅ Для каждой строки goal-mapping есть helper и тест.

**При падении**: см. console-output; типичные причины — лишний пробел в event-name, отсутствие helper'а для нового event'а, утечка PII (вывод `[pii-redacted] ...`).

→ **SC-024 выполнен**.

---

## Шаг 2: Happy-path в браузере с принятым consent (10 минут)

```bash
pnpm --filter @soliton/web dev
```

Открыть `http://localhost:3000` в инкогнито браузера.

1. **Главная**: появляется cookie-banner.
2. Открыть DevTools → Console.
3. Нажать «Принять» в banner-е.
   - **Проверка**: в console `[analytics] consent_banner_shown`, затем `[analytics] consent_accepted`. В `window.dataLayer` появились эти события.
4. **Категория**: перейти `/catalog/setevye-filtry/`.
   - **Проверка**: `category_view` с `category_slug=setevye-filtry` и `items_count`; `view_item_list` с массивом товаров и `list_id=catalog_setevye-filtry`.
5. **PDP**: кликнуть по карточке товара.
   - **Проверка**: `select_item` с `position` и `list_id`; на странице товара — `view_item` + `ecommerce.detail` (для встроенного отчёта Метрики); `stock_status_view`; либо `price_view`, либо `price_request_click` в зависимости от наличия публичной цены.
6. **Добавить в корзину**: нажать «В корзину».
   - **Проверка**: `add_to_cart` + `ecommerce.add` с тем же товаром.
7. **Корзина**: перейти на `/cart/`.
   - **Проверка**: `view_cart` + `page_view` с `page_type=cart`.
8. **Checkout**: «Оформить заказ» → выбрать checkout-type (физлицо / юрлицо).
   - **Проверка**: `begin_checkout` с `checkout_type`; затем по шагам:
     - При фокусе на контактах: `checkout_step_contact` с `step_index=1`.
     - При выборе доставки: `checkout_step_shipping` + `add_shipping_info`.
     - При выборе оплаты: `checkout_step_payment_method` + `add_payment_info`.
     - При показе сводки: `checkout_step_review`.
9. **Юрлицо**: ввести ИНН → проверить `inn_validation_success` или `inn_validation_failed`.
   - **Проверка**: значение ИНН в payload **отсутствует** (только факт + error code).
10. **Оплатить**: нажать «Оплатить».
    - **Проверка**: `checkout_cta_pay_clicked` (до редиректа на ЮKassa).
    - Затем редирект на ЮKassa, тестовая оплата, возврат на `/payment/return/<orderId>`.
    - На success-page: `purchase` event с `transaction_id` = SO-2026-XXXX + `ecommerce.purchase`.
11. **Cookie**: открыть Application → Cookies:
    - `_solitomo_attribution` — содержит JSON с UTM/refererHost/capturedAt.
    - `_solitomo_first_seen` — содержит ISO-дату.
    - `_solitomo_consent=accepted`.
    - `_ym_uid` — установлено Метрикой.
    - Cookie на `.<домен>` (для Safari ITP first-party).

→ **SC-001, SC-002 (для покрытых событий), SC-006 (PII не утекли), SC-027 (cookie на основном домене)** выполнены.

---

## Шаг 3: Проверка серверного хита (5 минут)

После успешной оплаты:

1. Открыть Payload Admin → Orders → последний заказ.
   - **Проверка**:
     - `attributionFirstTouch` заполнен из cookie.
     - `timeToPurchaseDays` вычислен.
     - `serverHitStatus.purchaseHitStatus = 'sent'`.
     - `serverHitStatus.purchaseHitSentAt` ≈ время оплаты + несколько секунд.
2. Открыть UI Метрики → Реальное время.
   - **Проверка**: видны hits с params, содержащими `transaction_id` и `value`.

### Тест adblock-resilience (SC-005):
1. Включить uBlock Origin с EasyList + EasyPrivacy.
2. Повторить happy-path с другого инкогнито-окна.
3. Клиентский `purchase` event **может быть заблокирован**, но в Payload Admin → Orders → `serverHitStatus.purchaseHitStatus = 'sent'`.
4. В Метрика-отчёте через 5-15 минут конверсия видна (с тем же `transaction_id` → не дублируется).

→ **SC-005** выполнен.

---

## Шаг 4: Hybrid `user_type=legal_entity` (3 минуты)

1. Новое инкогнито → главная → cookie-banner accept.
2. Без логина → checkout юр.лицо → ввести валидный ИНН → отправить.
3. **Проверка**: cookie `_solitomo_legal_entity_flag` создана с `source='inn-form'`.
4. Следующие события (от cookie-time) содержат `user_type=legal_entity`.
5. Открыть Payload Admin → Cart этого заказа → `userTypeAtCreation = 'legal_entity'`.

→ Q1 clarification реализована корректно.

---

## Шаг 5: Аннотации (2 минуты)

1. Open Payload Admin → Annotations → New.
2. Создать тестовую: type=manual, title="Quickstart test", occurredAt=now, environment=production.
3. Запустить `pnpm report:analytics:weekly --week=<текущая неделя> --dry-run`.
4. **Проверка**: в выводе MD есть секция «Аннотации недели» с этой строкой.

---

## Шаг 6: Weekly-report генерация (5 минут)

```bash
pnpm --filter @soliton/web report:analytics:weekly --week=2026-21 --dry-run
```

**Ожидается** в stdout:
- Markdown с шапкой, всеми секциями (см. weekly-report-cli.md).
- Секция «Организический канал» содержит ссылки на Webmaster/GSC.
- Секция «Аннотации» содержит тестовую запись.
- Секция «Электронная коммерция» содержит данные последнего заказа.
- Никаких NaN / undefined / частично заполненных пустых таблиц.

Затем без `--dry-run`:
```bash
pnpm --filter @soliton/web report:analytics:weekly --week=2026-21
```

→ **SC-003, SC-010 (при наличии данных за 4 недели), SC-029 (если в файлах нет staging-визитов)** выполнены.

---

## Шаг 7: Cross-device через UserID (опционально, 5 минут)

1. Открыть сайт на мобильном.
2. Перейти на тестовый customer-аккаунт через magic-link.
3. Открыть тот же аккаунт на десктопе.
4. В Метрике (раздел «Посетители → Поведение по UserID») должен быть один профиль для обоих устройств.

→ **SC-014** выполнен.

---

## Шаг 8: Operator-guide и goal-mapping проверка (3 минуты)

1. Открыть `06-reports/analytics/operator-guide.md`.
   - **Проверка**: содержит глоссарий событий (минимум для всех v1-событий), описание воронок, UTM-чек-лист, чек-лист «как читать недельный отчёт за 30 минут».
2. Открыть `06-reports/analytics/goal-mapping.md`.
   - **Проверка**: таблица содержит строки для каждого event с Metrika Goal-ID и owner.
3. Открыть `06-reports/analytics/dsar-runbook.md`.
   - **Проверка**: соответствует контракту `contracts/dsar-runbook.md`.

→ **SC-017 (для v1 — частично, по чек-листу), SC-028** выполнены.

---

## Шаг 9: Проверка изоляции env (1 минута)

1. Запустить `pnpm dev` → все события в console содержат `env: 'development'`.
2. Открыть Метрика-счётчик → Сегменты → создать сегмент `env != production` → проверить, что в production-счётчик dev-визиты НЕ попадают.

→ **SC-029** выполнен.

---

## Acceptance Summary

После выполнения всех шагов следующие SC из spec v1-приёмки **должны быть зелёными**:

| SC | Описание | Шаг проверки |
|---|---|---|
| SC-001 | Воронка покупки видна с drop-off | Шаг 2 (happy-path) |
| SC-002 | Все события видны в debug | Шаг 1 + Шаг 2 |
| SC-003 | Weekly-отчёт за 30 минут | Шаг 6 |
| SC-005 | Adblock-user учтён через server-hit | Шаг 3 |
| SC-006 | Нет PII в event-payload | Шаг 1 + Шаг 2 (verify console) |
| SC-008 | Источники видны (даже без рекламы — через органику) | Шаг 6 (секция «Источники») |
| SC-010 | Папка `06-reports/analytics/` накапливает файлы | Шаг 6 |
| SC-012 | Checkout-funnel с 5 шагами | Шаг 2 (шаги 8-10) |
| SC-014 | Cross-device по UserID | Шаг 7 |
| SC-017 | Operator-guide прочитан и достаточен | Шаг 8 (чек-лист) |
| SC-024 | Smoke-test покрывает ≥80% событий | Шаг 1 |
| SC-027 | Safari first-party cookies работают | Шаг 2 (cookie на основном домене) |
| SC-028 | Goal-mapping artifact существует | Шаг 8 |
| SC-029 | Test/staging не загрязняют prod | Шаг 9 |
| SC-030 | DSAR runbook позволяет ответить <30 мин | (тестируется отдельным DSAR-rehearsal) |

**Defer для v1.1+**:
- SC-004 (yclid → offline-conversion) — defer до запуска первой Я.Директ-кампании.
- SC-007 (Web Vitals по типам страниц) — defer до v1.1, в v1 используется встроенный отчёт «Скорость загрузки».
- SC-011 (Электронная коммерция через 24 часа) — проверяется после первой реальной покупки.
- SC-013 (retention D7/D30) — требует 4 недель накопленных данных.
- SC-015 (8 ретаргетинг-сегментов) — в v1 проверяются только 3 из 8.
- SC-016 (auto-deploy аннотация) — defer до v1.1.
- SC-018-022 (Webmaster/GSC данные) — defer до v1.1.
- SC-023 (consent-rate в диапазоне) — требует ≥100 визитов для статистики.
- SC-025 (Я.Директ cost import) — после первой реальной кампании.
- SC-026 (retry-очередь resilience) — defer до v1.1.

---

## Rollback procedure

Если v1 деплой ломает что-то критическое:
1. Откатить env `NEXT_PUBLIC_YANDEX_METRIKA_ID` к старому значению → старая разметка восстановится.
2. AnalyticsSettings → `activation.serverHitsEnabled = false` → серверные хиты отключены (kill-switch).
3. AnalyticsSettings → `activation.webvisorEnabled = false` → Webvisor выключен (на случай утечки PII).
4. Cookie consent banner работает независимо (наследие 057) — не требует rollback.

---

## Дальнейшие шаги

После успешного v1-приёма:
1. Запустить тестовую Я.Директ кампанию с `?yclid=...` → проверить SC-004.
2. Запустить недельный cron для `report:analytics:weekly` (понедельник 11:00 МСК).
3. Через 4 недели — SC-013 (retention), SC-022 (brand-доля динамика).
4. Через 1 месяц — оценка готовности к v1.1 (Webmaster/GSC API, HTML-admin-page, retry-очередь).
