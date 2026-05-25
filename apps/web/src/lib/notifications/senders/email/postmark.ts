import "server-only";

import type { EmailSender, SendResult } from "../../types";

const POSTMARK_URL = "https://api.postmarkapp.com/email";

export function createPostmarkSender(apiKey: string): EmailSender {
  return {
    channel: "email",
    providerName: "postmark",
    async sendEmail({ to, from, replyTo, subject, text, html }): Promise<SendResult> {
      try {
        const res = await fetch(POSTMARK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Postmark-Server-Token": apiKey,
          },
          body: JSON.stringify({
            From: from,
            To: to,
            ReplyTo: replyTo,
            Subject: subject,
            TextBody: text,
            HtmlBody: html,
            MessageStream: "outbound",
          }),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "unknown");
          return {
            status: "failed",
            errorCode: String(res.status),
            errorMessage: `postmark ${res.status}: ${truncate(errText, 240)}`,
            transient: res.status >= 500 || res.status === 429,
          };
        }
        const data = (await res.json().catch(() => ({}))) as { MessageID?: string };
        return { status: "sent", externalRef: data.MessageID };
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
        // Postmark `/server` returns 200 for valid token.
        const res = await fetch("https://api.postmarkapp.com/server", {
          headers: {
            Accept: "application/json",
            "X-Postmark-Server-Token": apiKey,
          },
        });
        if (!res.ok) {
          return {
            status: "failed",
            errorCode: String(res.status),
            errorMessage: `postmark ping ${res.status}`,
          };
        }
        return { status: "sent" };
      } catch (err) {
        return { status: "failed", errorMessage: (err as Error).message, transient: true };
      }
    },
  };
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
