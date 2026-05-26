# Operator Guide — Аналитика Soliton/pdumarket

**Спека**: 058, T077 (FR-220-221)
**Дата**: 2026-05-26
**Для кого**: маркетолог, owner сайта, SEO-команда

---

## 1. Где смотреть метрики

### Yandex.Metrika
- URL: https://metrika.yandex.ru/dashboard?id=109422539
- Login: тот же аккаунт, что прикреплён к OAuth-token'у (YM_AGENT_TOKEN)
- Ключевые отчёты:
  - **Цели** — все 14 целей v1 (см. `goal-mapping.md`)
  - **Электронная коммерция** — выручка, средний чек, топ-товары
  - **Источники → Метки** — UTM/yclid breakdown
  - **Содержание → Активность пользователей** — глубина прокрутки, время
  - **Аудитории** — ретаргетинг-сегменты (создаются вручную в v1)
  - **Webvisor** — записи визитов (PII-маскированы)
- Связка с Я.Директом для импорта стоимости: **manual** (Settings →
  Source Traffic → Add Я.Директ account). В v1 не настроено по умолчанию.

### Yandex.Webmaster
- URL: https://webmaster.yandex.ru/site/pdumarket.ru/
- Главное: «Поисковые запросы», «Страницы в поиске», «Диагностика → Ошибки обхода»
- v1: ручной просмотр. v1.1: автоимпорт в weekly-report.

### Google Search Console
- URL: https://search.google.com/search-console
- v1: ручной просмотр (домен подтверждается owner-ом).

---

## 2. Глоссарий событий (v1 разметка)

Цели и события — что они означают и где смотреть:

| Event | Goal-ID | Бизнес-смысл | Где трекается |
|---|---|---|---|
| `purchase` | 562674651 | **Главная цель**: успешная оплата заказа | PaymentReturnClient (success page) |
| `begin_checkout` | 562674653 | Пользователь начал оформление заказа | CartView |
| `add_to_cart` | 562674654 | Товар добавлен в RFQ-корзину | RfqCart |
| `payment_intent` | 562674587 | Клик «Оплатить», до редиректа на ЮKassa | PhysicalCheckoutForm |
| `payment_failed` | 562674588 | Оплата провалилась | PaymentReturnClient |
| `rfq_submit` | 562674656 | B2B запрос на КП отправлен | RfqForm |
| `rfq_open` | 562674589 | Открыта форма RFQ | RfqForm |
| `price_request_click` | 562674657 | «Запросить цену» (товар без публичной цены) | ProductDetail |
| `document_download` | 562674658 | Скачан PDF (паспорт/сертификат) | (TODO в Phase 7) |
| `phone_click` | 562674659 | Клик на номер телефона | TrackedPhone |
| `email_click` | 562674660 | Клик на email-ссылку | TrackedEmail |
| `search` | 562674661 | Использован поиск по сайту | (если поиск есть) |
| `search_no_results` | 562674662 | Поиск дал 0 результатов | (если поиск есть) |
| `filter_apply` | 562674663 | Применён фильтр в каталоге | (TODO в Phase 7) |

Дополнительные события без отдельных целей (для воронки):
- `view_item`, `view_item_list`, `select_item`, `view_cart`
- `checkout_step_contact/shipping/payment_method/review/cta_pay_clicked`
- `add_payment_info`, `add_shipping_info`, `payment_retry`
- `inn_validation_success/failed` — B2B CRO-сигнал
- `consent_banner_shown/accepted/declined` — meta-аналитика consent
- `js_error`, `page_404`, `error_5xx` — качество сайта
- `stock_status_view`, `price_view` — B2B-сигналы

---

## 3. Воронка покупки (12 шагов)

```
1. Посетитель приходит из источника        → page_view + cookie set
2. Смотрит каталог                          → category_view + view_item_list
3. Кликает по карточке                      → select_item
4. Смотрит PDP                              → view_item + ecommerce.detail
5. Добавляет в корзину                      → add_to_cart + ecommerce.add
6. Смотрит корзину                          → view_cart
7. Нажимает «Оформить»                      → begin_checkout
8. Фокус в контактах                        → checkout_step_contact
9. Выбирает доставку                        → checkout_step_shipping + add_shipping_info
10. Видит выбор оплаты                      → checkout_step_payment_method + add_payment_info
11. Нажимает «Оплатить»                     → checkout_cta_pay_clicked + payment_intent
12. После ЮKassa успех                      → purchase + ecommerce.purchase
                                              → server-side hit (FR-040, для adblock)
                                              → offline-conversion в Я.Директ
                                                (FR-033/034, для оптимизации ставок)
```

В Метрике эту воронку можно построить через «Конверсии → Составные цели».
Каждый шаг — отдельная цель из списка выше. Drop-off rate показывает где
максимальный отвал.

---

## 4. Как читать недельный отчёт (за 30 минут)

В v1 weekly-report — manual через UI Метрики (auto-CLI — defer до v1.1).

Каждый понедельник:

1. **Метрика → Сводка** (5 мин)
   - Visits / Users / Sessions недели
   - Bounce rate (норма для B2B: 40-60%)
   - Avg time on site (норма: > 2 мин)

2. **Метрика → Цели → Конверсии** (10 мин)
   - Покупки: сколько, выручка, средний чек
   - RFQ: сколько отправлено
   - Phone clicks vs Email clicks (sign of B2B trust)
   - Drop-off на checkout-шагах: посмотреть «Составная цель → Покупка»

3. **Метрика → Источники → Метки** (5 мин)
   - Топ-10 utm_campaign по конверсиям
   - ROAS (когда настроится связка Метрика↔Директ): кампании с ROAS<1 — пауза
   - Brand vs non-brand (запросы со словом soliton/солитон)

4. **Я.Вебмастер → Запросы** (5 мин)
   - Топ-30 запросов недели
   - Новые запросы (попали в top-100 впервые)
   - Потерянные запросы (выпали)

5. **GSC → Performance** (3 мин)
   - Сравнение с Я.Вебмастером
   - Pages с CTR < 2% (need title/meta tuning)

6. **Webvisor выборочно** (2 мин)
   - 3-5 записей с высоким bounce — проверить почему уходят

---

## 5. UTM-чек-лист для запуска кампании

Перед запуском любой рекламной кампании:

```
✓ utm_source задан (e.g. yandex, vk, mailing)
✓ utm_medium задан (e.g. cpc, social, email)
✓ utm_campaign задан с понятным именем (e.g. pdu-19-promo-2026q2)
✓ utm_content задан если несколько креативов (e.g. banner-1, banner-2)
✓ utm_term задан если контекст (ключевик)
✓ Тестовая ссылка открыта, в Метрика-real-time виден визит с этими метками
✓ Цель в Метрике для главной конверсии активна
✓ ROAS budget threshold заранее зафиксирован
```

---

## 6. Agent-driven Metrika operations

Agent (Claude) управляет Метрика-конфигурацией через `pnpm metrika:apply-config`.

### Когда выполнять

| Когда | Команда | Что делает |
|---|---|---|
| После любого изменения `metrika.config.ts` | `pnpm metrika:apply-config --dry-run` затем `pnpm metrika:apply-config` | Создаёт/обновляет goals/filters/settings |
| Pre-deploy CI gate | `pnpm metrika:validate-config` | Exit 1 при drift между config и live |
| Diagnostics после manual UI-изменения | `pnpm metrika:export-config` (v1.1) | Тащит live state в config |

### Forever-Manual operations (НЕ автоматизируются)

Эти 7 операций навсегда требуют ручного действия:

1. **DNS CNAME** `mc.<domain>` → `mc.yandex.ru` для first-party cookies
   (FR-340). На registrar (не Метрика API).
2. **OAuth-связка Метрика↔Я.Директ** для импорта стоимости — UI Метрики.
3. **Создание счётчика** — Yandex-аккаунт владельца.
4. **Получение и ротация API-токенов** — OAuth flow один раз.
5. **Webvisor selective deletion для DSAR** — Yandex Support escalation.
6. **Подтверждение прав на домен** в Я.Вебмастере и GSC — UI.
7. **Approve/reject AgentProposal** — целевая ручная операция в Payload Admin.

---

## 7. Как проверить, что серверные хиты работают (T068)

Сценарий: проверить FR-040 adblock-resilience.

1. Открыть сайт в Chrome
2. Установить uBlock Origin с EasyList + EasyPrivacy
3. Пройти happy-path до успешной оплаты (тестовый платёж ЮKassa)
4. Открыть Payload Admin → Orders → последний заказ
5. Найти `serverHitStatus.purchaseHitStatus`. Ожидаемое значение: `sent`
6. Если `failed` — проверить лог в Vercel/server-console:
   `[orders] server-hit fire-and-forget failed: ...`

Метрика-side проверка:
- Real-time → визиты с этим IP (последние 5 мин)
- Через 24h в отчёте «Цели → Purchase» — counter увеличился, но в
  «Источники → Прямые» (NOT через клиент-pixel)

---

## 8. Известные ограничения v1

| Ограничение | Причина | Workaround |
|---|---|---|
| Counter Settings не sync через apply-config | Yandex API silently ignored unknown fields | Настройка через UI Метрики (Forever-Manual) |
| Retargeting filters пусты | Требуют Yandex Audience API (отдельный продукт) | Создать через UI или v1.1 |
| Qualified Visit цель отсутствует | type='number' требует depth-параметр (TODO mapper) | Создать через UI как «Депth-goal: 2 страницы за визит» |
| Weekly-report manual | Auto-CLI defer до v1.1 | Использовать UI Метрики + Wikiстраницу |
| Webmaster/GSC auto-integration | v1.1 | Manual просмотр |
| Goal-webhook алертинг | v1.1 (нет трафика на launch) | Поллинг manual через UI |

См. полный список в `spec.md` § «Forever-Manual operations» и Scope Phases.

---

## 9. Quick links

- Метрика: https://metrika.yandex.ru/dashboard?id=109422539
- Webmaster: https://webmaster.yandex.ru/site/pdumarket.ru/
- GSC: https://search.google.com/search-console
- Спека: `specs/058-behavior-and-ad-analytics/spec.md`
- Goal mapping (актуальная): `06-reports/analytics/goal-mapping.md`
- Forms inventory: `06-reports/analytics/forms-inventory.md`
- DSAR runbook: `06-reports/analytics/dsar-runbook.md`
- Apply-config CLI: `pnpm metrika:apply-config --dry-run`
- Validate-config CI gate: `pnpm metrika:validate-config`
