# Feature Specification: Indexation Launch — максимально эффективная индексация pdumarket.ru в Яндексе и Google

**Feature Branch**: `059-indexation-launch`

**Created**: 2026-05-26

**Status**: Draft

**Input**: User description: «Максимально эффективная индексация pdumarket.ru в Яндексе и Google после боевого запуска. Цель — не „отдать sitemap и забыть“, а минимизировать время от деплоя страницы до её появления в поиске и обеспечить широкое покрытие всех публичных страниц. Найден P0-блокер: sitemap/robots отдают `http://localhost:3000`. Существует Метрика-счётчик 109422539 (спека 058) и 9 юр-страниц `/info/*` (спека 057), которые должны попасть в индекс.»

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Поисковый бот может прочитать корректный sitemap и обойти весь сайт (Priority: P1)

Поисковый робот (YandexBot / Googlebot) приходит на `pdumarket.ru/robots.txt`, читает там абсолютный URL sitemap'а с боевым доменом, скачивает sitemap, видит ≥120 проиндексируемых URL'ов (главная, каталог, продукты, knowledge, info, b2b, company) и обходит их за один сеанс.

**Why this priority**: без этого ни один из остальных шагов не работает — Webmaster/GSC откажутся принимать sitemap с localhost-URL'ами, а боты не смогут обнаружить страницы кроме главной.

**Independent Test**: `curl -s https://pdumarket.ru/sitemap.xml` показывает ≥120 `<url>` тегов со всеми `<loc>https://pdumarket.ru/...</loc>`; `curl -s https://pdumarket.ru/robots.txt` показывает `Host: https://pdumarket.ru` и `Sitemap: https://pdumarket.ru/sitemap.xml`.

**Acceptance Scenarios**:

1. **Given** сайт работает на pdumarket.ru, **When** бот делает GET `/robots.txt`, **Then** ответ содержит только абсолютные URL с боевым доменом, без `localhost`.
2. **Given** sitemap отдан, **When** бот парсит его, **Then** в нём присутствуют URL всех типов: `/`, `/catalog/<slug>/`, `/product/<slug>/`, `/knowledge/<slug>/`, `/info/<slug>/`, `/b2b/<slug>/`, `/company/<slug>/`.
3. **Given** sitemap отдан, **When** Яндекс.Вебмастер обрабатывает его через «Анализ файлов Sitemap», **Then** ошибок 0, предупреждений 0.
4. **Given** новая страница опубликована в Payload, **When** sitemap запрашивается через 1 час, **Then** новая страница присутствует в выдаче (благодаря `force-dynamic`/`revalidate: 3600`).

---

### User Story 2 — Владелец сайта подтвердил права в обеих панелях и видит данные индексации (Priority: P1)

Владелец заходит в `webmaster.yandex.ru` и `search.google.com/search-console`, добавляет `pdumarket.ru`, проходит верификацию (Яндекс — meta-tag, Google — DNS TXT в TimeWeb), submit'ит sitemap, привязывает Метрика-счётчик `109422539`, получает первые отчёты о статусе обхода через 3–7 дней.

**Why this priority**: без верификации обоих сервисов невозможно получить отчёты, увидеть ошибки обхода или ускорить попадание страниц в индекс через URL Inspection / IndexNow-побратимство. Без привязки Метрики Webmaster не понимает trust-связь сайт↔организация.

**Independent Test**: «Зелёные галки» подтверждения в обеих панелях; sitemap принят без ошибок; первая страница появляется в «Страницы в поиске» / «Indexed pages» через 3–7 дней.

**Acceptance Scenarios**:

1. **Given** meta-tag верификации Яндекса встроен через `metadata.verification.yandex`, **When** владелец нажимает «Проверить» в Webmaster, **Then** статус — «Подтверждён».
2. **Given** TXT-запись Google добавлена в DNS TimeWeb, **When** владелец нажимает «Verify» в GSC через ≥30 минут после добавления записи, **Then** статус — «Verified».
3. **Given** оба сайта верифицированы, **When** владелец сабмитит sitemap, **Then** обе панели показывают «Success / OK» без ошибок.
4. **Given** Метрика-счётчик `109422539` привязан в Webmaster (Настройки → Метрика), **When** владелец открывает раздел «Поисковые запросы», **Then** счётчик отображается как «Подключён».

---

### User Story 3 — Новые и обновлённые страницы попадают в Яндекс/Bing в течение 24 часов (Priority: P1)

Когда контент-менеджер публикует новый PDU-товар или обновляет юр-страницу `/info/payment/` в Payload-админке, сайт автоматически уведомляет Яндекс и Bing через push-протокол IndexNow. Через 24 часа эта страница уже есть в индексе Яндекса (вместо стандартных 2–4 недель ожидания краула).

**Why this priority**: для свежепубликуемого сайта (без накопленной trust-репутации) Яндекс может крауловать страницы по 2–3 недели. IndexNow — единственный механизм, гарантирующий быстрый push в Яндекс. Для динамичного каталога (новые SKU, изменение цен/наличия) это критично — иначе пользователь видит в поиске устаревшие данные.

**Independent Test**: Опубликовать новый продукт в Payload → проверить лог IndexNow ping → через 24 часа найти этот URL в индексе Яндекса (`yandex.ru/search/?text=url:pdumarket.ru/product/<новый-slug>/`).

**Acceptance Scenarios**:

1. **Given** IndexNow ключ-файл размещён по `https://pdumarket.ru/<key>.txt`, **When** боты Bing/Yandex запрашивают его, **Then** ответ HTTP 200 + сам ключ в теле.
2. **Given** товар опубликован в Payload, **When** срабатывает `afterChange` hook, **Then** IndexNow API возвращает HTTP 200/202 (успех), а в логах — запись о ping'е URL'а.
3. **Given** статическая страница `/info/<slug>/` обновлена, **When** срабатывает hook, **Then** аналогично — ping ушёл.
4. **Given** одна неделя после первого bulk-ping, **When** владелец ищет в Яндексе `site:pdumarket.ru`, **Then** видит ≥30% URL'ов из sitemap.

---

### User Story 4 — Страницы товаров и FAQ показываются с rich snippets (Priority: P2)

Когда пользователь ищет «PDU 8 розеток Schuko» в Яндексе или Google, среди результатов выдачи показывается страница `pdumarket.ru/product/sp-8/` уже с ценой, наличием, рейтингом (если есть), хлебными крошками. Когда ищет «как оплатить заказ pdumarket», в выдаче появляется expanding-блок FAQ с тремя топ-вопросами и ответами.

**Why this priority**: rich snippets повышают CTR на 30–60% по сравнению с обычным сниппетом, а высокий CTR — сигнал релевантности для поисковика, который ускоряет re-craul и улучшает позицию. Это не блокер индексации, но множитель её эффективности.

**Independent Test**: Прогнать главную, 1 PDP, 1 catalog-страницу, `/info/faq/` через Google Rich Results Test и Яндекс Валидатор микроразметки — 0 ошибок. Через 14 дней в GSC → Enhancements должны появиться карточки «Products», «Breadcrumbs», «FAQ» с ≥1 valid item.

**Acceptance Scenarios**:

1. **Given** PDP отрисована, **When** парсер вытаскивает JSON-LD, **Then** находит `Product` с обязательными полями `name`, `sku`, `brand.name`, `offers.price`, `offers.priceCurrency`, `offers.availability`, `offers.url`.
2. **Given** `/info/faq/` отрисована, **When** парсер ищет JSON-LD, **Then** находит `FAQPage` с массивом `mainEntity` ≥3 вопросов.
3. **Given** caталог-страница отрисована, **When** парсер ищет JSON-LD, **Then** находит `ItemList` с массивом `itemListElement`.
4. **Given** структурная разметка валидна, **When** через 14 дней владелец открывает GSC → Enhancements, **Then** видит ≥3 типа rich-results с ≥1 valid URL каждый.

---

### User Story 5 — Поисковики не тратят бюджет краула на технические/личные страницы (Priority: P2)

Бот, обходящий сайт, не теряет лимит запросов на сканирование `/cart/`, `/checkout/`, `/me/`, страниц с UTM-параметрами и других транзакционных/личных URL'ов. Вся выделенная квота уходит на товары, категории, юр-страницы и knowledge.

**Why this priority**: бюджет краула Google/Яндекса для нового сайта ~100–500 URL/день. Без crawl-budget оптимизации до 30–60% бюджета может уйти на бесполезные комбинации параметров корзины. С оптимизацией — 100% бюджета идёт на ценные страницы.

**Independent Test**: `curl -s https://pdumarket.ru/robots.txt` показывает `Disallow: /cart/`, `Disallow: /checkout/`, `Disallow: /payment/`, `Disallow: /me/`, `Disallow: /?*`; в GSC → Crawl Stats через 14 дней ≥90% обхода — на разрешённых URL'ах.

**Acceptance Scenarios**:

1. **Given** robots.txt опубликован, **When** бот пытается обойти `/cart/`, **Then** правило `Disallow` срабатывает, страница не индексируется.
2. **Given** в выдаче поисковика появилась бы дубль-страница с UTM-параметром, **When** canonical корректен (без UTM), **Then** дубль склеивается с канонической формой.
3. **Given** бот пытается обойти `/?utm_source=...`, **When** правило `Disallow: /?*` срабатывает, **Then** страница не индексируется (но не повлияет на главную `/`).

---

### User Story 6 — Владелец видит в одной таблице, какие страницы успешно индексируются, а какие нет (Priority: P3)

Через 14 и 28 дней после запуска индексации владелец открывает `06-reports/seo/indexation-watchlist.md`, видит таблицу-снимок текущего состояния: сколько страниц в индексе Google и Яндекса, какие из sitemap'а не попали, причины (Crawled/Not indexed, Discovered/Not indexed, Duplicate, Soft 404), какие действия предпринять.

**Why this priority**: без runbook'а владелец будет каждый раз заново разбираться, что значат термины GSC/Webmaster. Это снижает приоритет — структурно полезно, но не блокирует ничего.

**Independent Test**: Файл `06-reports/seo/indexation-watchlist.md` существует и содержит: (1) snapshot-таблицу с цифрами, (2) список «непроиндексированных» URL'ов с причинами, (3) action items на следующие 7 дней.

**Acceptance Scenarios**:

1. **Given** прошло 14 дней с D-day, **When** владелец открывает `indexation-watchlist.md`, **Then** видит актуальный snapshot с заполненными метриками покрытия.
2. **Given** покрытие Google ниже целевых 50%, **When** владелец читает раздел «Action items», **Then** видит конкретные шаги (например, «Запросить indexing для топ-10 PDP через URL Inspection»).

---

### Edge Cases

- **Сайт работает на pdumarket.ru, но IP в TimeWeb сменится** (миграция) → DNS TXT для GSC сохранится (привязан к домену, не IP). Yandex meta-tag — тоже сохранится (вшит в HTML). IndexNow ключ-файл переедет с code-base. Никаких ре-верификаций.
- **YANDEX_VERIFICATION env не выставлен на деплое** → `metadata.verification.yandex` отдаст пустую строку или `undefined` → Yandex.Webmaster не найдёт meta-tag → fallback на DNS-verify. Должно работать gracefully (не падать build).
- **Бот пришёл за sitemap во время деплоя** (5–10 сек downtime) → Traefik вернёт 502/503 → бот повторит через 1–3 минуты. Это допустимый сценарий, не блокер.
- **Payload `afterChange` hook на products срабатывает 100 раз за минуту** (массовый импорт) → IndexNow batch-ping группирует URL'ы за окно 30 секунд в один request (до 10 000 URL). Без батчинга — 100 отдельных HTTP-запросов к api.indexnow.org, что не запрещено, но неэффективно.
- **IndexNow API недоступен (503)** → ping в режиме fire-and-forget (не блокирует основную операцию), ошибка логируется, повтор НЕ делается — на следующий deploy bulk-ping подберёт пропущенные URL.
- **Сайт частично индексируется, но 30% URL'ов в Google показывают «Crawled — currently not indexed»** → это сигнал «тонкий контент» (PDP с одной фразой описания). Решение — расширить content на этих PDP (отдельная задача, выходит за scope этой фичи; в indexation-watchlist отмечается как «требует контент-доработки»).
- **Webmaster выдаёт «Часть страниц не индексируется из-за дубликатов»** → проверить canonical URL'ы; типичная причина — `/catalog/pdu/?sort=price` без canonical на `/catalog/pdu/`. Решается через `alternates.canonical` в `generateMetadata`.
- **DNS-провайдер TimeWeb не отдаёт TXT-запись Google после 4 часов** → fallback на HTML-file verify (загрузить файл, который Google выдаст, в `apps/web/public/`).

## Requirements *(mandatory)*

### Functional Requirements

#### Группа A — Sitemap и robots.txt (P0)

- **FR-001**: Маршрут `/sitemap.xml` MUST читать домен из runtime-окружения (а не build-time fallback), чтобы боевой sitemap всегда содержал актуальный `https://pdumarket.ru/...` независимо от того, был ли env-var задан на этапе сборки.
- **FR-002**: Маршрут `/robots.txt` MUST отдавать `Host: https://pdumarket.ru` и `Sitemap: https://pdumarket.ru/sitemap.xml` (абсолютный URL).
- **FR-003**: Sitemap MUST включать минимум следующие группы URL'ов: главная, все каталог-категории и подкатегории (≥10), все опубликованные продукты (≥40), все опубликованные knowledge-страницы (≥14), все опубликованные `/info/*` страницы (9), все `/b2b/*` страницы, страницы `/company/*`. Итого ≥120 URL'ов.
- **FR-004**: Каждая запись sitemap MUST содержать `<loc>`, `<lastmod>` (формат W3C datetime), `<changefreq>`, `<priority>` (0.0–1.0).
- **FR-005**: Sitemap MUST автоматически отражать новые опубликованные страницы максимум через 1 час после публикации (через revalidate или dynamic-генерацию).
- **FR-006**: robots.txt MUST явно запрещать индексацию пути: `/admin/`, `/api/`, `/_next/`, `/cart/`, `/checkout/`, `/payment/`, `/me/`, query-параметров через `/?*`.
- **FR-007**: robots.txt MUST явно разрешать главный путь `/` и все каталог/контент-страницы (через `Allow: /` или отсутствие явного `Disallow`).
- **FR-008**: robots.txt MAY запрещать SEO-сканеры третьих лиц (AhrefsBot, SemrushBot) для экономии bandwidth, но это не обязательно.

#### Группа B — Регистрация и верификация в поисковых консолях (P0)

- **FR-010**: HTML главной страницы MUST содержать `<meta name="yandex-verification" content="...">` с динамической подстановкой из env-переменной `YANDEX_VERIFICATION`. Если env пуст — meta-tag не отрисовывается (а не отдаёт пустую строку).
- **FR-011**: Сайт MUST быть верифицирован в Яндекс.Вебмастер с зелёным статусом «Подтверждён».
- **FR-012**: Сайт MUST быть верифицирован в Google Search Console как Domain property с зелёным статусом «Verified».
- **FR-013**: Sitemap `https://pdumarket.ru/sitemap.xml` MUST быть отправлен в обе панели (Webmaster → «Файлы Sitemap», GSC → «Sitemaps») и принят без ошибок («Успешно» / «Success»).
- **FR-014**: Метрика-счётчик `109422539` MUST быть привязан к Яндекс.Вебмастеру через настройки.
- **FR-015**: В Яндекс.Вебмастере MUST быть указан регион (Россия / Москва) и тип сайта (Коммерческий, Электротехника).
- **FR-016**: В обеих панелях MUST быть включены email-уведомления о критических ошибках обхода и резком падении страниц в индексе.

#### Группа C — Push-протокол IndexNow для Яндекс/Bing (P1)

- **FR-020**: Сайт MUST размещать ключ-файл IndexNow по пути `https://pdumarket.ru/<key>.txt`, где `<key>` — 32-символьный hex-токен; ответ HTTP 200, content-type `text/plain`, тело = сам ключ.
- **FR-021**: При публикации (`_status: published`) или обновлении документа в Payload-коллекциях `products`, `static-pages`, `knowledge-articles` (если такая есть) сайт MUST отправлять асинхронный POST-запрос на `https://api.indexnow.org/indexnow` с URL'ом изменённой страницы.
- **FR-022**: Сбой IndexNow ping (timeout, 5xx) MUST НЕ блокировать основную операцию (publish документа) и MUST быть залогирован для последующего разбора.
- **FR-023**: Сайт SHOULD предоставлять CLI/cron-скрипт для bulk-ping всех проиндексируемых URL'ов из sitemap (для первичной отправки сразу после setup, и для recovery после downtime IndexNow).
- **FR-024**: IndexNow ping MAY группировать несколько URL'ов в один request (до 10 000 URL за один POST) для эффективности при массовых операциях.

#### Группа D — Структурированные данные (Schema.org) (P1)

- **FR-030**: Каждая страница продукта `/product/<slug>/` MUST содержать JSON-LD `Product` с обязательными полями: `name`, `sku`, `brand` (Brand object с `name`), `offers` (Offer object с `price`, `priceCurrency: "RUB"`, `availability`, `url`).
- **FR-031**: Если для продукта известна дата окончания актуальности цены, `offers.priceValidUntil` MUST быть указан в формате ISO 8601 date.
- **FR-032**: Каждая страница категории `/catalog/<slug>/` MUST содержать JSON-LD `ItemList` с массивом `itemListElement` (минимум первые 10 товаров).
- **FR-033**: Страница `/info/faq/` MUST содержать JSON-LD `FAQPage` с массивом `mainEntity` (минимум 3 пары вопрос-ответ).
- **FR-034**: Каждая страница на сайте MUST содержать JSON-LD `BreadcrumbList` с актуальным путём от главной до текущей страницы.
- **FR-035**: JSON-LD `Organization` на главной MUST содержать поле `sameAs[]` со ссылками на внешние профили (Яндекс.Бизнес, соцсети) — массив может быть пустым, если профилей ещё нет, но поле должно быть готово к заполнению через runtime-конфиг.
- **FR-036**: Все типы JSON-LD MUST валидироваться без ошибок через Google Rich Results Test и Яндекс Валидатор микроразметки.

#### Группа E — Trust-сигналы для ускорения первичного обхода (P1)

- **FR-040**: Владелец MUST создать карточку организации в Яндекс.Бизнес с категорией «Электротехническое оборудование», адресом, телефоном, фото производства (≥5) и привязкой к pdumarket.ru.
- **FR-041**: После создания Яндекс.Бизнес карточки её URL MUST быть добавлен в `Organization.sameAs[]` JSON-LD на главной.
- **FR-042**: До публикации каждой knowledge-статьи (на момент существующих 14 шт) текст SHOULD быть загружен в Яндекс.Вебмастер → «Оригинальные тексты» для защиты авторства.

#### Группа F — Crawl-budget оптимизация и канонизация (P2)

- **FR-050**: Каждая страница сайта (главная, каталог, продукт, knowledge, info, b2b, company) MUST содержать `<link rel="canonical" href="...">` с абсолютным URL'ом канонической формы (без query-параметров, без trailing-slash отклонений, без UTM).
- **FR-051**: Страницы с query-параметрами (фильтры, сортировки, UTM-метки) MUST иметь canonical, указывающий на базовую форму без параметров.
- **FR-052**: HTTP-ответ всех проиндексируемых страниц MUST включать заголовок `X-Robots-Tag: index, follow` (или не включать `noindex`).
- **FR-053**: Страницы из «закрытых» категорий (`/cart/`, `/checkout/`, `/me/`) MUST возвращать `<meta name="robots" content="noindex, nofollow">` в HTML дополнительно к robots.txt-запрету (defense-in-depth).

#### Группа G — Мониторинг и итерации (P3)

- **FR-060**: Проект MUST содержать документ `06-reports/seo/indexation-watchlist.md` с runbook'ом для еженедельных проверок.
- **FR-061**: Runbook MUST включать чек-листы для дней D+3, D+5, D+7, D+10, D+14, D+28 с целевыми метриками.
- **FR-062**: Runbook SHOULD содержать таблицу-шаблон для weekly snapshot (URLs indexed, errors count, top queries, position changes).
- **FR-063**: Runbook MUST содержать troubleshooting-секцию с типичными ошибками («Crawled — currently not indexed», «Duplicate», «Soft 404») и предложенными действиями.

### Key Entities

- **Sitemap entry** — запись об одной публичной странице сайта: location URL, last-modified timestamp, change frequency, priority (0.0–1.0). Множество таких записей образует sitemap.xml.
- **Verification token** — строковый токен от поискового сервиса (Yandex или Google), используемый для подтверждения владения доменом. Хранится в env-переменной, отдаётся через HTML meta-tag или DNS-запись.
- **IndexNow key** — 32-символьный hex-токен, генерируется один раз; используется как доказательство владения сайтом при отправке push-уведомлений Bing/Yandex.
- **Structured data block (JSON-LD)** — встроенный в HTML страницы блок типа `Product` / `Organization` / `FAQPage` / `BreadcrumbList` / `ItemList`, описывающий семантическое содержимое страницы для поисковика.
- **Indexation snapshot** — еженедельная запись в `indexation-watchlist.md` с метриками: количество URL в индексе каждого поисковика, количество ошибок, действия на следующую неделю.
- **Trust signal** — внешняя сущность, повышающая «доверие» поисковика к сайту: карточка Яндекс.Бизнеса, привязка Метрики, оригинальные тексты в Webmaster.

## Success Criteria *(mandatory)*

### Measurable Outcomes

#### Базовая инфраструктура индексации (доступно сразу после launch)

- **SC-001**: Sitemap.xml отдаёт ≥120 проиндексируемых URL'ов, все с боевым доменом (verifiable: `curl + grep '<loc>' | wc -l ≥ 120`; `grep localhost == 0`).
- **SC-002**: Robots.txt содержит `Host: https://pdumarket.ru` и `Sitemap:` ссылку на боевой URL (verifiable: `curl + grep Host`).
- **SC-003**: Сайт верифицирован в обеих панелях («зелёная галка» в Webmaster и GSC) в течение 24 часов от старта работы по фиче.
- **SC-004**: Sitemap submit в обеих панелях завершается без ошибок при первой же попытке.
- **SC-005**: Все 4 ключевых типа страниц (главная, PDP, catalog, /info/faq) проходят валидацию структурированной разметки в Google Rich Results Test и Яндекс Микротест с 0 ошибками.

#### Скорость индексации новых страниц (через 7–14 дней)

- **SC-010**: Время от публикации новой страницы (например, нового товара) до её появления в индексе Яндекс/Bing ≤ 24 часа (через IndexNow ping).
- **SC-011**: Время от публикации новой страницы до её появления в индексе Google ≤ 7 дней (через sitemap + crawl).
- **SC-012**: Через 14 дней после старта ≥50% URL'ов из sitemap проиндексированы Google (GSC → Pages → Indexed).
- **SC-013**: Через 14 дней после старта ≥30% URL'ов из sitemap проиндексированы Яндексом (Webmaster → Страницы в поиске).

#### Качество индексации (через 14–28 дней)

- **SC-020**: Через 28 дней ≥100% URL'ов из sitemap проиндексированы Google; ≥80% — Яндексом.
- **SC-021**: 0 sitemap-ошибок в обеих панелях в течение 28 дней (Sitemap Reports → Errors).
- **SC-022**: Через 28 дней в GSC → Enhancements присутствуют ≥3 типа rich-results (Product, BreadcrumbList, FAQ) с ≥1 valid URL каждый.
- **SC-023**: Brand-search показы за неделю в Яндексе ≥200 показов; в Google ≥100 показов (через 28 дней от старта).
- **SC-024**: Бренд-запрос «солитон pdu» (или близкий вариант) ранжируется в топ-10 в обеих системах через 28 дней.

#### Эффективность crawl-budget (через 14 дней)

- **SC-030**: ≥90% запросов от поисковых ботов уходят на проиндексируемые страницы (не на `/cart/`, `/checkout/`, query-параметры). Verifiable через GSC → Crawl Stats → Crawl Requests by URL Type.
- **SC-031**: Доля «дубль-страниц» («Duplicate without user-selected canonical» в GSC) ≤5% от всех обнаруженных URL'ов через 28 дней.

#### Документация и операционная готовность

- **SC-040**: Документ `06-reports/seo/indexation-watchlist.md` существует, содержит runbook + шаблон snapshot + troubleshooting-таблицу.
- **SC-041**: Владелец может выполнить еженедельную проверку индексации за ≤15 минут, следуя runbook'у.

## Assumptions

- **A1**: Сайт развёрнут на боевом домене pdumarket.ru с валидным TLS-сертификатом от Let's Encrypt; HTTPS работает, нет смешанного контента.
- **A2**: У владельца есть Yandex-аккаунт, который владеет Метрика-счётчиком `109422539` (для seamless-привязки); и Google-аккаунт (Workspace или Gmail) для GSC.
- **A3**: У владельца есть доступ к панели TimeWeb для добавления DNS TXT-записей в зоне pdumarket.ru.
- **A4**: Контент сайта (продукты, knowledge, info) не нарушает требований законодательства РФ (152-ФЗ, 38-ФЗ о рекламе) и поисковых систем (нет мошенничества, нет cloaking).
- **A5**: На момент запуска у Солитон ещё нет внешних авторитетных backlink'ов; trust будет нарабатываться через Яндекс.Бизнес и Метрику (а не покупкой ссылок).
- **A6**: Сайт поддерживает русский язык как primary locale; hreflang не требуется (single-locale `ru-RU`).
- **A7**: TLS-сертификат отдаёт OCSP stapling и подтверждается обоими поисковиками без warning'ов (на момент написания спеки — подтверждено по результатам деплоя 058).
- **A8**: Все публичные страницы (главная, каталог, продукт, knowledge, info) уже отдают HTTP 200 и не возвращают 4xx/5xx ошибки. Это проверяется в acceptance-критериях фичи 058 (deploy verification).
- **A9**: Расширенные планы AEO (специально для AI-агентов — спеки 038–044) явно вне scope этой фичи и остаются отложенными.
- **A10**: Production environment поддерживает асинхронные `afterChange` hooks в Payload без блокировки основного потока запросов.

## Dependencies

### Internal

- **D-INT-1**: Спека 058 (Behavior & Ad Analytics) — задеплоена, Метрика-счётчик `109422539` активен; привязка к Webmaster использует именно его.
- **D-INT-2**: Спека 057 (Buyer-info Compliance) — задеплоена, 9 страниц `/info/*` опубликованы; они MUST попадать в sitemap.
- **D-INT-3**: Существующая SEO-инфраструктура: `seo-registry.ts` (registry статичных маршрутов), `getSiteUrl()`, JSON-LD `Organization` + `BreadcrumbList` на главной.
- **D-INT-4**: Payload Local API доступен для подгрузки опубликованных документов в sitemap-generator.

### External

- **D-EXT-1**: Доступ к Яндекс.Вебмастеру (https://webmaster.yandex.ru/) под Yandex-аккаунтом владельца Метрики.
- **D-EXT-2**: Доступ к Google Search Console (https://search.google.com/search-console/) под Google-аккаунтом.
- **D-EXT-3**: Доступ к панели TimeWeb для DNS-конфигурации pdumarket.ru.
- **D-EXT-4**: Доступность Yandex IndexNow endpoint (`https://api.indexnow.org/indexnow`) и его принятие от Yandex.
- **D-EXT-5**: Доступность валидаторов Google Rich Results Test и Яндекс Микротест для приёмочной проверки.
- **D-EXT-6** (опц., для FR-040): Возможность создания карточки в Яндекс.Бизнесе (требует владения адресом и телефоном организации).

## Out of Scope

Явно НЕ входит в эту фичу:

- **Полное наполнение Product schema по спеке 039** (manufacturer, countryOfOrigin, additionalProperty[], aggregateRating и др.) — здесь только минимальный набор: name, sku, brand, offers.
- **TechArticle/HowTo schema по спеке 042** для knowledge-страниц — здесь только BreadcrumbList покрывает их минимально-достаточно.
- **Machine-readable feeds (спека 040)** — YML для Я.Маркет, XML для Google Merchant. Это отдельная инициатива.
- **AEO-readiness по спекам 038, 041, 043, 044** — bot-policy, llms.txt, Wikidata, MCP-server. Эти спеки остаются отложенными.
- **Контент-доработка тонких PDP** — если после индексации Google пометит часть товаров «Crawled — currently not indexed» из-за тонкого контента, расширение текстов — отдельная задача (отложенный пункт 2/7 в deferred-content-track.md).
- **Полный SEO-аудит производительности** — спека 036 запускает Lighthouse, эта фича только просит проверить, что 4 шаблона зелёные. Полная оптимизация — отдельный спринт.
- **Конкурентно-сравнительные страницы (отложенный пункт 1)** — они не должны попасть в sitemap, пока не будут наполнены контентом.

## Risk Register

- **R1**: Build-time vs runtime разрешение домена для sitemap. Если выбрать static + build-arg в Dockerfile, любая смена домена требует rebuild. Mitigation: использовать dynamic-генерацию с revalidate ~1 час.
- **R2**: DNS-пропагация TXT-записи в TimeWeb может занять до 4 часов. Mitigation: закладывать буфер; параллельно использовать meta-tag верификацию Яндекса (быстрее).
- **R3**: Google помечает PDP с тонким контентом как «Crawled — currently not indexed». Mitigation: до submit'а проверить, что ≥30 PDP имеют ≥200 слов описания; помечать тонкие PDP как `noindex` через canonical-flag в Payload, чтобы не загрязнять покрытие.
- **R4**: IndexNow rate-limit не документирован; теоретически возможна блокировка при массовых ping'ах. Mitigation: batching до 10 000 URL/request; bulk-ping выполнять не чаще 1×/час.
- **R5**: Яндекс «Оригинальные тексты» требует загрузки ДО появления в индексе; если уже проиндексировано — функция бесполезна. Mitigation: загружать тексты сразу после верификации в Webmaster, ДО submit'а sitemap'а (или хотя бы в первые 24 часа).
- **R6**: GSC может пометить часть страниц как «Duplicate without user-selected canonical» из-за разных вариантов URL (с/без trailing slash, с/без UTM). Mitigation: жёсткое canonical в `generateMetadata` всех типов страниц.
- **R7**: Спека 057 при создании страниц `/info/*` могла оставить какие-то страницы в drafts (не опубликованы). Mitigation: перед запуском Phase 1 — sanity-check `payload.find({collection:"static-pages", where:{_status:{equals:"published"}}})`.
- **R8**: Регистрация в Яндекс.Бизнесе требует подтверждения физического адреса (письмо с кодом, телефонный звонок). Может занять 1–2 недели. Mitigation: FR-040 — P1, но не блокирует индексацию (даёт ускорение, но не нужен для появления в индексе).
