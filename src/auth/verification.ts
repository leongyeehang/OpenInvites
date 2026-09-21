// A host must verify their email before creating an event, but only when the instance
// can send mail. Without SMTP, verification is skipped entirely (spec, "Identity and access").
export function needsEmailVerification(input: { mailConfigured: boolean; emailVerified: boolean }): boolean {
  return input.mailConfigured && !input.emailVerified;
}
