// A report (CONTEXT.md): a visitor telling the operator that an event page does not belong on the
// instance (spec, "Report an event"). The reason says what is wrong; the contact, an email, is
// only there for the operator to write back, and is optional.
export const REASON_MIN = 20;
export const REASON_MAX = 1000;

// The same rule the RSVP form applies to a guest's email (rsvps/form.ts).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;

export type ReportError = "reasonTooShort" | "reasonTooLong" | "contactInvalid";

export type ParsedReport = { ok: true; reason: string; contact: string | null } | { ok: false; error: ReportError };

// The rules of the report form. A browser posts a textarea's line breaks as CR LF; they are kept as
// one line feed each, so a line break counts as one character, as the textarea counted it.
export function parseReport(fields: { reason: string; contact: string }): ParsedReport {
  const reason = fields.reason.replace(/\r\n?/g, "\n").trim();
  const contact = fields.contact.trim();
  if (reason.length < REASON_MIN) return { ok: false, error: "reasonTooShort" };
  if (reason.length > REASON_MAX) return { ok: false, error: "reasonTooLong" };
  if (contact && (contact.length > MAX_EMAIL || !EMAIL.test(contact))) return { ok: false, error: "contactInvalid" };
  return { ok: true, reason, contact: contact || null };
}
