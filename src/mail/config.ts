export type MailConfig = { smtpUrl: string; from: string };

// SMTP is the only mail transport. An unset SMTP_URL means the instance has no mail:
// email verification is skipped and password reset goes through the operator.
export function mailConfigFromEnv(env: Record<string, string | undefined>): MailConfig | null {
  const smtpUrl = env.SMTP_URL?.trim();
  if (!smtpUrl) return null;
  const from = env.MAIL_FROM?.trim();
  if (!from) throw new Error("MAIL_FROM must be set when SMTP_URL is set");
  return { smtpUrl, from };
}

export function mailConfig(): MailConfig | null {
  return mailConfigFromEnv(process.env);
}

export function isMailConfigured(): boolean {
  return mailConfig() !== null;
}
