// What the host asks of guests on this event's RSVP form (spec, "Per-event settings").
export type RsvpSettings = {
  plusOnesAllowed: number;
  requirePlusOneNames: boolean;
  askEmail: boolean;
};

// The three answers, in the order the buttons show them. Following src/themes/theme.ts: the
// list is the source, the type is derived from it, and the database enum is built from it too.
export const RSVP_STATUSES = ["going", "maybe", "cant"] as const;

export type RsvpStatus = (typeof RSVP_STATUSES)[number];

// The part of an answer both a guest and a host may set.
export type RsvpAnswer = {
  status: RsvpStatus;
  name: string;
  plusOnes: number;
  plusOneNames: string[];
};

// One guest's answer, once trusted. Only a guest ever gives the email.
export type RsvpInput = RsvpAnswer & { email: string | null };

// What a host posts when editing someone else's RSVP, as strings, before any of it is trusted.
export type HostEditFields = {
  status: string;
  name: string;
  plusOnes: string;
  plusOneNames: string[];
};

// What the guest's own RSVP form posts, which is the same plus the email field.
export type RsvpFormFields = HostEditFields & { email: string };

export type RsvpFormError = "statusInvalid" | "nameRequired" | "nameTooLong" | "plusOnesInvalid" | "plusOneNameRequired" | "plusOneNameTooLong" | "emailInvalid";

export type ParsedRsvpForm = { ok: true; input: RsvpInput } | { ok: false; error: RsvpFormError };

export type ParsedHostEdit = { ok: true; edit: RsvpAnswer } | { ok: false; error: RsvpFormError };

// Long enough for any real name; short enough that the field cannot be used as storage.
const MAX_NAME = 80;

// Enough to catch a typo or a wrong field; the address is never verified in M1.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;

// The rules of the RSVP form (ticket 07). The settings are the host's, so what counts as a valid
// answer changes from event to event.
export function parseRsvpForm(fields: RsvpFormFields, settings: RsvpSettings): ParsedRsvpForm {
  const parsed = parseAnswer(fields, settings);
  if (!parsed.ok) return parsed;

  // The field only exists when the host asks for it, and giving it is still the guest's choice.
  const typed = settings.askEmail ? fields.email.trim() : "";
  if (typed && (typed.length > MAX_EMAIL || !EMAIL.test(typed))) return { ok: false, error: "emailInvalid" };

  return { ok: true, input: { ...parsed.answer, email: typed || null } };
}

// What a host may change on a guest's RSVP (spec, story 53): the status, the name, and who they
// are bringing. Never the email the guest gave, and never the edit token, so the link in that
// guest's pocket keeps working. A host is held to the allowance they set themselves, but is not
// made to invent names for someone else's plus-ones.
export function parseHostEdit(fields: HostEditFields, settings: RsvpSettings): ParsedHostEdit {
  const parsed = parseAnswer(fields, { ...settings, requirePlusOneNames: false });
  return parsed.ok ? { ok: true, edit: parsed.answer } : parsed;
}

function parseAnswer(
  fields: HostEditFields,
  settings: RsvpSettings,
): { ok: true; answer: RsvpAnswer } | { ok: false; error: RsvpFormError } {
  const status = RSVP_STATUSES.find((each) => each === fields.status);
  if (!status) return { ok: false, error: "statusInvalid" };

  const name = fields.name.trim();
  if (!name) return { ok: false, error: "nameRequired" };
  if (name.length > MAX_NAME) return { ok: false, error: "nameTooLong" };

  // A guest who can't go brings nobody, whatever the form carried.
  const plusOnes = status === "cant" ? 0 : Number(fields.plusOnes);
  if (!Number.isInteger(plusOnes) || plusOnes < 0 || plusOnes > settings.plusOnesAllowed) {
    return { ok: false, error: "plusOnesInvalid" };
  }

  // One entry per plus-one, empty when the host does not ask who they are.
  const plusOneNames = Array.from({ length: plusOnes }, (_, index) => (fields.plusOneNames[index] ?? "").trim());
  if (settings.requirePlusOneNames && plusOneNames.some((plusOneName) => !plusOneName)) {
    return { ok: false, error: "plusOneNameRequired" };
  }
  if (plusOneNames.some((plusOneName) => plusOneName.length > MAX_NAME)) return { ok: false, error: "plusOneNameTooLong" };

  return { ok: true, answer: { status, name, plusOnes, plusOneNames } };
}
