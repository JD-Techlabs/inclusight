import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (!transporter) {
    const e = env();
    transporter = nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_SECURE === "true",
      auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD ?? "" } : undefined,
    });
  }
  return transporter;
}

export type EmailMessage = {
  to: string;
  subject: string;
  /** Plain-text paragraphs. Emails are sent as text plus simple semantic HTML. */
  paragraphs: string[];
  link?: { label: string; url: string };
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderEmail(message: EmailMessage): { text: string; html: string } {
  const textParts = [...message.paragraphs];
  if (message.link) textParts.push(`${message.link.label}: ${message.link.url}`);
  const htmlParts = message.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`);
  if (message.link) {
    htmlParts.push(
      `<p><a href="${escapeHtml(message.link.url)}">${escapeHtml(message.link.label)}</a></p>`,
    );
  }
  return {
    text: textParts.join("\n\n"),
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(message.subject)}</title></head><body>${htmlParts.join("")}</body></html>`,
  };
}

/** Sends an email. Never log the message: links contain single-use sign-in tokens. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const { text, html } = renderEmail(message);
  await getTransporter().sendMail({
    from: env().EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    text,
    html,
  });
}
