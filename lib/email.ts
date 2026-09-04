import type { ReactElement } from "react";
import { Resend } from "resend";

// Transactional email via Resend. Everything here is best-effort: sendEmail
// never throws, so a mail outage can't break a booking/payment mutation.
//
// Env:
//   RESEND_API_KEY + EMAIL_FROM — both required; email is silently disabled otherwise
//   DEMO_EMAIL_TO               — force all outbound mail to one address
//                                 (Resend's free tier only delivers to your
//                                 own verified address — handy for demos)

let client: Resend | null = null;

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function getClient(): Resend | null {
  if (!emailEnabled()) return null;
  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}

export type SendResult = { ok: boolean; skipped?: string };

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  react: ReactElement;
}): Promise<SendResult> {
  const resend = getClient();
  if (!resend) return { ok: false, skipped: "email-disabled" };

  const to = process.env.DEMO_EMAIL_TO || opts.to;
  const from = process.env.EMAIL_FROM!;

  // 8s cap so a slow email API can't hang the server action that triggered it.
  const timeout = new Promise<SendResult>((resolve) =>
    setTimeout(() => resolve({ ok: false, skipped: "timeout" }), 8000),
  );
  const send = async (): Promise<SendResult> => {
    try {
      const { error } = await resend.emails.send({ from, to, subject: opts.subject, react: opts.react });
      if (error) {
        console.error("[email] resend error:", error);
        return { ok: false, skipped: error.message };
      }
      return { ok: true };
    } catch (e) {
      console.error("[email] send failed:", e);
      return { ok: false, skipped: "exception" };
    }
  };

  return Promise.race([send(), timeout]);
}

export function appUrl(path = ""): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}
