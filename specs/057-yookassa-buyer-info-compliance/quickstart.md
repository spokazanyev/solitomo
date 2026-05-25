# Quickstart: 057 ЮKassa Buyer-Info Compliance

**Цель документа:** последовательность ручной проверки реализации 057 для приёмки. Эти шаги используются как basis для smoke-test и acceptance-чеклиста модератора ЮKassa.

---

## Prerequisites

1. Dev-сервер запущен: `pnpm --filter @soliton/web dev` (через `expect`-обёртку из `/tmp/run-dev.exp`)
2. БД содержит seed-данные `static-pages` (см. шаг 1 ниже)
3. Браузер открыт на `http://localhost:3000/`

## Step 1 — Seed buyer-info pages

```bash
cd /Users/svp/Documents/GitHub/SMB/projects/solitomo-organic-site
pnpm --filter @soliton/web seed:static-pages
```

**Ожидается:** 9 страниц создано в коллекции `static-pages` (slugs: payment, delivery, return, warranty, offer, privacy, pd-policy, terms, faq). Повторный запуск — no-op.

**Проверка через psql:**
```bash
docker exec soliton-postgres psql -U soliton -d soliton -c "SELECT slug, status, category, version FROM static_pages ORDER BY slug;"
```

---

## Step 2 — Меню «Покупателям» в Header

1. Открой `http://localhost:3000/`
2. **Desktop (>768px):** наведи курсор на «Покупателям» в header — выпадает dropdown с 6 пунктами
3. **Mobile (<768px):** открой mobile menu (☰) → «Покупателям» раскрывается аккордеоном

**Acceptance (US2.1):** видны все 6 пунктов: Оплата, Доставка, Возврат, Гарантия, Оферта, FAQ.

---

## Step 3 — Все 9 buyer-info страниц отдают 200

Запусти проверку:
```bash
for slug in payment delivery return warranty offer privacy pd-policy terms faq; do
  curl -sS -o /dev/null -w "%{http_code} /info/$slug/\n" --max-time 10 -L "http://localhost:3000/info/$slug/"
done
```

**Ожидается:** все 9 строк `200 /info/<slug>/`.

---

## Step 4 — Footer на каждой странице

1. Открой по очереди:
   - `/`
   - `/catalog/pdu/`
   - `/product/<любой-slug>/`
   - `/cart/`
   - `/info/payment/`
   - `/company/contacts/`
2. На каждой проверь footer:
   - **юр.наименование:** «ООО «НПП Солитон-1»»
   - **ИНН:** 6659009140
   - **ОГРН:** 1026602965850
   - **4 ссылки на политики:** Оферта, Политика конфиденциальности, Политика обработки ПДн, Пользовательское соглашение
   - **4 логотипа платёжных систем:** МИР, Visa, Mastercard, СБП

**Acceptance (US1.1, US1.2, FR-5703, FR-5704):** на всех страницах footer идентичен и содержит всё перечисленное.

---

## Step 5 — Расширение `/company/contacts/`

1. Открой `/company/contacts/`
2. Прокрути ниже базовых реквизитов
3. Найди блок **«Банковские реквизиты»** с:
   - Банк: Филиал «Екатеринбургский» АО «АЛЬФА-БАНК», г. Екатеринбург
   - БИК: 046577964
   - К/с: 30101810100000000964
   - Р/с: 40702810638030009466
4. Найди блок **«Руководитель»** с:
   - Директор Показаньев Виктор Григорьевич, с 29.11.2002

**Acceptance (US3):** оба блока видны.

---

## Step 6 — Cookies-consent banner

1. Открой `http://localhost:3000/` в **incognito-режиме**
2. **До любого клика:**
   - Открой DevTools → Network → фильтр `analytics|gtag|metrika`
   - Перезагрузи страницу
   - Проверь: **нет запросов** к `google-analytics.com`, `googletagmanager.com`, `mc.yandex.ru`
3. Должен быть виден баннер: «Мы используем cookies для аналитики» с кнопками «Принять» / «Отказаться» + ссылкой на `/info/pd-policy/`
4. На mobile (<768px): баннер — нижняя плашка, не fullscreen
5. Нажми **«Принять»** → баннер скрылся, в cookies `cookie_consent=accepted` (срок ≈365 дней)
6. Перезагрузи страницу → DevTools/Network → видны запросы к GA / Метрике
7. Повтори в новой incognito-сессии, нажми **«Отказаться»** → cookies `cookie_consent=declined`, после перезагрузки запросов к аналитике **по-прежнему нет**

**Acceptance (US6, SC-012, FR-5750..5755):** все 5 acceptance scenarios US6 пройдены.

---

## Step 7 — Чекбокс согласия 152-ФЗ во всех формах

Для каждой формы:
1. Открой соответствующий URL
2. Заполни обязательные поля
3. **До установки галки:** кнопка submit `disabled`, подсказка «Поставьте согласие на обработку ПДн»
4. Поставь галку → кнопка submit `enabled`
5. Submit → в БД сохраняется group `consent` с непустыми полями

**URLs форм:**

| Форма | URL |
|---|---|
| Checkout (физлицо) | `/cart/checkout/physical/review/` |
| Checkout (по счёту) | `/cart/checkout/invoice/` |
| Checkout (RFQ) | `/cart/checkout/quote/` |
| Запрос КП | `/b2b/request-quote/` |
| Регистрация клиента | `/me/register` (если есть в 054) |

**Проверка в БД после submit:**
```bash
# Пример для последнего Order
docker exec soliton-postgres psql -U soliton -d soliton -c "SELECT id, consent_consented_at, consent_policy_version_offer, consent_policy_version_privacy FROM orders ORDER BY id DESC LIMIT 1;"
```

**Acceptance (US4, FR-5730..5738):** все 5 форм проверены, БД содержит `consent.*` с непустыми значениями.

---

## Step 8 — Юр.документы содержат версию

1. Открой `/info/offer/`
2. Под заголовком должен быть disclaimer: «Версия 2026-05-25-v1 · Действует с 25 мая 2026 года»
3. Повтори для `/info/privacy/`, `/info/pd-policy/`, `/info/terms/`

**Acceptance (FR-5719):** все 4 юр-документа имеют видимую версию и дату.

---

## Step 9 — Сценарий US1: модератор ЮKassa

Имитируй прохождение по чеклисту ЮKassa onboarding:

| Чеклист | Где проверить | Должно быть |
|---|---|---|
| Юр.наименование, ИНН, ОГРН | Footer любой страницы | ✓ |
| Контакты (тел, email, адрес) | `/company/contacts/` | ✓ |
| Условия оплаты | `/info/payment/` | ≥ 1500 знаков |
| Условия доставки | `/info/delivery/` | ≥ 1500 знаков |
| Условия возврата | `/info/return/` | обе ветки: физлица 14 дней + юрлица |
| Гарантия | `/info/warranty/` | 12 мес упомянуто, исключения перечислены |
| Оферта | `/info/offer/` | ≥ 3000 знаков, версия указана |
| Политика конфиденциальности | `/info/privacy/` | ≥ 3000 знаков, версия указана |
| Политика обработки ПДн (152-ФЗ) | `/info/pd-policy/` | ≥ 3000 знаков, оператор = «ООО «НПП Солитон-1»» |
| SSL, один домен, нет битых ссылок | sitemap.xml + manual | ✓ |
| Реальные товары/цены | `/catalog/pdu/` | без TEST-данных |
| Чек 54-ФЗ упомянут | `/info/payment/` | «электронный чек на email» |

**Acceptance (US1, SC-001):** все 12 пунктов ✓.

---

## Step 10 — Покупатель находит ответы (US2)

1. Открой `/`
2. Меню «Покупателям» → «Оплата» → должна открыться `/info/payment/` (1 клик)
3. Меню «Покупателям» → «Возврат» → `/info/return/` (1 клик)
4. Меню «Покупателям» → «FAQ» → `/info/faq/` (1 клик)
5. Проверь, что в FAQ есть минимум 4 категории и 8 вопросов

**Acceptance (US2.4, SC-005):** все 6 buyer-info страниц доступны за ≤2 клика.

---

## Step 11 — Versioning юр-документа через админ

1. Залогинься в `/admin/`
2. Открой коллекцию «Статические страницы» → запись «Публичная оферта»
3. Измени `body` (добавь параграф)
4. **Не меняй** `version` → сохрани
5. Должна быть ValidationError: «Версия должна быть обновлена для юр-документа»
6. Обнови `version` на `2026-05-26-v2`, `effectiveFrom` на новую дату → сохрани
7. Открой `/info/offer/` в публичной части → видна новая версия

**Acceptance (FR-5741):** изменение юр-документа требует bump версии.

---

## Step 12 — Activation gate `paymentSettings.enabled`

(Этот шаг выполняется **уже после прохождения модерации ЮKassa** в проде, не в dev)

1. Открой админку `/admin/`
2. Globals → «Оплата / ЮKassa»
3. `enabled` → `true` (если был false)
4. Сохрани → AdminChangeLog фиксирует изменение
5. Cron `payment-create` начнёт работать с реальным API ЮKassa (не stub)

**Acceptance (A11 уточнено в Clarifications Q5):** activation gate — manual, audit-логирован.

---

## Smoke-test — full sequence (CI)

```bash
# 1. Все info-страницы 200
for slug in payment delivery return warranty offer privacy pd-policy terms faq; do
  curl -fsS -L "http://localhost:3000/info/$slug/" > /dev/null
done

# 2. Footer содержит ИНН на homepage
curl -sS -L http://localhost:3000/ | grep -q "ИНН 6659009140" && echo "footer ok"

# 3. /company/contacts/ содержит банковские реквизиты
curl -sS -L http://localhost:3000/company/contacts/ | grep -q "БИК 046577964" && echo "banking ok"

# 4. POST /api/orders без consent → 400
curl -sS -X POST http://localhost:3000/api/orders/ -H "Content-Type: application/json" -d '{"type":"physical","items":[{"sku":"TEST","quantity":1,"price":100}]}' | grep -q "CONSENT_REQUIRED" && echo "consent gate ok"

# 5. POST /api/orders с consent=true → 201
curl -sS -X POST http://localhost:3000/api/orders/ -H "Content-Type: application/json" -d '{"type":"physical","items":[{"sku":"TEST","quantity":1,"price":100}],"customer":{"fullName":"T","email":"t@ex.com","phone":"+7000"},"delivery":{"method":"cdek","city":"Москва","cost":100},"consent":true}' | grep -q "publicToken" && echo "consent flow ok"
```

Если все 5 строк OK — релиз 057 готов к staging.

---

## Откат / disable plan

Если после релиза возникли проблемы:

1. **Откат cookies-banner:** установить env-флаг `NEXT_PUBLIC_COOKIE_CONSENT_DISABLED=1` или удалить компонент из `RootLayout`
2. **Откат consent-чекбокса:** в форме сделать checkbox `defaultChecked=true` и убрать валидацию на API (временная меры). НЕ рекомендуется — это формальное нарушение 152-ФЗ
3. **Откат info-страниц:** изменить `status` любой страницы на `draft` через админ-панель → страница отдаст 404
4. **Полный откат 057:** `git revert` коммитов 057 ветки + drizzle push (новые колонки `consent.*` остаются NULL для старых записей)
