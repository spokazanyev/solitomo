/**
 * send-test-emails.mjs — тестовая рассылка всей цепочки писем клиенту.
 *
 * Отправляет все 10 клиентских шаблонов (T-001..T-009, T-015) на указанный адрес
 * через Unisender Go напрямую (минуя EMAIL_SANDBOX и Payload-стек).
 *
 * Запуск:
 *   DEST=svp@redbc.ru pnpm exec tsx scripts/send-test-emails.mjs
 *   # или без DEST — дефолт тоже svp@redbc.ru
 */

// ─── Mock server-only (templates chain imports it through types → lifecycle) ──
// tsx не Strip-ает server-only в ESM; регистрируем пустой модуль вместо него.
import { register } from "node:module";
import { MessageChannel } from "node:worker_threads";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── Env ──────────────────────────────────────────────────────────────────────
process.env.SITE_URL = "https://pdumarket.ru";

const API_KEY = process.env.EMAIL_API_KEY ?? "6ex6xt5ifi1pw8bdpda6uenkug4wethy7ffr4pso";
const BASE_URL =
  process.env.UNISENDER_GO_BASE_URL ?? "https://go2.unisender.ru/ru/transactional/api/v1";
const FROM_EMAIL = "orders@pdumarket.ru";
const FROM_NAME  = "PDU Market";
const REPLY_TO   = "support@pdumarket.ru";
const DEST       = process.env.DEST ?? "svp@redbc.ru";

// ─── Minimal mock OrderSnapshot ───────────────────────────────────────────────
/** @type {import('../src/lib/lifecycle/events').OrderSnapshot} */
const mockOrder = {
  id:          "SO-2026-0001",
  publicToken: "test-token-abc123",
  status:      "paid",
  customer: {
    fullName:    "Показаньев Виктор Григорьевич",
    email:       DEST,
    phone:       "+7 (343) 370-33-42",
    companyName: null,
  },
  billing: {
    name:    "Показаньев Виктор",
    email:   DEST,
    phone:   "+7 (343) 370-33-42",
    address: "620034, г. Екатеринбург, ул. Щорса, д. 7",
  },
  items: [
    {
      sku:       "PDU-1U-8C13-EU",
      name:      "PDU 1U 8×C13 (EU) Soliton",
      qty:       2,
      unitPrice: 12500,
      total:     25000,
    },
    {
      sku:       "PDU-1U-4C13-RU-UZIP",
      name:      "PDU 1U 4×C13 с УЗИП",
      qty:       1,
      unitPrice: 18900,
      total:     18900,
    },
  ],
  totals: {
    subtotal: 43900,
    shipping: 450,
    total:    44350,
  },
  shipping: {
    method:      "cdek",
    trackNumber: "1234567890",
    estimatedAt: "2026-05-30",
    address:     "620034, г. Екатеринбург, ул. Щорса, д. 7, корпус Р",
    point: {
      code:    "EKB001",
      address: "г. Екатеринбург, ул. Малышева, 51",
      phone:   "+7 (800) 250-04-99",
    },
    courierDate: "2026-05-28",
    courierSlot: "10:00–14:00",
  },
  paymentMethod: "card",
  invoiceUrl:    "https://pdumarket.ru/invoices/SO-2026-0001.pdf",
  clientNumber:  "SO-2026-0001",
  createdAt:     "2026-05-26T10:00:00.000Z",
  updatedAt:     "2026-05-26T12:00:00.000Z",
};

const mockPayload = {
  order: mockOrder,
  event: { kind: "order.paid", at: new Date().toISOString() },
};

// ─── Load templates (dynamic import so tsx resolves TS) ──────────────────────
const SRC = path.resolve(ROOT, "src/lib/notifications/templates");

async function loadTemplates() {
  // server-only stub — регистрируем фейковый резолвер чтобы пустой файл не упал
  // (tsx уже умеет игнорировать import "server-only" в некоторых режимах — если
  //  упадёт, перехватываем внизу)
  const [
    { renderT001Paid },
    { renderT002InvoiceIssued },
    { renderT003Shipped },
    { renderT004AtPoint },
    { renderT005Delivered },
    { renderT006CourierToday },
    { renderT007PickupReminder },
    { renderT008Completed },
    { renderT009Cancelled },
    { renderT015PaymentExpired },
  ] = await Promise.all([
    import(path.join(SRC, "t-001-paid.ts")),
    import(path.join(SRC, "t-002-invoice.ts")),
    import(path.join(SRC, "t-003-shipped.ts")),
    import(path.join(SRC, "t-004-at-point.ts")),
    import(path.join(SRC, "t-005-delivered.ts")),
    import(path.join(SRC, "t-006-courier-today.ts")),
    import(path.join(SRC, "t-007-pickup-reminder.ts")),
    import(path.join(SRC, "t-008-completed.ts")),
    import(path.join(SRC, "t-009-cancelled.ts")),
    import(path.join(SRC, "t-015-payment-expired.ts")),
  ]);

  return [
    { id: "T-001", label: "Заказ оплачен",                fn: renderT001Paid },
    { id: "T-002", label: "Счёт выставлен (юрлицо)",      fn: renderT002InvoiceIssued },
    { id: "T-003", label: "Заказ отгружен",                fn: renderT003Shipped },
    { id: "T-004", label: "Посылка в ПВЗ",                 fn: renderT004AtPoint },
    { id: "T-005", label: "Посылка доставлена",            fn: renderT005Delivered },
    { id: "T-006", label: "Курьер сегодня",                fn: renderT006CourierToday },
    { id: "T-007", label: "Напоминание о самовывозе",      fn: renderT007PickupReminder },
    { id: "T-008", label: "Заказ выполнен (завершён)",     fn: renderT008Completed },
    { id: "T-009", label: "Заказ отменён",                 fn: renderT009Cancelled },
    { id: "T-015", label: "Платёж истёк (не оплачен)",     fn: renderT015PaymentExpired },
  ];
}

// ─── Unisender Go sender ──────────────────────────────────────────────────────
async function sendEmail({ to, subject, text, html, listUnsubscribeUrl }) {
  const message = {
    recipients: [{ email: to }],
    body: {
      ...(html ? { html } : {}),
      plaintext: text,
    },
    subject,
    from_email: FROM_EMAIL,
    from_name:  FROM_NAME,
    reply_to:   REPLY_TO,
    // list_unsubscribe подавляет авто-футер Unisender и ставит List-Unsubscribe header.
    ...(listUnsubscribeUrl ? { list_unsubscribe: listUnsubscribeUrl } : {}),
    track_links: 0,
    track_read:  0,
  };

  const res = await fetch(`${BASE_URL}/email/send.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY":    API_KEY,
    },
    body: JSON.stringify({ message }),
  });

  const raw = await res.text().catch(() => "");
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* ok */ }

  return { http: res.status, data, raw };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📧  Test email blast → ${DEST}`);
  console.log(`    Unisender Go: ${BASE_URL}`);
  console.log(`    API key:      ${API_KEY.slice(0, 8)}…\n`);

  let templates;
  try {
    templates = await loadTemplates();
  } catch (err) {
    console.error("❌  Failed to load templates:", err.message);
    process.exit(1);
  }

  const results = [];

  for (const tpl of templates) {
    let rendered;
    try {
      rendered = tpl.fn(mockPayload);
    } catch (err) {
      console.error(`❌  ${tpl.id} render error: ${err.message}`);
      results.push({ id: tpl.id, label: tpl.label, status: "render_error" });
      continue;
    }

    try {
      const { http, data } = await sendEmail({
        to:                 DEST,
        subject:            rendered.subject,
        text:               rendered.text,
        html:               rendered.html,
        listUnsubscribeUrl: rendered.listUnsubscribeUrl,
      });

      if (data?.status === "success") {
        const ref = data.emails?.[0]?.id ?? data.job_id ?? "—";
        console.log(`✅  ${tpl.id}  "${rendered.subject}"  → ${ref}`);
        results.push({ id: tpl.id, label: tpl.label, status: "sent", ref });
      } else {
        const msg = data?.status === "error"
          ? `code ${data.code}: ${data.message}`
          : `HTTP ${http}: ${String(data?.raw ?? "").slice(0, 120)}`;
        console.error(`❌  ${tpl.id}  "${rendered.subject}"  → ${msg}`);
        results.push({ id: tpl.id, label: tpl.label, status: "failed", error: msg });
      }
    } catch (err) {
      console.error(`❌  ${tpl.id} send error: ${err.message}`);
      results.push({ id: tpl.id, label: tpl.label, status: "send_error" });
    }

    // небольшая пауза чтобы не словить rate-limit
    await new Promise(r => setTimeout(r, 400));
  }

  const sent   = results.filter(r => r.status === "sent").length;
  const failed = results.length - sent;
  console.log(`\n────────────────────────────────────────`);
  console.log(`  Итог: ${sent} отправлено, ${failed} ошибок из ${results.length} шаблонов`);
  console.log(`  Проверяйте почту: ${DEST}`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
