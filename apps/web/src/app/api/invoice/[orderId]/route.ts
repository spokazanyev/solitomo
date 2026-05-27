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

function resolveWarehouseAddress(contacts: ReturnType<typeof getCompanyContacts>): string {
  const actual = contacts.actualAddress?.trim() ?? "";
  if (actual && !actual.startsWith("TODO")) return actual;

  const legal = contacts.legalAddress?.trim() ?? "";
  if (legal && !legal.startsWith("TODO")) return legal;

  return "адрес уточнит менеджер";
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
    delivery?: { method?: string; handoverNote?: string };
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
  if (contacts.okpo) doc.text(`ОКПО: ${contacts.okpo}`);
  if (contacts.legalAddress && !contacts.legalAddress.startsWith("TODO")) doc.text(`Юр. адрес: ${contacts.legalAddress}`);
  if (contacts.actualAddress && !contacts.actualAddress.startsWith("TODO")) doc.text(`Факт. адрес: ${contacts.actualAddress}`);
  if (contacts.banking) {
    doc.text(`Банк: ${contacts.banking.bankName}`);
    doc.text(`БИК: ${contacts.banking.bik}`);
    doc.text(`Р/с: ${contacts.banking.settlementAccount}`);
    doc.text(`К/с: ${contacts.banking.correspondentAccount}`);
  }
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

  // 062 FR-062-31: режимы доставки определяют отображение строки «Доставка»
  // и наличие блока «Примечания» ниже по странице.
  const deliveryMethod = (o.delivery as { method?: string } | undefined)?.method;
  const handoverNote = (o.delivery as { handoverNote?: string } | undefined)?.handoverNote?.trim() ?? "";
  const isPickup = deliveryMethod === "pickup";
  const isOwnCarrier = deliveryMethod === "own_carrier" || deliveryMethod === "tc"; // legacy tc tolerance
  const isApiShipMethod = !isPickup && !isOwnCarrier;

  doc.fontSize(10).text(`Сумма позиций: ${formatRub(subtotal)}`, { align: "right" });
  doc.text(`В т.ч. НДС 20%: ${formatRub(vat)}`, { align: "right" });
  if (isApiShipMethod && delivery > 0) {
    doc.text(`Доставка: ${formatRub(delivery)}`, { align: "right" });
  }
  doc.fontSize(12).fillColor("#0f172a").text(`Итого к оплате: ${formatRub(total)}`, { align: "right" });
  doc.moveDown(2);

  // Footer
  doc.fontSize(9).fillColor("#64748b");
  doc.text("Оплата производится по реквизитам поставщика. Заказ начинает движение после поступления оплаты.");
  doc.moveDown(0.4);
  if (contacts.vatPolicy) doc.text(contacts.vatPolicy);
  doc.moveDown(0.4);

  // 062 FR-062-32: блок «Примечания» для pickup и own_carrier (включая legacy tc).
  // Для ApiShip-режимов блок не показывается.
  if (isPickup || isOwnCarrier) {
    doc.moveDown(0.4);
    doc.fillColor("#0f172a").fontSize(11).text("Примечания", { underline: true });
    doc.fontSize(10).fillColor("#334155");

    if (isPickup) {
      const warehouseAddress = resolveWarehouseAddress(contacts);
      doc.text(`Самовывоз со склада: ${warehouseAddress}`);
      if (handoverNote) {
        doc.text(`Получатель: ${handoverNote}`);
      }
    }

    if (isOwnCarrier) {
      if (handoverNote) {
        doc.text(`Отгрузка транспортной компанией покупателя: ${handoverNote}`);
      } else {
        // Legacy data path: order created before 062 without handoverNote
        doc.text("Отгрузка транспортной компанией покупателя (по согласованию с менеджером).");
      }
    }
    doc.moveDown(0.4);
  }

  if (contacts.director) {
    doc.text(`${contacts.director.position}: ___________________ / ${contacts.director.fullName} /`, { align: "left" });
  }
  doc.moveDown(0.4);
  doc.text("М.П.", { align: "left" });

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
