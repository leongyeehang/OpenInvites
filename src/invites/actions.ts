"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { requireHost } from "@/auth/session";
import { findHostEvent, setLettersEnabled } from "@/events/repository";
import { can } from "@/hosts/role";
import type { FormState } from "@/lib/form-state";
import { isUuid } from "@/lib/uuid";
import { MAX_INVITES, parseInvite, parseInviteLines, parseLetter } from "./invite";
import { createInvite, createInvites, deleteInvite, updateInviteLetter } from "./repository";

// A host's personal invites are part of who is coming, so whoever may manage the guest list may
// make and delete them (hosts/role.ts). Both pages that show them are drawn again: the invites
// page, and the guest list, whose Invited section lists those nobody has replied through.
function revalidateInvites(eventId: string): void {
  revalidatePath(`/events/${eventId}/invites`);
  revalidatePath(`/events/${eventId}/guests`);
}

// What a form posted under a name, or nothing.
function posted(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// Making one personal invite: a name and, if the host gives them, an email and a phone (spec,
// "Personal invite links"; M6 spec, "The invite list"), and the host's letter when the event has
// personal letters on, which is when the form offers one. The link is on the invites page from
// then on, for the host to copy.
export async function createInviteAction(eventId: string, _: FormState, formData: FormData): Promise<FormState> {
  const [host, t] = await Promise.all([requireHost(), getTranslations("Invites")]);
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "guests")) return { error: t("errors.notFound") };

  const parsed = parseInvite({
    name: posted(formData, "name"),
    email: posted(formData, "email"),
    phone: posted(formData, "phone"),
    letter: event.lettersEnabled ? posted(formData, "letter") : "",
  });
  if (!parsed.ok) return { error: t(`errors.${parsed.error}`) };

  const made = await createInvite(event.id, parsed.invite);
  if (!made) return { error: t("full", { max: MAX_INVITES }) };
  revalidateInvites(event.id);
  return { success: t("made", { name: made.name }) };
}

// "Add several" (M6 spec, "The invite list"): one person per line, made all at once or, when a
// line is wrong or the event cannot carry them all, not at all, saying which line or why.
export async function createInvitesAction(eventId: string, _: FormState, formData: FormData): Promise<FormState> {
  const [host, t] = await Promise.all([requireHost(), getTranslations("Invites")]);
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "guests")) return { error: t("errors.notFound") };

  const parsed = parseInviteLines(posted(formData, "people"));
  if (!parsed.ok) return { error: t("errors.line", { line: parsed.line, error: t(`errors.${parsed.error}`) }) };

  const made = await createInvites(event.id, parsed.invites);
  if (!made) return { error: t("errors.tooManyAtOnce", { max: MAX_INVITES }) };
  revalidateInvites(event.id);
  return { success: t("madeMany", { count: made.length }) };
}

// The host's letter to one guest (M6 spec, "Personal letters"), written on its row of the invites
// page; an empty one takes the letter away.
export async function saveLetterAction(eventId: string, id: string, _: FormState, formData: FormData): Promise<FormState> {
  const [host, t] = await Promise.all([requireHost(), getTranslations("Invites")]);
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "guests") || !isUuid(id)) return { error: t("errors.notFound") };

  const parsed = parseLetter(posted(formData, "letter"));
  if (!parsed.ok) return { error: t(`errors.${parsed.error}`) };
  if (!(await updateInviteLetter(event.id, id, parsed.letter))) return { error: t("errors.notFound") };
  revalidateInvites(event.id);
  return { success: t("letterSaved") };
}

// Personal letters on or off for the event, from the switch at the top of the invites page.
export async function setLettersEnabledAction(eventId: string, on: boolean): Promise<void> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "guests")) return;
  await setLettersEnabled(event.id, on === true);
  revalidateInvites(event.id);
}

// The link stops working; a reply made with it stays on the guest list (repository.ts).
export async function deleteInviteAction(eventId: string, id: string): Promise<void> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "guests") || !isUuid(id)) return;
  await deleteInvite(event.id, id);
  revalidateInvites(event.id);
}
