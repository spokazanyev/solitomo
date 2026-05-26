import type { GlobalConfig } from "payload";

import { adminLabel } from "../collections/admin-i18n.js";

/**
 * AnalyticsSettings — не-секретные конфигурации agent-driven model (058 Phase 12).
 *
 * Соответствие спеке 058:
 * - FR-101: только не-секретные данные (host-паттерны, ботовые UA, soft404-маркеры,
 *   goal-ID synced с UI Метрики, retargeting-segment IDs, флаги активации)
 * - FR-370: agent-review schedule + parameters
 * - FR-394: kill-switch activation.agentEnabled
 *
 * Secrets (YM_AGENT_TOKEN, YM_API_TOKEN) — в env (FR-100), не здесь.
 *
 * Source-of-truth для goals/filters/counterSettings — `apps/web/config/metrika.config.ts`
 * (FR-360). Этот global — только runtime-параметры, которые могут меняться без redeploy.
 */
export const AnalyticsSettings: GlobalConfig = {
  slug: "analytics-settings",
  label: adminLabel("Аналитика / Agent runtime", "Analytics / Agent runtime"),
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    // ============================================================
    // Activation flags / kill-switches
    // ============================================================
    {
      type: "group",
      name: "activation",
      label: adminLabel("Активация и kill-switches", "Activation and kill-switches"),
      admin: {
        description: adminLabel(
          "FR-394. Kill-switches для аварийного отключения. agentEnabled=false → agent не делает никаких API-вызовов.",
          "FR-394. Kill-switches for emergency disabling. agentEnabled=false → agent makes no API calls.",
        ),
      },
      fields: [
        {
          name: "serverHitsEnabled",
          type: "checkbox",
          defaultValue: true,
          label: adminLabel("Server-side hits", "Server-side hits"),
          admin: {
            description: adminLabel(
              "FR-040. Серверный дубль покупок для adblock-resilience.",
              "FR-040. Server-side duplicate for adblock resilience.",
            ),
          },
        },
        {
          name: "webvisorEnabled",
          type: "checkbox",
          defaultValue: true,
          label: adminLabel("Webvisor", "Webvisor"),
        },
        {
          name: "qualifiedVisitGoalEnabled",
          type: "checkbox",
          defaultValue: true,
          label: adminLabel("Цель qualified_visit", "qualified_visit goal"),
        },
        {
          name: "agentEnabled",
          type: "checkbox",
          defaultValue: true,
          label: adminLabel("Agent enabled (kill-switch)", "Agent enabled (kill-switch)"),
          admin: {
            description: adminLabel(
              "FR-394. При false agent НЕ обращается к Metrika API ни на каком endpoint.",
              "FR-394. When false, agent makes NO Metrika API calls.",
            ),
          },
        },
        {
          name: "agentSchedulerEnabled",
          type: "checkbox",
          defaultValue: false,
          label: adminLabel("Scheduled daily-review (v1.1)", "Scheduled daily-review (v1.1)"),
          admin: {
            description: adminLabel(
              "Default false в v1. В v1.1 включается для cron `/api/cron/agent-daily-review`.",
              "Default false in v1. v1.1 enables cron `/api/cron/agent-daily-review`.",
            ),
          },
        },
      ],
    },

    // ============================================================
    // Agent review parameters
    // ============================================================
    {
      type: "group",
      name: "agentReview",
      label: adminLabel("Параметры review", "Review parameters"),
      fields: [
        {
          name: "schedule",
          type: "text",
          defaultValue: "0 9 * * *",
          label: adminLabel("Cron-расписание (v1.1)", "Cron schedule (v1.1)"),
          admin: {
            description: adminLabel(
              "Cron-expression. Default '0 9 * * *' = 09:00 ежедневно.",
              "Cron-expression. Default '0 9 * * *' = 09:00 daily.",
            ),
          },
        },
        {
          name: "timezone",
          type: "text",
          defaultValue: "Europe/Moscow",
          label: adminLabel("Часовой пояс", "Timezone"),
        },
        {
          name: "enabledEvaluators",
          type: "select",
          hasMany: true,
          defaultValue: [
            "funnel_drop_off",
            "qualified_visit_rate",
            "source_quality",
            "zero_result_searches",
            "roas_deviation",
            "data_quality",
          ],
          label: adminLabel("Включённые evaluators (daily)", "Enabled evaluators (daily)"),
          options: [
            { label: "funnel_drop_off (FR-371-a)", value: "funnel_drop_off" },
            { label: "qualified_visit_rate (FR-371-b)", value: "qualified_visit_rate" },
            { label: "source_quality (FR-371-c)", value: "source_quality" },
            { label: "zero_result_searches (FR-371-d)", value: "zero_result_searches" },
            { label: "roas_deviation (FR-371-e)", value: "roas_deviation" },
            { label: "data_quality (FR-371-f)", value: "data_quality" },
          ],
        },
        {
          name: "cooldownDays",
          type: "number",
          defaultValue: 7,
          min: 1,
          max: 30,
          label: adminLabel("Cooldown (дни)", "Cooldown (days)"),
          admin: {
            description: adminLabel(
              "FR-383. Период, в течение которого один evaluator не создаёт повторный proposal по тому же targetPath.",
              "FR-383. Period during which evaluator does not create duplicate proposal for same targetPath.",
            ),
          },
        },
        {
          name: "rateLimit",
          type: "group",
          label: adminLabel("Rate-limit", "Rate-limit"),
          fields: [
            {
              name: "maxApiCallsPerMinute",
              type: "number",
              defaultValue: 100,
              min: 10,
              max: 500,
              label: adminLabel("Max calls/min", "Max calls/min"),
            },
            {
              name: "backoffOnRateLimit",
              type: "checkbox",
              defaultValue: true,
              label: adminLabel("Exponential backoff на 429", "Exponential backoff on 429"),
            },
          ],
        },
      ],
    },

    // ============================================================
    // qualifiedVisit thresholds (FR-211)
    // ============================================================
    {
      type: "group",
      name: "qualifiedVisit",
      label: adminLabel("Качественный визит (qualified_visit)", "Qualified visit"),
      admin: {
        description: adminLabel(
          "FR-211. Параметры цели qualified_visit. Если share <5% или >90% — evaluator предложит подстроить.",
          "FR-211. qualified_visit goal parameters. If share <5% or >90% — evaluator proposes adjust.",
        ),
      },
      fields: [
        {
          name: "minDurationSeconds",
          type: "number",
          defaultValue: 30,
          min: 10,
          max: 600,
          label: adminLabel("Мин. длительность (сек)", "Min duration (sec)"),
        },
        {
          name: "minPageDepth",
          type: "number",
          defaultValue: 2,
          min: 1,
          max: 10,
          label: adminLabel("Мин. глубина (страниц)", "Min depth (pages)"),
        },
        {
          name: "excludeBounce",
          type: "checkbox",
          defaultValue: true,
          label: adminLabel("Исключить bounce", "Exclude bounce"),
        },
      ],
    },

    // ============================================================
    // Brand keywords для split brand/non-brand (FR-232)
    // ============================================================
    {
      name: "brandKeywords",
      type: "array",
      label: adminLabel("Brand-ключевые слова", "Brand keywords"),
      defaultValue: [{ keyword: "soliton" }, { keyword: "солитон" }, { keyword: "pdumarket" }],
      fields: [{ name: "keyword", type: "text", required: true }],
      admin: {
        description: adminLabel(
          "FR-232. Подстроки для классификации brand vs non-brand запросов.",
          "FR-232. Substrings for brand vs non-brand query classification.",
        ),
      },
    },

    // ============================================================
    // Referrer host-patterns (FR-241)
    // ============================================================
    {
      name: "referrerPatterns",
      type: "array",
      label: adminLabel("Реферер: host-паттерны", "Referrer host patterns"),
      admin: {
        description: adminLabel(
          "FR-241. Список glob-паттернов для классификации реферера по каналам.",
          "FR-241. Glob-pattern list for referrer→channel classification.",
        ),
      },
      defaultValue: [
        {
          channel: "organic_yandex",
          priority: 10,
          enabled: true,
          hostPatterns: [{ pattern: "yandex.ru" }, { pattern: "yandex.by" }, { pattern: "ya.ru" }],
        },
        {
          channel: "organic_google",
          priority: 10,
          enabled: true,
          hostPatterns: [{ pattern: "google.com" }, { pattern: "google.ru" }],
        },
        {
          channel: "organic_ai",
          priority: 20,
          enabled: true,
          hostPatterns: [
            { pattern: "perplexity.ai" },
            { pattern: "chatgpt.com" },
            { pattern: "chat.openai.com" },
            { pattern: "claude.ai" },
            { pattern: "you.com" },
            { pattern: "phind.com" },
            { pattern: "copilot.microsoft.com" },
          ],
        },
        {
          channel: "social",
          priority: 30,
          enabled: true,
          hostPatterns: [{ pattern: "vk.com" }, { pattern: "t.me" }, { pattern: "telegram.me" }],
        },
        {
          channel: "marketplace_outbound",
          priority: 40,
          enabled: true,
          hostPatterns: [{ pattern: "wildberries.ru" }, { pattern: "ozon.ru" }],
        },
      ],
      fields: [
        {
          name: "channel",
          type: "select",
          required: true,
          options: [
            { label: "organic_yandex", value: "organic_yandex" },
            { label: "organic_google", value: "organic_google" },
            { label: "organic_images_yandex", value: "organic_images_yandex" },
            { label: "organic_images_google", value: "organic_images_google" },
            { label: "organic_maps_yandex", value: "organic_maps_yandex" },
            { label: "organic_maps_google", value: "organic_maps_google" },
            { label: "organic_marketplace_yandex_market", value: "organic_marketplace_yandex_market" },
            { label: "organic_ai", value: "organic_ai" },
            { label: "paid_yandex_direct", value: "paid_yandex_direct" },
            { label: "paid_google_ads", value: "paid_google_ads" },
            { label: "social", value: "social" },
            { label: "marketplace_outbound", value: "marketplace_outbound" },
            { label: "referral", value: "referral" },
          ],
        },
        { name: "priority", type: "number", required: true, defaultValue: 50 },
        { name: "enabled", type: "checkbox", defaultValue: true },
        {
          name: "hostPatterns",
          type: "array",
          fields: [{ name: "pattern", type: "text", required: true }],
        },
      ],
    },

    // ============================================================
    // Bot UA patterns (FR-080, deferred v1.2 — но schema готова)
    // ============================================================
    {
      name: "botUserAgentPatterns",
      type: "array",
      label: adminLabel("Боты: UA-паттерны (v1.2)", "Bot UA patterns (v1.2)"),
      defaultValue: [
        { pattern: "ClaudeBot" },
        { pattern: "GPTBot" },
        { pattern: "PerplexityBot" },
        { pattern: "Google-Extended" },
        { pattern: "CCBot" },
        { pattern: "Yandex-AI" },
        { pattern: "GigaChat-Bot" },
        { pattern: "Bytespider" },
      ],
      fields: [{ name: "pattern", type: "text", required: true }],
      admin: {
        description: adminLabel(
          "FR-080. Substrings для классификации visitor_type=bot. В v1 — fallback на штатную Metrika-фильтрацию.",
          "FR-080. Substrings for visitor_type=bot classification. v1 — fallback to Metrika built-in filter.",
        ),
      },
    },

    // ============================================================
    // Soft 404 markers (FR-251, v1.2 — но schema готова)
    // ============================================================
    {
      name: "soft404Markers",
      type: "array",
      label: adminLabel("Soft 404 маркеры (v1.2)", "Soft 404 markers (v1.2)"),
      defaultValue: [
        { marker: "не найдено" },
        { marker: "нет в наличии" },
        { marker: "снят с производства" },
      ],
      fields: [{ name: "marker", type: "text", required: true }],
    },

    // ============================================================
    // Goal-ID synced (с metrika.config.ts via apply-config)
    // ============================================================
    {
      name: "goalMapping",
      type: "array",
      label: adminLabel("Goal-ID синхронизация (read-only)", "Goal-ID sync (read-only)"),
      admin: {
        readOnly: true,
        description: adminLabel(
          "FR-292. Output `pnpm metrika:apply-config`. Не редактировать руками — синхронизируется автоматически.",
          "FR-292. Output of `pnpm metrika:apply-config`. Do not edit manually — synced automatically.",
        ),
      },
      fields: [
        { name: "eventName", type: "text", required: true },
        { name: "metrikaGoalId", type: "number" },
        { name: "businessMeaning", type: "text" },
        { name: "lastSyncAt", type: "date" },
      ],
    },

    // Audit
    {
      type: "group",
      name: "audit",
      label: adminLabel("Аудит", "Audit"),
      admin: { readOnly: true },
      fields: [
        { name: "lastChangedBy", type: "relationship", relationTo: "users" },
        { name: "lastChangedAt", type: "date" },
      ],
    },
  ],
  hooks: {
    afterChange: [
      async ({ req, doc, previousDoc }) => {
        if (req?.user && !req.context?.skipAnalyticsSettingsAudit) {
          try {
            await req.payload.updateGlobal({
              slug: "analytics-settings",
              data: {
                audit: {
                  lastChangedBy: req.user.id,
                  lastChangedAt: new Date().toISOString(),
                },
              },
              context: { skipAnalyticsSettingsAudit: true },
            });
          } catch {
            // ignore
          }

          // Лог в admin-change-log (FR-103)
          try {
            await req.payload.create({
              collection: "admin-change-log",
              data: {
                actorType: "user",
                actorName: req.user.email ?? "unknown",
                targetCollection: "globals/analytics-settings",
                targetLabel: "Analytics Settings",
                changeType: "update",
                diffSummary: JSON.stringify({
                  agentEnabledFrom: (previousDoc as { activation?: { agentEnabled?: boolean } })?.activation
                    ?.agentEnabled,
                  agentEnabledTo: (doc as { activation?: { agentEnabled?: boolean } })?.activation?.agentEnabled,
                }),
              },
            });
          } catch {
            // ignore
          }
        }
      },
    ],
  },
};
