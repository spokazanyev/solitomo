import type { CollectionConfig } from "payload";

import { adminGroups, adminLabel } from "./admin-i18n.js";

/**
 * AgentExecutionLog — immutable audit-log агентских вызовов Metrika API.
 *
 * Соответствие спеке 058:
 * - FR-375: каждый вызов agent → запись
 * - FR-396: invariant — каждая mutating-запись имеет proposalId | configApplyRunId | manualAdminUserId
 *
 * См. также: data-model.md §2.0a, contracts/metrika-management-api.md §«Audit-log Integration».
 *
 * Retention: 90 дней (cron-cleanup в v1.1).
 * Immutable: запрещены update и delete (даже admin).
 */
export const AgentExecutionLog: CollectionConfig = {
  slug: "agent-execution-log",
  labels: {
    singular: adminLabel("Лог агента", "Agent log"),
    plural: adminLabel("Логи агента", "Agent logs"),
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    // Only system-code создаёт записи (через payload.create из agent-кода)
    create: ({ req }) => Boolean(req.user),
    // Immutable — никаких update/delete
    update: () => false,
    delete: () => false,
  },
  admin: {
    group: adminGroups.agentOperations,
    defaultColumns: ["timestamp", "method", "endpoint", "responseStatus", "durationMs"],
    useAsTitle: "endpoint",
    description: adminLabel(
      "FR-375. Immutable audit-log API-вызовов Metrika из agent-кода. FR-396 invariant: " +
        "каждая mutating-запись имеет proposalId, configApplyRunId или manualAdminUserId.",
      "FR-375. Immutable audit-log of Metrika API calls from agent. FR-396 invariant: " +
        "every mutating record has proposalId, configApplyRunId or manualAdminUserId.",
    ),
  },
  fields: [
    {
      name: "timestamp",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      label: adminLabel("Когда", "Timestamp"),
      admin: { date: { pickerAppearance: "dayAndTime" } },
    },
    {
      name: "endpoint",
      type: "text",
      required: true,
      label: adminLabel("URL-path", "URL path"),
    },
    {
      name: "method",
      type: "select",
      required: true,
      label: adminLabel("HTTP method", "HTTP method"),
      options: [
        { label: "GET", value: "GET" },
        { label: "POST", value: "POST" },
        { label: "PUT", value: "PUT" },
        { label: "PATCH", value: "PATCH" },
        { label: "DELETE", value: "DELETE" },
      ],
    },
    {
      name: "requestParams",
      type: "json",
      label: adminLabel("Параметры запроса (sanitized)", "Request params (sanitized)"),
      admin: {
        description: adminLabel(
          "Query/body без секретов и без PII.",
          "Query/body without secrets and PII.",
        ),
      },
    },
    {
      name: "responseStatus",
      type: "number",
      required: true,
      label: adminLabel("HTTP status", "HTTP status"),
    },
    {
      name: "responseBodySummary",
      type: "textarea",
      maxLength: 1000,
      label: adminLabel("Краткий response body", "Response body summary"),
    },
    {
      name: "durationMs",
      type: "number",
      required: true,
      label: adminLabel("Длительность (ms)", "Duration (ms)"),
    },
    {
      name: "errorMessage",
      type: "text",
      label: adminLabel("Ошибка (если non-2xx)", "Error (if non-2xx)"),
    },
    {
      name: "proposalId",
      type: "relationship",
      relationTo: "agent-proposals",
      label: adminLabel("AgentProposal source", "AgentProposal source"),
      admin: {
        description: adminLabel(
          "FR-396. Если вызов сделан в результате approved-proposal.",
          "FR-396. Set if call originates from approved proposal.",
        ),
      },
    },
    {
      name: "configApplyRunId",
      type: "text",
      label: adminLabel("config-apply runId", "config-apply runId"),
      admin: {
        description: adminLabel(
          "FR-396. UUID одного прогона apply-config CLI.",
          "FR-396. UUID of single apply-config CLI run.",
        ),
      },
    },
    {
      name: "manualAdminUserId",
      type: "relationship",
      relationTo: "users",
      label: adminLabel("Manual admin (escape-hatch)", "Manual admin (escape-hatch)"),
    },
    {
      name: "evaluatorName",
      type: "text",
      label: adminLabel("Evaluator name (для read-only review-вызовов)", "Evaluator name"),
    },
    {
      name: "userAgent",
      type: "text",
      required: true,
      label: adminLabel("User-Agent", "User-Agent"),
      admin: {
        description: adminLabel(
          "MUST начинаться с 'Soliton-AnalyticsAgent/'.",
          "MUST start with 'Soliton-AnalyticsAgent/'.",
        ),
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation !== "create") {
          throw new Error("AgentExecutionLog is immutable (FR-375).");
        }

        // FR-396 invariant enforcement
        const method = (data as { method?: string }).method;
        const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method ?? "");
        if (isMutating) {
          const proposalId = (data as { proposalId?: unknown }).proposalId;
          const configApplyRunId = (data as { configApplyRunId?: string }).configApplyRunId;
          const manualAdminUserId = (data as { manualAdminUserId?: unknown }).manualAdminUserId;

          if (!proposalId && !configApplyRunId && !manualAdminUserId) {
            throw new Error(
              `AgentExecutionLog: mutating call (${method}) requires one of ` +
                `proposalId | configApplyRunId | manualAdminUserId (FR-396).`,
            );
          }
        }

        // User-Agent должен начинаться с 'Soliton-AnalyticsAgent/'
        const userAgent = (data as { userAgent?: string }).userAgent ?? "";
        if (!userAgent.startsWith("Soliton-AnalyticsAgent/")) {
          throw new Error(
            "AgentExecutionLog: userAgent must start with 'Soliton-AnalyticsAgent/' (FR-375).",
          );
        }

        return data;
      },
    ],
  },
};
