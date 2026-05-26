/**
 * Утилиты для шаблонов email (049).
 *
 * Намеренно простые TS-функции (без React-email) — MVP-компромисс.
 * FR-4913: render с fallback'ами на отсутствующие поля.
 */

import type { OrderSnapshot } from "../../lifecycle/events";

export function siteUrl(path: string): string {
  const base = process.env.SITE_URL ?? "https://pdumarket.ru";
  const clean = base.replace(/\/$/, "");
  if (!path) return clean;
  return `${clean}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function orderPageUrl(order: OrderSnapshot): string {
  return order.publicToken ? siteUrl(`/cart/order/${order.publicToken}/`) : "";
}

export function reviewPageUrl(order: OrderSnapshot): string {
  return order.publicToken ? siteUrl(`/cart/order/${order.publicToken}/review/`) : "";
}

export function preferencesPageUrl(order: OrderSnapshot): string {
  return order.publicToken ? siteUrl(`/preferences/${order.publicToken}/`) : "";
}

export function adminOrderUrl(orderId: string): string {
  const base = process.env.PAYLOAD_ADMIN_URL ?? siteUrl("/admin");
  return `${base.replace(/\/$/, "")}/collections/orders/${orderId}`;
}

export function formatPrice(amount: number | undefined | null): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    currency: "RUB",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

export function formatDate(value: string | undefined | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function customerName(order: OrderSnapshot): string {
  return (
    order.customer?.fullName?.trim() ||
    order.customer?.companyName?.trim() ||
    "уважаемый покупатель"
  );
}

export function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BASE_STYLES = {
  body: "background:#f5f5f0;margin:0;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;",
  container:
    "max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6e6dd;border-radius:8px;padding:32px;",
  h1: "font-size:20px;font-weight:600;margin:0 0 16px 0;color:#1a1a1a;",
  p: "font-size:15px;line-height:1.55;margin:0 0 12px 0;color:#333;",
  cta: "display:inline-block;padding:10px 18px;margin:16px 0;background:#3f6212;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:500;",
  muted: "font-size:13px;color:#6b6b5e;margin-top:24px;line-height:1.5;",
  hr: "border:0;border-top:1px solid #e6e6dd;margin:24px 0;",
};

interface HtmlOptions {
  preheader?: string;
  unsubscribeUrl?: string;
}

export function renderHtmlShell(bodyHtml: string, opts: HtmlOptions = {}): string {
  const preheader = opts.preheader ? escapeHtml(opts.preheader) : "";
  const unsubscribe = opts.unsubscribeUrl
    ? `<p style="${BASE_STYLES.muted}"><a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#6b6b5e;">Управление уведомлениями</a></p>`
    : "";
  return [
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>`,
    `<body style="${BASE_STYLES.body}">`,
    preheader
      ? `<div style="display:none;font-size:1px;color:transparent;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>`
      : "",
    `<div style="${BASE_STYLES.container}">`,
    bodyHtml,
    unsubscribe,
    `<p style="${BASE_STYLES.muted}">— Команда Soliton · pdumarket.ru</p>`,
    `</div></body></html>`,
  ].join("");
}

export const styles = BASE_STYLES;
