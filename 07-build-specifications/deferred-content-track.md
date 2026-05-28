# Единый реестр отложенных работ

Дата создания: 2026-05-16. Последнее обновление: 2026-05-28 (добавлена Часть И — мониторинг индексации 059 + оставшиеся owner-actions после боевого деплоя).

**Это единственное место**, где фиксируются отложенные задачи по проекту Солитон. Сюда стекаются все «пока не делаем» / «требует данных от владельца» / «отложено до приоритизации» из всех этапов разработки. Не дублировать в issue-tracker, в комментариях кода или личных списках.

## 🔝 Текущие приоритеты (после боевого запуска индексации, 2026-05-28)

Высокий ROI — делать в этом порядке. Дешевле и полезнее, чем Yandex YML (п.18, отложено):

1. **Яндекс.Бизнес карточка (п.41)** — поднимает траст Яндекса, открывает нейровыдачу Алисы, ускоряет индексацию. **Самый высокий ROI.**
2. **sameAs / внешние профили (п.40)** — entity-сигнал доверия для поисковиков и ИИ-агентов (URL Я.Бизнеса из п.41 + соцсети в `contacts.json`).
3. **Контент тонких карточек товаров (п.7)** — чтобы PDP не залипали в «Crawled — currently not indexed».

Параллельно — мониторинг индексации (п.39, runbook `06-reports/seo/indexation-watchlist.md`). **Не приоритет сейчас:** Yandex YML / спека 040 (п.18) — это монетизация, а не индексация.

## Содержание

- [Часть А. Контент и доработки качества (017–036)](#часть-а-контент-и-доработки-качества) — пункты 1–14
- [Часть Б. Cart and checkout (037)](#часть-б-cart-and-checkout-037) — пункты 15, 25, 26
- [Часть В. AEO / AI-агенты (038–044, отложены целиком)](#часть-в-aeo--ai-агенты-038044-отложены-целиком) — пункты 16–23
- [Часть Г. CRM-интеграция (047, ресёрч завершён, реализация отложена)](#часть-г-crm-интеграция-047-ресёрч-завершён-реализация-отложена) — пункт 24
- [Часть Д. Behavior & ad analytics (058, v1 задеплоено, follow-up отложен)](#часть-д-behavior--ad-analytics-058-v1-задеплоено-follow-up-отложен) — пункты 27–29
- [Часть Е. Доставка — доработки после v1 (047+)](#часть-е-доставка--доработки-после-v1-047) — пункт 30
- [Часть Ж. Invoice & shipping unify (062, реализовано, follow-up отложен)](#часть-ж-invoice--shipping-unify-062-реализовано-follow-up-отложен) — пункты 31–34
- [Часть З. Email-уведомления — активация и follow-up (049, активировано на проде)](#часть-з-email-уведомления--активация-и-follow-up-049-активировано-на-проде) — пункты 35–38
- [Часть И. Индексация (059, задеплоено, мониторинг + owner-actions)](#часть-и-индексация-059-задеплоено-мониторинг--owner-actions) — пункты 39–42

---

## Часть А. Контент и доработки качества

## 1. Контент для конкурентно-сравнительных страниц (после `033`)

5 страниц создаются с placeholder-контентом (intro + criteria-table + FAQ + RFQ-prefill). После публикации нужно дописать:

| URL | Что добавить | Объём |
|---|---|---:|
| `/knowledge/zamena-importnyh-pdu/` | Обзорная статья: причины импортозамещения, регуляторика (44-ФЗ, 223-ФЗ, реестр Минпромторга), порядок замены, 3 типовых сценария | 1500–2000 слов |
| `/knowledge/pdu-soliton-vs-hyperline/` | Конкретное сравнение моделей Hyperline N4-CW-8 / N4-PD-8-IP vs Солитон SP-8 / S-12AB: розетки, ток, монтаж, документы, цена-диапазон, срок поставки | 1200 слов |
| `/knowledge/zamena-apc-pdu-rossijskij-analog/` | APC AP4424 / AP7900B / AP8841 vs аналоги Солитон. Параметры, реестр, что говорить закупке | 1200 слов |
| `/knowledge/analogi-vertiv-eaton-pdu/` | Vertiv Geist GU2 + Eaton ePDU G3 vs Солитон | 1200 слов |
| `/knowledge/analogi-rittal-schneider-pdu/` | Rittal DK 7856 + Schneider APC vs Солитон | 1000 слов |

**Пререкизит:** доступ к каталогам конкурентов и фотографиям референсных моделей (можно вытащить из их сайтов с правильной атрибуцией).

## 2. Уникальный контент knowledge-статей (спека `035`)

9 существующих knowledge-статей сейчас используют шаблон. Список с темами и краткими ТЗ:

| URL | Тема | Целевой объём | Ключевые секции |
|---|---|---:|---|
| `/knowledge/chto-takoe-pdu/` | Объяснение термина PDU для не-инженера | 1000 | определение, отличие от удлинителя, типы PDU, как выглядит, где применяется, ссылка на стандарты |
| `/knowledge/kak-vybrat-pdu/` | Pillar по выбору PDU | 1500 | ток и нагрузка, розетки, монтаж, защита, мониторинг, документы, чек-лист |
| `/knowledge/pdu-schuko-ili-iec-c13/` | Schuko vs IEC C13 | 900 | конструктив, совместимость, безопасность, типичные применения, гибридные конфигурации |
| `/knowledge/pdu-16a-ili-32a/` | 16A vs 32A | 900 | расчёт нагрузки, вилки, кабельные сечения, проектные случаи |
| `/knowledge/gorizontalnyj-ili-vertikalnyj-pdu/` | Форм-факторы | 1000 | плюсы/минусы каждого, как влияет на стойку, типичные ошибки |
| `/knowledge/chto-takoe-metered-pdu/` | Metered PDU | 1000 | принцип измерения, точность, передача данных, типичные ситуации |
| `/knowledge/chto-takoe-switched-pdu/` | Switched PDU | 1000 | удалённое управление, протоколы (SNMP, HTTP), use cases |
| `/knowledge/kak-rasschitat-nagruzku-na-pdu/` | Расчёт нагрузки | 1200 | формулы, примеры, запас, реальные кейсы |
| `/knowledge/pdu-s-uzip/` | УЗИП в PDU | 900 | физика перенапряжений, классы УЗИП, когда нужен, ограничения |

**Пререкизит:** инженерное согласование цифр и стандартов с производством/КБ Солитон. Ссылки на ГОСТ Р 51992, IEC 60320, IEC 60309.

## 3. Реальные контакты компании (`018-company-contacts`)

`00-source-data/company/contacts.json` сейчас содержит плейсхолдеры. Нужно от владельца:

- ИНН, КПП, ОГРН.
- Юридическое название (ООО «Солитон» или иное).
- Юридический и фактический адрес.
- Телефоны: продажи + техподдержка.
- Email: продажи + техподдержка.
- Социальные сети (если есть).
- Решение, нужно ли публиковать `LocalBusiness` JSON-LD (требует geo-координат).

## 4. Production photo для homepage hero (`020-homepage-product-first`)

Сейчас hero-картинка `apps/web/public/home/hero-manufacturing.webp` — реальное фото производства. Если запланирована фотосессия — нужно подменить на более высокое качество (минимум 1600×1280, 5:4) с тем же сюжетом.

## 5. Реальный логотип Солитон (`019-organization-jsonld`)

`apps/web/public/brand/logo.svg` — векторный плейсхолдер. Если есть фирменная графика — заменить.

## 6. Аналитика — счётчики Yandex.Metrika и GA4 (`027-analytics-verification`)

`.env` пуст по `NEXT_PUBLIC_YANDEX_METRICA_ID` и `NEXT_PUBLIC_GA4_MEASUREMENT_ID`. Нужно получить:

- Yandex.Metrika counter ID.
- (опционально) GA4 measurement ID.
- Включить server-side Measurement Protocol API key.

## 7. Цены и сроки — приведение к актуальности

`00-source-data/assortment/soliton1_assortment_raw.json` — наследие, цены могли устареть. Перед публикой:

- Проверить актуальность цен (66 SKU).
- Добавить `priceUpdatedAt` (см. `031-price-valid-until`).
- Решить судьбу позиций без цены — «Цена по запросу» или скрыть.

## 8. Media-migration финиш (`017-media-and-documents-migration`)

- 1 файл из 112 не скачался при последней миграции. Найти и докачать (см. `06-reports/06-asset-inventory.json`).
- Перевод картинок и PDF в Payload Media/Documents (сейчас отдаются из `public/legacy/` без CMS).

## 9. Sub-categories каталога — расширение списка (`034`)

Стартовый список — 10 URL (см. spec `034`). После аналитики поведения можно добавить:

- `/catalog/managed-pdu/32a/`
- `/catalog/pdu/16a-schuko/` (пересечение тока и розетки)
- `/catalog/three-phase-pdu/iec-c19/`
- по факту запросов в Search Console.

## 10. Payload public cutover (`017-payload-public-cutover`, не создана)

Все правки контента сейчас живут в TypeScript-файлах (`template-content.ts`, `seo-registry.ts`, `source-products.ts`). Менеджер не может редактировать. Полный cutover — отдельный проект.

## 11. Performance — продакшен-бенч (`036`)

Спека `036` запускает Lighthouse на dev-build. Перед запуском в продакшен:

- Запустить на production-build (`pnpm build && pnpm start`).
- Прогнать на realистичной сети (Slow 4G).
- Сделать запуск под Yandex.Metrika скрытым (`NEXT_PUBLIC_YANDEX_METRICA_ID=test`), чтобы не загрязнять рабочие данные.

## 12. Мониторинг ранжирования

После публикации:

- Регистрация в Yandex.Webmaster, Google Search Console.
- Подача sitemap.
- Подключение Яндекс.Метрика → Поисковые фразы.
- Еженедельная сводка top-50 фраз и их движение в выдаче.
- Через 4 недели — first SEO snapshot.
- Через 12 недель — оценка эффекта.

## 13. Контент-планы B2B / use-case

`/b2b/integrators/`, `/b2b/tenders/`, `/b2b/custom-pdu/` — сейчас на шаблоне. Содержательные тексты с конкретикой по процессу:

- `/b2b/integrators/`: процесс работы с интегратором, шаблон рамочного договора, типовые сроки.
- `/b2b/tenders/`: документы для 44/223-ФЗ, реестр, паспорта, типовые ТЗ.
- `/b2b/custom-pdu/`: вместо общего описания — конкретные кейсы кастомных сборок.

## 14. Open Graph improvements

Дефолтная OG-картинка сейчас генерируется через `ImageResponse`. Можно:

- Добавить вариативность по типу страницы (catalog/product/knowledge).
- Перейти на pre-rendered PNG для скорости.

---

## Часть Б. Cart and checkout (037)

Спека `037-cart-and-checkout-flows` реализована в коде (Phase 1–7), но **boevoy запуск** требует данных от владельца. До получения этих данных платёжный поток работает в mock-режиме, PDF-счёт собирается на placeholder-реквизитах.

### 15. Cart and checkout пререкизиты (фича `037-cart-and-checkout-flows`)

Перед или во время реализации Cart-фичи нужно получить от владельца:

- **Платёжный шлюз ЮKassa**: shop ID, secret key (sandbox + production). Включить сервис «Чеки» в ЮKassa для 54-ФЗ — иначе нужна отдельная интеграция с онлайн-кассой.
- **Банковские реквизиты Солитон** для PDF-счёта: расчётный счёт, банк, БИК, корр. счёт, наименование плательщика, КБК (если применимо).
- **Налоговый статус**: НДС 20% или без НДС. Если с НДС — рег. номер.
- **Доставка**: список курьеров для v1 (СДЭК / Boxberry / Почта России / самовывоз) + фиксированные тарифы или маркер «согласуется отдельно».
- ~~**SMTP / email-сервис** для отправки PDF-счетов и нотификаций. Варианты: Resend / собственный SMTP / Mailgun. Адрес отправителя, реквизит для DMARC.~~ **✅ Снято 2026-05-24:** выбран **Unisender Go** (EU-регион `go2.unisender.ru`), домен `pdumarket.ru` подтверждён, DKIM active. Адаптер `EMAIL_PROVIDER=unisender_go` подключён в `apps/web/src/lib/notifications/senders/email/unisender-go.ts`. Адрес отправителя — `orders@pdumarket.ru`. Подробности — `specs/049-customer-notifications/IMPLEMENTATION_NOTES.md` § «2026-05-24: Подключён Unisender Go». **Остаточные шаги для боевого запуска — см. п. 25.**
- **Юридические тексты**: договор-оферта для физлица, политика возврата, политика обработки персональных данных (152-ФЗ).
- **Шаблон счёта**: согласовать визуальный шаблон PDF (логотип, шапка, подвал с реквизитами, подпись/печать опционально).
- **Решение по подтверждению оплаты юрлица**: ручное менеджером или автоматическое через банковскую интеграцию (1С-Банк-клиент, OFD).

Также из P0-замечаний код-ревью спеки `037` (см. чат-историю):
- **Резолвить цены на сервере** по SKU, не доверять клиенту (security).
- **Зарегистрировать кириллический шрифт в PDFKit** для счёта (сейчас PDF битый для русского).
- **Реальная интеграция ЮKassa** вместо mock-redirect.
- **Rate-limit на `/api/orders`** (anti-spam).

### 25. Unisender Go — переход на платный тариф + boevoe тестирование (`049-customer-notifications`)

**Контекст.** На 2026-05-24 адаптер `unisender_go` подключён и подтверждён ping-вызовом + send-вызовом до уровня валидации Unisender. Аккаунт сейчас на **free-тарифе**, который запрещает отправку на внешние домены (mail.ru / gmail / yandex и т.п.) — разрешены только верифицированные домены (`pdumarket.ru`) и индивидуально verified email-адреса (через UI кабинета). Для боевого магазина это блокер: клиенты сидят на mail.ru/yandex/gmail. Поэтому реальный send-flow всё ещё в dry-run (`EMAIL_SANDBOX=true`).

**Что нужно сделать перед боевым включением email-уведомлений:**

1. **Активировать платный тариф** в кабинете Unisender Go. Минимум — ~800 ₽/мес за 500 писем/день, что покрывает 100–2000 писем/мес с большим запасом. Тариф снимает ограничение free-tier на внешних получателей.
2. **Проверить DNS-записи домена `pdumarket.ru`:**
   - **DKIM** — должен быть `unisender-go-validate.pdumarket.ru` или эквивалент по инструкции из кабинета (на 2026-05-24 статус `active`, но перепроверить после смены тарифа).
   - **SPF** — TXT-запись `pdumarket.ru` должна содержать `include:_spf.unisender-go.com` (или аналог, выданный кабинетом). Без SPF Mail.ru понижает рейтинг.
   - **DMARC** — TXT-запись `_dmarc.pdumarket.ru` с минимум `v=DMARC1; p=quarantine; rua=mailto:...`. С 2024 Mail.ru требует DMARC, иначе валит в спам.
3. **End-to-end тест отправки** — после смены тарифа повторить `node /tmp/test-unisender-send.mjs` (или новый скрипт в `apps/web/scripts/`) с получателями на трёх главных провайдерах РФ: `mail.ru`, `yandex.ru`, `gmail.com`. Проверить, что письмо приходит в **inbox**, а не в спам. Использовать [postoffice.yandex.ru](https://postoffice.yandex.ru) и [postmaster.mail.ru](https://postmaster.mail.ru) для аналитики доставляемости.
4. **Снять sandbox-режим**: `EMAIL_SANDBOX=false` в `.env.local` (для разработки) и в production env (Vercel/деплой). После этого реальные `order.paid`, `shipment.created` и т.п. начнут отправляться.
5. **Прогрев репутации**: первая неделя — не больше 10–50 писем/день, чтобы Mail.ru не закинул IP в greylist. Без прогрева возможны массовые soft-bounce.
6. **Bounce webhook** (`POST /api/webhooks/email-bounce`) — нужно настроить эндпоинт в кабинете Unisender Go для приёма уведомлений о hard bounce / spam complaint, чтобы помечать `customer.emailValid=false` после 3 hard bounce подряд (FR-4945 спеки 049). Снимает TODO «Email bounce-handling» из `specs/049-customer-notifications/IMPLEMENTATION_NOTES.md`.
7. **CRM Twenty (п. 24)** — когда дойдём до Twenty self-hosted, переиспользовать тот же аккаунт Unisender для системных писем Twenty (либо отдельный SMTP-логин из их кабинета). Тариф уже будет платный.
8. **Email отправителя для разных типов**: сейчас `EMAIL_FROM=PDU Market <orders@pdumarket.ru>`. Решить, нужны ли отдельные `noreply@`, `support@`, `manager@` — по `From` пользователи различают типы писем.

**Условие старта.** Параллельно с финализацией Cart/checkout (п. 15) — без боевого email клиент не получит подтверждение заказа. Зависимость: должен быть выпущен Cart-flow, иначе тестировать нечего.

**Не блокирует:** разработку кода 049 — он уже полностью реализован и работает в dry-run.

### 26. Production VPS pdumarket-prod — DNS cutover, первый деплой, бэкапы

**Контекст.** 2026-05-24 выделен и полностью подготовлен боевой сервер: Ubuntu 24.04 LTS на TimeWeb Cloud (4 vCPU / 7.8 GB RAM / 77 GB SSD), IP `45.144.220.45`. Сервер прошёл полный hardening, на нём установлены Docker, Traefik (v3.6, отдаёт self-signed fallback на 443 в ожидании cert), создан non-root `server` user с ключевой авторизацией. Доступ — `ssh pdumarket-prod`. Подробности — `deploy/README.md`. Креды и .env-секреты — `deploy/.secrets/`. На сервере **ещё нет** боевого деплоя soliton — пустая папка `/home/server/apps/soliton/` готова принять `rsync`.

**Что нужно сделать для запуска pdumarket.ru с нового хоста:**

1. **Написать `deploy/push.sh`** — автоматизация деплоя в одну команду. Сейчас процедура расписана в `deploy/README.md` § «Шаги деплоя» как ручные шаги (scp .env → rsync source → docker compose up --build → seed). Скрипт должен: валидировать наличие `deploy/.secrets/production-env`, делать idempotent rsync, ждать healthcheck, выполнять seed только при флаге `--seed`, печатать итог. Под mac-mini-ext эта же `push.sh` упоминалась в historic README, но никогда не существовала.
2. **Первый pre-cutover деплой** — запушить код на pdumarket-prod до DNS-cutover, проверить через `curl -skI -H 'Host: pdumarket.ru' https://45.144.220.45/`. Если 200 OK — готово.
3. **DNS cutover** — последовательность в `deploy/README.md` § «DNS cutover»:
   - снизить TTL для `pdumarket.ru` / `www.pdumarket.ru` до 300 сек минимум за час до cutover;
   - переключить A-записи на `45.144.220.45`;
   - дождаться ACME-валидации (Let's Encrypt tlsChallenge сработает автоматически при первом запросе);
   - проверить `curl -sI https://pdumarket.ru` → 200 с валидным сертификатом.
4. **mac-mini-ext** — оставить работающим под `soliton.heado.tech` (legacy test host). Его cert обновляется отдельно. Удалять до периода стабильной работы pdumarket-prod (минимум 2 недели после cutover) не надо — нужен как fallback.
5. **Backup-стратегия:**
   - Включить **снэпшоты у TimeWeb Cloud** (1 раз / 24 ч, retention 7 копий — у TimeWeb настраивается в панели, ~10–30% доплаты).
   - Настроить `cron` на pdumarket-prod: ежедневный `pg_dump` контейнера `soliton-postgres` → S3-совместимое хранилище (Yandex Object Storage / Selectel S3). Хранить 30 дней. Это второй слой на случай потери всего VPS.
   - Документировать процедуру restore — нужен runbook на 5 минут.
6. **Мониторинг и алерты (минимум):**
   - Uptime-monitor на `https://pdumarket.ru` (UptimeRobot бесплатно, проверка каждые 5 мин, e-mail-алерт).
   - Disk-usage алерт на сервере (cron + e-mail когда `/` > 80%).
   - Логи Docker — `docker logs --since 24h soliton-web` руками либо настроить `loki+grafana`/`netdata` позже.
7. **Сменить пароль root** в панели TimeWeb на длинный случайный (текущий backup-only пароль уже прошёл через несколько систем). Обновить `deploy/.secrets/production-server.md`.
8. **Перейти со static IP на reverse-DNS** для `pdumarket.ru` — попросить TimeWeb выставить PTR-запись `45.144.220.45 → mail.pdumarket.ru` или подобную; нужно для отправки писем напрямую (если когда-то откажемся от Unisender Go) и для лучшей репутации у Mail.ru/Yandex.
9. **Удалить из репозитория временные файлы**, оставшиеся от bootstrap (если что-то по ошибке утекло в git).

**Условие старта:** параллельно с финальным завершением Cart/checkout (п. 15) и переходом на платный Unisender (п. 25). Все три можно делать в один спринт — это последовательность действий «boevoe включение pdumarket.ru».

**Состояние pdumarket-prod на момент создания пункта (2026-05-24, вечер):**

- ✅ ОС, Docker, Traefik, ufw, fail2ban, unattended-upgrades, ключи — настроены
- ✅ Сеть Docker `proxy` создана, Traefik слушает 80/443
- ✅ Папка `/home/server/apps/soliton/` готова
- ✅ Production .env с DB-паролем и Payload-секретом сгенерирован (`deploy/.secrets/production-env.md`)
- ❌ Код приложения **не запушен** (пустая папка soliton)
- ❌ DNS pdumarket.ru указывает на старый mac-mini (5.189.127.125)
- ❌ Бэкапы (снэпшоты + pg_dump в S3) не настроены
- ❌ Мониторинг не настроен

---

## Часть В. AEO / AI-агенты (038–044, отложены целиком)

Спецификации `038`–`044` **созданы** (spec.md / plan.md / tasks.md), но **разработка отложена** до приоритизации. Возобновляются после прохождения SEO-стабилизации и сбора первых органических метрик. Контекст и обоснование — в чат-истории «AEO/GEO ревью на май 2026».

### 16. Spec `038-ai-bot-policy-and-analytics` — целиком отложено

Что отложено: расширение `robots.txt` под AI-bot UA, meta `max-snippet:-1`, middleware-логирование AI-bot визитов, скрипт `report:ai-bots`.

Импакт: AI-bot могут случайно блокироваться CDN/anti-DDoS-шаблонами без явного allow. Без логирования невозможно измерять долю AI-трафика.

Условие старта: после публичного запуска сайта и подключения Yandex.Metrika.

### 17. Spec `039-product-schema-enrichment` — ✅ ВЫПОЛНЕНО (2026-05-26)

**Закрыто.** Реализовано на ветке `039-product-schema-enrichment`: `Product.additionalProperty[]` через единый источник `buildKeyFacts()` (`apps/web/src/lib/products/key-facts.ts`), `mpn`/`brand`/`manufacturer`/`model`/`countryOfOrigin`, единицы UN/CEFACT (`AMP`/`MTR`/`C62`), key-facts предложение после H1 на PDP (анти-галлюцинация), `offers.availability=InStock`, Organization `@id=#organization` для резолва manufacturer/seller ref. Покрыто unit-тестом `key-facts.test.ts` (6 тестов). Аудит-обоснование — `06-reports/seo/seo-aeo-audit-2026-05.md`. Осталось: post-deploy `pnpm validate:schema` (live-gate) после мёржа.

### 18. Spec `040-machine-readable-product-feeds` — целиком отложено

Что отложено: `/feed/yandex-market.xml`, `/feed/google-merchant.xml`, `/api/products.json`, `/api/products/[sku].json`.

Импакт: нет канала в Yandex.Market → нет попадания в Алису/Нейро. Нет single-endpoint каталога для AI-агентов.

Условие старта: связано с регистрацией в Yandex.Market (organisational).

**Решение по приоритету (2026-05-28): НЕ делать сейчас.** YML — это канал монетизации/рекламы (Маркет / Я.Директ / commerce-ответы Алисы), а НЕ индексации. На попадание в органическую выдачу не влияет (это sitemap, уже сделан в 059). Делать только при срабатывании одного из триггеров:
- принято бизнес-решение **продавать на Яндекс.Маркете** (учесть: Маркет — розница, B2B-фит PDU под вопросом — покупатели идут через КП/прямые заказы);
- запускается **Я.Директ** с динамическими/смарт-объявлениями (фид нужен для них);
- нужны товарные ответы **Алисы** (тоже через Маркет).
До этого по ROI выгоднее Яндекс.Бизнес (п.41) + sameAs (п.40) + контент карточек (п.7) — см. блок «Текущие приоритеты» вверху.

### 19. Spec `041-yandex-business-and-brand-presence` — целиком отложено

Что отложено: `sameAs` в Organization JSON-LD, IndexNow integration, поле `externalProfiles[]` в contacts.

Параллельно нужны owner-actions:

- **Yandex Business**: зарегистрировать карточку организации с категорией «Электротехническое оборудование», загрузить лого, фото производства, заполнить описание.
- **Wikidata item**: создать запись о Солитон с минимальным набором claims; для прохождения модерации Wikidata желательно иметь хотя бы одну ссылку на отраслевое издание / пресс-релиз.
- **IndexNow ключ**: получить через Yandex.Webmaster, разместить файл, заполнить `INDEXNOW_KEY` в `.env`.

Импакт: без Yandex Business сайт не попадает в карточные ответы Алисы. Без `sameAs` LLM-агенты не верифицируют существование бренда.

### 20. Spec `042-article-schema-on-knowledge` — целиком отложено

Что отложено: `TechArticle`/`Article` JSON-LD на 14 knowledge-страницах, `HowTo` schema для пошаговых, видимые даты публикации/обновления.

Импакт: knowledge-страницы цитируются AI-агентами без атрибуции автора и даты — снижается trust.

Связано с пунктом 2 (рерайт knowledge-контента) — Article schema технически готовит площадку, но настоящий импакт после контент-рефакта.

### 21. Spec `043-llms-txt-and-agent-entry` — целиком отложено

Что отложено: `/llms.txt`, `/llms-full.txt`, `PotentialAction` в Organization JSON-LD.

Импакт: малый. Стандарт не индустриальный консенсус на 2026. PR-эффект для dev-аудитории + удобство для специфичных AI-клиентов.

### 22. Spec `044-mcp-server-soliton` — целиком отложено

Что отложено: создание отдельного пакета `packages/mcp-server-soliton-catalog` с tools `search_products`, `get_product`, `get_quote_estimate`, `list_categories`.

Owner-actions: получить npm namespace `@soliton`, согласовать PR-анонс.

Импакт: нишевой канал для IT-аудитории через Claude Desktop / Cursor. Реальный трафик минимальный в 2026, но technological future-proofing.

### 23. AEO-organisational-задачи

Не привязаны к конкретной спеке, но входят в общий AI-readiness:

- **CDN/Anti-DDoS whitelist для AI-bot**: убедиться, что Cloudflare/Vercel-настройки не блокируют ClaudeBot, GPTBot, PerplexityBot, Yandex-AI, GigaChat.
- **Knowledge content track для AI** (см. также п. 2): статьи в knowledge должны быть фактически точными — это качество цитирования AI-агентами. Не публиковать шаблонный контент без редакторской проверки.
- **PR-инфо в отраслевые издания** (Хабр, IT-Channel News, Comnews) — даёт внешние сигналы для Wikidata и LLM-обучения.
- **Регистрация в Google Merchant Center** (если YML feed готов, spec 040): приоритет низкий, ограничения для РФ.

---

## Часть Г. CRM-интеграция (047, ресёрч завершён, реализация отложена)

Дата ресёрча: 2026-05-18. Owner-решение: **Twenty self-hosted**. Спека `047-crm-integration` не создавалась — отложена до возобновления работы.

### 24. CRM для приёма RFQ и сделок — Twenty self-hosted

**Контекст.** Сейчас RFQ-форма складывает заявки в БД сайта (Payload). Нужна отдельная CRM для: приёма заявок, отслеживания статусов (новая → в работе → КП отправлено → выиграно/проиграно), переписки с клиентом, привязки нескольких сделок к одной организации, отгрузки и закрытия.

**Решение по итогам ресёрча.** Twenty CRM (self-hosted, v2.4+).

**Почему Twenty (на май 2026).**

- Open source, MIT-aligned (AGPL для core с возможностью commercial), активная разработка (Anthropic-style темп релизов).
- Stack совпадает с проектом: TypeScript / NestJS / PostgreSQL — не вносит дополнительной операционной нагрузки на mac-mini.
- API GraphQL + REST, webhooks, MCP-сервер из коробки (v2.0+) — естественная интеграция с агентскими сценариями.
- v2.0 app-builder + Git-backed workspaces — конфигурацию объектов можно держать в репозитории.
- 45,885⭐ на GitHub (топ open-source CRM), маркетинговый «Notion-like» UI понятен менеджерам без обучения.

**Что отвергнуто и почему.**

| Кандидат | Причина отказа |
|---|---|
| Atomic CRM (989⭐) | Слишком молодой, малая комьюнити, нет роста; преимущество MCP-first нивелируется тем, что Twenty уже даёт MCP. |
| NocoBase (22,421⭐) | Это low-code platform, не CRM «из коробки» — пришлось бы строить модель данных с нуля; избыточно. |
| ERPNext (33,934⭐) | Полный ERP — overkill для приёма заявок; Python/Frappe выпадает из стека. Возвращаться можно если нужен полноценный учёт. |
| Huly / Chatwoot / Monica | Не профильные (PM-suite / customer support / personal CRM). |
| EspoCRM / SuiteCRM / Mautic | Legacy-ощущение интерфейса, медленный темп разработки. |

**Модель данных в Twenty (как покрываются требования).**

- `Company` — клиент-организация (ИНН, юр.название, адрес).
- `Person` — контактное лицо (имя, должность, телефон, email), привязан к Company через `companyId`.
- `Opportunity` — сделка / RFQ (стадии: New → Qualified → Proposal Sent → Won / Lost), привязана к Company + Person + Product Line Items.
- **Несколько заказов на одного клиента**: каждый RFQ = отдельная Opportunity, привязанная к той же Company; история сделок видна на карточке Company.
- `Note` / `Task` / `Message` — переписка и активности на каждой Opportunity.
- Кастомные объекты v2.0 — для специфичных полей Солитон (тендер №, реестр, документы для 44/223-ФЗ).

**Owner-actions (пререкизит спеки 047).**

1. Решить: self-hosted на mac-mini рядом с soliton.heado.tech (поддомен `crm-twenty.heado.tech` под Traefik с tlsChallenge) или Twenty Cloud.
2. Если self-hosted — выделить отдельный Postgres-контейнер и volume; отдельный compose-проект (`twenty-postgres`, `twenty-server`, `twenty-front`).
3. ~~Получить SMTP для уведомлений Twenty (можно переиспользовать SMTP-реквизиты из пункта 15, Cart-and-checkout).~~ **✅ Снято 2026-05-24:** Unisender Go подключён (см. п. 15). Для Twenty SMTP-креды можно сгенерировать в том же кабинете — добавочные задачи в п. 25.
4. Создать workspace, базовые роли (admin / sales / readonly), seeding базовых объектов под доменную модель Солитон.

**Технические задачи будущей спеки 047.**

- Webhook `POST /api/rfq` на сайте → создание Opportunity в Twenty через REST API (с пробросом cart items в Opportunity line items).
- Маппинг RFQ-формы (имя, телефон, email, организация, ИНН, корзина, сообщение) → Twenty (Person + Company + Opportunity + Notes).
- Дедупликация: поиск Company по ИНН перед созданием; поиск Person по email + companyId.
- Хранение `twentyOpportunityId` в Payload-документе RFQ для двусторонней связи.
- (опц.) Двусторонний sync статусов: webhook из Twenty → обновление статуса в Payload → email клиенту.

**Состояние ресёрча.** Сравнительная таблица из 22 CRM с live-статистикой GitHub (на 2026-05-18), benchmark от marmelab 2026, обзоры NocoBase / opensourcealternatives / dench blog — изучены. Финальный отбор:

1. Twenty self-hosted v2.4 — **выбрано**.
2. Atomic CRM — отвергнуто (см. выше).
3. NocoBase — отвергнуто.
4. ERPNext — отвергнуто (резерв на случай ERP-сценария).

**Условие старта реализации.** После прохождения основного публичного запуска сайта и стабилизации Cart/checkout (пункт 15). Альтернатива — параллельно с Cart-фичей, если RFQ начнёт идти потоком до завершения checkout.

---

## Часть Д. Behavior & ad analytics (058, v1 задеплоено, follow-up отложен)

Спека `specs/058-behavior-and-ad-analytics/` (v3, Level C-Full + Agent-Driven Model) реализована в объёме **v1 MVP** и **успешно задеплоена в production** 2026-05-26 (commit на ветке `058-behavior-and-ad-analytics`, migration `20260526_130918_058_v1_analytics_attribution` применена, Yandex Metrika Stat API подтверждает поток данных). Ниже — задачи, которые сознательно отложены либо требуют ручного действия владельца.

### 27. Боевой PR-merge и smoke-test ecommerce-воронки (058 v1, операционные финалы)

**Контекст.** v1 MVP задеплоено напрямую с ветки `058-behavior-and-ad-analytics`, чтобы успеть проверить поток данных в Метрику. PR в `main` пока не открыт, ecommerce-воронка не прошла end-to-end smoke в production. Это два последних шага «формального закрытия v1».

**Что нужно сделать:**

1. **PR merge `058-behavior-and-ad-analytics` → `main`** — открыть PR, дождаться зелёного CI (`pnpm typecheck`, `pnpm lint`, `pnpm --filter @soliton/web test`), мерж squash-коммитом с конвенциональным сообщением. После мержа удалить локальную и remote-ветку, проверить что production по-прежнему собирается из `main` (повторный `./deploy/push.sh` опционально).
2. **Production smoke-test ecommerce-воронки** — пройти full path: `/catalog/<category>/` → клик на товар → PDP (должен зафайриться `view_item` + `ecommerce.detail`) → «Добавить в заявку» (`add_to_cart`) → `/cart/` (`view_cart`) → `/checkout/physical/` (5 step-events) → mock-оплата (success) → `payment_success` + server-side hit + dataLayer `purchase`. Проверить в Метрике, что все события долетели с правильным `order_id`, `revenue`, `items[]`. Особенно проверить, что server-hit отрабатывает даже с включённым AdBlock (FR-040).
3. **Verify dual-push коммерции (FR-110-115)** — открыть Метрику → Стандартные отчёты → E-commerce. Если данные не появились через 30 минут, проверить, что `ecommerce: "dataLayer"` init в `analytics-loader.ts` действительно работает в продакшене (DevTools → `window.dataLayer` должно содержать `ecommerce`-объекты, не только flat events).
4. **Verify call-tracking ready** — `TrackedPhone` / `TrackedEmail` должны фиксировать `phone_click` / `email_click` события на каждой странице. Smoke на homepage + `/company/contacts/` + footer.

**Условие старта.** Сейчас. Реальный покупатель в любой момент может пройти этот путь и заметить отсутствие конверсий в Метрике — лучше отстреляться руками первыми.

**Не блокирует:** ничего критического, v1 в production уже работает.

### 28. v1.1 — Audience API filters, Qualified Visit goal mapper, Annotations admin UI

**Контекст.** В v1 сознательно отложены три фичи спеки 058, которые требуют либо отдельной OAuth-области, либо нестабильного API, либо доп UI-работы. Все три собраны в v1.1 (см. `specs/058-behavior-and-ad-analytics/spec.md` MVP-Lite breakdown).

**Что отложено:**

1. **Audience API filters** (FR-072 — FR-080). Нужно для серверной сегментации: «posetiteli s payment_success», «brand-search visitors», «B2B-формы заполнили». Требует:
   - отдельной OAuth-области `audience:write` (текущий токен агента её не покрывает — получить через `https://oauth.yandex.ru/`);
   - дополнительного `metrika-management-client.ts` метода `createSegment(definition, source)` с FR-396 MutationSource;
   - расширения `apps/web/config/metrika.config.ts` блоком `audienceSegments[]`;
   - расширения `pnpm metrika:apply-config` для apply сегментов с idempotency по `name`.
2. **Qualified Visit goal mapper.** Yandex Management API для `type: 'number'` целей (глубина просмотра) ожидает поле `depth: <int>`, а не `conditions: []`, как у `type: 'action'`. В v1 эта цель **не создана** — нужно расширить `metrika-management-client.ts` discriminated-union TypeScript-типом и добавить отдельный mapper в `apply-config`. После создания цели — обновить `06-reports/analytics/goal-mapping.md`.
3. **Annotations admin UI**. Payload-коллекция `Annotations` создана и принимает записи через `POST /api/annotations` (deploy/campaign/incident-маркеры — для последующей корреляции в недельных отчётах). UI в админке работает базовый — не хватает: фильтра по `kind`, кнопки «push to Metrika annotation» (требует Annotations API в Yandex Management), кнопки «attach to weekly report». Сейчас аннотации остаются локальными, в Метрику не отправляются.

**Условие старта.** После того, как накопится первый месяц данных в v1 и появится потребность во «вглубь-копать» отчётах. v1.1 — это не блокер, а enhancement.

**Не блокирует:** ничего. v1 без этих трёх фич полностью функционален.

### 29. Forever-Manual ops + критическая ротация OAuth-токена (058 ops-runbook)

**Контекст.** Ряд операций по Метрике сознательно вынесены в **Forever-Manual** — их либо не покрывает Management API стабильно, либо они требуют live OAuth-prompt, либо это селективное удаление данных по 152-ФЗ (DSAR), которое не должно автоматизироваться по соображениям безопасности.

**Постоянные ручные операции (operator-guide):**

1. **Counter-settings (Webvisor 100%, IP-anonymization, in_one_line code-flag)** — Yandex Management API схема нестабильна (POST на counter возвращает 400 на `code_options.in_one_line`). Эти три флага зашиты руками через UI кабинета Метрики на counter `109422539` и проверяются глазами 1 раз / месяц. Документировать чек-лист в `06-reports/analytics/operator-guide.md`.
2. **DNS CNAME для first-party** — `mc.pdumarket.ru → mc.yandex.ru` (для tag-firstparty). На 2026-05-26 CNAME **ещё не создан** в TimeWeb DNS. После создания обновить `analytics-loader.ts` константу `FIRST_PARTY_HOST` и передеплоить. Без этого Safari ITP режет cookie через 7 дней.
3. **OAuth re-prompt раз в год** — токен Yandex.OAuth протухает по политике, нужен ручной refresh через `https://oauth.yandex.ru/authorize?response_type=token&client_id=...`. Документировать в operator-guide на дату `expires_at`.
4. **Selective Webvisor delete (152-ФЗ DSAR)** — при запросе субъекта ПДн на удаление, поиск записи Webvisor в кабинете → удаление руками. Управление API не покрывает фильтрацию по `ymClientId` для Webvisor.
5. **Я.Директ offline-conversion активация** — `YM_AGENT_TOKEN` уже задеплоен в env, endpoint `/api/analytics/server-hit` подключает offline API при `payment_success`. Но до первого реального purchase в production проверить нечего. После первой реальной оплаты:
   - проверить, что offline-conversion долетел в Метрику (Целевые действия → Источники → Я.Директ) с правильным `yclid`;
   - проверить, что Я.Директ-кампания (когда будет запущена) получает данные для post-click оптимизации.

**⚠️ Критическая разовая задача — ротация утёкшего OAuth-токена:**

Live OAuth-токен Yandex.Metrika (`y0__wgBEKvJthAYlbBCII6wn9UXtmS5lnPK8f30GWQE3fsY5gQK80g` — указан здесь намеренно для трекинга, токен уже скомпрометирован) был вставлен в чат-историю и попал в Anthropic conversation logs. **Не сохранён в git**, но всё равно требуется немедленная ротация:

1. Зайти в `https://oauth.yandex.ru/client/<client-id>` под аккаунтом владельца.
2. **Revoke** текущий токен.
3. Создать новый OAuth-приложение или новый токен в существующем приложении с теми же scope: `metrika:read`, `metrika:write`.
4. Обновить `.env.local` → `YM_AGENT_TOKEN=<новый>`.
5. Обновить `deploy/.secrets/production-env` через тот же Python-скрипт, что и при первом деплое (без вывода значения в stdout).
6. Передеплоить через `./deploy/push.sh` без флага `--seed`.
7. Smoke-проверка: `pnpm metrika:validate-config` (должен вернуть `OK: 14 goals match config`).

**Условие старта.** Ротация — **немедленно**, остальное — после первого реального purchase / при первом OAuth-протуханье / при first-DSAR-запросе.

**Не блокирует:** работу v1 (Stat API уже подтвердил поток данных), но скомпрометированный токен — потенциальная брешь до момента отзыва.

---

## Часть Е. Доставка — доработки после v1 (047+)

### 30. Per-provider настройки схемы вывоза (senderPickupType)

**Контекст.** В текущей реализации (ветка `058`, май 2026) `senderPickupType` — глобальная настройка: один флаг `"courier" | "dropoff"` применяется ко всем провайдерам ApiShip одновременно. В запросе к калькулятору ApiShip передаётся единое `pickupTypes: [1]` или `pickupTypes: [2]`.

Это работает корректно **только при одном активном провайдере (СДЭК)**. При подключении второго провайдера возникает системная проблема:

| Провайдер | Курьерский вывоз (`pickupType=1`) | Самовывоз в офис (`pickupType=2`) |
|---|---|---|
| СДЭК | ✅ есть | ✅ есть |
| Boxberry | ❌ нет | ✅ есть |
| Почта России | ❌ нет | ✅ есть |

Если выставить глобальный `senderPickupType = "courier"` → запрос уходит с `pickupTypes=[1]` → Boxberry и Почта России не возвращают ни одного тарифа, хотя у них есть варианты через самовывоз. Покупатель не увидит их дешёвые тарифы вообще.

**Что нужно сделать при добавлении второго провайдера:**

1. **Добавить per-provider конфигурацию в `ApiShipSettings`** — поле `providerSettings: Array<{ providerKey: string; senderPickupType: "courier" | "dropoff"; dropoffAddress?: string }>` в Payload Global `ApiShipSettings` вместо (или рядом с) глобального `senderPickupType`.

2. **Рефакторинг `toCalculatorRequest`** — принимать `pickupType: 1 | 2` напрямую, а не брать из глобального settings. Вызывающий код (`provider.ts` `calculate()`) должен делать отдельный вызов для каждого провайдера с его `pickupType`.

3. **Рефакторинг `calculate()` в `provider.ts`** — вместо одного запроса с `providerKeys` = все провайдеры: итерировать по per-provider конфигурации, для каждого провайдера делать отдельный API-запрос с `providerKeys: [key]` и нужным `pickupTypes`. Результаты объединять.

4. **Миграция DB** — добавить массив `providerSettings` в таблицу `apiship_settings`, перенести текущий глобальный `senderPickupType` как значение для `providerKey: "cdek"`.

**Текущий workaround.** Глобальный `senderPickupType = "dropoff"` (самовывоз в офис СДЭК) — корректен для СДЭК и будет корректен для Boxberry/Почты России тоже (они оба поддерживают только dropoff). Проблема возникнет только если СДЭК настраивается на `"courier"` (курьерский вывоз), а остальные провайдеры — нет.

**Условие старта.** При подключении второго провайдера доставки через ApiShip. До тех пор текущая архитектура достаточна.

**Файлы, которые затрагивает рефакторинг:**
- `apps/web/src/globals/ApiShipSettings.ts`
- `apps/web/src/lib/shipping/apiship/settings.ts`
- `apps/web/src/lib/shipping/apiship/mappers.ts` (`toCalculatorRequest`)
- `apps/web/src/lib/shipping/apiship/provider.ts` (`calculate()`)
- Новый файл миграции в `apps/web/src/migrations/`

---

## Часть Ж. Invoice & shipping unify (062, реализовано, follow-up отложен)

### 31. DEFERRED-062-A — Финальная очистка enum `delivery_method` от значения `'tc'`

**Контекст.** В рамках спеки 062 enum `delivery_method` мигрирован: новые значения — `pickup` / `apiship` / `own_carrier`. Старое значение `'tc'` оставлено в enum как transitional compat для existing-записей (Postgres не поддерживает `DROP VALUE` для enum напрямую — нужен type-recreate).

**Что нужно сделать (R3 step B из `specs/062-invoice-shipping-unify/research.md`):**

1. Убедиться, что в таблице `orders` нет ни одной записи с `delivery.method = 'tc'` (запрос: `SELECT count(*) FROM orders WHERE delivery_method = 'tc';` должен вернуть 0).
2. Выполнить type-recreate procedure:
   - создать новый enum `delivery_method_new` со значениями `pickup | apiship | own_carrier`;
   - `ALTER TABLE orders ALTER COLUMN delivery_method TYPE delivery_method_new USING delivery_method::text::delivery_method_new`;
   - `DROP TYPE delivery_method`;
   - `ALTER TYPE delivery_method_new RENAME TO delivery_method`.
3. Отразить изменение в новом файле миграции `apps/web/src/migrations/`.

**Условие старта.** 2–3 месяца наблюдения, что в новых записях `tc` не появляется (никто из legacy-клиентов больше не шлёт это значение).

**Не блокирует:** работу 062 v1 — `'tc'` уже не принимается на write-path (см. пункт 32).

**Owner:** TBD.

### 32. DEFERRED-062-B — Удалить soft-mapping `tc → own_carrier` из `apps/web/src/app/api/orders/route.ts`

**Контекст.** На POST-эндпоинте создания заказа сохранён transitional compat: если клиент шлёт `delivery.method = 'tc'`, бекенд молча мапит это на `'own_carrier'`. Это позволяет старым SPA-сборкам (закешированный JS) продолжать работать сразу после релиза 062.

**Что нужно сделать:**

1. Удалить блок soft-mapping в `apps/web/src/app/api/orders/route.ts`.
2. Заменить на 400-ошибку валидации: «`delivery.method='tc'` deprecated, используйте `own_carrier`».
3. Проверить, что у всех клиентов выкачан свежий SPA-bundle (по метрикам Метрики — нет старых ymClientId с устаревшим referer-bundle hash).

**Условие старта.** 1–2 месяца после релиза 062, когда уверены, что все клиенты обновили SPA.

**Не блокирует:** ничего — мапинг сейчас работает прозрачно для клиента.

**Owner:** TBD.

### 33. DEFERRED-062-C — Настроить goal `shipping_mode_changed` в Yandex.Метрика

**Контекст.** Спека 062 добавила новое аналитическое событие `shipping_mode_changed` (срабатывает при переключении между режимами доставки в чекауте юрлица). Событие пушится в dataLayer через `apps/web/src/lib/analytics/events.ts`. Но в Метрике под него ещё не создана отдельная цель (goal) — поэтому в отчётах его пока нельзя сегментировать.

**Что нужно сделать:**

1. Добавить goal `shipping_mode_changed` (type `action`) в `apps/web/config/metrika.config.ts` (см. формат — рядом с существующими goals из 058).
2. Запустить `pnpm metrika:apply-config` — apply создаст goal idempotent через Metrika Management API.
3. Проверить через `pnpm metrika:validate-config` и в кабинете Метрики.
4. Обновить `06-reports/analytics/goal-mapping.md` после успешного apply.

**Условие старта.** Сразу после релиза 062 (можно в тот же спринт).

**Не блокирует:** работу 062 — событие уже пушится в dataLayer, просто пока не агрегируется в отчётах Метрики.

**Owner:** TBD.

### 34. DEFERRED-062-D — Twenty CRM mapping для `delivery.handoverNote`

**Контекст.** Спека 062 добавила поле `Order.delivery.handoverNote` (свободный комментарий покупателя ≤1000 символов — куда передать груз/контакты водителя для own_carrier, чьим транспортом самовывоз для pickup). Поле остаётся редактируемым после статуса `paid` (формальное exception из иммутабельности 051).

При активации Twenty CRM (см. `../../specs/048-twenty-crm-sync/`, сейчас `crmSettings.enabled=false`) нужно пробросить `handoverNote` в Twenty.

**Что нужно сделать:**

1. Расширить sync-mapper в `apps/web/src/lib/crm/twenty/`: добавить `handoverNote` либо в `opportunity.description` (конкатенацией к существующему текстовому полю), либо отдельным custom-field в Twenty schema.
2. Решить с владельцем: нужно ли отображать `handoverNote` в Twenty как отдельный визуальный блок (custom-field) или достаточно append к описанию.
3. Покрыть subscriber тестом — что при `update Order.delivery.handoverNote` отправляется PATCH в Twenty.

**Условие старта.** Момент активации Twenty CRM (на запуске Twenty-sync отключён, см. capability matrix `../crm-integration-pattern.md`).

**Не блокирует:** работу 062 — `handoverNote` хранится в Payload и используется в PDF-счёте и в ApiShip note, Twenty просто не получает это поле до активации.

**Owner:** TBD.

---

## Часть З. Email-уведомления — активация и follow-up (049, активировано на проде)

> Контекст: при тесте юр-чекаута (062) обнаружилось, что подсистема уведомлений 049 построена, но никогда не была активирована end-to-end на проде. В ходе 2026-05-28 активирована (Unisender Go, sandbox=false), прогнан полный happy-path цикл писем legal-заказа (T-002→T-001→T-003→T-005→T-008), 7/7 sent. Ниже — оставшийся follow-up.

### 35. DEFERRED-049-A — Перенести email-конфиг в Payload Global (сейчас через .env)

**Контекст.** Активация сделана через env-переменные (`EMAIL_PROVIDER/API_KEY/FROM/SANDBOX`, `NOTIFICATIONS_ENABLED`, `NOTIFICATION_MANAGER_EMAILS`) с env-приоритетом в `loadNotificationsSettings` (пустой Payload Global возвращал defaultValue, затирая .env — это и было причиной первых сбоев). Это работает, но конфиг живёт в `deploy/.secrets/production-env` + проброс в `docker-compose.yml`, а не в admin-UI.

**Что нужно сделать:** один раз сохранить Global `notifications-settings` через admin (provider/apiKey/from/managers/enabled/sandbox=false), после чего env можно убрать. Решить с владельцем: оставить env-driven (12-factor, проще ротация) или admin-driven (Owner правит без деплоя). Env-приоритет в коде уважает Global, если env не задан — совместимо.

**Условие старта:** когда Owner захочет править нотификации без передеплоя. **Не блокирует:** письма работают через env.

### 36. DEFERRED-049-B — `enabled`/`managers`/`sandbox` берутся из env, не из Global

**Контекст.** Связано с 35. В `settings.ts` добавлены env-override: `NOTIFICATIONS_ENABLED`, `NOTIFICATION_MANAGER_EMAILS`, `EMAIL_SANDBOX` имеют приоритет над Global. Это compromise для активации без admin-доступа.

**Что нужно сделать:** при переходе на admin-driven (35) — пересмотреть приоритеты, чтобы Global был source-of-truth. Также мелочь: при первом прогоне менеджерские svp-копии не создались из-за stale settings-cache (60s TTL) в момент emit — клиентских не коснулось; кэш инвалидируется штатно, разовый артефакт.

### 37. DEFERRED-049-C — systemd-timer вместо EnvironmentFile для CRON_SECRET

**Контекст.** `soliton-notifications.timer` (каждые 3 мин → `/api/cron/notifications`) настроен на VPS, `CRON_SECRET` захардкожен в `.service` (root-only). См. `deploy/systemd/README.md`.

**Что нужно сделать:** перейти на `EnvironmentFile=/home/server/apps/soliton/.env` + `${CRON_SECRET}` в ExecStart, чтобы не дублировать секрет и упростить ротацию. Также рассмотреть таймеры для остальных cron (`closure`, `pickup-reminder`, `stuck-alerts`, `carts-cleanup`, `returns-overdue`) — сейчас заведён только notifications.

### 38. DEFERRED-049-D — order.completed для legal-заказов не автоэмитится

**Контекст.** В 062 подключён emit `order.invoice_issued` (создание legal) и `order.paid` (ручной перевод legal в paid). Но `order.completed` (→ T-008) эмитится только из closure-cron (`lib/lifecycle/closure.ts`) по условию paid + closure-delay. В тесте T-008 эмитился искусственно через временный endpoint.

**Что нужно сделать:** убедиться, что closure-cron реально доводит legal-заказы до `completed` на проде (нужен systemd-timer для `/api/cron/closure` — см. 37) ИЛИ подключить emit при ручном переводе менеджером в completed/delivered, по аналогии с order.paid. Проверить весь lifecycle на реальном (не emit-симулированном) заказе.

**Условие старта:** перед массовым запуском B2B-продаж. **Не блокирует:** invoice + paid письма работают (основные для покупателя).

---

## Часть И. Индексация (059, задеплоено, мониторинг + owner-actions)

Спека `specs/059-indexation-launch/` реализована (code-doable ядро) и **задеплоена в production 2026-05-28** (merge `059 → main`). Сняты P0-блокеры индексации: sitemap (127 URL, 66 товаров, без localhost), robots (боевой Host, crawl-budget, без deprecated `Host`-директивы), canonical (боевой домен на статике через Dockerfile build-arg), IndexNow (key-file + Payload hooks + bulk-push 127 URL → HTTP 202). Сайт зарегистрирован и подтверждён в Яндекс.Вебмастере и Google Search Console (оба — через DNS TXT), sitemap отправлен в обе панели, счётчик Метрики `109422539` привязан к Вебмастеру.

**Операционный runbook мониторинга:** `06-reports/seo/indexation-watchlist.md` — там график D+3…D+28, шаблон недельного снимка, troubleshooting, команды проверки. Этот файл — рабочий чек-лист; пункты ниже — напоминание в общем реестре.

### 39. Мониторинг индексации D+3…D+28 (по graphику watchlist)

**Контекст.** D-day = 2026-05-28. Результаты индексации проявляются неделями (Google: главная 1–3 дня, покрытие 2–4 нед; Яндекс: 2–4 нед, до 1.5 мес для нового домена без траста).

**Контрольные точки (детали — в `06-reports/seo/indexation-watchlist.md`):**
- **D+3 (2026-05-31)** — GSC: главная «URL есть в Google».
- **D+7 (2026-06-04)** — 0 ошибок sitemap в обеих панелях; первые страницы в Яндексе.
- **D+14 (2026-06-11)** — Google ≥50%, Яндекс ≥30% покрытия + первые показы. Заполнить недельный снимок.
- **D+28 (2026-06-25)** — Google ~100%, Яндекс ≥80%; бренд «солитон pdu» в топ-10. Первый SEO-snapshot (см. п.12).

**Эскалация при отставании:** повторный `pnpm indexnow:bulk`; Request indexing для топ-страниц в GSC (лимит ~10-12/день); при массовом «Crawled — not indexed» → контент-доработка тонких PDP (см. п.7).

**Условие старта:** уже идёт. **Не блокирует:** ничего — это наблюдение.

### 40. Owner Шаг 3 — заполнить `sameAs` (внешние профили) — отложено

**Контекст.** Код готов: `createOrganizationJsonLd()` берёт `sameAs` из `socials` в `00-source-data/company/contacts.json`, `compactJsonLd` срезает пустой массив. Сейчас `socials: []` → поле не выводится (аудит видел «sameAs missing» именно поэтому). Пробел — только в данных.

**Что нужно сделать:** вписать в `00-source-data/company/contacts.json` → `socials[]` реальные URL (VK / Telegram / др.) + URL карточки Яндекс.Бизнес (после п.41). Затем редеплой → `sameAs` появится в Organization JSON-LD. Это entity-сигнал доверия для поисковиков и ИИ-агентов (FR-035 спеки 059).

**Условие старта:** вместе с п.41 (Яндекс.Бизнес даёт главный URL для sameAs) — одной правкой + одним редеплоем. **Не блокирует:** индексацию.

### 41. Owner Шаг 4 — карточка Яндекс.Бизнес — отложено

**Контекст.** Самый мощный trust-сигнал для Яндекса + вход в нейровыдачу Алисы (она берёт источники только из топ-30 органики). На момент деплоя 059 не создана.

**Что нужно сделать (owner-action):** `https://yandex.ru/business/` → создать карточку организации: категория «Электротехническое оборудование», адрес, телефон, email, фото производства (≥5), привязка к `pdumarket.ru`. После модерации (1–2 недели) — взять URL карточки и внести в `sameAs` (п.40). В Вебмастере региональность подтянется к карточке.

**Условие старта:** высокий приоритет для ускорения индексации Яндекса. **Не блокирует:** появление в индексе (но ускоряет траст + открывает Алису).

### 42. FAQPage JSON-LD на `/info/faq` — отложено (код)

**Контекст.** Аудит (`06-reports/seo/seo-aeo-audit-2026-05.md`) нашёл: на самой FAQ-странице `/info/faq` стоит `Article + Organization`, но НЕ `FAQPage` (при том что каталог/knowledge/solutions FAQPage несут). Теряется expanding-FAQ rich-result + AEO-сигнал. Контент FAQ хранится в rich-text `body` коллекции `static-pages` (057) — без структурных Q&A.

**Что нужно сделать:** добавить структурное поле `faqItems[]` (`{question, answer}`) в коллекцию `StaticPages` + миграция + рендер `FAQPage` JSON-LD из него в `StaticPageRenderer` для `category=faq` + перенос контента из `body` в `faqItems`. Не quick-win — отдельная под-итерация.

**Условие старта:** после стабилизации индексации, в AEO-эшелоне (вместе с 040/042). **Не блокирует:** индексацию `/info/faq` (страница индексируется, просто без FAQ rich-result).
