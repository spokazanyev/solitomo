# Solitomo / Soliton Organic Site Project

Рабочая папка для проектирования нового сайта на основе ассортимента Soliton1 и подтвержденного поискового спроса.

Примечание по названию: папка названа `solitomo` по текущему рабочему названию пользователя. Исходный сайт и товарные данные собраны с `soliton1.ru`.

## Цель

Собрать из набора карточек товаров полноценную структуру сайта, которая сможет привлекать органический трафик и конвертировать его в обращения/продажи по PDU, блокам розеток и смежным товарам.

## Структура Папки

- `00-source-data/assortment` - исходная карта ассортимента и JSON с товарами.
- `00-source-data/demand` - Wordstat, семантика, динамика, SEO-матрица и вспомогательные артефакты.
- `01-site-structure` - проектирование структуры сайта и каталога.
- `02-page-design` - проектирование типов страниц и блоков.
- `03-content` - контент-архитектура, ТЗ на тексты, карточки, категории.
- `04-seo-methods` - методы поисковой оптимизации, правила, чек-листы.
- `05-implementation-roadmap` - план внедрения и выбор технологической платформы.
- `06-reports` - читабельные отчеты, собранные из рабочих данных.
- `07-build-specifications` - спецификации для разработки через Codex.
- `apps/web` - Next.js + Payload CMS приложение нового сайта.
- `.specify` - GitHub Spec Kit: конституция, шаблоны, скрипты и workflow SDD.
- `.agents/skills` - навыки Spec Kit для Codex.

## Основные Входные Документы

- [Карта ассортимента](06-reports/01-assortment-map.md)
- [Валидация спроса и семантика](06-reports/02-demand-validation-and-semantics.md)
- [Полное семантическое ядро](06-reports/03-semantic-core.md)
- [Выбор платформы для сайта и магазина](05-implementation-roadmap/platform-evaluation.md)
- [Оплата и логистика в России](05-implementation-roadmap/russia-payments-logistics.md)
- [МойСклад и движки интернет-магазинов](05-implementation-roadmap/moysklad-ecommerce-integration-evaluation.md)
- [inSales и работа через Codex](05-implementation-roadmap/insales-codex-operability.md)
- [Чек-лист пилота inSales](05-implementation-roadmap/insales-pilot-checklist.md)
- [Российские агрегаторы оплаты и доставки](05-implementation-roadmap/russian-payment-delivery-aggregators.md)
- [Мастер-план проекта](05-implementation-roadmap/master-project-plan.md)
- [Roadmap разработки](05-implementation-roadmap/development-roadmap.md)
- [SDD и GitHub Spec Kit](05-implementation-roadmap/sdd-speckit-methodology.md)
- [Пошаговый SDD-план выполнения проекта](05-implementation-roadmap/sdd-step-by-step-execution-plan.md)
- [Конституция Spec Kit](.specify/memory/constitution.md)
- [Реестр документов и спецификаций](07-build-specifications/document-register.md)
- [Спецификация аналитики и измерений](07-build-specifications/analytics-measurement-spec.md)
- [Конкурентный и конверсионный анализ](07-build-specifications/competitor-marketing-analysis.md)
- [Позиционирование и копирайтинг](07-build-specifications/copywriting-and-positioning-spec.md)
- [Визуальная система и UI](07-build-specifications/ui-design-system-spec.md)
- [Спецификация товарных данных](07-build-specifications/product-data-spec.md)
- [Спецификация характеристик и фильтров](07-build-specifications/product-attributes-spec.md)
- [Спецификация импорта товаров](07-build-specifications/product-import-spec.md)
- [Спецификация карточки товара](07-build-specifications/product-detail-page-spec.md)
- [Спецификация категорий и фильтров](07-build-specifications/category-filter-pages-spec.md)
- [Технический фундамент проекта](07-build-specifications/technical-project-foundation.md)
- [Техническая SEO-спецификация](07-build-specifications/seo-technical-spec.md)
- [SEO-матрица посадочных страниц](07-build-specifications/seo-landing-matrix.md)
- [Система шаблонов страниц](07-build-specifications/page-template-system-spec.md)
- [Главная и B2B trust](07-build-specifications/homepage-b2b-trust-spec.md)
- [Навигация и перелинковка](07-build-specifications/navigation-linking-spec.md)
- [Checkout и запрос КП](07-build-specifications/checkout-rfq-spec.md)
- [QA checklist и JTBD-проходы](07-build-specifications/qa-acceptance-checklist.md)
- [План производства контента](07-build-specifications/content-production-plan.md)

## Локальная Разработка

```bash
pnpm install
cp .env.example apps/web/.env.local
docker compose up -d postgres
pnpm dev
```

Публичная часть: `http://localhost:3000/`.

Админка Payload: `http://localhost:3000/admin`.

Базовые проверки:

```bash
pnpm lint
pnpm typecheck
DATABASE_URI=postgres://soliton:soliton_dev_password@localhost:5432/soliton PAYLOAD_SECRET=development-secret pnpm build
```

## Текущее Решение По Спросу

Потребность подтверждена. Продвигать стоит не брендовый спрос Soliton, а категорийный спрос:

- PDU / блоки распределения питания.
- Блоки розеток 19” / 1U / в стойку.
- Schuko / IEC C13 / IEC C19.
- 16A / 32A.
- Вертикальные PDU.
- Измерительные, мониторинговые и управляемые PDU.
- Трехфазные PDU.
- Use-case страницы под серверные шкафы, 19” стойки и ЦОД.

## Текущий Рабочий Шаг

Текущий SDD-этап: `013-conversion-rfq-mvp`.

МойСклад, оплата и доставка отложены до этапов после MVP. Сейчас главный приоритет - современная конверсионная витрина Soliton с каталогом PDU, сетевыми фильтрами с УЗИП, карточками и надежным приемом заявок на КП.

## Обязательные SEO И Structured Data Правила

Проект должен поддерживать соответствие актуальному словарю schema.org и рекомендациям поисковых систем по structured data. Для публичных страниц обязательны корректные JSON-LD-разметки по типу страницы: `BreadcrumbList`, `Organization`, `ItemList`, `Product`, `Offer`, `PropertyValue`, `FAQPage`, а позже `Article`, `LocalBusiness`, delivery/payment schemas при наличии подтвержденных данных.

Запрещено размечать неподтвержденные остатки, отзывы, рейтинги, сроки доставки, сертификаты, реестр или сравнительные claims. Такие поля добавляются только после появления источника данных в проекте.
