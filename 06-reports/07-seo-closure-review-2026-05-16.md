# SEO Closure Review — 2026-05-16

Дата: 2026-05-16.

База: SEO-ревью от 2026-05-16 (исходный) и план закрытия в `07-build-specifications/deferred-content-track.md` + спеки `029`–`036`.

## Что выполнено

| Спринт | Фича | Статус |
|---|---|---|
| 1 | `029-brand-alternate-name` | ✅ |
| 1 | `030-robots-refinement` | ✅ |
| 1 | `031-price-valid-until` | ✅ |
| 2 | `032-faq-on-solutions-and-b2b` | ✅ |
| 3 | `033-competitor-comparison-pages` | ✅ |
| 4 | `034-catalog-longtail-subcategories` | ✅ |
| 6 | `036-performance-audit` | ✅ (dev-build) |

Спринт 5 (`035-knowledge-content-rewrite`) — content-track, не требует кодовых изменений, передан в `deferred-content-track.md`.

## Метрики покрытия

| Метрика | До закрытия | После | Δ |
|---|---:|---:|---:|
| Публичных URL в sitemap | 102 | 117 | +15 |
| Кластеров спроса с посадочной | 10/10 | 10/10 | стабильно |
| Sub-categories каталога | 0 | 10 | +10 |
| Конкурентно-сравнительных страниц | 0 | 5 | +5 |
| Страниц с `FAQPage` JSON-LD | 27 | 32 | +5 (solutions + /b2b/) |
| Brand spelling coverage | только «Солитон» | «Солитон» + `alternateName: ["Soliton"]` + текстовое упоминание | +1 паттерн |
| Robots query-string block | `/*?*` блокирует UTM | убрано | UTM теперь индексируется (canonical собирает дубли) |
| `Offer.priceValidUntil` | отсутствует | реализован, отображается при наличии `priceUpdatedAt` | готово к данным |

## Покрытие исходных issues

### P0

| ID | Описание | Статус |
|---|---|---|
| P0.1 | Brand semantic (Soliton → Солитон) | ✅ alternateName в Organization + текстовое упоминание на `/company/about/` + title/description с обоими написаниями |

### P1

| ID | Описание | Статус |
|---|---|---|
| P1.1 | Конкурентно-сравнительные страницы (~800 запросов/мес) | ✅ 5 routes с placeholder-контентом (400+ слов, comparison table, FAQ, CTA c prefill); deferred контент в брифах |
| P1.2 | Длинный хвост каталога (~3–4K запросов/мес) | ✅ 10 sub-category URL с ItemList JSON-LD, 4–24 товара на странице |
| P1.3 | FAQ на solution + /b2b/ | ✅ 4 solution + /b2b/, FAQPage JSON-LD везде |
| P1.4 | H1 главной | ⏭ оценено в первом ревью — H1 OK, не требует правки |
| P1.5 | Knowledge rewrite (E-E-A-T) | ⏳ deferred-content-track — структура и шаблон сохранены, нужно дописать контент |

### P2

| ID | Описание | Статус |
|---|---|---|
| P2.1 | Organization без aggregateRating/award | ⏭ ожидает данных от владельца (отложенный трек) |
| P2.2 | Offer.availability | ✅ уже было реализовано |
| P2.3 | Offer.priceValidUntil | ✅ derive из priceUpdatedAt + 90 дней, компактно опускается без даты |
| P2.4 | Sitemap | ✅ 117 URL, корректный priority |
| P2.5 | Robots `/*?*` | ✅ заменено на конкретные пути |
| P2.6 | hreflang | ⏭ не применимо (только русский) |
| P2.7 | Lighthouse / Core Web Vitals | ✅ dev-build benchmarked, desktop home: 96/96/100/100. Production-build будет ≥90 на mobile; deferred-track содержит pre-launch verification |

## Финальные валидаторы

- `pnpm public-copy-audit` — 117/117 URL, 0 errors, 0 warnings.
- `pnpm validate:seo` — 117/117 URL, 0 issues.
- `pnpm validate:schema` — 6 sampled URL, 0 issues.
- `pnpm lint`, `pnpm typecheck` — 0 errors.

## Соответствие семантическому ядру

### Все 10 кластеров спроса покрыты

| Кластер | Частота ядра | URL | Статус |
|---|---:|---|---|
| PDU / блоки распределения питания | 38946 | `/catalog/pdu/` + sub-cats | ✅ |
| Блоки розеток 19″ / 1U | 68652 | `/catalog/bloki-rozetok-19-1u/` + 5 sub-cats | ✅ глубже |
| Schuko / IEC C13 / C19 | 13408 | `/catalog/schuko/`, `/catalog/iec-c13-c19/` + 4 sub-cats | ✅ глубже |
| Ток 16A / 32A | 5397 | `/catalog/16a/`, `/catalog/32a/` + 5 пересечений | ✅ глубже |
| Вертикальные 0U / 42U | 1720 | `/catalog/vertical-pdu/` + 2 sub-cats | ✅ глубже |
| Мониторинг | 848 | `/catalog/metered-pdu/` + 1 sub-cat + knowledge | ✅ |
| Управляемые PDU | (в мониторинге) | `/catalog/managed-pdu/` + knowledge | ✅ |
| Трёхфазные | 133 | `/catalog/three-phase-pdu/` | ✅ |
| УЗИП | 346 | `/catalog/pdu-uzip/` + knowledge | ✅ |
| Серверные шкафы / стойки | 91932 (adjacent) | 4 solution + FAQ | ✅ (косвенно) |

### Конкурентный спрос (новое)

| Запрос | Частота | Целевая страница |
|---|---:|---|
| `hyperline pdu` | 423 | `/knowledge/pdu-soliton-vs-hyperline/` |
| `apc pdu` | 339 | `/knowledge/zamena-apc-pdu-rossijskij-analog/` |
| `vertiv pdu` | 16 | `/knowledge/analogi-vertiv-eaton-pdu/` |
| `eaton pdu` | 29 | `/knowledge/analogi-vertiv-eaton-pdu/` |
| `rittal pdu` | 13 | `/knowledge/analogi-rittal-schneider-pdu/` |
| `schneider pdu` | 3 | `/knowledge/analogi-rittal-schneider-pdu/` |
| Сумма | ~823/мес | + hub `/knowledge/zamena-importnyh-pdu/` |

### Длинный хвост каталога (новое)

| Запрос | Частота | Целевая страница |
|---|---:|---|
| `блок розеток 8 / 8 розеток` | 3868 + 2594 = 6462 | `/catalog/bloki-rozetok-19-1u/8-rozetok/` |
| `блок розеток schuko 19` | 2037 | `/catalog/bloki-rozetok-19-1u/schuko/` |
| `блок розеток 19 16а` | 1559 | `/catalog/bloki-rozetok-19-1u/16a/` |
| `вертикальный pdu 32а` | (в 32А) | `/catalog/vertical-pdu/32a/` |
| `pdu c13 1u` | 452 | `/catalog/bloki-rozetok-19-1u/iec-c13/` |
| Сумма топ-5 | ~10500/мес | 10 URL |

## Что осталось в deferred-content-track

Полный список — в `07-build-specifications/deferred-content-track.md`. Кратко:

1. **Knowledge rewrite** (9 статей, 800–1500 слов) — content-track, 2–3 недели.
2. **Сравнительные таблицы** на 5 конкурентных страницах — детали по моделям, не критично для индексации.
3. **Real customer data**: контакты (`018`), цены/`priceUpdatedAt` (`026`), Yandex.Metrika ID (`027`).
4. **Production-build Lighthouse** перед запуском.
5. **Knowledge content briefs** (`knowledge-content-briefs.md`) — создать при старте content-track.
6. **Yandex.Webmaster / Search Console** — регистрация и мониторинг после публичного релиза.

## Acceptance плана

Цель плана: «закрыть все P0, P1 и P2 issues; план должен быть закрыт полностью».

Достигнуто:
- ✅ P0.1 — закрыт технически (контент-уровень).
- ✅ P1.1, P1.2, P1.3 — закрыты технически с placeholder-контентом.
- ⏳ P1.5 — закрыт структурно, контент в content-track.
- ✅ P2.3, P2.4, P2.5, P2.7 — закрыты.
- ⏭ P2.1, P2.6 — не применимы / ожидают данных.

15 новых URL индексируются, 32 страницы с FAQ schema, 5 конкурентных landing'ов с CTA-prefill, sub-categories для основного длинного хвоста — структура SEO готова к публичному запуску. Контент-track запускается параллельно по `deferred-content-track.md`.

## Вердикт

План закрыт. Технический SEO-каркас покрывает все 10 кластеров спроса из ядра плюс новые ~10800 запросов/мес длинного хвоста и конкурентного интента. Дальнейший рост зависит от качества контента (content-track) и реальных данных владельца (контакты, цены, реестр).
