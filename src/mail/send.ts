import nodemailer from "nodemailer";
import { mailConfig } from "./config";

export type Message = { to: string; subject: string; text: string };

// Plain-text mail over SMTP. Callers check isMailConfigured() first; sending
// without SMTP is a programming error, not a condition to handle.
export async function sendMail(message: Message): Promise<void> {
  const config = mailConfig();
  if (!config) throw new Error("Mail is not configured: SMTP_URL is not set");
  await nodemailer.createTransport(config.smtpUrl).sendMail({ from: config.from, ...message });
}
