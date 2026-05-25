"use client";

import { useDocumentInfo } from "@payloadcms/ui";
import { useState } from "react";

const ELIGIBLE_ORDER_STATUSES = new Set(["paid", "fulfilling"]);
const ELIGIBLE_SHIPMENT_STATUSES = new Set(["none", "error", ""]);

/**
 * Custom Payload Admin field для коллекции Orders.
 * Показывает кнопку «Создать отправление», если:
 *   order.status ∈ {paid, fulfilling}
 *   AND shipment.status ∈ {none, error}
 *
 * При клике POST /api/admin/shipping/create.
 */
export function CreateShipmentButton() {
  const doc = useDocumentInfo() as
    | {
        id?: string;
        savedDocumentData?: {
          status?: string;
          shipment?: { status?: string };
        };
      }
    | undefined;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderStatus = doc?.savedDocumentData?.status ?? "";
  const shipmentStatus = doc?.savedDocumentData?.shipment?.status ?? "";
  const orderId = doc?.id;

  const eligible =
    ELIGIBLE_ORDER_STATUSES.has(orderStatus) && ELIGIBLE_SHIPMENT_STATUSES.has(shipmentStatus);

  if (!orderId) return null;

  async function handleClick() {
    if (loading || !orderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/shipping/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      // Перезагружаем страницу, чтобы Payload отрисовал shipment-блок с актуальными данными.
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось создать отправление");
      setLoading(false);
    }
  }

  if (!eligible) {
    return (
      <div style={{ padding: "8px 0", fontSize: 12, color: "var(--theme-elevation-500)" }}>
        Кнопка «Создать отправление» доступна для заказов в статусе «Оплачен» / «В обработке»
        без активного отправления.
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 0" }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          background: "var(--theme-success-500, #16a34a)",
          border: "1px solid transparent",
          borderRadius: 4,
          color: "#fff",
          cursor: loading ? "wait" : "pointer",
          font: "inherit",
          fontWeight: 600,
          minHeight: 36,
          opacity: loading ? 0.7 : 1,
          padding: "8px 16px",
        }}
      >
        {loading ? "Создаём…" : "Создать отправление"}
      </button>
      {error ? (
        <p style={{ color: "var(--theme-error-500, #dc2626)", fontSize: 13, marginTop: 8 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default CreateShipmentButton;
