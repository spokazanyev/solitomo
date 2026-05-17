import { adminLabel, commonLabels } from "./admin-i18n.js";

export const adminAccess = ({ req }) => Boolean(req.user);

export const publishedOrAdminAccess = ({ req }) => {
  if (req.user) {
    return true;
  }

  return {
    status: {
      equals: "published",
    },
  };
};

export const publicationStatusField = {
  name: "status",
  type: "select",
  defaultValue: "draft",
  label: commonLabels.status,
  options: [
    { label: adminLabel("Черновик", "Draft"), value: "draft" },
    { label: adminLabel("На проверке", "In review"), value: "review" },
    { label: adminLabel("Опубликовано", "Published"), value: "published" },
    { label: adminLabel("Архив", "Archived"), value: "archived" },
  ],
  required: true,
};

export const qualityStatusField = {
  name: "qualityStatus",
  type: "select",
  defaultValue: "needs_review",
  label: adminLabel("Статус качества", "Quality status"),
  options: [
    { label: adminLabel("Нужно проверить", "Needs review"), value: "needs_review" },
    { label: adminLabel("Требует технической проверки", "Needs technical review"), value: "technical_review" },
    { label: adminLabel("Требует SEO/контент проверки", "Needs SEO/content review"), value: "content_review" },
    { label: adminLabel("Готово", "Ready"), value: "ready" },
  ],
};

export const agentFields = [
  {
    name: "agentEditable",
    type: "checkbox",
    defaultValue: true,
    label: adminLabel("Можно менять агенту", "Agent can edit"),
  },
  {
    name: "agentLockReason",
    type: "text",
    label: adminLabel("Причина блокировки для агента", "Agent lock reason"),
  },
  {
    name: "requiresHumanApproval",
    type: "checkbox",
    defaultValue: false,
    label: adminLabel("Требует подтверждения владельца", "Requires owner approval"),
  },
  {
    name: "sourceOfTruth",
    type: "select",
    defaultValue: "payload",
    label: adminLabel("Источник истины", "Source of truth"),
    options: [
      { label: adminLabel("Payload", "Payload"), value: "payload" },
      { label: adminLabel("Импортированный JSON", "Imported JSON"), value: "source_json" },
      { label: adminLabel("МойСклад", "MoySklad"), value: "moysklad" },
      { label: adminLabel("Ручное утверждение", "Manual approval"), value: "manual_approved" },
    ],
  },
  {
    name: "validationErrors",
    type: "textarea",
    label: adminLabel("Ошибки проверки", "Validation errors"),
    admin: {
      description: adminLabel(
        "Ошибки проверок данных, SEO, schema.org или публичного рендера.",
        "Data, SEO, schema.org, or public rendering validation errors.",
      ),
    },
  },
  {
    name: "previewPath",
    type: "text",
    label: adminLabel("Путь предпросмотра", "Preview path"),
    admin: {
      description: adminLabel(
        "Путь для проверки результата на публичном сайте или preview.",
        "Path for checking the result on the public site or preview.",
      ),
    },
  },
  {
    name: "revisionNote",
    type: "textarea",
    label: adminLabel("Комментарий к версии", "Revision note"),
  },
];

export const seoFields = [
  {
    name: "seoTitle",
    type: "text",
    label: adminLabel("SEO title", "SEO title"),
  },
  {
    name: "seoDescription",
    type: "textarea",
    label: adminLabel("SEO description", "SEO description"),
  },
  {
    name: "canonicalUrl",
    type: "text",
    label: adminLabel("Canonical URL", "Canonical URL"),
  },
  {
    name: "indexingPolicy",
    type: "select",
    defaultValue: "index",
    label: adminLabel("Политика индексации", "Indexing policy"),
    options: [
      { label: adminLabel("Индексировать", "Index"), value: "index" },
      { label: adminLabel("Не индексировать", "Noindex"), value: "noindex" },
      { label: adminLabel("Только canonical", "Canonical only"), value: "canonical_only" },
    ],
  },
  {
    name: "targetQueries",
    type: "array",
    label: adminLabel("Целевые поисковые запросы", "Target search queries"),
    fields: [
      {
        name: "query",
        type: "text",
        label: adminLabel("Запрос", "Query"),
        required: true,
      },
      {
        name: "intent",
        type: "select",
        label: adminLabel("Интент", "Intent"),
        options: [
          { label: adminLabel("Коммерческий", "Commercial"), value: "commercial" },
          { label: adminLabel("Технический", "Technical"), value: "technical" },
          { label: adminLabel("Информационный", "Informational"), value: "informational" },
          { label: adminLabel("Навигационный", "Navigational"), value: "navigational" },
        ],
      },
    ],
  },
];

export const machineCodeField = {
  name: "code",
  type: "text",
  required: true,
  unique: true,
  label: commonLabels.code,
};
