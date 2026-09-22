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

// One guest's answer, once trusted.
export type RsvpInput = {
  status: RsvpStatus;
  name: string;
  plusOnes: number;
  plusOneNames: string[];
  email: string | null;
};

// What the RSVP form posts, as strings, before any of it is trusted.
export type RsvpFormFields = {
  status: string;
  name: string;
  plusOnes: string;
  plusOneNames: string[];
  email: string;
};

export type RsvpFormError = "statusInvalid" | "nameRequired" | "nameTooLong" | "plusOnesInvalid" | "plusOneNameRequired" | "plusOneNameTooLong" | "emailInvalid";

export type ParsedRsvpForm = { ok: true; input: RsvpInput } | { ok: false; error: RsvpFormError };

// Long enough for any real name; short enough that the field cannot be used as storage.
const MAX_NAME = 80;

// Enough to catch a typo or a wrong field; the address is never verified in M1.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;

// The rules of the RSVP form (ticket 07). The settings are the host's, so what counts as a valid
// answer changes from event to event.
export function parseRsvpForm(fields: RsvpFormFields, settings: RsvpSettings): ParsedRsvpForm {
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

  // The field only exists when the host asks for it, and giving it is still the guest's choice.
  const typed = settings.askEmail ? fields.email.trim() : "";
  if (typed && (typed.length > MAX_EMAIL || !EMAIL.test(typed))) return { ok: false, error: "emailInvalid" };

  return { ok: true, input: { status, name, plusOnes, plusOneNames, email: typed || null } };
}
