# Contract: Weekly Report CLI

**Spec**: [../spec.md](../spec.md) | **Requirements**: FR-090, FR-091, FR-092, FR-093

## Команда

```bash
pnpm --filter @soliton/web report:analytics:weekly [options]
```

Скрипт: `apps/web/scripts/report-analytics-weekly.mjs`.

## Опции

| Опция | Тип | Default | Назначение |
|---|---|---|---|
| `--week` | `string` (формат `YYYY-WW`) | прошлая полная неделя | Конкретная неделя (ISO-week). |
| `--from` / `--to` | `string` (ISO8601) | вычисляется из `--week` | Альтернатива произвольного диапазона. |
| `--dry-run` | boolean flag | false | Не пишет файл, выводит MD в stdout. |
| `--force` | boolean flag | false | Перезаписывает существующий weekly-файл. |
| `--no-prev-diff` | boolean flag | false | Не загружает предыдущую неделю для динамики. |

## Workflow

1. **Парсинг аргументов**. Default = «прошлая полная ISO-week» (понедельник 00:00 → воскресенье 23:59 МСК).
2. **Проверка env**. Обязательны: `YM_COUNTER_ID`, `YM_API_TOKEN`, `PAYLOAD_SECRET`, `DATABASE_URI`. Если что-то не хватает — exit 1 с понятной ошибкой.
3. **Параллельные запросы**:
   - Метрика API (см. ниже).
   - Payload Local API: `orders`, `carts`, `rfqRequests`, `annotations` за период.
4. **Aggregation**: формирование структуры данных (см. § Data shape).
5. **Diff с предыдущей неделей**: если есть файл `06-reports/analytics/YYYY-(WW-1).md`, парсится и вычисляются % изменения.
6. **Рендеринг**: template-функция `renderWeeklyReport(data)` возвращает MD-строку.
7. **Запись**: `06-reports/analytics/YYYY-WW.md`. Если файл существует и `--force` не задан — exit 2 с предупреждением.
8. **Лог**: в stdout — список секций и предупреждений (например «GSC: данные недоступны — оставлена ссылка»).

## Метрика API endpoints (v1)

Используется официальный Yandex Metrika API v1:

| Endpoint | Назначение |
|---|---|
| `GET /stat/v1/data?metrics=ym:s:visits,ym:s:uniqueVisitors,ym:s:bounceRate&date1=<from>&date2=<to>&id=<counter>` | Базовые visit-метрики. |
| `GET /stat/v1/data?metrics=ym:s:goal<id>conversionRate&id=<counter>...` | Конверсии по целям из `AnalyticsSettings.goals`. |
| `GET /stat/v1/data?metrics=ym:s:visits&dimensions=ym:s:trafficSource,ym:s:UTMSource,ym:s:UTMCampaign&id=<counter>...` | Источники / кампании. |
| `GET /stat/v1/data?metrics=ym:s:ecommercePurchases,ym:s:ecommerceRevenue&dimensions=ym:s:productName&id=<counter>...` | Электронная коммерция. |
| `GET /stat/v1/data?metrics=ym:s:visits&dimensions=ym:s:lastTrafficSource&id=<counter>...&filters=ym:s:goal<purchaseId>IsReached==0` | Брошенная корзина. |

**Лимиты**: Yandex Metrika API ~5000 запросов/день. Weekly-report использует ~15-20 запросов — далеко в лимите.

## Data shape (input в renderer)

```typescript
interface WeeklyReportData {
  meta: {
    week: string,                // 'YYYY-WW'
    from: string,                // ISO8601
    to: string,                  // ISO8601
    generatedAt: string,
    previousWeekAvailable: boolean
  },
  funnel: {
    visits: number,
    visitsToPdp: number,
    addedToCart: number,
    beganCheckout: number,
    purchased: number,
    rfqSubmitted: number
  },
  funnelDelta?: {                // % к прошлой неделе
    visits: number,
    purchased: number,
    rfqSubmitted: number
  },
  checkoutFunnel: {
    contact: number,
    shipping: number,
    payment_method: number,
    review: number,
    cta_clicked: number,
    completed: number
  },
  sources: Array<{
    channel: string,
    visits: number,
    conversions: number,
    revenue: number,
    cost?: number,               // если Я.Директ привязан
    roas?: number                // revenue / cost
  }>,
  ecommerce: {
    totalRevenue: number,
    orderCount: number,
    avgOrderValue: number,
    topProducts: Array<{ sku, name, qty, revenue }>,
    byCategory: Array<{ category, revenue, orderCount }>
  },
  search: {
    topQueries: Array<{ query, count, conversions }>,
    topZeroResultQueries: Array<{ query, count }>
  },
  b2b: {
    priceRequestClicks: number,
    innValidationFailedRate: number
  },
  qualifiedVisits: {
    count: number,
    share: number                // % от всех визитов
  },
  consent: {
    accepted: number,
    declined: number,
    noAction: number,
    acceptRate: number
  },
  cohort: {
    note: 'see Метрика «Когортный анализ»', // в v1 — только ссылка
    medianTimeToPurchaseDays: number | null
  },
  dataQuality: {
    botShare: number,
    jsErrorRate: number,
    serverHitsFailed: number     // только если есть AnalyticsHitQueue в v1.1+
  },
  annotations: Array<{ type, occurredAt, title, gitRef? }>,
  organicLinks: {                // v1 — только ссылки на Webmaster/GSC
    webmasterUrl: string,        // с pre-filled диапазоном
    gscUrl: string,
    webmasterCrawlErrorsUrl: string
  }
}
```

## MD-Template (структура output)

```markdown
# Weekly Analytics Report — YYYY, week WW

**Период**: <from> — <to>
**Сгенерирован**: <generatedAt>

## Воронка покупки
...

## Воронка checkout (5 шагов)
...

## Источники
...

## Электронная коммерция
...

## Организический канал
- [Я.Вебмастер: запросы и индекс](<webmasterUrl>)
- [GSC: performance](<gscUrl>)
- [Я.Вебмастер: ошибки обхода](<webmasterCrawlErrorsUrl>)

> В v1 эта секция содержит ссылки. Автоматический импорт — v1.1.

## Внутренний поиск
...

## B2B-сигналы
...

## Качество визита
...

## Consent rate
...

## Когортный анализ
- См. отчёт «Когортный анализ» в Метрике
- Median time-to-purchase: <X дней>

## Качество данных
...

## Аннотации недели
| Когда | Тип | Описание |
|---|---|---|
| ... | ... | ... |

## Динамика к предыдущей неделе
...
```

Шаблон хранится отдельно в `apps/web/templates/weekly-report.md.hbs` (handlebars) или как template-literal-function в скрипте. Решение принимается на этапе implementation.

## Error handling

| Сценарий | Поведение |
|---|---|
| Метрика API недоступен | Exit 1, файл не создан (FR-093). |
| Метрика API частично недоступен (один endpoint падает) | Создан файл, секция-failed помечена `**Данные недоступны: <причина>**`, exit 0 с warning в stderr. |
| Payload недоступен | Exit 1, файл не создан. |
| Файл за неделю уже существует и `--force` не задан | Exit 2 с предупреждением. |
| `--week` синтаксически невалиден | Exit 1 с описанием формата. |

## Тестируемость

**Unit test** (`apps/web/scripts/tests/report-analytics-weekly.test.mjs`):
- Mocked Metrika API + mocked Payload → проверка корректной aggregation.
- Snapshot test MD-output для фиксированного фикстурного input.
- Edge: API partial-failure → правильная пометка в MD.
- Edge: file exists без --force → exit 2.

**Acceptance test** (manual, перед launch):
- Запуск `pnpm report:analytics:weekly --dry-run --week=2026-21` → визуальная проверка MD.
- Запуск без `--dry-run` → файл создан, формат корректен.

## v1.1 расширения (для справки)

- Добавляются endpoints Webmaster API + GSC API → секции организического канала заполняются автоматически (без ссылок-заглушек).
- Добавляется секция «Кластерный анализ» и «Schema-org effectiveness».
- HTML-rendering админ-страницы `/admin/analytics-report` → читает тот же MD-файл и отрисовывает с графиками.
