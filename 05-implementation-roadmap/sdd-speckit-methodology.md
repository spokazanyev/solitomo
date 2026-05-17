# SDD Методология Разработки Soliton Через GitHub Spec Kit

Дата: 2026-05-14.

## Решение

Разработка нового сайта Soliton должна вестись по методологии **Spec-Driven Development** с использованием **GitHub Spec Kit**.

Spec Kit уже инициализирован в рабочей папке проекта:

- `.specify/` - шаблоны, скрипты, workflow и конституция проекта;
- `.agents/skills/` - навыки Spec Kit для Codex;
- `AGENTS.md` - контекст для агента;
- `.specify/memory/constitution.md` - обязательные принципы проекта.

## Рабочий Процесс

Каждая большая функция должна проходить последовательность:

```text
$speckit-constitution
$speckit-specify
$speckit-clarify   optional
$speckit-plan
$speckit-tasks
$speckit-analyze   optional
$speckit-implement
```

На практике:

1. **Constitution** - фиксирует принципы проекта.
2. **Specify** - описывает функцию с точки зрения пользователя и бизнеса.
3. **Clarify** - снимает неоднозначности, если они есть.
4. **Plan** - превращает спецификацию в технический план.
5. **Tasks** - разбивает план на исполняемые задачи.
6. **Analyze** - проверяет согласованность артефактов.
7. **Implement** - Codex реализует задачи.

## Как Это Применяется К Soliton

Нельзя начинать разработку всего сайта одной большой задачей. Проект нужно разбить на features, каждая со своим каталогом в `specs/`.

Рекомендуемые первые features:

1. `product-catalog-foundation` - модели товаров, категорий, характеристик, импорт ассортимента.
2. `seo-site-structure` - URL, sitemap, robots, metadata, canonical, JSON-LD, посадочные.
3. `product-detail-pages` - карточки товаров, характеристики, документы, CTA, похожие товары.
4. `category-filter-pages` - категории, фильтры, SEO-тексты, перелинковка.
5. `rfq-and-cart` - корзина-заявка, запрос КП, формы юрлиц.
6. `moysklad-sync` - товары, остатки, цены, заказы, контрагенты.
7. `payments-yookassa` - онлайн-оплата, webhooks, 54-ФЗ, счета.
8. `delivery-integrations` - доставка по согласованию, ApiShip, СДЭК, Деловые Линии.
9. `analytics-and-search-monitoring` - Яндекс Метрика, GA4, Вебмастер, Search Console, события.
10. `launch-qa-and-monitoring` - проверки перед запуском, smoke tests, SEO QA.

## Роль Уже Созданных Документов

Документы в `01-site-structure`, `02-page-design`, `03-content`, `04-seo-methods`, `05-implementation-roadmap`, `06-reports`, `07-build-specifications` остаются аналитической и проектной базой.

Spec Kit будет использоваться для исполняемых feature-спецификаций.

Связь такая:

```text
Исследования и проектные документы
  -> Feature spec в specs/
  -> Technical plan
  -> Tasks
  -> Implementation by Codex
  -> Verification
```

## Что Должно Быть В Каждой Feature Spec

Минимально:

- цель функции;
- пользовательские сценарии;
- функциональные требования;
- исключения и edge cases;
- сущности данных;
- SEO-требования, если функция влияет на публичные страницы;
- аналитические события, если функция влияет на поведение пользователя;
- интеграционные требования, если есть внешние сервисы;
- критерии успеха;
- критерии приемки.

## Правила Для Codex

Codex не должен:

- реализовывать крупную функцию без spec/plan/tasks;
- делать checkout, оплату, доставку или МойСклад без отдельной спецификации;
- добавлять SEO-страницы без связи с семантическим ядром;
- добавлять аналитику только в конце проекта;
- прятать бизнес-логику в ручных настройках без документации.

Codex должен:

- начинать с feature specification;
- явно фиксировать допущения;
- создавать задачи с точными путями файлов;
- делать каждую user story независимо проверяемой;
- обновлять документы, если техническое решение меняется;
- проверять конституцию проекта перед планированием.

## Структура Spec Kit

Ожидаемая структура:

```text
.specify/
  memory/
    constitution.md
  templates/
  scripts/
  workflows/

.agents/
  skills/
    speckit-specify/
    speckit-plan/
    speckit-tasks/
    speckit-implement/

specs/
  001-product-catalog-foundation/
    spec.md
    plan.md
    research.md
    data-model.md
    contracts/
    quickstart.md
    tasks.md
```

## Первые Практические Шаги

1. Утвердить эту SDD-методологию.
2. Создать первую feature spec: `product-catalog-foundation`.
3. Сформировать план и задачи.
4. Только после этого начинать кодовую реализацию проекта.

## Источники

- GitHub Spec Kit: https://github.com/github/spec-kit
- GitHub Spec Kit docs: https://github.github.io/spec-kit/
