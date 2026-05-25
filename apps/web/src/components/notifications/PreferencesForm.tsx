"use client";

/**
 * Клиентская форма для /preferences/[token]/ (049 US6).
 *
 * Отправляет PATCH в /api/preferences/[token].
 */

import { useState } from "react";

interface Props {
  token: string;
  initialMarketingOptIn: boolean;
  initialMessengerOptIn: boolean;
  currentEmail: string;
}

export function PreferencesForm({
  token,
  initialMarketingOptIn,
  initialMessengerOptIn,
  currentEmail,
}: Props) {
  const [marketingOptIn, setMarketingOptIn] = useState(initialMarketingOptIn);
  const [messengerOptIn, setMessengerOptIn] = useState(initialMessengerOptIn);
  const [newEmail, setNewEmail] = useState(currentEmail);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setStatus("idle");
    try {
      const body: Record<string, unknown> = {
        marketingOptIn,
        messengerOptIn,
      };
      if (newEmail && newEmail !== currentEmail) {
        body.newEmail = newEmail;
      }
      const res = await fetch(`/api/preferences/${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setStatus("error");
        setErrorMessage(data.message ?? `Ошибка ${res.status}`);
        return;
      }
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setErrorMessage((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)}
        />
        <span>
          Получать маркетинговые письма (приглашения оценить покупку, спецпредложения).
        </span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={messengerOptIn}
          onChange={(e) => setMessengerOptIn(e.target.checked)}
        />
        <span>
          Получать уведомления в мессенджере (Telegram). <i>placeholder, будет включён позже</i>
        </span>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span>Email для уведомлений</span>
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
          required
        />
      </label>
      <div>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "10px 20px",
            background: "#3f6212",
            color: "#fff",
            border: 0,
            borderRadius: 6,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
      {status === "ok" && <p style={{ color: "#3f6212" }}>Предпочтения сохранены.</p>}
      {status === "error" && (
        <p style={{ color: "#b91c1c" }}>Не удалось сохранить: {errorMessage}</p>
      )}
    </form>
  );
}
