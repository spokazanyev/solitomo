import type { CollectionConfig } from "payload";

import { adminLabel } from "./admin-i18n.js";

/**
 * StaticPages collection (057 data-model §1).
 *
 * Хранит редактируемый Owner'ом контент для buyer-info страниц `/info/*`
 * (payment, delivery, return, warranty, offer, privacy, pd-policy, terms,
 * faq) и опционально других статических разделов.
 *
 * Версионирование включено для юр-документов (`category=policy`) — нужна
 * история редакций (FR-5741). Lexical rich-text задан глобально в
 * `payload.config.ts`, поэтому `body: { type: "richText" }` использует
 * lexical автоматически.
 *
 * NOTE: пока `pnpm generate:types` не запущен, slug `static-pages` ещё нет
 * в сгенерированных payload-types. Полагаемся на runtime — типы подъедут
 * после регенерации (orchestrator делает это следующим шагом).
 */
export const StaticPages: CollectionConfig = {
  slug: "static-pages",
  labels: {
    singular: adminLabel("Статическая страница", "Static page"),
    plural: adminLabel("Статические страницы", "Static pages"),
  },
  admin: {
    useAsTitle: "title",
    group: adminLabel("Контент", "Content"),
    defaultColumns: ["slug", "title", "section", "category", "status", "version", "updatedAt"],
    description: adminLabel(
      "Контент страниц /info/* (оферта, политика конфиденциальности, FAQ, доставка и др.). " +
        "Юр-документы (category=policy) версионируются — version и effectiveFrom обязательны.",
      "Buyer-info pages content (/info/*). Policy documents (category=policy) require version and effectiveFrom.",
    ),
  },
  versions: {
    drafts: true,
    maxPerDoc: 50,
  },
  access: {
    // Published страницы видны всем (гостям и не-аутентифицированным).
    // Черновики (status=draft) — только аутентифицированным пользователям Payload.
    read: ({ req }) => Boolean(req.user) || { status: { equals: "published" } },
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    // ─── Identity ───
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      label: adminLabel("URL-адрес", "Slug"),
      admin: {
        description: adminLabel(
          "Уникальный идентификатор URL (lowercase, цифры, дефисы). Пример: payment, pd-policy.",
          "Unique URL identifier (lowercase, digits, hyphens). Example: payment, pd-policy.",
        ),
      },
      validate: (value: string | null | undefined) => {
        if (value == null || value === "") return "Slug is required";
        return /^[a-z0-9-]+$/.test(value)
          ? true
          : "Slug must match ^[a-z0-9-]+$ (lowercase letters, digits, hyphens)";
      },
    },

    // ─── Section / classification ───
    {
      name: "section",
      type: "select",
      required: true,
      defaultValue: "info",
      label: adminLabel("Раздел", "Section"),
      options: [
        { label: adminLabel("Покупателям (/info/*)", "Buyer info (/info/*)"), value: "info" },
        { label: adminLabel("О компании", "Company"), value: "company" },
        { label: adminLabel("Другое", "Other"), value: "other" },
      ],
    },

    // ─── Content ───
    {
      name: "title",
      type: "text",
      required: true,
      maxLength: 200,
      label: adminLabel("Заголовок", "Title"),
      admin: {
        description: adminLabel(
          "Используется как <h1> и в <title>, если не задан seoTitle.",
          "Used as <h1> and in <title> when seoTitle is empty.",
        ),
      },
    },
    {
      name: "subtitle",
      type: "text",
      maxLength: 300,
      label: adminLabel("Подзаголовок", "Subtitle"),
    },
    {
      name: "body",
      type: "richText",
      required: true,
      label: adminLabel("Содержание", "Body"),
      admin: {
        description: adminLabel(
          "Основной контент. Заголовки H2-H4, списки, ссылки, таблицы.",
          "Main content. Headings H2-H4, lists, links, tables.",
        ),
      },
    },

    // ─── Category (controls policy fields) ───
    {
      name: "category",
      type: "select",
      defaultValue: "info",
      label: adminLabel("Категория", "Category"),
      options: [
        { label: adminLabel("Юр-документ (политика, оферта)", "Policy"), value: "policy" },
        { label: adminLabel("Информационная", "Info"), value: "info" },
        { label: adminLabel("FAQ", "FAQ"), value: "faq" },
      ],
    },
    {
      name: "version",
      type: "text",
      label: adminLabel("Версия", "Version"),
      admin: {
        condition: (data) => data?.category === "policy",
        description: adminLabel(
          "Версия юр-документа в формате YYYY-MM-DD-vN (например, 2026-05-25-v1). Обязательно для category=policy.",
          "Policy version in YYYY-MM-DD-vN format (e.g. 2026-05-25-v1). Required when category=policy.",
        ),
      },
      validate: (value: string | null | undefined) => {
        if (value == null || value === "") return true; // beforeChange enforces presence for policy
        return /^\d{4}-\d{2}-\d{2}-v\d+$/.test(value)
          ? true
          : "Version must match YYYY-MM-DD-vN (e.g. 2026-05-25-v1)";
      },
    },
    {
      name: "effectiveFrom",
      type: "date",
      label: adminLabel("Действует с", "Effective from"),
      admin: {
        condition: (data) => data?.category === "policy",
        description: adminLabel(
          "Дата вступления в силу юр-документа. Обязательно для category=policy.",
          "Date the policy becomes effective. Required when category=policy.",
        ),
      },
    },

    // ─── SEO ───
    {
      name: "seoTitle",
      type: "text",
      maxLength: 200,
      label: adminLabel("SEO заголовок (<title>)", "SEO title (<title>)"),
      admin: {
        description: adminLabel(
          "Переопределяет <title>. Если пусто — используется обычный заголовок.",
          "Overrides <title>. Falls back to title if empty.",
        ),
      },
    },
    {
      name: "seoDescription",
      type: "text",
      maxLength: 200,
      label: adminLabel("SEO описание (meta description)", "SEO description"),
    },
    {
      name: "indexingPolicy",
      type: "select",
      defaultValue: "index",
      label: adminLabel("Индексация (robots)", "Indexing policy (robots)"),
      options: [
        { label: adminLabel("Разрешить (index)", "Allow (index)"), value: "index" },
        { label: adminLabel("Запретить (noindex)", "Block (noindex)"), value: "noindex" },
      ],
    },

    // ─── Lifecycle ───
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      label: adminLabel("Статус", "Status"),
      options: [
        { label: adminLabel("Черновик", "Draft"), value: "draft" },
        { label: adminLabel("Опубликовано", "Published"), value: "published" },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.category === "policy") {
          if (!data.version || !data.effectiveFrom) {
            throw new Error("Policy documents require version and effectiveFrom");
          }
        }
        return data;
      },
    ],
    afterChange: [
      async ({ doc }) => {
        // Invalidate the in-process static-page cache so admin edits are
        // reflected within the same process instantly.
        try {
          const mod = await import("../lib/static-pages/get-static-page");
          mod.invalidateStaticPageCache(typeof doc.slug === "string" ? doc.slug : undefined);
        } catch {
          // Cache module failures must never block a save.
        }
        // Policy documents drive consent records — invalidate that cache too.
        if (doc?.category === "policy") {
          try {
            const mod = await import("../lib/consent/make-consent-record");
            mod.invalidatePolicyVersionCache();
          } catch {
            // Module may not exist yet during 057 build-out — fail soft.
          }
        }
        // 059 Phase 5 (FR-021): IndexNow push для buyer-info страниц (/info/*).
        // Только section=info → чёткий URL. Legal/policy и прочее покрываются
        // bulk-ping'ом + sitemap. Fire-and-forget (FR-022).
        if (doc?.section === "info" && typeof doc.slug === "string") {
          try {
            const mod = await import("../lib/seo/indexnow");
            await mod.pingIndexNowPath(`/info/${doc.slug}/`);
          } catch {
            // IndexNow недоступен → sitemap/bulk-ping подберут URL позже.
          }
        }
      },
    ],
  },
  timestamps: true,
};

export default StaticPages;
