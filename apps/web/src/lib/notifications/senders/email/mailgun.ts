import "server-only";

import type { EmailSender, SendResult } from "../../types";

export function createMailgunSender(apiKey: string, domain: string): EmailSender {
  const base = `https://api.mailgun.net/v3/${encodeURIComponent(domain)}`;
  const auth = `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`;

  return {
    channel: "email",
    providerName: "mailgun",
    async sendEmail({ to, from, replyTo, subject, text, html }): Promise<SendResult> {
      try {
        const form = new URLSearchParams();
        form.set("from", from);
        form.set("to", to);
        if (replyTo) form.set("h:Reply-To", replyTo);
        form.set("subject", subject);
        form.set("text", text);
        if (html) form.set("html", html);

        const res = await fetch(`${base}/messages`, {
          method: "POST",
          headers: {
            Authorization: auth,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "unknown");
          return {
            status: "failed",
            errorCode: String(res.status),
            errorMessage: `mailgun ${res.status}: ${truncate(errText, 240)}`,
            transient: res.status >= 500 || res.status === 429,
          };
        }
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        return { status: "sent", externalRef: data.id };
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
        const res = await fetch(`${base}/stats/total?event=accepted&duration=1d`, {
          headers: { Authorization: auth },
        });
        if (!res.ok) {
          return {
            status: "failed",
            errorCode: String(res.status),
            errorMessage: `mailgun ping ${res.status}`,
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
