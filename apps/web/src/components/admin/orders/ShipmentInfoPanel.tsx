"use client";

import { useDocumentInfo } from "@payloadcms/ui";
import { useState } from "react";

interface ShipmentEvent {
  eventId?: string;
  internalStatus?: string;
  providerStatus?: string;
  at?: string;
  message?: string;
}

interface ShipmentShape {
  providerOrderId?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  labelUrl?: string;
  waybillUrl?: string;
  status?: string;
  events?: ShipmentEvent[];
}

const STATUS_LABEL: Record<string, string> = {
  none: "Не создан",
  pending: "Создаётся",
  created: "Создан",
  pending_label: "Ожидает этикетки",
  in_transit: "В пути",
  at_point: "В ПВЗ",
  delivered: "Доставлен",
  returned: "Возврат",
  cancelled: "Отменён",
  error: "Ошибка",
};

const buttonStyle: React.CSSProperties = {
  background: "var(--theme-input-bg)",
  border: "1px solid var(--theme-elevation-250)",
  borderRadius: 4,
  color: "var(--theme-text)",
  cursor: "pointer",
  font: "inherit",
  marginInlineEnd: 8,
  minHeight: 30,
  padding: "6px 12px",
  whiteSpace: "nowrap" as const,
};

const buttonPrimary: React.CSSProperties = {
  ...buttonStyle,
  background: "var(--theme-elevation-800)",
  color: "var(--theme-elevation-0)",
  borderColor: "transparent",
};

const buttonDanger: React.CSSProperties = {
  ...buttonStyle,
  background: "var(--theme-error-500, #dc2626)",
  color: "#fff",
  borderColor: "transparent",
};

/**
 * Readonly-блок «Отправление» для админ-карточки заказа.
 * Показывает provider-id / tracking / лейблы и кнопки управления.
 */
export function ShipmentInfoPanel() {
  const doc = useDocumentInfo() as
    | { id?: string; savedDocumentData?: { shipment?: ShipmentShape } }
    | undefined;

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orderId = doc?.id;
  const shipment = doc?.savedDocumentData?.shipment;

  if (!orderId || !shipment || !shipment.providerOrderId) return null;

  async function callAction(endpoint: string, label: string) {
    if (busy || !orderId) return;
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      const body = (await res.json().catch(() => ({}))) as { redirectUrl?: string; labelUrl?: string };
      if (body.labelUrl) {
        window.open(body.labelUrl, "_blank", "noreferrer");
      } else if (body.redirectUrl) {
        window.open(body.redirectUrl, "_blank", "noreferrer");
      } else {
        window.location.reload();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Ошибка: ${label}`);
    } finally {
      setBusy(null);
    }
  }

  function downloadLabel(type: "label" | "waybill") {
    void callAction(`/api/admin/shipping/labels?type=${type}`, type === "label" ? "label" : "waybill");
  }

  const events = (shipment.events ?? []).slice().sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return (
    <div
      style={{
        border: "1px solid var(--theme-elevation-150)",
        borderRadius: 4,
        margin: "12px 0",
        padding: 16,
      }}
    >
      <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Отправление</h4>
      <dl style={{ display: "grid", fontSize: 13, gap: 4, margin: "12px 0", gridTemplateColumns: "auto 1fr" }}>
        <dt style={{ color: "var(--theme-elevation-500)" }}>Статус:</dt>
        <dd style={{ margin: 0 }}>{STATUS_LABEL[shipment.status ?? "none"] ?? shipment.status}</dd>
        <dt style={{ color: "var(--theme-elevation-500)" }}>providerOrderId:</dt>
        <dd style={{ margin: 0, fontFamily: "monospace" }}>{shipment.providerOrderId}</dd>
        {shipment.trackingNumber ? (
          <>
            <dt style={{ color: "var(--theme-elevation-500)" }}>trackingNumber:</dt>
            <dd style={{ margin: 0, fontFamily: "monospace" }}>
              {shipment.trackingNumber}
              {shipment.trackingUrl ? (
                <>
                  {" — "}
                  <a href={shipment.trackingUrl} target="_blank" rel="noreferrer">
                    отследить ↗
                  </a>
                </>
              ) : null}
            </dd>
          </>
        ) : null}
      </dl>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        <button
          type="button"
          style={buttonStyle}
          onClick={() => downloadLabel("label")}
          disabled={busy != null}
        >
          {busy === "label" ? "Открываем…" : "Этикетка PDF"}
        </button>
        <button
          type="button"
          style={buttonStyle}
          onClick={() => downloadLabel("waybill")}
          disabled={busy != null}
        >
          {busy === "waybill" ? "Открываем…" : "Накладная PDF"}
        </button>
        <button
          type="button"
          style={buttonPrimary}
          onClick={() => callAction("/api/admin/shipping/refresh-tracking", "refresh")}
          disabled={busy != null}
        >
          {busy === "refresh" ? "Обновляем…" : "⟳ Обновить трекинг"}
        </button>
        <button
          type="button"
          style={buttonDanger}
          onClick={() => {
            if (!window.confirm("Отменить отправление в ApiShip? Действие необратимо.")) return;
            void callAction("/api/admin/shipping/cancel", "cancel");
          }}
          disabled={busy != null}
        >
          {busy === "cancel" ? "Отменяем…" : "✕ Отменить отправление"}
        </button>
      </div>

      {error ? (
        <p style={{ color: "var(--theme-error-500, #dc2626)", fontSize: 13, marginTop: 12 }}>{error}</p>
      ) : null}

      {events.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <h5 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>События</h5>
          <ol style={{ fontSize: 12, listStyle: "none", margin: 0, padding: 0 }}>
            {events.map((e, i) => (
              <li
                key={e.eventId ?? i}
                style={{ borderBottom: "1px dashed var(--theme-elevation-100)", padding: "6px 0" }}
              >
                <span style={{ color: "var(--theme-elevation-500)", marginInlineEnd: 8 }}>
                  {e.at ? new Date(e.at).toLocaleString("ru-RU") : ""}
                </span>
                <span>
                  {STATUS_LABEL[e.internalStatus ?? ""] ?? e.providerStatus ?? "Событие"}
                  {e.message ? ` — ${e.message}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

export default ShipmentInfoPanel;
