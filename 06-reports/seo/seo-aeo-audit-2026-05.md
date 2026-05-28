# Полный аудит SEO + семантика + AEO: pdumarket.ru

**Дата**: 2026-05-26. **Метод**: read-only краул прода (127 страниц: 61 контентных + 66 товаров) + сверка с семантическим ядром (`00-source-data/demand/`) + актуальный веб-ресёрч практик AEO/GEO и Яндекс.Нейро 2026.

**Объект**: `https://pdumarket.ru` (Next.js 16 + Payload v3, задеплоено на pdumarket-prod).

---

## TL;DR — главный вывод

**Контент и разметка — на удивление сильные** (богатая Product-схема, FAQPage+Answer на каталоге и knowledge, 100% покрытие семантического ядра лендингами, тексты 1000–5200 слов). **Но три критических build-time дефекта полностью саботируют индексацию** — и, как следствие, AEO (Алиса/Нейро берёт только сайты из топ-30 обычной выдачи).

| Что | Состояние | Вердикт |
|---|---|---|
| Контент и покрытие семядра | ✅ Отлично (100% кластеров) | Не трогать, это сильная сторона |
| On-page разметка (schema.org) | ✅ Сильная (Product/FAQ/ItemList/Org) | Точечные доработки |
| **Техническая индексируемость** | 🔴 **Сломана (localhost в sitemap/robots/canonical)** | **P0 — чинить немедленно** |
| Регистрация в Webmaster/GSC | 🔴 Не сделана | P0 |
| AEO entity-сигналы (sameAs) | 🔴 Отсутствуют | P1 |
| Машиночитаемые фиды (Алиса) | 🔴 Нет | P2 |

**Парадокс проекта**: сделана дорогая, качественная работа по контенту и микроразметке, но из-за одной build-time переменной (`NEXT_PUBLIC_SITE_URL` не запеклась) сайт фактически **невидим** для поисковиков. Хорошая новость: фикс — это 059 Phase 0, ~30 минут работы, и он разблокирует ВСЁ остальное.

---

## Track A — Технический SEO

### A1. Доступность (отлично)

- **127/127 страниц отдают HTTP 200**: 61 контентная (home, 12+8 catalog, 4 solutions, 5 b2b, 14 knowledge, 3 company, 3 documents, 5 info, 5 legal) + 66 карточек товаров `/product/<slug>/`.
- Все страницы имеют ровно **1 `<h1>`** — корректная структура заголовков.
- AI-боты (GPTBot, ClaudeBot, PerplexityBot, Bingbot, Google-Extended, YandexAdditional) получают 200 — **не заблокированы**.
- 0 дубликатов `<title>` среди 127 страниц — **каннибализации на уровне title нет**.

### A2. 🔴 КРИТИЧНО — build-time localhost (3 дефекта, один корень)

Все три проистекают из того, что `getSiteUrl()` падает в fallback `http://localhost:3000`, потому что `NEXT_PUBLIC_SITE_URL` не была доступна на этапе сборки Docker-образа (она проброшена как runtime-env, а Next.js запекает её в статические артефакты на build-time).

| Дефект | Где | Последствие |
|---|---|---|
| **robots.txt** | `Host: http://localhost:3000` + `Sitemap: http://localhost:3000/sitemap.xml` | Webmaster/GSC не примут sitemap; боты не найдут карту сайта |
| **sitemap.xml** | все `<loc>` = `http://localhost:3000/...` | sitemap невалиден для submit |
| **canonical** | 28 статических страниц: `<link rel="canonical" href="http://localhost:3000/...">` | Google/Яндекс получают canonical на несуществующий хост → деиндексация или склейка в никуда |

**28 страниц с localhost-canonical**: все `/b2b/*`, `/company/*`, `/documents/catalog/`, `/documents/certificates/`, все `/knowledge/*`, часть прочих статических. Каталог и товары рендерятся динамически — у них canonical правильный (`https://pdumarket.ru/...`). Это объясняет, почему дефект «частичный»: SSG-страницы пострадали, SSR — нет.

**Фикс**: 059 Phase 0 — `export const dynamic = "force-dynamic"` для `sitemap.ts`/`robots.ts` + для статических страниц либо то же, либо проброс `NEXT_PUBLIC_SITE_URL` как build-arg в Dockerfile. **Один фикс закрывает все три.**

### A3. 🔴 КРИТИЧНО — неполный sitemap

Sitemap содержит **61 URL и НОЛЬ товаров**. На проде существует **66 опубликованных карточек** (`/product/s-12/`, `/product/sp-8/`, …) — все линкуются из каталога, все отдают 200, но **отсутствуют в sitemap**.

Также вне sitemap (но существуют и отдают 200):
- 5 catalog-подкатегорий (`/catalog/bloki-rozetok-19-1u/16a/`, `…/schuko/`, `/catalog/iec-c13-c19/16a/`, `/catalog/vertical-pdu/42u/`, `/catalog/metered-pdu/32a/` и др. — часть в sitemap есть, проверить полноту).

Итого **~66+ ценных URL невидимы для краулеров через sitemap**. Корень — тот же build-time: `getProducts()` в `sitemap.ts` на этапе сборки не имеет доступа к БД → возвращает пусто.

**Фикс**: 059 Phase 1 (динамический sitemap → `getProducts()` отработает в runtime, товары появятся).

### A4. 🔴 Нет verification-метатегов

На `/` отсутствуют `<meta name="yandex-verification">` и `<meta name="google-site-verification">`. Сайт не зарегистрирован ни в Яндекс.Вебмастере, ни в GSC. → 059 Phase 3/4.

### A5. 🟡 Длина title и description

- **72 из 127 title > 60 символов** (риск обрезки в SERP). Почти все — товары: имена SKU длинные («Блок розеток S-32-42U-10×6C13×2-АВ Солитон…» = 108 симв.). Топ-нарушители: `/product/s-32-42u-10-6c13-x2-ab/` (108), `/product/s-6-iec320c13-uzo/` (103), `/product/s-36c13-6c19-m-3f/` (102).
- **6 товаров — description < 70 симв.** (слишком тонко для сниппета): `/product/s-pdu-1x5-20a-dc/` (38), фильтры Coral/Soral (49).
- **21 description > 160 симв.** (обрезка): худший `/product/s-18/` = **457 симв.**, `/product/spf-8-4c13-ab/` (247), `/info/return/` (205).

**Не блокер**, но снижает CTR. Фикс — шаблонная логика обрезки title/description для товаров (clamp 55–60 / 150–160).

### A6. 🟢 Прочее в норме

- HTTPS + HSTS + security-заголовки (X-Frame-Options, X-Content-Type-Options) — корректны (заполнены Traefik).
- `X-Robots-Tag: index, follow` присутствует.
- Single-locale `ru-RU` → hreflang не нужен (корректно отсутствует).
- BreadcrumbList JSON-LD — на всех типах страниц.

---

## Track B — Соответствие семантическому ядру

### B1. 🟢 Покрытие кластеров = 100%

Каждый из 10 кластеров спроса (Wordstat, регион Россия) имеет выделенный лендинг с title/H1, точно содержащими целевые фразы:

| Кластер (частота) | Лендинг | Title / H1 — соответствие |
|---|---|---|
| Серверные шкафы / стойки (91 932, adjacent) | 4× `/solutions/*` | ✅ «PDU для серверного шкафа 19 дюймов», «Питание серверной стойки 42U» |
| Блоки розеток 19″/1U (68 652) | `/catalog/bloki-rozetok-19-1u/` | ✅ «Блоки розеток 19 дюймов 1U для серверных стоек» |
| PDU / распределение питания (38 946) | `/catalog/pdu/` | ✅ «PDU и блоки розеток Солитон» |
| Schuko / IEC C13-C19 (13 408) | `/catalog/schuko/` + `/catalog/iec-c13-c19/` | ✅ две страницы под две оси |
| Ток 16A / 32A (5 397) | `/catalog/16a/` + `/catalog/32a/` | ✅ |
| Вертикальные 0U/42U (1 720) | `/catalog/vertical-pdu/` | ✅ «Вертикальные PDU … 0U / 42U» |
| Измерительные / управляемые (848) | `/catalog/metered-pdu/` + `/catalog/managed-pdu/` | ✅ |
| Брендовые / конкурентные (483, alternative) | `/knowledge/pdu-soliton-vs-hyperline/`, `/knowledge/zamena-apc-pdu-rossijskij-analog/`, `/knowledge/analogi-*` | ✅ конкурентные сравнения опубликованы |
| УЗИП / сетевые фильтры (346, adjacent) | `/catalog/pdu-uzip/` | ✅ «Сетевые фильтры 19 дюймов и PDU с УЗИП» |
| Трёхфазные PDU (133) | `/catalog/three-phase-pdu/` | ✅ |

### B2. 🟢 Контент — не skeleton, а полноценный

Landing-матрица от 2026-05-15 помечала всё как `skeleton`. **На проде это уже не так**: каталог несёт 1 000–5 200 слов (`/catalog/pdu/` = 5 238, `/catalog/vertical-pdu/` = 3 784, `/catalog/schuko/` = 3 238), knowledge ~600–860 слов, solutions ~700–780. Long-tail подкатегории (спека 034) реализованы и наполнены.

### B3. 🟢 Конкурентные сравнения (спека 033) — опубликованы

Все 5 сравнительных страниц из отложенного пункта 1 уже live и с контентом: `pdu-soliton-vs-hyperline`, `zamena-apc-pdu-rossijskij-analog`, `analogi-vertiv-eaton-pdu`, `analogi-rittal-schneider-pdu`, `zamena-importnyh-pdu` (769–861 слов). Закрывает брендовый кластер.

### B4. 🟡 Мелочи

- Двойной бренд в части title: «PDU и блоки розеток **Солитон** — каталог | **Солитон**». Не вредно, но можно убрать дублирование ради места под ключи.
- `/catalog/three-phase-pdu/` title = 32 симв. (коротко, можно обогатить: «Трёхфазные PDU 380В для ЦОД и серверных стоек | Солитон»).
- `/company/contacts/` title = 26 симв.

### B5. Вывод Track B

**Семантика — образцовая.** Это не зона роста, а актив, который сейчас **простаивает** из-за технических блокеров Track A. Как только индексация заработает — этот контент должен ранжироваться.

---

## Track C — AEO / оптимизация под ИИ-агентов

### C0. Ключевой контекст (веб-ресёрч 2026)

- **Яндекс.Алиса/Нейро берут источники ТОЛЬКО из топ-30 обычной выдачи** ([redbee](https://redbee.ru/blog/kak-popast-v-neyrovydachu-yandeks-alisy-ai-v-2026-godu/)). Без органических позиций в нейровыдачу не попасть. → **AEO в Яндексе = производная от классического SEO + индексации.** Localhost-блокеры Track A блокируют и AEO.
- 92% корреляция: страницы из топ-10 органики ↔ страницы, цитируемые в AI Overviews ([surmado](https://www.surmado.com/blog/answer-engine-optimization-aeo-geo-guide)). Нельзя «перепрыгнуть» классику.
- LLM-движки цитируют контент, который «выглядит доказательно»: экспертные цитаты (+41%), статистика (+30%), inline-ссылки на источники (+30%) ([jasper](https://www.jasper.ai/blog/geo-aeo)).
- Формула AEO-контента: question-first структура под реальные промпты, FAQ-схема с «промпт-совпадающими» вопросами, ответы-блоки по «правилу 40 слов», entity-граф (sameAs, Organization).

### C1. 🟢 Что уже сделано отлично

- **FAQPage + Question + Answer schema** на каталоге, knowledge и solutions — прямое попадание в «question-first + FAQ schema» рекомендацию 2026. Это сильнейший AEO-актив.
- **Product schema богатая**: `Product / Offer / Brand / Organization / PropertyValue / CreativeWork / BreadcrumbList` на всех 66 PDP. `PropertyValue` = `additionalProperty` (техспеки) — это фактически закрывает спеку 039 (Product schema enrichment) прямо на проде. Карточки готовы к extraction агентами.
- **ItemList** на каталог-страницах — помогает агенту понять структуру категории.
- **Organization** с `legalName`, `alternateName`, `logo`, `image`, `telephone`, `email`, `address`, `contactPoint` — сильная entity-база.
- Контент фактологичный (токи, форм-факторы, стандарты) — пригоден для цитирования.

### C2. 🔴 Entity-gap: `sameAs` отсутствует

`Organization` JSON-LD на `/` не содержит `sameAs[]`. Для LLM это разрыв «цепочки доверия» — нечем верифицировать существование бренда вовне. Нужны ссылки на Яндекс.Бизнес, соцсети, Wikidata. → спека 041 + 059 FR-035/041.

### C3. 🔴 Knowledge без Article/TechArticle

Knowledge-страницы несут `FAQPage + Answer + Question + BreadcrumbList`, но **не имеют `Article`/`TechArticle`** с `author`, `datePublished`, `dateModified`. Для AEO это критично: цитата без атрибуции автора/даты получает меньший вес доверия. → спека 042.

### C4. 🟡 Несогласованность на `/info/faq/`

Главная FAQ-страница `/info/faq/` имеет `Article + Organization`, но **НЕ `FAQPage`** — при том что каталог/knowledge/solutions FAQPage несут. Парадокс: именно на FAQ-странице нет FAQ-разметки, и она теряет expanding-FAQ rich result. Быстрый фикс.

### C5. 🔴 Нет машиночитаемых фидов

`/feed/yandex-market.xml`, `/api/products.json` → 404. Для Алисы (которая умеет «найти товар дешевле» и тянет товарные данные) YML-фид Яндекс.Маркета — прямой канал в товарную нейровыдачу. → спека 040.

### C6. 🟡 Нет llms.txt

`/llms.txt`, `/llms-full.txt` → 404. Низкий приоритет (не индустриальный консенсус), но дешёвый сигнал для AI-клиентов. → спека 043.

### C7. 🟡 AI-bot policy

Боты не заблокированы (хорошо), но robots.txt не содержит **явного** `Allow` для AI-UA и нет логирования их визитов. → спека 038 (низкий приоритет, т.к. де-факто доступ открыт).

---

## Track D — Синтез и дорожная карта

### D1. Состояние отложенных AEO-спек (038–044) по факту прода

| Спека | План | Факт на проде | Рекомендация |
|---|---|---|---|
| 039 Product schema | enrichment PDP | ✅ **Уже сделано** (Product/Offer/Brand/PropertyValue) | Закрыть как done; убрать из отложенных |
| 042 Article schema | TechArticle на knowledge | 🔴 Нет (только FAQPage) | **Активировать** — высокий AEO-импакт |
| 040 Feeds | YML/JSON каталог | 🔴 Нет | **Активировать** — канал в Алису |
| 041 Yandex Business + sameAs | entity-сигналы | 🔴 Нет sameAs, нет карточки | **Активировать** (часть в 059) |
| 038 AI-bot policy | allow + логирование | 🟡 Доступ открыт, но без explicit allow/логов | Низкий приоритет |
| 043 llms.txt | entry для агентов | 🔴 Нет | Низкий приоритет |
| 044 MCP-server | n_иш канал | 🔴 Нет | Отложить (нишевое) |

### D2. Матрица приоритетов (impact × effort)

```
ВЫСОКИЙ ИМПАКТ
   │
   │  [P0-1] Fix localhost          [P1-3] Article schema knowledge (042)
   │   sitemap/robots/canonical     [P2-1] YML-фид для Алисы (040)
   │  [P0-2] Товары в sitemap       [P1-2] sameAs + Я.Бизнес (041)
   │  [P0-3] Register Webmaster+GSC
   │  [P0-4] Verification tags
   │─────────────────────────────────────────────────────
   │  [P1-1] /info/faq → FAQPage    [P3-1] llms.txt (043)
   │  [P1-4] Title/desc clamp       [P3-2] AI-bot explicit allow (038)
   │  [P2-2] IndexNow push (059 C)  [P3-3] MCP (044)
   │
НИЗКИЙ ИМПАКТ
        НИЗКИЙ EFFORT ──────────────────────► ВЫСОКИЙ EFFORT
```

### D3. Рекомендованный порядок действий

**P0 — немедленно (всё уже в спеке 059, ~1 день):**
1. **Fix localhost** (059 Phase 0): `dynamic="force-dynamic"` на sitemap/robots + статические страницы. Один фикс → робот.txt + sitemap + 28 canonical. **Это разблокирует индексацию И AEO.**
2. **Товары + подкатегории + /legal в sitemap** (059 Phase 1): после Phase 0 `getProducts()` отработает в runtime → 66 PDP появятся.
3. **Verification + регистрация** в Webmaster/GSC (059 Phase 3/4), привязка счётчика 109422539.

**P1 — эта неделя (быстрые AEO-победы):**
4. `/info/faq/` → заменить `Article` на `FAQPage` (или добавить FAQPage). 1 файл.
5. `sameAs[]` в Organization (заглушка-массив уже предусмотрена в 059 FR-035) + завести карточку Яндекс.Бизнес (041).
6. **Article/TechArticle на 14 knowledge** с author/datePublished/dateModified (042). Высокий AEO-импакт — knowledge станут цитируемыми.
7. Шаблонный clamp title (≤60) и description (150–160) для товаров.

**P2 — спринт +1:**
8. **YML-фид Яндекс.Маркета** (040) — прямой канал в товарную нейровыдачу Алисы.
9. IndexNow push (059 Phase 5) — ускорение переиндексации.
10. Тюнинг тонких/длинных описаний (6 + 21 товар).

**P3 — потом:**
11. llms.txt (043), explicit AI-bot allow + логирование (038), MCP (044).

### D4. Что обновить в трекерах

- **Закрыть в `deferred-content-track.md`**: пункт «спека 039» — Product schema фактически на проде.
- **Разморозить/поднять приоритет**: 042 (Article), 040 (feeds), 041 (sameAs+Я.Бизнес) — они дают наибольший AEO-импакт и должны идти сразу после 059.
- **Спека 059** покрывает весь P0 + часть P1 (sameAs, IndexNow). Рекомендую реализовать 059 первой, затем мини-итерацию «059.1 AEO»: 042 + 040 + 041 + FAQPage-fix.

---

## Приложение: сводка находок по severity

| # | Severity | Находка | Трек | Фикс |
|---|---|---|---|---|
| 1 | 🔴 P0 | robots.txt + sitemap.xml = localhost | A | 059 Phase 0 |
| 2 | 🔴 P0 | 28 страниц: canonical = localhost | A | 059 Phase 0 |
| 3 | 🔴 P0 | 66 товаров вне sitemap | A | 059 Phase 1 |
| 4 | 🔴 P0 | Нет verification, не зарегистрирован в Webmaster/GSC | A | 059 Phase 3/4 |
| 5 | 🔴 P1 | Organization без sameAs (entity-gap) | C | 059 FR-035 + 041 |
| 6 | 🔴 P1 | Knowledge без Article/TechArticle | C | 042 |
| 7 | 🟡 P1 | /info/faq/ имеет Article вместо FAQPage | C | 1 файл |
| 8 | 🟡 P1 | 72 title > 60 симв. (товары) | A | шаблонный clamp |
| 9 | 🔴 P2 | Нет YML-фида для Алисы | C | 040 |
| 10 | 🟡 P2 | 6 тонких + 21 длинное description | A | шаблон |
| 11 | 🟡 P3 | Нет llms.txt | C | 043 |
| 12 | 🟢 — | Контент, семантика, Product/FAQ schema, breadcrumbs | A/B/C | НЕ ТРОГАТЬ — актив |

---

## Методология

- **Краул**: `/tmp/seo_crawl2.py` — read-only, UA «SEO-Audit/1.0», retry на 404/5xx (транзиентные из-за ISR-revalidation), задержка 0.35с. Сырые данные: `/tmp/seo_full.json` (127 страниц).
- **Семантика**: `00-source-data/demand/{semantic_core,keyword_matrix,query_clusters_auto}.json` + `06-reports/03-semantic-core.md`.
- **Структура**: `07-build-specifications/seo-landing-matrix.md`.
- **AEO-ресёрч**: практики 2026 (Surmado, Jasper, HubSpot) + Яндекс.Нейро/Алиса (redbee, ya.ru/ai).

**Источники веб-ресёрча**:
- [Answer Engine Optimization Guide 2026 — Surmado](https://www.surmado.com/blog/answer-engine-optimization-aeo-geo-guide)
- [GEO vs AEO vs SEO 2026 — Jasper](https://www.jasper.ai/blog/geo-aeo)
- [AEO trends 2026 — HubSpot](https://blog.hubspot.com/marketing/answer-engine-optimization-trends)
- [Как попасть в нейровыдачу Яндекс.Алисы 2026 — redbee](https://redbee.ru/blog/kak-popast-v-neyrovydachu-yandeks-alisy-ai-v-2026-godu/)
- [Нейросети Яндекса — ya.ru/ai](https://ya.ru/ai/)
