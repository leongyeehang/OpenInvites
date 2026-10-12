// How the host asks for one way of reaching a guest, an email or a phone number (spec, "Contact
// details"): not at all, as the guest's choice, or as something every RSVP must carry. The list
// is the source, as RSVP_STATUSES below is, and the database enum is built from it.
export const CONTACT_FIELDS = ["none", "optional", "required"] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];

// What the host asks of guests on this event's RSVP form (spec, "Per-event settings").
export type RsvpSettings = {
  plusOnesAllowed: number;
  requirePlusOneNames: boolean;
  emailField: ContactField;
  phoneField: ContactField;
};

// The three answers, in the order the buttons show them. Following src/themes/theme.ts: the
// list is the source, the type is derived from it, and the database enum is built from it too.
export const RSVP_STATUSES = ["going", "maybe", "cant"] as const;

export type RsvpStatus = (typeof RSVP_STATUSES)[number];

// What an RSVP can be once stored: the three answers, and Waitlisted, which a guest never chooses.
// A reply that asked for Going when the event had no place for its party is saved as waitlisted
// (spec, "Capacity and the waitlist"; admission.ts). The database enum is built from this list.
export const SAVED_STATUSES = [...RSVP_STATUSES, "waitlisted"] as const;

export type SavedStatus = (typeof SAVED_STATUSES)[number];

// The status the guest chose for a stored one: a waitlisted guest asked for Going.
export function chosenStatus(status: SavedStatus): RsvpStatus {
  return status === "waitlisted" ? "going" : status;
}

// The part of an answer that says who is coming.
export type RsvpAnswer = {
  status: RsvpStatus;
  name: string;
  plusOnes: number;
  plusOneNames: string[];
};

// One guest's answer, once trusted, with how they can be reached. A host's edit of it sets the
// same. An email or a phone number the host does not ask for is undefined: saving leaves what is
// stored there alone, which may be one the host gave (ticket 04, review).
export type RsvpInput = RsvpAnswer & { email: string | null | undefined; phone: string | null | undefined };

// What the guest's own RSVP form posts, and a host's edit of someone else's RSVP, as strings,
// before any of it is trusted.
export type RsvpFormFields = {
  status: string;
  name: string;
  plusOnes: string;
  plusOneNames: string[];
  email: string;
  phone: string;
};

export type RsvpFormError =
  | "statusInvalid"
  | "nameRequired"
  | "nameTooLong"
  | "plusOnesInvalid"
  | "plusOneNameRequired"
  | "plusOneNameTooLong"
  | "emailRequired"
  | "emailInvalid"
  | "phoneRequired"
  | "phoneInvalid";

export type ParsedRsvpForm = { ok: true; input: RsvpInput } | { ok: false; error: RsvpFormError };

export type ParsedHostEdit = { ok: true; edit: RsvpInput } | { ok: false; error: RsvpFormError };

// Long enough for any real name; short enough that the field cannot be used as storage.
const MAX_NAME = 80;

// Enough to catch a typo or a wrong field. The one rule for an email a guest or a visitor types:
// the RSVP form's, and the report form's contact (reports/report.ts).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;

export function isEmail(value: string): boolean {
  return value.length <= MAX_EMAIL && EMAIL.test(value);
}

// A phone number as people write one (spec, "Contact details"): 5 to 20 characters of digits,
// spaces, plus, hyphens, brackets and dots, at least five of them digits. It is kept as typed,
// never formatted or dialled, and never proven: it is shown to the hosts and used for nothing else.
const PHONE = /^[0-9 +\-().]{5,20}$/;
const MIN_DIGITS = 5;

export function isPhone(value: string): boolean {
  return PHONE.test(value) && (value.match(/[0-9]/g)?.length ?? 0) >= MIN_DIGITS;
}

// The rules of the RSVP form (ticket 07). The settings are the host's, so what counts as a valid
// answer changes from event to event.
export function parseRsvpForm(fields: RsvpFormFields, settings: RsvpSettings): ParsedRsvpForm {
  const parsed = parseAnswer(fields, settings);
  if (!parsed.ok) return parsed;

  const email = asked(fields.email, settings.emailField);
  if (!email && settings.emailField === "required") return { ok: false, error: "emailRequired" };
  if (email && !isEmail(email)) return { ok: false, error: "emailInvalid" };

  const phone = asked(fields.phone, settings.phoneField);
  if (!phone && settings.phoneField === "required") return { ok: false, error: "phoneRequired" };
  if (phone && !isPhone(phone)) return { ok: false, error: "phoneInvalid" };

  return { ok: true, input: { ...parsed.answer, email: given(email), phone: given(phone) } };
}

// What the guest gave for one way of reaching them, trimmed. The field only exists when the host
// asks for it, so a value posted anyway is ignored: undefined, which leaves the stored one alone.
function asked(typed: string, field: ContactField): string | undefined {
  return field === "none" ? undefined : typed.trim();
}

// A field the guest was asked and left blank is null, which takes back what they gave before.
function given(value: string | undefined): string | null | undefined {
  return value === undefined ? undefined : value || null;
}

// What a host may change on a guest's RSVP (spec, story 53, and "Contact details"): the status,
// the name, who they are bringing, and the email and phone number, which the host may know from
// elsewhere. Never the edit token, so the link in that guest's pocket keeps working. A host is
// held to the allowance they set themselves and to the shape of an email and a phone number, but
// is not made to invent names for someone else's plus-ones, nor to give a way of reaching them,
// and may give one the guest was not asked for.
export function parseHostEdit(fields: RsvpFormFields, settings: RsvpSettings): ParsedHostEdit {
  const parsed = parseRsvpForm(fields, { ...settings, requirePlusOneNames: false, emailField: "optional", phoneField: "optional" });
  return parsed.ok ? { ok: true, edit: parsed.input } : parsed;
}

function parseAnswer(
  fields: RsvpFormFields,
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
