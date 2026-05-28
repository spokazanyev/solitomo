import fs from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import configPromise from "@payload-config";
import { getPayload } from "payload";
import PDFDocument from "pdfkit";

import { getCompanyContacts } from "@/lib/company/get-company-contacts";
import { amountInWords } from "@/lib/documents/amount-in-words";

// 062 hot-fix: PDFkit built-in Helvetica поддерживает только latin-1. Для
// кириллических счетов нужен Unicode-шрифт. На production-образе (alpine)
// установлен пакет `font-dejavu` (см. deploy/Dockerfile). На dev/macOS файла
// нет — graceful fallback на Helvetica (PDF «крокозябрами» на dev, приемлемо).
const CYRILLIC_FONT_CANDIDATES = [
  process.env.PDF_CYRILLIC_FONT_PATH,
  "/usr/share/fonts/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/TTF/DejaVuSans.ttf",
  "/Library/Fonts/Arial Unicode.ttf",
].filter(Boolean) as string[];

const CYRILLIC_BOLD_FONT_CANDIDATES = [
  process.env.PDF_CYRILLIC_BOLD_FONT_PATH,
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
].filter(Boolean) as string[];

// Печать + подпись директора (PNG с прозрачным фоном). Кладётся в репозиторий
// по одному из путей ниже; если файла нет — в PDF остаётся место «М.П.».
const STAMP_CANDIDATES = [
  process.env.INVOICE_STAMP_PATH,
  path.join(process.cwd(), "public/brand/stamp-signature.png"),
  path.join(process.cwd(), "apps/web/public/brand/stamp-signature.png"),
].filter(Boolean) as string[];

function firstExisting(candidates: string[]): string | null {
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      // ignore
    }
  }
  return null;
}

type RouteContext = { params: Promise<{ orderId: string }> };

/** Число → "6 440,00" (ru-RU, 2 знака, без символа валюты). */
function fmt(amount: number | undefined | null): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "0,00";
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** "Показаньев Виктор Григорьевич" → "Показаньев В.Г." */
function shortName(fullName: string | undefined): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return "";
  const surname = parts[0];
  const initials = parts
    .slice(1)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + ".")
    .join("");
  return initials ? `${surname} ${initials}` : surname;
}

function resolveWarehouseAddress(contacts: ReturnType<typeof getCompanyContacts>): string {
  const actual = contacts.actualAddress?.trim() ?? "";
  if (actual && !actual.startsWith("TODO")) return actual;
  const legal = contacts.legalAddress?.trim() ?? "";
  if (legal && !legal.startsWith("TODO")) return legal;
  return "адрес уточнит менеджер";
}

const VAT_RATE = 22; // % — НДС по ФЗ-425 (с 2025). vat = gross * 22/122.

export async function GET(_request: NextRequest, context: RouteContext) {
  const { orderId } = await context.params;
  const payload = await getPayload({ config: configPromise });

  let order: Record<string, unknown> | null = null;
  try {
    order = (await payload.findByID({ collection: "orders", id: orderId })) as unknown as Record<
      string,
      unknown
    >;
  } catch {
    const found = await payload.find({
      collection: "orders",
      where: { publicToken: { equals: orderId } },
      limit: 1,
    });
    order = (found.docs[0] as unknown as Record<string, unknown>) ?? null;
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const o = order as {
    id: string;
    clientNumber?: string;
    items?: Array<{ sku?: string; name?: string; quantity?: number; price?: number | null; lineTotal?: number | null }>;
    totals?: { subtotal?: number; vat?: number; deliveryCost?: number; total?: number };
    customer?: { fullName?: string; email?: string; companyName?: string; inn?: string; kpp?: string; legalAddress?: string };
    invoice?: { number?: string; issuedAt?: string };
    delivery?: { method?: string; handoverNote?: string };
    createdAt: string;
  };

  const contacts = getCompanyContacts();
  const invoiceNumber = o.invoice?.number ?? o.clientNumber ?? `${String(o.id)}`;
  const invoiceDate = new Date(o.invoice?.issuedAt ?? o.createdAt);

  // ─── НДС-модель (по решению владельца) ───────────────────────────────────
  // Каталожные цены — С НДС (gross). В счёте выделяем цену без НДС (net =
  // gross / 1.22), начисляем НДС 22% на net; Итого (gross) = сумма каталожных
  // цен. То есть НДС выделяется «из суммы с НДС».
  const items = (o.items ?? []).filter((it) => it.sku || it.name);
  const grossOf = (it: { price?: number | null; quantity?: number; lineTotal?: number | null }) =>
    typeof it.lineTotal === "number"
      ? it.lineTotal
      : (it.price ?? 0) * (it.quantity ?? 1);
  const netOf = (gross: number) => gross / (1 + VAT_RATE / 100);

  const goodsGross = items.reduce((s, it) => s + grossOf(it), 0);
  const deliveryMethod = o.delivery?.method;
  const handoverNote = o.delivery?.handoverNote?.trim() ?? "";
  const isPickup = deliveryMethod === "pickup";
  const isOwnCarrier = deliveryMethod === "own_carrier" || deliveryMethod === "tc";
  const isApiShipMethod = !isPickup && !isOwnCarrier;
  const deliveryGross = isApiShipMethod ? o.totals?.deliveryCost ?? 0 : 0;

  const totalGross = goodsGross + deliveryGross;
  const vat = Math.round(((totalGross * VAT_RATE) / (100 + VAT_RATE)) * 100) / 100;
  const subtotalNet = Math.round((totalGross - vat) * 100) / 100;
  const totalQty = items.reduce((s, it) => s + (it.quantity ?? 1), 0);

  // ─── PDF setup ───────────────────────────────────────────────────────────
  const buffers: Buffer[] = [];
  const MARGIN = 40;
  const doc = new PDFDocument({ size: "A4", margin: MARGIN });
  doc.on("data", (chunk: Buffer) => buffers.push(chunk));
  const finished = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
  });

  const FONT = "Cyr";
  const FONT_BOLD = "CyrBold";
  const cyr = firstExisting(CYRILLIC_FONT_CANDIDATES);
  const cyrBold = firstExisting(CYRILLIC_BOLD_FONT_CANDIDATES);
  if (cyr) {
    doc.registerFont(FONT, cyr);
    doc.registerFont(FONT_BOLD, cyrBold ?? cyr);
    doc.font(FONT);
  }
  const useFont = (bold = false) => doc.font(cyr ? (bold ? FONT_BOLD : FONT) : "Helvetica");

  const pageLeft = MARGIN;
  const pageRight = doc.page.width - MARGIN; // 595 - 40 = 555
  const contentWidth = pageRight - pageLeft;
  const ink = "#0f172a";
  const muted = "#475569";

  // ─── Заголовок: СЧЁТ № NNNN ... дата ─────────────────────────────────────
  useFont(true);
  doc.fontSize(20).fillColor(ink).text(`СЧЁТ № ${invoiceNumber}`, pageLeft, MARGIN, {
    continued: false,
  });
  useFont(false);
  doc
    .fontSize(11)
    .fillColor(muted)
    .text(`от ${invoiceDate.toLocaleDateString("ru-RU")}`, pageLeft, MARGIN + 6, {
      width: contentWidth,
      align: "right",
    });
  doc.moveTo(pageLeft, MARGIN + 32).lineTo(pageRight, MARGIN + 32).lineWidth(1.2).strokeColor(ink).stroke();

  // ─── Двухколоночная шапка: Поставщик/Получатель (слева) + Банк (справа) ───
  const headTop = MARGIN + 44;
  const colGap = 24;
  const leftW = Math.round(contentWidth * 0.52);
  const rightX = pageLeft + leftW + colGap;
  const rightW = pageRight - rightX;

  const supplierName = contacts.legalName?.startsWith("TODO") ? contacts.brandName : contacts.legalName;
  const primaryPhone = contacts.phones?.find((p) => p.isPrimary) ?? contacts.phones?.[0];
  const primaryEmail = contacts.emails?.find((e) => e.isPrimary) ?? contacts.emails?.[0];

  // Левая колонка
  doc.fontSize(9.5).fillColor(ink);
  let ly = headTop;
  const leftLine = (text: string, bold = false, gap = 13) => {
    useFont(bold);
    doc.fillColor(ink).text(text, pageLeft, ly, { width: leftW });
    ly = doc.y + (gap - doc.currentLineHeight());
  };
  leftLine(`Поставщик: ${supplierName}`, true);
  if (primaryPhone) leftLine(`тел./факс: ${primaryPhone.value}`);
  if (primaryEmail) leftLine(`E-mail: ${primaryEmail.value}`);
  ly += 6;
  leftLine("Получатель:", true);
  if (o.customer?.companyName) leftLine(o.customer.companyName);
  {
    const innKpp = [o.customer?.inn ? `ИНН ${o.customer.inn}` : "", o.customer?.kpp ? `КПП ${o.customer.kpp}` : ""]
      .filter(Boolean)
      .join("  ");
    if (innKpp) leftLine(innKpp);
  }
  if (o.customer?.legalAddress) leftLine(`Адрес: ${o.customer.legalAddress}`);
  if (o.customer?.email) leftLine(`E-mail: ${o.customer.email}`);
  const leftEndY = ly;

  // Правая колонка — банковские реквизиты поставщика
  doc.fontSize(9.5);
  let ry = headTop;
  const rightLine = (text: string, bold = false, gap = 13) => {
    useFont(bold);
    doc.fillColor(ink).text(text, rightX, ry, { width: rightW });
    ry = doc.y + (gap - doc.currentLineHeight());
  };
  if (contacts.banking) {
    rightLine("Банковские реквизиты:", true);
    rightLine(`Р/сч: ${contacts.banking.settlementAccount}`);
    rightLine(`К/сч: ${contacts.banking.correspondentAccount}`);
    rightLine(contacts.banking.bankName);
    rightLine(`БИК: ${contacts.banking.bik}`);
  }
  {
    const innKpp = [contacts.inn ? `ИНН ${contacts.inn}` : "", contacts.kpp ? `КПП ${contacts.kpp}` : ""]
      .filter(Boolean)
      .join("  ");
    if (innKpp) rightLine(innKpp);
  }
  const rightEndY = ry;

  // ─── Таблица позиций ─────────────────────────────────────────────────────
  let y = Math.max(leftEndY, rightEndY) + 16;

  // Колонки: Товар | Кол | Цена | Стоимость
  const cTovar = pageLeft;
  const wTovar = Math.round(contentWidth * 0.56);
  const cKol = cTovar + wTovar;
  const wKol = 44;
  const cCena = cKol + wKol;
  const wCena = Math.round((contentWidth - wTovar - wKol) / 2);
  const cSum = cCena + wCena;
  const wSum = pageRight - cSum;
  const PAD = 5;

  const drawRow = (
    cells: { tovar: string; kol: string; cena: string; sum: string },
    opts: { bold?: boolean; header?: boolean } = {},
  ) => {
    useFont(opts.bold || opts.header);
    doc.fontSize(9).fillColor(ink);
    const nameH = doc.heightOfString(cells.tovar, { width: wTovar - 2 * PAD });
    const rowH = Math.max(nameH, doc.currentLineHeight()) + 2 * PAD;
    // page-break
    if (y + rowH > doc.page.height - MARGIN - 120) {
      doc.addPage();
      y = MARGIN;
    }
    if (opts.header) {
      doc.rect(cTovar, y, contentWidth, rowH).fillAndStroke("#f1f5f9", "#94a3b8");
      doc.fillColor(ink);
    } else {
      // cell borders
      doc.rect(cTovar, y, wTovar, rowH).strokeColor("#cbd5e1").lineWidth(0.6).stroke();
      doc.rect(cKol, y, wKol, rowH).stroke();
      doc.rect(cCena, y, wCena, rowH).stroke();
      doc.rect(cSum, y, wSum, rowH).stroke();
    }
    useFont(opts.bold || opts.header);
    doc.fillColor(ink);
    doc.text(cells.tovar, cTovar + PAD, y + PAD, { width: wTovar - 2 * PAD });
    doc.text(cells.kol, cKol + PAD, y + PAD, { width: wKol - 2 * PAD, align: "center" });
    doc.text(cells.cena, cCena + PAD, y + PAD, { width: wCena - 2 * PAD, align: "right" });
    doc.text(cells.sum, cSum + PAD, y + PAD, { width: wSum - 2 * PAD, align: "right" });
    y += rowH;
  };

  drawRow({ tovar: "Товар", kol: "Кол", cena: "Цена", sum: "Стоимость" }, { header: true });
  items.forEach((it) => {
    const gross = grossOf(it);
    const qty = it.quantity ?? 1;
    const net = netOf(gross);
    const unitNet = qty > 0 ? net / qty : net;
    drawRow({
      tovar: it.name ?? it.sku ?? "—",
      kol: String(qty),
      cena: fmt(unitNet),
      sum: fmt(net),
    });
  });
  if (deliveryGross > 0) {
    drawRow({
      tovar: "Доставка",
      kol: "1",
      cena: fmt(netOf(deliveryGross)),
      sum: fmt(netOf(deliveryGross)),
    });
  }

  // ─── Итоги (справа) ──────────────────────────────────────────────────────
  y += 8;
  const totalsX = cCena - 60;
  const totalsLabelW = cSum - totalsX - PAD;
  const totalLine = (label: string, value: string, bold = false, size = 10) => {
    useFont(bold);
    doc.fontSize(size).fillColor(ink);
    doc.text(label, totalsX, y, { width: totalsLabelW, align: "right" });
    doc.text(value, cSum + PAD, y, { width: wSum - 2 * PAD, align: "right" });
    y = doc.y + 3;
  };
  totalLine(`Итого (${totalQty} поз.), без НДС:`, fmt(subtotalNet), true);
  totalLine(`НДС ${VAT_RATE}%:`, fmt(vat));
  totalLine("Итого к оплате:", fmt(totalGross), true, 12);

  // ─── Сумма прописью ──────────────────────────────────────────────────────
  y += 10;
  useFont(true);
  doc.fontSize(10).fillColor(ink);
  doc.text(`Итого на сумму: ${amountInWords(totalGross)}.`, pageLeft, y, { width: contentWidth });
  y = doc.y + 2;
  useFont(false);
  doc.fontSize(9.5).fillColor(muted);
  doc.text(`В том числе НДС ${VAT_RATE}% — ${fmt(vat)} руб.`, pageLeft, y, { width: contentWidth });
  y = doc.y + 12;

  // ─── Условия оплаты ──────────────────────────────────────────────────────
  doc.fontSize(9).fillColor(muted);
  doc.text(
    "Оплата производится по реквизитам поставщика. Заказ начинает движение после поступления оплаты. Счёт действителен 5 банковских дней.",
    pageLeft,
    y,
    { width: contentWidth },
  );
  y = doc.y + 8;

  // ─── Примечания (062): pickup / own_carrier ──────────────────────────────
  if (isPickup || isOwnCarrier) {
    useFont(true);
    doc.fontSize(10).fillColor(ink).text("Примечания:", pageLeft, y, { width: contentWidth });
    y = doc.y + 2;
    useFont(false);
    doc.fontSize(9.5).fillColor("#334155");
    if (isPickup) {
      doc.text(`Самовывоз со склада: ${resolveWarehouseAddress(contacts)}.`, pageLeft, y, { width: contentWidth });
      y = doc.y + 1;
      if (handoverNote) {
        doc.text(`Получатель: ${handoverNote}`, pageLeft, y, { width: contentWidth });
        y = doc.y;
      }
    }
    if (isOwnCarrier) {
      doc.text(
        handoverNote
          ? `Отгрузка транспортной компанией покупателя: ${handoverNote}`
          : "Отгрузка транспортной компанией покупателя (по согласованию с менеджером).",
        pageLeft,
        y,
        { width: contentWidth },
      );
      y = doc.y;
    }
    y += 12;
  }

  // ─── Подписи + печать ────────────────────────────────────────────────────
  if (y > doc.page.height - MARGIN - 130) {
    doc.addPage();
    y = MARGIN;
  }
  y += 8;
  const issuer = contacts.responsiblePersons?.find((p) => /технич/i.test(p.position ?? ""));
  const issuerName = shortName(issuer?.fullName) || shortName(contacts.director?.fullName);
  useFont(false);
  doc.fontSize(10).fillColor(ink);
  doc.text(`Счёт оформил: ${issuerName}`, pageLeft, y, { width: contentWidth });
  y = doc.y + 14;

  const dirPos = contacts.director?.position ?? "Директор";
  const dirName = shortName(contacts.director?.fullName);
  const dirBrand = contacts.legalName?.startsWith("TODO") ? contacts.brandName : contacts.legalName;
  const dirLineY = y;
  // Строка директора без линии подписи и слешей — подпись ставит печать-PNG.
  doc.text(`${dirPos} ${dirBrand} ${dirName}`, pageLeft, y, { width: contentWidth * 0.55 });

  // Печать + подпись (PNG, прозрачный фон) — СПРАВА от строки директора,
  // по центру по вертикали относительно строки. Если файла нет — «М.П.».
  const stampPath = firstExisting(STAMP_CANDIDATES);
  if (stampPath) {
    try {
      const stampW = 185;
      const stampH = stampW * (554 / 1122); // ≈ 91pt
      const stampX = pageRight - stampW;
      let stampY = dirLineY - stampH / 2 + 6;
      if (stampY < MARGIN) stampY = MARGIN;
      if (stampY + stampH > doc.page.height - MARGIN) {
        doc.addPage();
        stampY = MARGIN;
      }
      doc.image(stampPath, stampX, stampY, { width: stampW });
    } catch {
      doc.fontSize(9).fillColor(muted).text("М.П.", pageRight - 70, dirLineY);
    }
  } else {
    doc.fontSize(9).fillColor(muted).text("М.П.", pageRight - 70, dirLineY);
  }

  doc.end();
  const buffer = await finished;

  // 062 hot-fix: HTTP-заголовки требуют latin-1 — экранируем кириллицу в имени.
  const pdfName = `Schet-${String(invoiceNumber).replace(/[^\x20-\x7E]/g, "_")}.pdf`;
  const utf8Name = encodeURIComponent(`Счёт-${invoiceNumber}.pdf`);
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdfName}"; filename*=UTF-8''${utf8Name}`,
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
