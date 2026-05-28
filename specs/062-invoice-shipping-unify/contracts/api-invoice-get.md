# Contract: GET `/api/invoice/[orderId]` — расширение PDF-счёта блоком «Примечания»

**Branch**: `062-invoice-shipping-unify` | **Phase**: 1 — Design | **Date**: 2026-05-27

Расширение существующего endpoint [/api/invoice/[orderId]/route.ts](../../../apps/web/src/app/api/invoice/[orderId]/route.ts) без breaking changes для существующих заказов.

---

## Request

`GET /api/invoice/<orderId>` (без изменений).

- `orderId` — Payload-ID **или** `publicToken`.
- Response — `Content-Type: application/pdf`, `inline` disposition.
- Headers: `Cache-Control: private, max-age=300`, `X-Robots-Tag: noindex` (без изменений).

---

## Response — PDF structure (изменения)

Layout счёта остаётся прежним. Изменения локализованы:

### 1. Условное отображение строки «Доставка» в табличной части итогов

**Логика**:

```ts
const method = o.delivery?.method;
const deliveryCost = o.totals?.deliveryCost ?? 0;

// Renaming + legacy compat: any of {own_carrier, tc} → own-carrier branch
const isPickup = method === "pickup";
const isOwnCarrier = method === "own_carrier" || method === "tc";  // legacy

const isApiShipMethod = !isPickup && !isOwnCarrier;
const showDeliveryLine = isApiShipMethod && deliveryCost > 0;

// Existing block:
// doc.text(`Сумма позиций: ${formatRub(subtotal)}`, { align: "right" });
// doc.text(`В т.ч. НДС 20%: ${formatRub(vat)}`, { align: "right" });
if (showDeliveryLine) {
  doc.text(`Доставка: ${formatRub(deliveryCost)}`, { align: "right" });
}
doc.fontSize(12).text(`Итого к оплате: ${formatRub(total)}`, { align: "right" });
```

**Result**:
- `cdek`/`boxberry`/`russian-post` + `cost>0` → строка «Доставка» отображается, как сейчас.
- `pickup`/`own_carrier`/`tc(legacy)` → строки «Доставка» нет.
- `cdek` + `cost=0` (fallback warning из 047) → строки «Доставка» нет, итог = subtotal+vat (как сейчас).

### 2. Новый блок «Примечания» (после стандартного footer-текста, до подписи)

**Расположение**: между блоком «Оплата производится по реквизитам поставщика…» и подписью директора.

**Логика**:

```ts
// Existing block end:
// doc.text("Оплата производится по реквизитам поставщика. Заказ начинает движение после поступления оплаты.");
// doc.moveDown(0.4);
// if (contacts.vatPolicy) doc.text(contacts.vatPolicy);
// doc.moveDown(0.4);

// NEW: блок «Примечания» для pickup и own_carrier
if (isPickup || isOwnCarrier) {
  const handoverNote = o.delivery?.handoverNote?.trim() ?? "";

  doc.moveDown(0.4);
  doc.fillColor("#0f172a").fontSize(11).text("Примечания", { underline: true });
  doc.fontSize(10).fillColor("#334155");

  if (isPickup) {
    // Адрес склада: actualAddress → legalAddress → плейсхолдер (R4)
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
      // Legacy data path: order created до 062 без handoverNote — выводим generic
      doc.text("Отгрузка транспортной компанией покупателя (по согласованию с менеджером).");
    }
  }

  doc.moveDown(0.4);
}

// Existing block continues:
// if (contacts.director) doc.text(`${contacts.director.position}: ___________________ / …`);
```

### 3. Helper: `resolveWarehouseAddress(contacts)` (R4)

```ts
function resolveWarehouseAddress(contacts: CompanyContacts): string {
  const actual = contacts.actualAddress?.trim() ?? "";
  if (actual && !actual.startsWith("TODO")) return actual;

  const legal = contacts.legalAddress?.trim() ?? "";
  if (legal && !legal.startsWith("TODO")) return legal;

  return "адрес уточнит менеджер";
}
```

**Placement**: inline в `/api/invoice/[orderId]/route.ts` (одно использование), либо в `@/lib/company/get-company-contacts.ts` если потребуется в других местах.

---

## Test matrix — pre/post comparison

| Order | method | cost | handoverNote | Pre-062 PDF | Post-062 PDF |
|-------|--------|------|--------------|-------------|--------------|
| O1 (legacy) | `cdek` | 850 | null | «Доставка: 850 ₽» в итогах, нет «Примечания» | identical |
| O2 (legacy) | `tc` | 0 | null | нет «Доставка», нет «Примечания» | НЕТ «Доставка», есть «Примечания: Отгрузка ТК покупателя (по согласованию)» |
| O3 (legacy) | `pickup` | 0 | null | нет «Доставка», нет «Примечания» | НЕТ «Доставка», есть «Примечания: Самовывоз со склада: <actualAddress>» |
| O4 (new) | `own_carrier` | 0 | "ПЭК, договор 4567, +7 9XX..." | N/A | НЕТ «Доставка», есть «Примечания: Отгрузка ТК покупателя: ПЭК, договор 4567, +7 9XX...» |
| O5 (new) | `pickup` | 0 | "Иванов И.И., +7 9XX..." | N/A | НЕТ «Доставка», есть «Примечания: Самовывоз: <addr>; Получатель: Иванов И.И., +7 9XX...» |
| O6 (new) | `cdek` | 650 | null | N/A | «Доставка: 650 ₽» в итогах, нет «Примечания» |
| O7 (edge) | `cdek` | 0 (fallback) | null | нет «Доставка», нет «Примечания» | identical (нет «Доставка», нет «Примечания») |

Regression test: O1 PDF (legacy ApiShip с cost>0) — должен побайтово совпадать с pre-062 версией (SC-062-06). На случай различий — fontMetrics могут чуть отличаться, тогда визуальный diff = 0 (см. SC-062-07).

---

## Performance

- PDF-генерация — серверный side, до 500ms per request (наследуется от текущего pdfkit).
- Новый блок «Примечания» добавляет ≤5 LOC; никакого I/O или async-операций.
- `resolveWarehouseAddress` — pure-function, без вычислительной стоимости.

---

## Backward compatibility / Idempotency

- Endpoint — read-only GET, идемпотентен по природе.
- Legacy-заказы (`method='tc'`, `handoverNote=null`) рендерятся через legacy-fallback branch (FR-062-51).
- Existing заказы (`method='cdek'`+`cost>0`, без handoverNote) рендерятся идентично pre-062 PDF (SC-062-06).
