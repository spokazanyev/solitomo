import "server-only";

import type { EmailSender, SendResult } from "../../types";

interface UnisenderGoError {
  status: "error";
  code: number;
  message: string;
}

interface UnisenderGoSuccess {
  status: "success";
  job_id?: string;
  emails?: Array<{ email: string; id?: string }>;
}

type UnisenderGoResponse = UnisenderGoError | UnisenderGoSuccess;

function parseFrom(from: string): { email: string; name?: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || undefined, email: m[2].trim() };
  return { email: from.trim() };
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function createUnisenderGoSender(apiKey: string, baseUrl: string): EmailSender {
  const base = baseUrl.replace(/\/$/, "");

  async function call(
    path: string,
    body: unknown,
  ): Promise<{ http: number; data: UnisenderGoResponse | null; raw: string }> {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify(body),
    });
    const raw = await res.text().catch(() => "");
    let data: UnisenderGoResponse | null = null;
    try {
      data = raw ? (JSON.parse(raw) as UnisenderGoResponse) : null;
    } catch {
      data = null;
    }
    return { http: res.status, data, raw };
  }

  return {
    channel: "email",
    providerName: "unisender_go",
    async sendEmail({ to, from, replyTo, subject, text, html, listUnsubscribeUrl }): Promise<SendResult> {
      const sender = parseFrom(from);
      const message: Record<string, unknown> = {
        recipients: [{ email: to }],
        body: {
          ...(html ? { html } : {}),
          plaintext: text,
        },
        subject,
        from_email: sender.email,
        ...(sender.name ? { from_name: sender.name } : {}),
        ...(replyTo ? { reply_to: replyTo } : {}),
        // list_unsubscribe подавляет авто-footer Unisender и ставит List-Unsubscribe header.
        ...(listUnsubscribeUrl ? { list_unsubscribe: listUnsubscribeUrl } : {}),
        track_links: 0,
        track_read: 0,
      };
      try {
        const { http, data, raw } = await call("/email/send.json", { message });
        if (data && data.status === "success") {
          const externalRef = data.emails?.[0]?.id ?? data.job_id;
          return { status: "sent", externalRef };
        }
        const errMsg =
          data && data.status === "error"
            ? `unisender_go code ${data.code}: ${data.message}`
            : `unisender_go ${http}: ${truncate(raw, 240)}`;
        const errCode = data && data.status === "error" ? String(data.code) : String(http);
        return {
          status: "failed",
          errorCode: errCode,
          errorMessage: errMsg,
          transient: http >= 500 || http === 429,
        };
      } catch (err) {
        return {
          status: "failed",
          errorMessage: (err as Error).message,
          transient: true,
        };
      }
    },
    async ping(): Promise<SendResult> {
      try {
        const { http, data, raw } = await call("/template/list.json", { limit: 1, offset: 0 });
        if (data && data.status === "success") return { status: "sent" };
        const errMsg =
          data && data.status === "error"
            ? `unisender_go ping code ${data.code}: ${data.message}`
            : `unisender_go ping ${http}: ${truncate(raw, 240)}`;
        return {
          status: "failed",
          errorCode: data && data.status === "error" ? String(data.code) : String(http),
          errorMessage: errMsg,
          transient: http >= 500,
        };
      } catch (err) {
        return { status: "failed", errorMessage: (err as Error).message, transient: true };
      }
    },
  };
}
