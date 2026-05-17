import { withDiscardChangesControl } from "./admin-components.js";
import { adminGroups, adminLabel, commonLabels } from "./admin-i18n.js";
import {
  adminAccess,
  agentFields,
  publicationStatusField,
  publishedOrAdminAccess,
  qualityStatusField,
  seoFields,
} from "./shared.js";

const categoryTypeOptions = [
  { label: adminLabel("Основная категория", "Catalog category"), value: "catalog" },
  { label: adminLabel("SEO-фильтр", "SEO filter"), value: "seo_filter" },
  { label: adminLabel("Сценарий применения", "Use case"), value: "use_case" },
  { label: adminLabel("Служебная группа", "Service group"), value: "service" },
  { label: adminLabel("Скрытая категория", "Hidden category"), value: "hidden" },
];

/** @type {import('payload').CollectionConfig} */
export const Categories = {
  slug: "categories",
  labels: {
    plural: adminLabel("Категории", "Categories"),
    singular: adminLabel("Категория", "Category"),
  },
  admin: withDiscardChangesControl({
    defaultColumns: ["title", "slug", "categoryType", "status", "updatedAt"],
    group: adminGroups.catalog,
    useAsTitle: "title",
  }),
  access: {
    create: adminAccess,
    read: publishedOrAdminAccess,
    update: adminAccess,
    delete: adminAccess,
  },
  fields: [
    publicationStatusField,
    qualityStatusField,
    { name: "title", type: "text", label: commonLabels.title, required: true },
    { name: "slug", type: "text", label: commonLabels.slug, required: true, unique: true },
    {
      name: "categoryType",
      type: "select",
      defaultValue: "catalog",
      label: adminLabel("Тип категории", "Category type"),
      options: categoryTypeOptions,
      required: true,
    },
    {
      name: "parent",
      type: "relationship",
      label: adminLabel("Родительская категория", "Parent category"),
      relationTo: "categories",
    },
    { name: "h1", type: "text", label: commonLabels.h1 },
    { name: "intro", type: "textarea", label: adminLabel("Вводный текст", "Intro") },
    {
      name: "primaryFilters",
      type: "relationship",
      label: adminLabel("Основные фильтры", "Primary filters"),
      hasMany: true,
      relationTo: "filter-fields",
    },
    {
      name: "featuredProducts",
      type: "relationship",
      label: adminLabel("Рекомендуемые товары", "Featured products"),
      hasMany: true,
      relationTo: "products",
    },
    {
      name: "relatedCategories",
      type: "relationship",
      label: adminLabel("Связанные категории", "Related categories"),
      hasMany: true,
      relationTo: "categories",
    },
    { name: "bottomSeoText", type: "textarea", label: adminLabel("Нижний SEO-текст", "Bottom SEO text") },
    {
      name: "schemaItemListEnabled",
      type: "checkbox",
      label: adminLabel("Включить schema.org ItemList", "Enable schema.org ItemList"),
      defaultValue: true,
    },
    ...seoFields,
    ...agentFields,
  ],
  timestamps: true,
  versions: true,
};

/** @type {import('payload').CollectionConfig} */
export const MediaAssets = {
  slug: "media",
  labels: {
    plural: adminLabel("Медиа", "Media"),
    singular: adminLabel("Медиафайл", "Media asset"),
  },
  admin: withDiscardChangesControl({
    defaultColumns: ["title", "role", "status", "updatedAt"],
    group: adminGroups.documentsMedia,
    useAsTitle: "title",
  }),
  access: {
    create: adminAccess,
    read: publishedOrAdminAccess,
    update: adminAccess,
    delete: adminAccess,
  },
  fields: [
    publicationStatusField,
    { name: "title", type: "text", label: commonLabels.title, required: true },
    { name: "externalUrl", type: "text", label: commonLabels.externalUrl },
    { name: "alt", type: "text", label: adminLabel("Alt-текст", "Alt text") },
    { name: "caption", type: "textarea", label: adminLabel("Подпись", "Caption") },
    {
      name: "role",
      type: "select",
      label: adminLabel("Роль медиа", "Media role"),
      options: [
        { label: adminLabel("Главное фото товара", "Primary product image"), value: "product_primary" },
        { label: adminLabel("Фото товара", "Product gallery image"), value: "product_gallery" },
        { label: adminLabel("Схема", "Diagram"), value: "diagram" },
        { label: adminLabel("Чертеж", "Drawing"), value: "drawing" },
        { label: adminLabel("Hero", "Hero"), value: "hero" },
        { label: adminLabel("Иллюстрация статьи", "Article image"), value: "article" },
      ],
    },
    {
      name: "products",
      type: "relationship",
      label: commonLabels.products,
      hasMany: true,
      relationTo: "products",
    },
    {
      name: "categories",
      type: "relationship",
      label: commonLabels.categories,
      hasMany: true,
      relationTo: "categories",
    },
    { name: "source", type: "text", label: adminLabel("Источник", "Source") },
    { name: "sortOrder", type: "number", label: commonLabels.sortOrder, defaultValue: 100 },
    ...agentFields,
  ],
  timestamps: true,
};

/** @type {import('payload').CollectionConfig} */
export const Documents = {
  slug: "documents",
  labels: {
    plural: adminLabel("Документы", "Documents"),
    singular: adminLabel("Документ", "Document"),
  },
  admin: withDiscardChangesControl({
    defaultColumns: ["title", "documentType", "status", "updatedAt"],
    group: adminGroups.documentsMedia,
    useAsTitle: "title",
  }),
  access: {
    create: adminAccess,
    read: publishedOrAdminAccess,
    update: adminAccess,
    delete: adminAccess,
  },
  fields: [
    publicationStatusField,
    { name: "title", type: "text", label: commonLabels.title, required: true },
    { name: "externalUrl", type: "text", label: commonLabels.externalUrl },
    {
      name: "documentType",
      type: "select",
      label: adminLabel("Тип документа", "Document type"),
      options: [
        { label: adminLabel("Паспорт", "Passport"), value: "passport" },
        { label: adminLabel("Инструкция", "Manual"), value: "manual" },
        { label: adminLabel("Чертеж", "Drawing"), value: "drawing" },
        { label: adminLabel("Схема", "Diagram"), value: "diagram" },
        { label: adminLabel("Сертификат", "Certificate"), value: "certificate" },
        { label: adminLabel("Декларация", "Declaration"), value: "declaration" },
        { label: adminLabel("Реестр", "Registry"), value: "registry" },
        { label: adminLabel("Datasheet", "Datasheet"), value: "datasheet" },
        { label: adminLabel("Прочее", "Other"), value: "other" },
      ],
    },
    {
      name: "products",
      type: "relationship",
      label: commonLabels.products,
      hasMany: true,
      relationTo: "products",
    },
    {
      name: "categories",
      type: "relationship",
      label: commonLabels.categories,
      hasMany: true,
      relationTo: "categories",
    },
    { name: "versionLabel", type: "text", label: adminLabel("Версия", "Version label") },
    { name: "proofRole", type: "text", label: adminLabel("Роль доказательства", "Proof role") },
    { name: "downloadCtaLabel", type: "text", label: adminLabel("Текст кнопки скачивания", "Download CTA label") },
    ...seoFields,
    ...agentFields,
  ],
  timestamps: true,
  versions: true,
};

/** @type {import('payload').CollectionConfig} */
export const Products = {
  slug: "products",
  labels: {
    plural: adminLabel("Товары", "Products"),
    singular: adminLabel("Товар", "Product"),
  },
  admin: withDiscardChangesControl({
    defaultColumns: ["sku", "title", "status", "primaryCategory", "updatedAt"],
    group: adminGroups.catalog,
    useAsTitle: "title",
  }),
  access: {
    create: adminAccess,
    read: publishedOrAdminAccess,
    update: adminAccess,
    delete: adminAccess,
  },
  fields: [
    publicationStatusField,
    qualityStatusField,
    { name: "sku", type: "text", label: adminLabel("Артикул", "SKU"), required: true, unique: true },
    { name: "slug", type: "text", label: commonLabels.slug, required: true, unique: true },
    { name: "externalId", type: "text", label: adminLabel("Внешний ID", "External ID") },
    { name: "title", type: "text", label: commonLabels.title, required: true },
    { name: "h1", type: "text", label: commonLabels.h1 },
    { name: "shortDescription", type: "textarea", label: adminLabel("Краткое описание", "Short description") },
    { name: "description", type: "textarea", label: commonLabels.description },
    {
      name: "productType",
      type: "select",
      label: adminLabel("Тип товара", "Product type"),
      options: [
        { label: adminLabel("PDU / блок розеток", "PDU / power strip"), value: "pdu" },
        { label: adminLabel("Сетевой фильтр", "Surge filter"), value: "surge_filter" },
        { label: adminLabel("Контроллер мониторинга", "Monitoring controller"), value: "monitoring_controller" },
        { label: adminLabel("Аксессуар", "Accessory"), value: "accessory" },
      ],
    },
    {
      name: "primaryCategory",
      type: "relationship",
      label: adminLabel("Основная категория", "Primary category"),
      relationTo: "categories",
    },
    {
      name: "categories",
      type: "relationship",
      label: commonLabels.categories,
      hasMany: true,
      relationTo: "categories",
    },
    {
      name: "price",
      type: "group",
      label: adminLabel("Цена", "Price"),
      fields: [
        { name: "amount", type: "number", label: adminLabel("Сумма", "Amount") },
        { name: "currency", type: "text", label: adminLabel("Валюта", "Currency"), defaultValue: "RUB" },
        {
          name: "status",
          type: "select",
          defaultValue: "request",
          label: commonLabels.status,
          options: [
            { label: adminLabel("Цена по запросу", "Price on request"), value: "request" },
            { label: adminLabel("Опубликована", "Published"), value: "published" },
            { label: adminLabel("Скрыта", "Hidden"), value: "hidden" },
          ],
        },
      ],
    },
    {
      name: "availabilityStatus",
      type: "select",
      defaultValue: "request",
      label: adminLabel("Наличие", "Availability"),
      options: [
        { label: adminLabel("Уточнить при КП", "Confirm in quote"), value: "request" },
        { label: adminLabel("В наличии", "In stock"), value: "in_stock" },
        { label: adminLabel("Под заказ", "Preorder"), value: "preorder" },
        { label: adminLabel("Недоступен", "Unavailable"), value: "unavailable" },
      ],
    },
    {
      name: "technicalAttributes",
      type: "array",
      label: adminLabel("Технические характеристики", "Technical attributes"),
      fields: [
        {
          name: "attribute",
          type: "relationship",
          label: adminLabel("Характеристика", "Attribute"),
          relationTo: "attributes",
          required: true,
        },
        {
          name: "option",
          type: "relationship",
          label: adminLabel("Значение из справочника", "Option"),
          relationTo: "attribute-options",
        },
        { name: "valueText", type: "text", label: adminLabel("Текстовое значение", "Text value") },
        { name: "valueNumber", type: "number", label: adminLabel("Числовое значение", "Number value") },
        {
          name: "confidence",
          type: "select",
          defaultValue: "manual",
          label: adminLabel("Достоверность", "Confidence"),
          options: [
            { label: adminLabel("Ручное значение", "Manual value"), value: "manual" },
            { label: adminLabel("Высокая", "High"), value: "high" },
            { label: adminLabel("Средняя", "Medium"), value: "medium" },
            { label: adminLabel("Низкая", "Low"), value: "low" },
          ],
        },
      ],
    },
    {
      name: "imageLinks",
      type: "array",
      label: adminLabel("Ссылки на фотографии", "Image links"),
      admin: {
        description: adminLabel(
          "Прямые URL фотографий товара из источника. Используются для проверки карточки, импорта медиа и контроля публичного отображения.",
          "Direct product image URLs from the source. Used to check the product card, import media, and verify public rendering.",
        ),
      },
      fields: [
        {
          name: "role",
          type: "select",
          defaultValue: "gallery",
          label: adminLabel("Роль фото", "Image role"),
          options: [
            { label: adminLabel("Главное фото", "Primary image"), value: "primary" },
            { label: adminLabel("Галерея", "Gallery"), value: "gallery" },
            { label: adminLabel("Схема / чертеж", "Diagram / drawing"), value: "diagram" },
            { label: adminLabel("Прочее", "Other"), value: "other" },
          ],
        },
        {
          name: "url",
          type: "text",
          label: adminLabel("URL фотографии", "Image URL"),
          required: true,
        },
        {
          name: "alt",
          type: "text",
          label: adminLabel("Alt-текст", "Alt text"),
        },
      ],
    },
    {
      name: "media",
      type: "relationship",
      label: adminLabel("Медиафайлы товара", "Product media"),
      admin: {
        description: adminLabel(
          "Связанные медиа-записи Payload. Прямые исходные URL находятся выше в блоке «Ссылки на фотографии».",
          "Related Payload media records. Direct source URLs are listed above in the Image links block.",
        ),
      },
      hasMany: true,
      relationTo: "media",
    },
    {
      name: "documents",
      type: "relationship",
      label: commonLabels.documents,
      hasMany: true,
      relationTo: "documents",
    },
    {
      name: "relatedProducts",
      type: "relationship",
      label: adminLabel("Связанные товары", "Related products"),
      hasMany: true,
      relationTo: "products",
    },
    {
      name: "ctaMode",
      type: "select",
      defaultValue: "rfq",
      label: adminLabel("Режим CTA", "CTA mode"),
      options: [
        { label: adminLabel("Запрос КП", "Request quote"), value: "rfq" },
        { label: adminLabel("Купить", "Buy"), value: "buy" },
        { label: adminLabel("Только консультация", "Consultation only"), value: "consult" },
      ],
    },
    { name: "rfqEnabled", type: "checkbox", label: adminLabel("Разрешить запрос КП", "RFQ enabled"), defaultValue: true },
    { name: "sourceUrl", type: "text", label: adminLabel("URL источника", "Source URL") },
    { name: "sourceRawTitle", type: "text", label: adminLabel("Исходный заголовок", "Source raw title") },
    { name: "sourceRawDescription", type: "textarea", label: adminLabel("Исходное описание", "Source raw description") },
    { name: "lastImportedAt", type: "date", label: adminLabel("Дата последнего импорта", "Last imported at") },
    {
      name: "schemaProductEnabled",
      type: "checkbox",
      label: adminLabel("Включить schema.org Product", "Enable schema.org Product"),
      defaultValue: true,
    },
    { name: "schemaBrand", type: "text", label: adminLabel("Бренд для schema.org", "Schema.org brand"), defaultValue: "Soliton" },
    {
      name: "schemaManufacturer",
      type: "text",
      label: adminLabel("Производитель для schema.org", "Schema.org manufacturer"),
      defaultValue: "Soliton",
    },
    ...seoFields,
    ...agentFields,
  ],
  timestamps: true,
  versions: true,
};
