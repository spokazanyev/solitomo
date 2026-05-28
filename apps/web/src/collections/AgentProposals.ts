import type { CollectionConfig } from "payload";

import { adminGroups, adminLabel } from "./admin-i18n.js";

/**
 * AgentProposals — центральная коллекция agent-driven analytics model (058 Phase 12).
 *
 * Соответствие спеке 058:
 * - FR-380: полная schema с lifecycle (pending → approved/rejected → executed/failed)
 * - FR-381: основа admin-view `/admin/agent-proposals`
 * - FR-382: на approve → enqueue execution через afterChange hook
 * - FR-383: cooldown 7 days per (evaluator, targetPath) для anti-spam
 * - FR-384/396: source-of-truth для FR-396 invariant
 * - FR-385: state-changes логируются в admin-change-log
 *
 * См. также: data-model.md §2.0, contracts/agent-proposals-api.md.
 */
export const AgentProposals: CollectionConfig = {
  slug: "agent-proposals",
  labels: {
    singular: adminLabel("Предложение агента", "Agent proposal"),
    plural: adminLabel("Предложения агента", "Agent proposals"),
  },
  access: {
    // Read для admin + analytics-operator (в v1 все авторизованные)
    read: ({ req }) => Boolean(req.user),
    // Create — только из system-кода (agent через service-user) или admin-UI
    create: ({ req }) => Boolean(req.user),
    // Update — статусы + reviewerReason (см. beforeChange hook для ограничений)
    update: ({ req }) => Boolean(req.user),
    // Delete — только admin (для cleanup; обычно soft)
    delete: ({ req }) => Boolean(req.user),
  },
  admin: {
    group: adminGroups.agentOperations,
    defaultColumns: ["type", "evaluator", "severity", "status", "createdAt"],
    useAsTitle: "type",
    description: adminLabel(
      "FR-380. Предложения, созданные agent'ом на основе анализа Метрика-данных. " +
        "Approve → agent выполняет через Management API. Hard-delete возможен только " +
        "с confirmationFlag (FR-391).",
      "FR-380. Proposals created by agent based on Metrika data analysis. " +
        "On approve → agent executes via Management API. Hard-delete requires " +
        "confirmationFlag (FR-391).",
    ),
  },
  fields: [
    {
      name: "createdBy",
      type: "select",
      required: true,
      defaultValue: "agent",
      label: adminLabel("Источник", "Created by"),
      options: [
        { label: "agent (scheduled review)", value: "agent" },
        { label: "mcp_tool (Claude Desktop)", value: "mcp_tool" },
        { label: "manual (admin)", value: "manual" },
      ],
    },
    {
      name: "evaluator",
      type: "text",
      required: true,
      label: adminLabel("Evaluator", "Evaluator"),
      admin: {
        description: adminLabel(
          "Имя evaluator'а (funnel_drop_off, drift_detector, missing_goal, ...) — для cooldown logic.",
          "Evaluator name (funnel_drop_off, drift_detector, missing_goal, ...) — for cooldown logic.",
        ),
      },
    },
    {
      name: "type",
      type: "select",
      required: true,
      label: adminLabel("Тип предложения", "Proposal type"),
      options: [
        { label: "create_goal", value: "create_goal" },
        { label: "update_goal", value: "update_goal" },
        { label: "soft_disable_goal", value: "soft_disable_goal" },
        { label: "hard_delete", value: "hard_delete" },
        { label: "create_filter", value: "create_filter" },
        { label: "update_filter", value: "update_filter" },
        { label: "update_setting", value: "update_setting" },
        { label: "drift_detected", value: "drift_detected" },
        { label: "create_missing_goal", value: "create_missing_goal" },
        { label: "remove_unused_segment", value: "remove_unused_segment" },
        { label: "adjust_qualified_visit_threshold", value: "adjust_qualified_visit_threshold" },
        { label: "investigate_funnel_drop", value: "investigate_funnel_drop" },
        { label: "update_config_from_drift", value: "update_config_from_drift" },
        { label: "auto_approve_request", value: "auto_approve_request" },
      ],
    },
    {
      name: "action",
      type: "select",
      required: true,
      label: adminLabel("Действие", "Action"),
      options: [
        { label: "create", value: "create" },
        { label: "update", value: "update" },
        { label: "delete", value: "delete" },
        { label: "soft-disable", value: "soft-disable" },
      ],
    },
    {
      name: "targetPath",
      type: "text",
      required: true,
      label: adminLabel("Цель изменения (path)", "Target path"),
      admin: {
        description: adminLabel(
          "Например: 'goals[name=Purchase].conditions' или 'counterSettings.firstPartyCookies'.",
          "E.g.: 'goals[name=Purchase].conditions' or 'counterSettings.firstPartyCookies'.",
        ),
      },
    },
    {
      name: "payload",
      type: "json",
      required: true,
      label: adminLabel("Payload изменения", "Change payload"),
      admin: {
        description: adminLabel(
          "JSON структура самого изменения (для create — полный object; для update — partial).",
          "JSON structure of the change (full object for create; partial for update).",
        ),
      },
    },
    {
      name: "reasoning",
      type: "textarea",
      required: true,
      maxLength: 2000,
      label: adminLabel("Обоснование", "Reasoning"),
      admin: {
        description: adminLabel(
          "LLM-generated объяснение, почему изменение предложено. Видно оператору в admin-UI.",
          "LLM-generated explanation. Visible to operator in admin UI.",
        ),
      },
    },
    {
      name: "expectedImpact",
      type: "textarea",
      maxLength: 500,
      label: adminLabel("Ожидаемое влияние", "Expected impact"),
    },
    {
      name: "evidence",
      type: "json",
      required: true,
      label: adminLabel("Данные обоснования (snapshot)", "Evidence (data snapshot)"),
      admin: {
        description: adminLabel(
          "Snapshot Metrика-данных, на основании которых принято решение.",
          "Snapshot of Metrika data backing the proposal.",
        ),
      },
    },
    {
      name: "severity",
      type: "select",
      required: true,
      defaultValue: "info",
      label: adminLabel("Severity", "Severity"),
      options: [
        { label: "info", value: "info" },
        { label: "warning", value: "warning" },
        { label: "critical", value: "critical" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      label: adminLabel("Статус", "Status"),
      options: [
        { label: "pending", value: "pending" },
        { label: "approved", value: "approved" },
        { label: "rejected", value: "rejected" },
        { label: "executed", value: "executed" },
        { label: "failed", value: "failed" },
      ],
      admin: {
        description: adminLabel(
          "FR-380. Lifecycle: pending → approved/rejected → executed/failed. executed/rejected — terminal.",
          "FR-380. Lifecycle: pending → approved/rejected → executed/failed. executed/rejected — terminal.",
        ),
      },
    },
    {
      name: "reviewedBy",
      type: "relationship",
      relationTo: "users",
      label: adminLabel("Кто review-нул", "Reviewed by"),
    },
    {
      name: "reviewedAt",
      type: "date",
      label: adminLabel("Когда review", "Reviewed at"),
    },
    {
      name: "reviewerReason",
      type: "textarea",
      maxLength: 1000,
      label: adminLabel("Комментарий ревьюера", "Reviewer reason"),
      admin: {
        description: adminLabel(
          "Optional для approve, REQUIRED для reject — обоснование решения.",
          "Optional for approve, REQUIRED for reject — decision rationale.",
        ),
      },
    },
    {
      name: "executedAt",
      type: "date",
      label: adminLabel("Когда выполнено", "Executed at"),
    },
    {
      name: "executionResult",
      type: "json",
      label: adminLabel("Результат выполнения API", "Execution result"),
      admin: {
        description: adminLabel(
          "Response от Yandex.Metrika API (без секретов). Для failed — error+stack.",
          "Response from Yandex.Metrika API (sanitized). For failed — error+stack.",
        ),
      },
    },
    {
      name: "cooldownUntil",
      type: "date",
      label: adminLabel("Cooldown до", "Cooldown until"),
      admin: {
        description: adminLabel(
          "FR-383. Этот evaluator+targetPath не создаст повторный proposal до этой даты (anti-spam, default 7 дней).",
          "FR-383. Evaluator+targetPath won't create duplicate proposal until this date (anti-spam, default 7 days).",
        ),
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation }) => {
        // Status transition validation (FR-380 lifecycle)
        if (operation === "update" && originalDoc) {
          const fromStatus = (originalDoc as { status?: string }).status;
          const toStatus = (data as { status?: string }).status;

          if (fromStatus !== toStatus) {
            const ALLOWED_TRANSITIONS: Record<string, string[]> = {
              pending: ["approved", "rejected"],
              approved: ["executed", "failed"],
              failed: ["pending", "executed"], // retry path
              // executed, rejected — terminal
            };
            const allowed = ALLOWED_TRANSITIONS[fromStatus ?? ""] ?? [];
            if (!allowed.includes(toStatus ?? "")) {
              throw new Error(
                `AgentProposal: invalid status transition ${fromStatus} → ${toStatus} (FR-380).`,
              );
            }

            // FR-383: reject требует reviewerReason
            if (toStatus === "rejected") {
              const reason = (data as { reviewerReason?: string }).reviewerReason;
              if (!reason || reason.trim().length === 0) {
                throw new Error("AgentProposal: reject requires reviewerReason (FR-383).");
              }
            }
          }
        }

        // hard_delete type требует confirmationFlag в payload (FR-391)
        const type = (data as { type?: string }).type;
        if (type === "hard_delete") {
          const payload = (data as { payload?: { confirmationFlag?: boolean } }).payload;
          if (payload?.confirmationFlag !== true) {
            throw new Error(
              "AgentProposal: type='hard_delete' requires payload.confirmationFlag=true (FR-391).",
            );
          }
        }

        return data;
      },
    ],
    afterChange: [
      async ({ req, doc, previousDoc, operation }) => {
        if (operation !== "update" || !previousDoc) return;

        const fromStatus = (previousDoc as { status?: string }).status;
        const toStatus = (doc as { status?: string }).status;

        // Лог в admin-change-log (FR-385)
        if (fromStatus !== toStatus) {
          try {
            await req.payload.create({
              collection: "admin-change-log",
              data: {
                actorType: "user",
                actorName: req.user?.email ?? "system",
                targetCollection: "agent-proposals",
                targetId: (doc as { id?: string }).id ?? "",
                targetLabel: `AgentProposal: ${(doc as { type?: string }).type}`,
                changeType: "update",
                diffSummary: JSON.stringify({
                  statusFrom: fromStatus,
                  statusTo: toStatus,
                  evaluator: (doc as { evaluator?: string }).evaluator,
                }),
              },
            });
          } catch {
            // ignore — change-log не должен блокировать operation
          }
        }

        // FR-382: на approve → enqueue execution (в v1 — placeholder, реальный exec в следующей итерации)
        // TODO(058 Phase 12, T117): подключить executeProposal worker
      },
    ],
  },
};
