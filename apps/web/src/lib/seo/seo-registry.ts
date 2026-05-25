import type { Metadata, MetadataRoute } from "next";

export type SeoRouteType =
  | "home"
  | "catalog"
  | "solution"
  | "knowledge"
  | "b2b"
  | "document"
  | "company"
  | "info"
  | "legal";

export type SeoRoute = {
  path: string;
  type: SeoRouteType;
  h1: string;
  title: string;
  description: string;
  demandCluster: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  indexable: boolean;
  keywords: string[];
  summary: string;
  cta: string;
};

export const SITE_NAME = "Солитон";

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export const seoRoutes: SeoRoute[] = [
  {
    path: "/",
    type: "home",
    h1: "Модульные PDU и блоки розеток 19″ российского производства",
    title: "Солитон — производитель модульных PDU 19″ для серверных шкафов и ЦОД",
    description:
      "Солитон 19 лет производит модульные PDU и блоки розеток для стоек 19″, серверных шкафов и ЦОД. Купите серийную модель, закажите конфигурацию под вашу задачу или получите КП.",
    demandCluster: "PDU / блоки распределения питания",
    priority: 1,
    changeFrequency: "weekly",
    indexable: true,
    keywords: ["pdu", "блок розеток", "блок розеток 19"],
    summary:
      "Купите серийный блок розеток из каталога, закажите модульную конфигурацию под вашу стойку, запросите КП на тендер или отправьте ТЗ инженеру.",
    cta: "В каталог",
  },
  {
    path: "/catalog/pdu/",
    type: "catalog",
    h1: "PDU и блоки розеток",
    title: "PDU и блоки розеток Солитон — каталог",
    description:
      "Каталог PDU (блоков распределения питания) и блоков розеток Солитон для стоек 19 дюймов, серверных шкафов, ЦОД и телеком-инфраструктуры.",
    demandCluster: "PDU / блоки распределения питания",
    priority: 0.95,
    changeFrequency: "weekly",
    indexable: true,
    keywords: ["pdu", "блок розеток", "блок розеток pdu", "блок pdu", "pdu розетки"],
    summary:
      "Подбор по монтажу, току, типу розеток и функциям для стоек и серверных шкафов.",
    cta: "Подобрать PDU",
  },
  {
    path: "/catalog/bloki-rozetok-19-1u/",
    type: "catalog",
    h1: "Блоки розеток 19 дюймов 1U",
    title: "Блоки розеток 19 дюймов 1U для серверных стоек",
    description:
      "Горизонтальные блоки розеток 19 дюймов 1U для шкафов и стоек: Schuko, IEC C13/C19, 16A, 32A и варианты под проект.",
    demandCluster: "Блоки розеток 19 / 1U / в стойку",
    priority: 0.95,
    changeFrequency: "weekly",
    indexable: true,
    keywords: [
      "блок розеток 19",
      "блок розеток 19 1u",
      "блок розеток 1u",
      "блок розеток в стойку",
    ],
    summary:
      "Горизонтальные блоки для стоек 19 дюймов: серийные модели, характеристики и переход к КП.",
    cta: "Смотреть блоки 19 дюймов",
  },
  {
    path: "/catalog/vertical-pdu/",
    type: "catalog",
    h1: "Вертикальные PDU и блоки розеток 0U / 42U",
    title: "Вертикальные PDU Солитон для серверных стоек",
    description:
      "Вертикальные PDU и блоки розеток Солитон для стоек 0U и 42U: решения 16A, 32A, Schuko, IEC C13/C19 и проектные конфигурации.",
    demandCluster: "Вертикальные PDU / 0U / 42U",
    priority: 0.82,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["вертикальный pdu", "вертикальный блок розеток", "pdu вертикальный 32а"],
    summary:
      "Вертикальные PDU для стоек с высокой плотностью оборудования и экономией полезных юнитов.",
    cta: "Подобрать вертикальный PDU",
  },
  {
    path: "/catalog/schuko/",
    type: "catalog",
    h1: "Блоки розеток Schuko",
    title: "Блоки розеток Schuko 19 дюймов Солитон",
    description:
      "Блоки розеток Schuko для серверных шкафов и стоек 19 дюймов: 1U, 16A, варианты с выключателем и защитой.",
    demandCluster: "Типы розеток Schuko / IEC C13 / C19",
    priority: 0.88,
    changeFrequency: "weekly",
    indexable: true,
    keywords: ["блок розеток schuko", "блок розеток schuko 19", "блок розеток 19 schuko"],
    summary:
      "Посадочная под спрос по евророзеткам Schuko, где важно показать совместимость, ток и сценарии применения.",
    cta: "Смотреть Schuko PDU",
  },
  {
    path: "/catalog/iec-c13-c19/",
    type: "catalog",
    h1: "PDU и блоки розеток IEC C13 / C19",
    title: "PDU IEC C13 и C19 для серверных стоек",
    description:
      "PDU и блоки розеток IEC C13/C19 Солитон для подключения серверного и сетевого оборудования в стойках 19 дюймов.",
    demandCluster: "Типы розеток Schuko / IEC C13 / C19",
    priority: 0.88,
    changeFrequency: "weekly",
    indexable: true,
    keywords: ["pdu c13", "pdu c19", "блок розеток c13", "блок розеток iec c13"],
    summary:
      "Модели IEC C13/C19 для серверного и сетевого оборудования с проверкой нагрузки и ввода.",
    cta: "Подобрать IEC PDU",
  },
  {
    path: "/catalog/16a/",
    type: "catalog",
    h1: "Блоки розеток и PDU 16A",
    title: "PDU и блоки розеток 16A Солитон",
    description:
      "Блоки розеток и PDU 16A для стоек 19 дюймов: Schuko, IEC C13/C19, горизонтальные и проектные исполнения.",
    demandCluster: "Ток и мощность 16A / 32A",
    priority: 0.82,
    changeFrequency: "weekly",
    indexable: true,
    keywords: ["блок розеток 16а", "pdu 16a", "блок розеток 19 16а"],
    summary:
      "Модели 16A для стоек 19 дюймов с проверкой количества розеток, ввода, защиты и монтажа.",
    cta: "Смотреть PDU 16A",
  },
  {
    path: "/catalog/32a/",
    type: "catalog",
    h1: "Блоки розеток и PDU 32A",
    title: "PDU и блоки розеток 32A Солитон",
    description:
      "PDU 32A и блоки розеток для серверных стоек, ЦОД и проектных поставок: IEC C13/C19, вертикальные и трехфазные решения.",
    demandCluster: "Ток и мощность 16A / 32A",
    priority: 0.78,
    changeFrequency: "weekly",
    indexable: true,
    keywords: ["блок розеток 32а", "pdu 32a", "pdu 32a c13"],
    summary:
      "PDU 32A для стоек с повышенной нагрузкой, проектных поставок и подбора по вводу.",
    cta: "Смотреть PDU 32A",
  },
  {
    path: "/catalog/metered-pdu/",
    type: "catalog",
    h1: "Измерительные PDU и PDU с мониторингом",
    title: "PDU с мониторингом и измерительные PDU Солитон",
    description:
      "Измерительные PDU и блоки розеток с мониторингом нагрузки для серверных стоек, ЦОД и удаленного контроля питания.",
    demandCluster: "Измерительные, управляемые и мониторинговые PDU",
    priority: 0.74,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["pdu с мониторингом", "metered pdu", "monitored pdu", "блок розеток с мониторингом"],
    summary:
      "PDU с измерением и мониторингом параметров питания для контроля нагрузки в стойке.",
    cta: "Запросить PDU с мониторингом",
  },
  {
    path: "/catalog/managed-pdu/",
    type: "catalog",
    h1: "Управляемые PDU",
    title: "Управляемые PDU Солитон для удаленного контроля питания",
    description:
      "Управляемые PDU для серверных стоек: удаленное управление питанием, мониторинг, SNMP и проектные конфигурации.",
    demandCluster: "Измерительные, управляемые и мониторинговые PDU",
    priority: 0.7,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["управляемый pdu", "switched pdu", "pdu с управлением", "pdu snmp"],
    summary:
      "Подбор управляемых PDU с уточнением функций, протоколов и требований к удаленному доступу.",
    cta: "Обсудить управляемый PDU",
  },
  {
    path: "/catalog/three-phase-pdu/",
    type: "catalog",
    h1: "Трехфазные PDU",
    title: "Трехфазные PDU Солитон",
    description:
      "Трехфазные PDU и блоки розеток для проектных поставок, ЦОД и стоек с высокой нагрузкой.",
    demandCluster: "Трехфазные PDU",
    priority: 0.66,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["pdu 3 фазы", "трехфазный блок розеток", "pdu трехфазный"],
    summary:
      "Трехфазные PDU для стоек с высокой нагрузкой, ЦОД и проектных поставок.",
    cta: "Запросить трехфазный PDU",
  },
  {
    path: "/catalog/pdu-uzip/",
    type: "catalog",
    h1: "Сетевые фильтры 19 дюймов и PDU с УЗИП",
    title: "Сетевые фильтры 19 дюймов и PDU с УЗИП Солитон",
    description:
      "Стоечные сетевые фильтры 19 дюймов, PDU и блоки розеток Солитон с УЗИП и защитой для серверных шкафов и телеком-стоек.",
    demandCluster: "УЗИП и стоечные сетевые фильтры",
    priority: 0.56,
    changeFrequency: "monthly",
    indexable: true,
    keywords: [
      "сетевой фильтр 19",
      "сетевой фильтр 19 дюймов",
      "блок розеток с узип",
      "pdu с узип",
    ],
    summary:
      "Стоечные фильтры и PDU с УЗИП: розетки, ток, защита и документы уточняются по конкретной модели.",
    cta: "Запросить фильтр с УЗИП",
  },
  {
    path: "/solutions/pdu-dlya-servernogo-shkafa/",
    type: "solution",
    h1: "PDU для серверного шкафа 19 дюймов",
    title: "Как выбрать PDU для серверного шкафа 19 дюймов",
    description:
      "Подбор PDU для серверного шкафа: монтаж 1U или вертикальный, 16A или 32A, Schuko или IEC C13/C19, мониторинг и защита.",
    demandCluster: "Серверные шкафы, 19 стойки и телеком-шкафы",
    priority: 0.84,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["pdu для серверного шкафа", "блок розеток для серверного шкафа", "шкаф 19"],
    summary:
      "Помогаем перейти от параметров серверного шкафа к подходящему PDU и списку уточнений для КП.",
    cta: "Подобрать PDU для шкафа",
  },
  {
    path: "/solutions/pitanie-stojki-42u/",
    type: "solution",
    h1: "Питание серверной стойки 42U",
    title: "Питание серверной стойки 42U: выбор PDU и блоков розеток",
    description:
      "Как организовать питание стойки 42U: вертикальные PDU, 16A/32A, типы розеток, мониторинг нагрузки и резервирование.",
    demandCluster: "Серверные шкафы, 19 стойки и телеком-шкафы",
    priority: 0.76,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["шкаф 19 42u", "серверный шкаф 42u", "питание стойки 42u"],
    summary:
      "Страница для проектного спроса по стойкам 42U с акцентом на плотность, расчет нагрузки и вертикальный монтаж.",
    cta: "Получить консультацию инженера",
  },
  {
    path: "/solutions/pdu-dlya-cod/",
    type: "solution",
    h1: "PDU для ЦОД",
    title: "PDU для ЦОД и дата-центров",
    description:
      "PDU Солитон для ЦОД: проектные поставки, мониторинг, 32A, трехфазные конфигурации и документы для закупки.",
    demandCluster: "B2B use-case",
    priority: 0.74,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["pdu для цод", "pdu для дата центра", "pdu 32a"],
    summary:
      "Решения для инфраструктурных проектов, где важны документы, сроки, надежность и параметры под ТЗ.",
    cta: "Запросить КП для проекта",
  },
  {
    path: "/solutions/pdu-dlya-telekommunikacionnogo-shkafa/",
    type: "solution",
    h1: "PDU для телекоммуникационного шкафа",
    title: "PDU и блоки розеток для телекоммуникационных шкафов",
    description:
      "Блоки розеток и PDU для телекоммуникационных шкафов 19 дюймов: 1U, Schuko, IEC, 16A и проектный подбор.",
    demandCluster: "Серверные шкафы, 19 стойки и телеком-шкафы",
    priority: 0.7,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["шкаф телекоммуникационный 19", "блок розеток в стойку", "pdu 19"],
    summary:
      "Страница под телеком-сценарии, где пользователь ищет шкаф, но ему также нужен ввод питания и распределение розеток.",
    cta: "Подобрать блок розеток",
  },
  {
    path: "/b2b/",
    type: "b2b",
    h1: "PDU и блоки розеток для корпоративных поставок",
    title: "Корпоративные поставки PDU Солитон",
    description:
      "Поставка PDU и блоков розеток Солитон для компаний, интеграторов, ЦОД, тендеров и проектных закупок.",
    demandCluster: "B2B",
    priority: 0.78,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["поставка pdu", "pdu под проект", "блоки розеток оптом"],
    summary:
      "Корпоративные поставки PDU: подбор, КП, документы, сроки и работа с проектными партиями.",
    cta: "Запросить коммерческое предложение",
  },
  {
    path: "/b2b/request-quote/",
    type: "b2b",
    h1: "Запросить коммерческое предложение",
    title: "Запрос КП на PDU и блоки розеток Солитон",
    description:
      "Отправьте параметры PDU, количество, сроки и техническое задание, чтобы получить коммерческое предложение Солитон.",
    demandCluster: "Conversion",
    priority: 0.7,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["запрос кп pdu", "коммерческое предложение pdu"],
    summary:
      "Форма для запроса КП по артикулам, параметрам стойки или свободному техническому заданию.",
    cta: "Заполнить заявку",
  },
  {
    path: "/b2b/custom-pdu/",
    type: "b2b",
    h1: "PDU под заказ",
    title: "PDU под заказ и индивидуальные конфигурации Солитон",
    description:
      "Индивидуальные PDU под проект: тип розеток, ток, ввод, кабель, защита, мониторинг и документы для закупки.",
    demandCluster: "B2B custom",
    priority: 0.68,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["pdu под заказ", "кастомные pdu", "индивидуальные блоки розеток"],
    summary:
      "Страница для проектных запросов, где важно собрать параметры и не обещать нестандартное без технического подтверждения.",
    cta: "Обсудить конфигурацию",
  },
  {
    path: "/b2b/integrators/",
    type: "b2b",
    h1: "Поставки PDU для системных интеграторов",
    title: "PDU Солитон для системных интеграторов",
    description:
      "Поставки PDU и блоков розеток для интеграторов: подбор, документы, проектные партии и российское производство.",
    demandCluster: "B2B integrators",
    priority: 0.64,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["pdu для интеграторов", "поставка pdu под проект"],
    summary:
      "Раздел для партнеров и интеграторов: документы, проектные поставки и повторяемые партии.",
    cta: "Стать партнером по поставке",
  },
  {
    path: "/b2b/tenders/",
    type: "b2b",
    h1: "Документы для закупок и тендеров",
    title: "Документы Солитон для закупок и тендеров",
    description:
      "Документы для закупки PDU Солитон: реквизиты, паспорта изделий, сертификаты, описание российского производства и КП.",
    demandCluster: "B2B tenders",
    priority: 0.6,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["документы для закупки pdu", "тендер pdu", "сертификаты pdu"],
    summary:
      "Страница поддержки закупщиков: документы, статусы, подтверждения и запрос недостающих материалов.",
    cta: "Запросить документы",
  },
  {
    path: "/knowledge/chto-takoe-pdu/",
    type: "knowledge",
    h1: "Что такое PDU",
    title: "Что такое PDU и зачем он нужен в серверной стойке",
    description:
      "Понятное объяснение PDU: распределение питания в стойке, типы розеток, ток, монтаж, мониторинг и отличие от обычного удлинителя.",
    demandCluster: "Informational",
    priority: 0.58,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["что такое pdu", "power distribution unit", "pdu питание"],
    summary:
      "Краткое объяснение PDU и переход к выбору модели для серверной стойки.",
    cta: "Перейти к выбору PDU",
  },
  {
    path: "/knowledge/kak-vybrat-pdu/",
    type: "knowledge",
    h1: "Как выбрать PDU",
    title: "Как выбрать PDU для серверной стойки",
    description:
      "Критерии выбора PDU: монтаж, ток, тип розеток, количество выходов, ввод, защита, мониторинг и требования проекта.",
    demandCluster: "Informational",
    priority: 0.62,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["как выбрать pdu", "подбор pdu", "pdu для стойки"],
    summary:
      "Экспертная статья по выбору PDU: ток, монтаж, розетки, мониторинг и УЗИП с переходом в каталог.",
    cta: "Подобрать PDU по параметрам",
  },
  {
    path: "/knowledge/pdu-schuko-ili-iec-c13/",
    type: "knowledge",
    h1: "PDU Schuko или IEC C13: что выбрать",
    title: "PDU Schuko или IEC C13: различия и сценарии применения",
    description:
      "Сравнение PDU Schuko и IEC C13/C19: совместимость, нагрузка, кабели, оборудование и выбор для серверной стойки.",
    demandCluster: "Типы розеток Schuko / IEC C13 / C19",
    priority: 0.58,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["pdu schuko", "pdu c13", "schuko или iec c13"],
    summary:
      "Сравнение Schuko и IEC C13/C19 с переходом к подходящим категориям каталога.",
    cta: "Сравнить Schuko и IEC PDU",
  },
  {
    path: "/knowledge/pdu-16a-ili-32a/",
    type: "knowledge",
    h1: "PDU 16A или 32A: что выбрать",
    title: "PDU 16A или 32A: как выбрать по нагрузке",
    description:
      "Как выбрать PDU 16A или 32A: расчет нагрузки, ввод, типы розеток, запас мощности и проектные требования.",
    demandCluster: "Ток и мощность 16A / 32A",
    priority: 0.58,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["pdu 16a", "pdu 32a", "16а или 32а"],
    summary:
      "Статья для снижения ошибки выбора и перехода на категории по току.",
    cta: "Подобрать PDU по току",
  },
  {
    path: "/knowledge/gorizontalnyj-ili-vertikalnyj-pdu/",
    type: "knowledge",
    h1: "Горизонтальный или вертикальный PDU",
    title: "Горизонтальный или вертикальный PDU: отличия и выбор",
    description:
      "Сравнение горизонтального PDU 19 дюймов 1U и вертикального PDU 0U/42U для серверных стоек.",
    demandCluster: "Вертикальные PDU / 0U / 42U",
    priority: 0.54,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["горизонтальный pdu", "вертикальный pdu", "блок розеток 1u"],
    summary:
      "Помогает выбрать форм-фактор PDU: горизонтальный 1U в 19″ или вертикальный 0U в стойку.",
    cta: "Выбрать форм-фактор",
  },
  {
    path: "/knowledge/chto-takoe-metered-pdu/",
    type: "knowledge",
    h1: "Что такое metered PDU",
    title: "Что такое metered PDU и когда нужен мониторинг питания",
    description:
      "Metered PDU: измерение нагрузки, контроль тока и мощности, применение в серверных стойках и ЦОД.",
    demandCluster: "Измерительные, управляемые и мониторинговые PDU",
    priority: 0.5,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["metered pdu", "pdu с мониторингом", "измерительный pdu"],
    summary:
      "Что такое metered PDU и как PDU с мониторингом помогает контролировать нагрузку и потребление.",
    cta: "Смотреть PDU с мониторингом",
  },
  {
    path: "/knowledge/chto-takoe-switched-pdu/",
    type: "knowledge",
    h1: "Что такое switched PDU",
    title: "Что такое switched PDU и удаленное управление питанием",
    description:
      "Switched PDU: удаленное управление розетками, мониторинг, SNMP и сценарии применения в серверной инфраструктуре.",
    demandCluster: "Измерительные, управляемые и мониторинговые PDU",
    priority: 0.5,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["switched pdu", "управляемый pdu", "pdu с управлением"],
    summary:
      "Объяснение switched PDU, удаленного управления и параметров, которые нужно проверить перед заказом.",
    cta: "Обсудить управляемый PDU",
  },
  {
    path: "/knowledge/kak-rasschitat-nagruzku-na-pdu/",
    type: "knowledge",
    h1: "Как рассчитать нагрузку на PDU",
    title: "Как рассчитать нагрузку на PDU для серверной стойки",
    description:
      "Базовая логика расчета нагрузки на PDU: ток, напряжение, мощность оборудования, запас и ограничения ввода.",
    demandCluster: "Informational engineering",
    priority: 0.52,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["расчет нагрузки pdu", "нагрузка pdu", "pdu 16a 32a"],
    summary:
      "Экспертная статья для инженеров и закупщиков, которая снижает неопределенность перед запросом КП.",
    cta: "Получить расчет для проекта",
  },
  {
    path: "/knowledge/pdu-s-uzip/",
    type: "knowledge",
    h1: "PDU с УЗИП: когда нужна защита",
    title: "PDU с УЗИП и защита питания серверной стойки",
    description:
      "Когда нужен PDU с УЗИП или стоечный сетевой фильтр, чем отличаются типы защиты и что проверять в характеристиках.",
    demandCluster: "УЗИП и стоечные сетевые фильтры",
    priority: 0.48,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["pdu с узип", "блок розеток с узип", "сетевой фильтр 19"],
    summary:
      "Когда нужна защита УЗИП в стойке и какие параметры проверить в документации изделия.",
    cta: "Подобрать защиту питания",
  },
  {
    path: "/catalog/bloki-rozetok-19-1u/8-rozetok/",
    type: "catalog",
    h1: "Блоки розеток 19″ 1U с 8 розетками",
    title: "Блок розеток 19 8 розеток — серверная стойка | Солитон",
    description:
      "Блоки розеток 1U в стойку 19 дюймов с 8 розетками: Schuko и IEC C13, 16A, ввод через шнур или IEC.",
    demandCluster: "Блоки розеток 19 / 1U / в стойку",
    priority: 0.74,
    changeFrequency: "weekly",
    indexable: true,
    keywords: ["блок розеток 8", "блок розеток 19 8 розеток", "pdu 8 розеток 19"],
    summary:
      "Серийные 1U-модели с 8 розетками для типовой серверной стойки. Schuko и IEC, 16A.",
    cta: "Открыть подкатегорию",
  },
  {
    path: "/catalog/bloki-rozetok-19-1u/16-rozetok/",
    type: "catalog",
    h1: "Блоки розеток 19″ 1U с 16+ розетками",
    title: "Блок розеток 16 розеток 19 дюймов | Солитон",
    description:
      "Плотные 1U-модели с 16 и более розетками для серверных стоек и ЦОД. Schuko, IEC C13/C19, 16A.",
    demandCluster: "Блоки розеток 19 / 1U / в стойку",
    priority: 0.7,
    changeFrequency: "weekly",
    indexable: true,
    keywords: ["блок розеток 16", "блок розеток 16 розеток", "pdu 16 розеток"],
    summary:
      "1U-блоки с высокой плотностью розеток для ЦОД и проектных стоек.",
    cta: "Открыть подкатегорию",
  },
  {
    path: "/catalog/bloki-rozetok-19-1u/schuko/",
    type: "catalog",
    h1: "Блоки розеток Schuko 19″ 1U",
    title: "Блок розеток Schuko 19 дюймов 1U | Солитон",
    description:
      "Горизонтальные блоки розеток 1U с евророзетками Schuko для серверной стойки и телеком-шкафа.",
    demandCluster: "Типы розеток Schuko / IEC C13 / C19",
    priority: 0.72,
    changeFrequency: "weekly",
    indexable: true,
    keywords: ["блок розеток schuko 19", "блок розеток schuko 1u", "schuko 19 дюймов"],
    summary:
      "1U-модели Schuko: горизонтальный монтаж, типичная евророзеточная конфигурация.",
    cta: "Открыть подкатегорию",
  },
  {
    path: "/catalog/bloki-rozetok-19-1u/iec-c13/",
    type: "catalog",
    h1: "Блоки розеток IEC C13 19″ 1U",
    title: "Блок розеток IEC C13 19 дюймов 1U | Солитон",
    description:
      "Горизонтальные блоки 1U с розетками IEC320 C13 для серверного и сетевого оборудования с IEC-кабелем.",
    demandCluster: "Типы розеток Schuko / IEC C13 / C19",
    priority: 0.7,
    changeFrequency: "weekly",
    indexable: true,
    keywords: ["блок розеток c13", "блок розеток iec c13 19", "pdu c13 1u"],
    summary:
      "1U-модели IEC C13: серверы, сетевое оборудование, типовые конфигурации стойки.",
    cta: "Открыть подкатегорию",
  },
  {
    path: "/catalog/bloki-rozetok-19-1u/16a/",
    type: "catalog",
    h1: "Блоки розеток 19″ 1U 16A",
    title: "Блок розеток 19 1U 16A | Солитон",
    description:
      "Горизонтальные блоки 1U с током 16A для типовых серверных и телеком-нагрузок.",
    demandCluster: "Ток и мощность 16A / 32A",
    priority: 0.72,
    changeFrequency: "weekly",
    indexable: true,
    keywords: ["блок розеток 19 16а", "pdu 1u 16a", "блок розеток 1u 16а"],
    summary:
      "1U-модели 16A для серверной стойки и телеком-шкафа.",
    cta: "Открыть подкатегорию",
  },
  {
    path: "/catalog/vertical-pdu/32a/",
    type: "catalog",
    h1: "Вертикальные PDU 32A",
    title: "Вертикальный PDU 32A для стойки 42U | Солитон",
    description:
      "Вертикальные блоки розеток с током 32A для стоек ЦОД, высокой плотности и проектных поставок.",
    demandCluster: "Ток и мощность 16A / 32A",
    priority: 0.68,
    changeFrequency: "weekly",
    indexable: true,
    keywords: ["вертикальный pdu 32а", "блок розеток вертикальный 32а", "pdu 32a 0u"],
    summary:
      "Вертикальные модели 32A: ЦОД, проектные стойки, высокая плотность подключений.",
    cta: "Открыть подкатегорию",
  },
  {
    path: "/catalog/vertical-pdu/42u/",
    type: "catalog",
    h1: "Вертикальные PDU для стоек 42U",
    title: "Вертикальный PDU для стойки 42U | Солитон",
    description:
      "Вертикальные блоки повышенной длины для стоек 42U: больше розеток на одной PDU, удобный монтаж в задней рейке.",
    demandCluster: "Вертикальные PDU / 0U / 42U",
    priority: 0.66,
    changeFrequency: "weekly",
    indexable: true,
    keywords: ["вертикальный pdu 42u", "блок розеток 42u", "pdu 42u 0u"],
    summary:
      "Вертикальные модели на полную высоту стойки 42U для проектных поставок.",
    cta: "Открыть подкатегорию",
  },
  {
    path: "/catalog/iec-c13-c19/16a/",
    type: "catalog",
    h1: "PDU IEC C13 / C19 16A",
    title: "PDU IEC C13 C19 16A для серверной стойки | Солитон",
    description:
      "Блоки розеток IEC C13/C19 с током 16A для серверного и сетевого оборудования.",
    demandCluster: "Типы розеток Schuko / IEC C13 / C19",
    priority: 0.66,
    changeFrequency: "weekly",
    indexable: true,
    keywords: ["pdu c13 16a", "блок розеток c13 16а", "iec c13 1u 16a"],
    summary:
      "IEC-модели 16A для серверных стоек и сетевого оборудования.",
    cta: "Открыть подкатегорию",
  },
  {
    path: "/catalog/iec-c13-c19/32a/",
    type: "catalog",
    h1: "PDU IEC C13 / C19 32A",
    title: "PDU IEC C13 C19 32A | Солитон",
    description:
      "Блоки розеток IEC C13/C19 с током 32A для плотных стоек ЦОД и проектных поставок.",
    demandCluster: "Ток и мощность 16A / 32A",
    priority: 0.66,
    changeFrequency: "weekly",
    indexable: true,
    keywords: ["pdu c13 32a", "блок розеток c19 32а", "iec c13 32a"],
    summary:
      "IEC-модели 32A для серверов высокой плотности и проектных стоек.",
    cta: "Открыть подкатегорию",
  },
  {
    path: "/catalog/metered-pdu/32a/",
    type: "catalog",
    h1: "Измерительные PDU 32A с мониторингом",
    title: "PDU 32A с мониторингом для ЦОД | Солитон",
    description:
      "PDU с мониторингом тока и напряжения, номинальный ток 32A. Для ЦОД, проектной эксплуатации и расчета PUE.",
    demandCluster: "Измерительные, управляемые и мониторинговые PDU",
    priority: 0.62,
    changeFrequency: "weekly",
    indexable: true,
    keywords: ["pdu 32a мониторинг", "metered pdu 32a", "блок розеток 32а с мониторингом"],
    summary:
      "Управляемые PDU с мониторингом и током 32A для ЦОД и проектных стоек.",
    cta: "Открыть подкатегорию",
  },
  {
    path: "/knowledge/zamena-importnyh-pdu/",
    type: "knowledge",
    h1: "Замена импортных PDU на российский аналог",
    title: "Замена импортных PDU — российский аналог Солитон",
    description:
      "Как заменить PDU зарубежных брендов (APC, Hyperline, Vertiv, Eaton, Rittal, Schneider) на российский аналог Солитон: параметры, документы, реестр, сроки.",
    demandCluster: "Замена импортных PDU",
    priority: 0.58,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["замена pdu", "импортозамещение pdu", "российский pdu", "аналог импортного pdu"],
    summary:
      "Обзорная страница по замене импортных PDU на Солитон: параметры, документы, реестр Минпромторга, сроки и КП.",
    cta: "Запросить замену",
  },
  {
    path: "/knowledge/pdu-soliton-vs-hyperline/",
    type: "knowledge",
    h1: "PDU Солитон vs Hyperline — сравнение и замена",
    title: "PDU Солитон vs Hyperline — российский аналог",
    description:
      "Сравнение PDU и блоков розеток Солитон и Hyperline: розетки, ток, монтаж, документы, российское производство и реестр для тендера.",
    demandCluster: "Замена импортных PDU",
    priority: 0.6,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["hyperline pdu", "hyperline блок розеток", "аналог hyperline", "замена hyperline"],
    summary:
      "Сравнение Солитон и Hyperline по ключевым параметрам PDU. Замена импортной модели на российский аналог.",
    cta: "Запросить замену Hyperline",
  },
  {
    path: "/knowledge/zamena-apc-pdu-rossijskij-analog/",
    type: "knowledge",
    h1: "Замена APC PDU на российский аналог",
    title: "Замена APC PDU — российский аналог Солитон",
    description:
      "Чем заменить APC PDU: параметры моделей APC, аналог Солитон, реестр Минпромторга и документы для закупки.",
    demandCluster: "Замена импортных PDU",
    priority: 0.6,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["apc pdu", "замена apc pdu", "аналог apc", "apc ap7900"],
    summary:
      "Сравнение APC PDU и Солитон, российский аналог для импортозамещения и тендеров по 44/223-ФЗ.",
    cta: "Запросить замену APC",
  },
  {
    path: "/knowledge/analogi-vertiv-eaton-pdu/",
    type: "knowledge",
    h1: "Аналоги Vertiv и Eaton PDU — российский Солитон",
    title: "Аналоги Vertiv и Eaton PDU — российский Солитон",
    description:
      "Аналоги PDU Vertiv (Geist) и Eaton ePDU: ключевые параметры, замена на Солитон, реестр и документы для закупки.",
    demandCluster: "Замена импортных PDU",
    priority: 0.54,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["vertiv pdu", "eaton pdu", "geist pdu", "epdu eaton"],
    summary:
      "Сравнение Vertiv Geist и Eaton ePDU с Солитон. Замена и параметры для проектных поставок.",
    cta: "Запросить замену Vertiv/Eaton",
  },
  {
    path: "/knowledge/analogi-rittal-schneider-pdu/",
    type: "knowledge",
    h1: "Аналоги Rittal и Schneider PDU — российский Солитон",
    title: "Аналоги Rittal и Schneider PDU — Солитон",
    description:
      "Замена PDU Rittal и Schneider Electric на российский аналог Солитон: параметры, документы, реестр и проектные поставки.",
    demandCluster: "Замена импортных PDU",
    priority: 0.52,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["rittal pdu", "schneider pdu", "rittal dk", "schneider electric pdu"],
    summary:
      "Сравнение Rittal и Schneider PDU с Солитон. Замена в стойках и тендерных проектах.",
    cta: "Запросить замену Rittal/Schneider",
  },
  {
    path: "/documents/",
    type: "document",
    h1: "Документы Солитон",
    title: "Документы Солитон: паспорта, сертификаты, инструкции",
    description:
      "Документы по PDU и блокам розеток Солитон: паспорта изделий, инструкции, сертификаты, реквизиты и материалы для закупки.",
    demandCluster: "Trust",
    priority: 0.56,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["документы soliton", "сертификаты pdu", "паспорта изделий pdu"],
    summary:
      "Паспорта, инструкции, сертификаты и материалы, которые помогают согласовать закупку PDU.",
    cta: "Запросить документ",
  },
  {
    path: "/documents/certificates/",
    type: "document",
    h1: "Сертификаты",
    title: "Сертификаты Солитон",
    description:
      "Сертификаты и подтверждающие документы Солитон для PDU, блоков розеток и закупочных процедур.",
    demandCluster: "Trust",
    priority: 0.5,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["сертификаты pdu", "сертификаты soliton"],
    summary:
      "Сертификаты и подтверждающие материалы по изделиям Солитон запрашиваются по конкретной модели.",
    cta: "Запросить сертификат",
  },
  {
    path: "/documents/catalog/",
    type: "document",
    h1: "Скачать каталог Солитон",
    title: "Каталог PDU Солитон в PDF",
    description:
      "Скачать или запросить каталог PDU и блоков розеток Солитон для подбора, закупки и проектирования.",
    demandCluster: "Trust",
    priority: 0.48,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["каталог pdu", "каталог soliton", "скачать каталог pdu"],
    summary:
      "Страница для PDF-каталога, который нужен закупщикам и инженерам.",
    cta: "Получить каталог",
  },
  {
    path: "/info/payment/",
    type: "info",
    h1: "Способы оплаты",
    title: "Способы оплаты PDU — Солитон",
    description:
      "Способы оплаты PDU и блоков розеток Солитон: банковская карта и СБП через ЮKassa для физлиц, безналичный расчет по счету для юрлиц и ИП. Электронный чек по 54-ФЗ приходит автоматически.",
    demandCluster: "Buyer info",
    priority: 0.6,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["способы оплаты", "оплата картой", "оплата сбп", "оплата по счету", "юkassa", "электронный чек 54-фз"],
    summary:
      "Карта и СБП через ЮKassa для физлиц, безналичный расчет по счету для юрлиц, электронный чек 54-ФЗ на email.",
    cta: "Перейти в каталог",
  },
  {
    path: "/info/delivery/",
    type: "info",
    h1: "Доставка",
    title: "Доставка PDU и блоков розеток — Солитон",
    description:
      "Доставка PDU и блоков розеток Солитон по России: СДЭК, Boxberry, Почта России, транспортные компании под проектные партии и самовывоз со склада в Екатеринбурге. Сроки, тарифы и условия отгрузки.",
    demandCluster: "Buyer info",
    priority: 0.6,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["доставка pdu", "доставка сдэк", "доставка boxberry", "почта россии", "самовывоз екатеринбург"],
    summary:
      "Доставка СДЭК, Boxberry, Почтой России и ТК по всей России, самовывоз со склада в Екатеринбурге.",
    cta: "Подробнее о доставке",
  },
  {
    path: "/info/return/",
    type: "info",
    h1: "Возврат товара",
    title: "Условия возврата — Солитон",
    description:
      "Условия возврата PDU и блоков розеток Солитон: 14 дней для физлиц по Закону о защите прав потребителей, возврат юрлицами по ГК РФ, оформление акта расхождения при браке и порядок возврата денежных средств.",
    demandCluster: "Buyer info",
    priority: 0.6,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["возврат товара", "возврат 14 дней", "акт расхождения", "возврат юрлицом", "возврат денег"],
    summary:
      "14 дней для физлиц, возврат юрлицами по ГК РФ, акт расхождения при браке и сроки возврата средств.",
    cta: "Оформить возврат",
  },
  {
    path: "/info/warranty/",
    type: "info",
    h1: "Гарантия",
    title: "Гарантийное обслуживание PDU — Солитон",
    description:
      "Гарантийное обслуживание PDU и блоков розеток Солитон: 12 месяцев заводской гарантии на все изделия, исключения из гарантийных обязательств и порядок обращения в сервисный центр в Екатеринбурге.",
    demandCluster: "Buyer info",
    priority: 0.6,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["гарантия pdu", "гарантия 12 месяцев", "гарантийное обслуживание", "сервис екатеринбург", "ремонт pdu"],
    summary:
      "12 месяцев заводской гарантии, перечень исключений и обращение в сервисный центр в Екатеринбурге.",
    cta: "Обратиться в сервис",
  },
  {
    path: "/legal/",
    type: "legal",
    h1: "Юридические документы",
    title: "Юридические документы — Солитон",
    description:
      "Юридические документы Солитон: публичная оферта, политика конфиденциальности, политика обработки персональных данных по 152-ФЗ, пользовательское соглашение. Текущие версии и даты вступления в силу.",
    demandCluster: "Compliance",
    priority: 0.45,
    changeFrequency: "yearly",
    indexable: true,
    keywords: ["юридические документы", "оферта", "политика конфиденциальности", "152-фз", "соглашение"],
    summary:
      "Все юридические документы Солитон в одном месте: оферта, политики, соглашение — с указанием версий.",
    cta: "Посмотреть документы",
  },
  {
    path: "/legal/offer/",
    type: "legal",
    h1: "Публичная оферта",
    title: "Публичная оферта — Солитон",
    description:
      "Публичная оферта на поставку PDU и блоков розеток Солитон: условия акцепта по статьям 432-435 ГК РФ, предмет договора, порядок заключения и существенные условия поставки товара покупателю.",
    demandCluster: "Trust documents",
    priority: 0.5,
    changeFrequency: "yearly",
    indexable: true,
    keywords: ["публичная оферта", "акцепт оферты", "договор поставки", "гк рф 432", "договор купли-продажи"],
    summary:
      "Условия публичной оферты: акцепт по ст. 432-435 ГК РФ, предмет и существенные условия договора поставки.",
    cta: "Читать оферту",
  },
  {
    path: "/legal/privacy/",
    type: "legal",
    h1: "Политика конфиденциальности",
    title: "Политика конфиденциальности — Солитон",
    description:
      "Политика конфиденциальности Солитон: какие данные мы собираем при оформлении заказа и обращениях, как храним и защищаем их в соответствии с 152-ФЗ, использование cookies и метрик на сайте.",
    demandCluster: "Compliance",
    priority: 0.5,
    changeFrequency: "yearly",
    indexable: true,
    keywords: ["политика конфиденциальности", "152-фз", "обработка персональных данных", "cookies", "защита данных"],
    summary:
      "Какие данные собираем, как храним и защищаем по 152-ФЗ, использование cookies и аналитики.",
    cta: "Читать политику",
  },
  {
    path: "/legal/pd-policy/",
    type: "legal",
    h1: "Политика обработки персональных данных",
    title: "Политика обработки персональных данных — Солитон",
    description:
      "Политика обработки персональных данных Солитон по 152-ФЗ: оператор персональных данных, цели и правовые основания обработки, права субъекта ПДн, сроки хранения и порядок реализации прав субъекта.",
    demandCluster: "Compliance",
    priority: 0.5,
    changeFrequency: "yearly",
    indexable: true,
    keywords: ["политика обработки персональных данных", "152-фз", "оператор пдн", "права субъекта пдн", "согласие на обработку"],
    summary:
      "Оператор ПДн, цели и правовые основания обработки по 152-ФЗ, права субъекта и сроки хранения.",
    cta: "Читать политику ПДн",
  },
  {
    path: "/legal/terms/",
    type: "legal",
    h1: "Пользовательское соглашение",
    title: "Пользовательское соглашение — Солитон",
    description:
      "Пользовательское соглашение сайта Солитон: условия использования сайта soliton.pro, правила размещения контента, ответственность сторон, ограничение ответственности и порядок разрешения споров.",
    demandCluster: "Compliance",
    priority: 0.5,
    changeFrequency: "yearly",
    indexable: true,
    keywords: ["пользовательское соглашение", "условия использования", "правила сайта", "ответственность", "разрешение споров"],
    summary:
      "Условия использования сайта soliton.pro, ответственность сторон и порядок разрешения споров.",
    cta: "Читать соглашение",
  },
  {
    path: "/info/faq/",
    type: "info",
    h1: "Вопросы и ответы",
    title: "Часто задаваемые вопросы — Солитон",
    description:
      "Часто задаваемые вопросы по PDU и блокам розеток Солитон: как заказать без регистрации, оплата для B2B и B2C, доставка и возврат, гарантия, документы для тендеров и проектных закупок.",
    demandCluster: "Buyer info",
    priority: 0.55,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["faq pdu", "вопросы и ответы", "как заказать pdu", "заказ без регистрации", "оплата b2b", "доставка возврат"],
    summary:
      "Ответы на частые вопросы B2B и B2C: заказ без регистрации, оплата, доставка, возврат, гарантия и документы.",
    cta: "Задать свой вопрос",
  },
  {
    path: "/company/about/",
    type: "company",
    h1: "О компании Солитон",
    title: "О компании Солитон (Soliton) — производитель PDU",
    description:
      "Солитон (Soliton) — российский производитель PDU и блоков розеток с 19-летней историей, проектными поставками и документами для закупки.",
    demandCluster: "Brand trust",
    priority: 0.5,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["soliton pdu", "солитон блок розеток", "производитель pdu"],
    summary:
      "Страница усиливает бренд и доверие: история, производство, документы, реестр и реальные подтверждения.",
    cta: "Связаться с компанией",
  },
  {
    path: "/company/production/",
    type: "company",
    h1: "Российское производство PDU",
    title: "Российское производство PDU Солитон",
    description:
      "Производство PDU и блоков розеток Солитон в России: проектные конфигурации, контроль качества и документы.",
    demandCluster: "Brand trust",
    priority: 0.54,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["российский pdu", "производство pdu", "российские блоки розеток"],
    summary:
      "Производственная информация, документы и сведения о возможностях Солитон для проектных поставок.",
    cta: "Запросить производственные документы",
  },
  {
    path: "/company/contacts/",
    type: "company",
    h1: "Контакты Солитон",
    title: "Контакты Солитон",
    description:
      "Контакты Солитон для заказа PDU, запроса коммерческого предложения, документов и консультации инженера.",
    demandCluster: "Conversion",
    priority: 0.52,
    changeFrequency: "monthly",
    indexable: true,
    keywords: ["контакты soliton", "заказать pdu", "запросить кп pdu"],
    summary:
      "Контакты для заказа PDU, запроса коммерческого предложения и инженерной консультации.",
    cta: "Отправить запрос",
  },
];

const routesByPath = new Map(seoRoutes.map((route) => [route.path, route]));

export function pathFromSegments(section: string, segments?: string[]) {
  const parts = [section, ...(segments ?? [])].filter(Boolean);
  return `/${parts.join("/")}/`;
}

export function getSeoRoute(path: string) {
  const normalized = path === "/" ? path : `/${path.replace(/^\/|\/$/g, "")}/`;
  const route = routesByPath.get(normalized);

  if (route) {
    return route;
  }

  const outletCountMatch = normalized.match(/^\/catalog\/outlet-count-(\d+)\/$/);
  if (outletCountMatch?.[1]) {
    const count = outletCountMatch[1];
    return {
      path: normalized,
      type: "catalog",
      h1: `PDU и блоки розеток на ${count} розеток`,
      title: `PDU и блоки розеток на ${count} розеток Солитон`,
      description: `Каталог PDU и блоков розеток Солитон с количеством выходных розеток ${count}. Подбор модели и заявка на коммерческое предложение.`,
      demandCluster: "PDU / количество розеток",
      priority: 0.2,
      changeFrequency: "weekly",
      indexable: false,
      keywords: [`pdu ${count} розеток`, `блок розеток ${count} розеток`],
      summary: `Подбор PDU и блоков розеток Солитон с количеством выходных розеток ${count}.`,
      cta: "Запросить КП",
    } satisfies SeoRoute;
  }

  return undefined;
}

export function getStaticParamsForSection(section: SeoRouteType) {
  return seoRoutes
    .filter((route) => route.type === section && route.path !== "/")
    .map((route) => ({
      slug: route.path.split("/").filter(Boolean).slice(1),
    }));
}

export function getSingleSlugParamsForSection(section: SeoRouteType) {
  return seoRoutes
    .filter((route) => route.type === section)
    .map((route) => ({
      slug: route.path.split("/").filter(Boolean).at(-1) ?? "",
    }));
}

export function createMetadata(route: SeoRoute): Metadata {
  return {
    title: route.title,
    description: route.description,
    alternates: {
      canonical: route.path,
    },
    openGraph: {
      title: route.title,
      description: route.description,
      siteName: SITE_NAME,
      type: "website",
      url: route.path,
    },
    robots: route.indexable
      ? {
          follow: true,
          index: true,
        }
      : {
          follow: false,
          index: false,
        },
  };
}
