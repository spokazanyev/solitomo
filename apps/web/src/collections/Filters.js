import { withDiscardChangesControl } from "./admin-components.js";
import { adminGroups, adminLabel, commonLabels } from "./admin-i18n.js";
import { adminAccess, agentFields, machineCodeField, publicationStatusField, seoFields } from "./shared.js";

/** @type {import('payload').CollectionConfig} */
export const FilterGroups = {
  slug: "filter-groups",
  labels: {
    plural: adminLabel("Группы фильтров", "Filter groups"),
    singular: adminLabel("Группа фильтров", "Filter group"),
  },
  admin: withDiscardChangesControl({
    defaultColumns: ["label", "code", "isActive", "sortOrder"],
    group: adminGroups.filters,
    useAsTitle: "label",
  }),
  access: {
    create: adminAccess,
    read: adminAccess,
    update: adminAccess,
    delete: adminAccess,
  },
  fields: [
    machineCodeField,
    { name: "label", type: "text", label: commonLabels.label, required: true },
    { name: "isActive", type: "checkbox", label: commonLabels.isActive, defaultValue: true },
    { name: "sortOrder", type: "number", label: commonLabels.sortOrder, defaultValue: 100 },
    {
      name: "categories",
      type: "relationship",
      label: commonLabels.categories,
      hasMany: true,
      relationTo: "categories",
    },
    ...agentFields,
  ],
  timestamps: true,
};

/** @type {import('payload').CollectionConfig} */
export const FilterFields = {
  slug: "filter-fields",
  labels: {
    plural: adminLabel("Поля фильтров", "Filter fields"),
    singular: adminLabel("Поле фильтра", "Filter field"),
  },
  admin: withDiscardChangesControl({
    defaultColumns: ["label", "code", "group", "fieldType", "isActive"],
    group: adminGroups.filters,
    useAsTitle: "label",
  }),
  access: {
    create: adminAccess,
    read: adminAccess,
    update: adminAccess,
    delete: adminAccess,
  },
  fields: [
    machineCodeField,
    { name: "label", type: "text", label: commonLabels.label, required: true },
    {
      name: "group",
      type: "relationship",
      label: adminLabel("Группа", "Group"),
      relationTo: "filter-groups",
    },
    {
      name: "attribute",
      type: "relationship",
      label: adminLabel("Характеристика", "Attribute"),
      relationTo: "attributes",
      admin: {
        description: adminLabel(
          "Фильтр должен ссылаться на управляемую характеристику, чтобы агент мог менять его безопасно.",
          "The filter should reference a controlled attribute so an agent can change it safely.",
        ),
      },
    },
    {
      name: "fieldType",
      type: "select",
      defaultValue: "multi_select",
      label: adminLabel("Тип поля", "Field type"),
      options: [
        { label: adminLabel("Один выбор", "Single select"), value: "single_select" },
        { label: adminLabel("Множественный выбор", "Multi select"), value: "multi_select" },
        { label: adminLabel("Диапазон", "Range"), value: "range" },
        { label: adminLabel("Да/нет", "Boolean"), value: "boolean" },
      ],
    },
    {
      name: "categories",
      type: "relationship",
      label: commonLabels.categories,
      hasMany: true,
      relationTo: "categories",
    },
    { name: "isActive", type: "checkbox", label: commonLabels.isActive, defaultValue: true },
    { name: "showCounters", type: "checkbox", label: adminLabel("Показывать счетчики", "Show counters"), defaultValue: true },
    {
      name: "recalculateCounters",
      type: "checkbox",
      label: adminLabel("Пересчитывать счетчики", "Recalculate counters"),
      defaultValue: true,
    },
    { name: "allowMultiple", type: "checkbox", label: adminLabel("Разрешить множественный выбор", "Allow multiple"), defaultValue: true },
    { name: "indexableAllowed", type: "checkbox", label: adminLabel("Можно индексировать", "Indexable allowed"), defaultValue: false },
    {
      name: "zeroResultsBehavior",
      type: "select",
      defaultValue: "disable",
      label: adminLabel("Поведение при нуле товаров", "Zero-results behavior"),
      options: [
        { label: adminLabel("Отключить опцию", "Disable option"), value: "disable" },
        { label: adminLabel("Скрыть опцию", "Hide option"), value: "hide" },
        { label: adminLabel("Показывать", "Show"), value: "show" },
      ],
    },
    { name: "sortOrder", type: "number", label: commonLabels.sortOrder, defaultValue: 100 },
    ...agentFields,
  ],
  timestamps: true,
};

/** @type {import('payload').CollectionConfig} */
export const FilterOptions = {
  slug: "filter-options",
  labels: {
    plural: adminLabel("Опции фильтров", "Filter options"),
    singular: adminLabel("Опция фильтра", "Filter option"),
  },
  admin: withDiscardChangesControl({
    defaultColumns: ["label", "code", "field", "isActive", "indexableAllowed"],
    group: adminGroups.filters,
    useAsTitle: "label",
  }),
  access: {
    create: adminAccess,
    read: adminAccess,
    update: adminAccess,
    delete: adminAccess,
  },
  fields: [
    machineCodeField,
    { name: "label", type: "text", label: commonLabels.label, required: true },
    {
      name: "field",
      type: "relationship",
      label: adminLabel("Поле фильтра", "Filter field"),
      relationTo: "filter-fields",
      required: true,
    },
    {
      name: "attributeOption",
      type: "relationship",
      label: adminLabel("Значение характеристики", "Attribute option"),
      relationTo: "attribute-options",
    },
    {
      name: "aliases",
      type: "array",
      label: commonLabels.aliases,
      fields: [{ name: "value", type: "text", label: commonLabels.value, required: true }],
    },
    { name: "seoSlug", type: "text", label: adminLabel("SEO URL-часть", "SEO slug") },
    { name: "sortOrder", type: "number", label: commonLabels.sortOrder, defaultValue: 100 },
    { name: "isActive", type: "checkbox", label: commonLabels.isActive, defaultValue: true },
    { name: "indexableAllowed", type: "checkbox", label: adminLabel("Можно индексировать", "Indexable allowed"), defaultValue: false },
    ...agentFields,
  ],
  timestamps: true,
};

/** @type {import('payload').CollectionConfig} */
export const FilterPresets = {
  slug: "filter-presets",
  labels: {
    plural: adminLabel("SEO-пресеты фильтров", "Filter SEO presets"),
    singular: adminLabel("SEO-пресет фильтра", "Filter SEO preset"),
  },
  admin: withDiscardChangesControl({
    defaultColumns: ["title", "slug", "category", "status", "indexingPolicy"],
    group: adminGroups.filters,
    useAsTitle: "title",
  }),
  access: {
    create: adminAccess,
    read: adminAccess,
    update: adminAccess,
    delete: adminAccess,
  },
  fields: [
    publicationStatusField,
    { name: "title", type: "text", label: commonLabels.title, required: true },
    { name: "slug", type: "text", label: commonLabels.slug, required: true, unique: true },
    {
      name: "category",
      type: "relationship",
      label: adminLabel("Категория", "Category"),
      relationTo: "categories",
      required: true,
    },
    { name: "h1", type: "text", label: commonLabels.h1 },
    { name: "intro", type: "textarea", label: adminLabel("Вводный текст", "Intro") },
    {
      name: "conditions",
      type: "array",
      label: adminLabel("Условия фильтра", "Filter conditions"),
      fields: [
        {
          name: "field",
          type: "relationship",
          label: adminLabel("Поле фильтра", "Filter field"),
          relationTo: "filter-fields",
          required: true,
        },
        {
          name: "options",
          type: "relationship",
          label: adminLabel("Опции", "Options"),
          hasMany: true,
          relationTo: "filter-options",
        },
      ],
    },
    {
      name: "relatedLinks",
      type: "array",
      label: adminLabel("Связанные ссылки", "Related links"),
      fields: [
        { name: "label", type: "text", label: commonLabels.label, required: true },
        { name: "href", type: "text", label: adminLabel("Ссылка", "Link"), required: true },
      ],
    },
    ...seoFields,
    ...agentFields,
  ],
  timestamps: true,
  versions: true,
};
