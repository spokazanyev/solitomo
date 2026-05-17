import { withDiscardChangesControl } from "./admin-components.js";
import { adminGroups, adminLabel, commonLabels } from "./admin-i18n.js";
import { adminAccess, machineCodeField } from "./shared.js";

/** @type {import('payload').CollectionConfig} */
export const AttributeGroups = {
  slug: "attribute-groups",
  labels: {
    plural: adminLabel("Группы характеристик", "Attribute groups"),
    singular: adminLabel("Группа характеристик", "Attribute group"),
  },
  admin: withDiscardChangesControl({
    defaultColumns: ["label", "code", "sortOrder", "isActive"],
    group: adminGroups.catalog,
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
    { name: "description", type: "textarea", label: commonLabels.description },
    { name: "sortOrder", type: "number", label: commonLabels.sortOrder, defaultValue: 100 },
    { name: "isActive", type: "checkbox", label: commonLabels.isActive, defaultValue: true },
  ],
  timestamps: true,
};

/** @type {import('payload').CollectionConfig} */
export const Attributes = {
  slug: "attributes",
  labels: {
    plural: adminLabel("Характеристики", "Attributes"),
    singular: adminLabel("Характеристика", "Attribute"),
  },
  admin: withDiscardChangesControl({
    defaultColumns: ["label", "code", "group", "valueType", "isFilterable"],
    group: adminGroups.catalog,
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
      relationTo: "attribute-groups",
    },
    {
      name: "valueType",
      type: "select",
      defaultValue: "option",
      label: adminLabel("Тип значения", "Value type"),
      options: [
        { label: adminLabel("Значение из списка", "Single option"), value: "option" },
        { label: adminLabel("Множественный список", "Multiple options"), value: "multi_option" },
        { label: adminLabel("Число", "Number"), value: "number" },
        { label: adminLabel("Да/нет", "Boolean"), value: "boolean" },
        { label: adminLabel("Текст", "Text"), value: "text" },
      ],
    },
    { name: "unit", type: "text", label: adminLabel("Единица измерения", "Unit") },
    { name: "isFilterable", type: "checkbox", label: adminLabel("Используется в фильтрах", "Filterable"), defaultValue: false },
    { name: "isComparable", type: "checkbox", label: adminLabel("Сравнимая характеристика", "Comparable"), defaultValue: true },
    { name: "sortOrder", type: "number", label: commonLabels.sortOrder, defaultValue: 100 },
  ],
  timestamps: true,
};

/** @type {import('payload').CollectionConfig} */
export const AttributeOptions = {
  slug: "attribute-options",
  labels: {
    plural: adminLabel("Значения характеристик", "Attribute options"),
    singular: adminLabel("Значение характеристики", "Attribute option"),
  },
  admin: withDiscardChangesControl({
    defaultColumns: ["label", "code", "attribute", "isActive", "indexableAllowed"],
    group: adminGroups.catalog,
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
      name: "attribute",
      type: "relationship",
      label: adminLabel("Характеристика", "Attribute"),
      relationTo: "attributes",
      required: true,
    },
    {
      name: "aliases",
      type: "array",
      label: commonLabels.aliases,
      fields: [{ name: "value", type: "text", label: commonLabels.value, required: true }],
    },
    { name: "sortOrder", type: "number", label: commonLabels.sortOrder, defaultValue: 100 },
    { name: "isActive", type: "checkbox", label: commonLabels.isActive, defaultValue: true },
    { name: "indexableAllowed", type: "checkbox", label: adminLabel("Можно индексировать", "Indexable allowed"), defaultValue: false },
    { name: "seoSlug", type: "text", label: adminLabel("SEO URL-часть", "SEO slug") },
  ],
  timestamps: true,
};
