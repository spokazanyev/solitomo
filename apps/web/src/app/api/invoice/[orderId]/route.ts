import { NextResponse, type NextRequest } from "next/server";
import configPromise from "@payload-config";
import { getPayload } from "payload";
import PDFDocument from "pdfkit";

import { getCompanyContacts } from "@/lib/company/get-company-contacts";

type RouteContext = { params: Promise<{ orderId: string }> };

function formatRub(amount: number | undefined | null) {
  if (typeof amount !== "number") return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(amount) + " ₽";
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { orderId } = await context.params;
  const payload = await getPayload({ config: configPromise });

  let order: Record<string, unknown> | null = null;
  try {
    order = (await payload.findByID({ collection: "orders", id: orderId })) as unknown as Record<string, unknown>;
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
    items?: Array<{ sku?: string; name?: string; quantity?: number; price?: number | null; lineTotal?: number | null }>;
    totals?: { subtotal?: number; vat?: number; deliveryCost?: number; total?: number };
    customer?: { fullName?: string; email?: string; companyName?: string; inn?: string; kpp?: string; legalAddress?: string };
    invoice?: { number?: string; issuedAt?: string };
    createdAt: string;
  };

  const contacts = getCompanyContacts();
  const invoiceNumber = o.invoice?.number ?? `СОЛ-${String(o.id).slice(-6).toUpperCase()}`;
  const invoiceDate = new Date(o.invoice?.issuedAt ?? o.createdAt);

  const buffers: Buffer[] = [];
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  doc.on("data", (chunk: Buffer) => buffers.push(chunk));
  const finished = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
  });

  // Header
  doc.fontSize(18).text(`Счёт № ${invoiceNumber}`, { align: "left" });
  doc.fontSize(10).fillColor("#475569");
  doc.text(`от ${invoiceDate.toLocaleDateString("ru-RU")}`, { align: "left" });
  doc.moveDown(1);

  // Seller
  doc.fillColor("#0f172a").fontSize(11).text("Поставщик", { underline: true });
  doc.fontSize(10).fillColor("#334155");
  doc.text(`${contacts.legalName.startsWith("TODO") ? contacts.brandName : contacts.legalName}`);
  if (contacts.inn) doc.text(`ИНН: ${contacts.inn}`);
  if (contacts.kpp) doc.text(`КПП: ${contacts.kpp}`);
  if (contacts.ogrn) doc.text(`ОГРН: ${contacts.ogrn}`);
  if (contacts.legalAddress && !contacts.legalAddress.startsWith("TODO")) doc.text(`Адрес: ${contacts.legalAddress}`);
  doc.text(`TODO(owner): расчётный счёт, банк, БИК, корр. счёт`);
  doc.moveDown(0.8);

  // Buyer
  doc.fillColor("#0f172a").fontSize(11).text("Плательщик", { underline: true });
  doc.fontSize(10).fillColor("#334155");
  if (o.customer?.companyName) doc.text(o.customer.companyName);
  if (o.customer?.inn) doc.text(`ИНН: ${o.customer.inn}`);
  if (o.customer?.kpp) doc.text(`КПП: ${o.customer.kpp}`);
  if (o.customer?.legalAddress) doc.text(`Адрес: ${o.customer.legalAddress}`);
  if (o.customer?.email) doc.text(`Email: ${o.customer.email}`);
  doc.moveDown(1);

  // Items table
  doc.fillColor("#0f172a").fontSize(11).text("Позиции", { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(9).fillColor("#475569");
  doc.text("№     SKU              Наименование                                       Кол-во   Цена         Сумма");
  doc.moveDown(0.2);
  doc.fillColor("#0f172a");
  (o.items ?? []).forEach((item, idx) => {
    const sku = (item.sku ?? "").padEnd(14, " ").slice(0, 14);
    const name = (item.name ?? "").padEnd(48, " ").slice(0, 48);
    const qty = String(item.quantity ?? 1).padStart(6, " ");
    const price = formatRub(item.price ?? null).padStart(12, " ");
    const total = formatRub(item.lineTotal ?? null).padStart(12, " ");
    doc.fontSize(9).text(`${String(idx + 1).padEnd(4, " ")} ${sku}  ${name}  ${qty}  ${price}  ${total}`);
  });
  doc.moveDown(1);

  // Totals
  const subtotal = o.totals?.subtotal ?? 0;
  const vat = o.totals?.vat ?? 0;
  const delivery = o.totals?.deliveryCost ?? 0;
  const total = o.totals?.total ?? 0;
  doc.fontSize(10).text(`Сумма позиций: ${formatRub(subtotal)}`, { align: "right" });
  doc.text(`В т.ч. НДС 20%: ${formatRub(vat)}`, { align: "right" });
  if (delivery > 0) doc.text(`Доставка: ${formatRub(delivery)}`, { align: "right" });
  doc.fontSize(12).fillColor("#0f172a").text(`Итого к оплате: ${formatRub(total)}`, { align: "right" });
  doc.moveDown(2);

  // Footer
  doc.fontSize(9).fillColor("#64748b");
  doc.text("Оплата производится по реквизитам поставщика. Заказ начинает движение после поступления оплаты.");
  doc.moveDown(0.4);
  doc.text("TODO(owner): подпись и печать.", { align: "left" });

  doc.end();
  const buffer = await finished;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceNumber}.pdf"`,
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
