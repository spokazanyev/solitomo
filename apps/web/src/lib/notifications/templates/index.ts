/**
 * Реестр шаблонов email/messenger (049).
 *
 * Полноценные HTML-шаблоны: T-001, T-003, T-005, T-008.
 * Упрощённые (subject + text): T-002, T-004, T-006, T-007, T-009, T-101..T-105.
 * Messenger M-001/M-003/M-004/M-005 — text-only, для будущей спеки 050.
 *
 * Все шаблоны принимают NotificationJobPayload и возвращают RenderedMessage.
 */

import type { NotificationJobPayload, RenderedMessage } from "../types";
import { renderT001Paid } from "./t-001-paid";
import { renderT002InvoiceIssued } from "./t-002-invoice";
import { renderT003Shipped } from "./t-003-shipped";
import { renderT004AtPoint } from "./t-004-at-point";
import { renderT005Delivered } from "./t-005-delivered";
import { renderT006CourierToday } from "./t-006-courier-today";
import { renderT007PickupReminder } from "./t-007-pickup-reminder";
import { renderT008Completed } from "./t-008-completed";
import { renderT009Cancelled } from "./t-009-cancelled";
import {
  renderT101ManagerPaid,
  renderT102ManagerInvoice,
  renderT103ManagerError,
  renderT104ManagerStuck,
  renderT105ManagerCancelled,
} from "./t-1xx-manager";
import { renderMessenger } from "./m-messenger";

export type TemplateRenderer = (payload: NotificationJobPayload) => RenderedMessage;

const REGISTRY: Record<string, TemplateRenderer> = {
  "T-001": renderT001Paid,
  "T-002": renderT002InvoiceIssued,
  "T-003": renderT003Shipped,
  "T-004": renderT004AtPoint,
  "T-005": renderT005Delivered,
  "T-006": renderT006CourierToday,
  "T-007": renderT007PickupReminder,
  "T-008": renderT008Completed,
  "T-009": renderT009Cancelled,
  "T-101": renderT101ManagerPaid,
  "T-102": renderT102ManagerInvoice,
  "T-103": renderT103ManagerError,
  "T-104": renderT104ManagerStuck,
  "T-105": renderT105ManagerCancelled,
  "M-001": renderMessenger("paid"),
  "M-003": renderMessenger("shipped"),
  "M-004": renderMessenger("at_point"),
  "M-005": renderMessenger("delivered"),
};

export function getTemplateRenderer(templateId: string): TemplateRenderer | null {
  return REGISTRY[templateId] ?? null;
}

export function listTemplates(): string[] {
  return Object.keys(REGISTRY);
}
