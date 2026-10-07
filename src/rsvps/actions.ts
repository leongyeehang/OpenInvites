"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { requireHost } from "@/auth/session";
import { acceptsRsvps } from "@/events/access";
import { findEventBySlug, findHostEvent } from "@/events/repository";
import { can } from "@/hosts/role";
import { parseAnswers, type AnswerFields } from "@/questions/answers";
import { listQuestions, saveAnswers } from "@/questions/repository";
import type { FormState } from "@/lib/form-state";
import { consume } from "@/rate-limit/rate-limit";
import { parseHostEdit, parseRsvpForm, type RsvpFormFields } from "./form";
import { findRsvpOnThisDevice, guestRsvp, type SaveRsvpResult } from "./guest";
import { notifyHostsOfRsvp } from "./notify-hosts";
import { deleteRsvp, editRsvpAsHost, saveRsvp } from "./repository";
import { rsvpCookieName, rsvpCookieOptions } from "./token";

function fields(formData: FormData): RsvpFormFields {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return {
    status: text("status"),
    name: text("name"),
    plusOnes: text("plusOnes"),
    plusOneNames: formData.getAll("plusOneNames").map((value) => (typeof value === "string" ? value : "")),
    email: text("email"),
  };
}

// The questions step posts an answer against each question's id.
function answersFrom(formData: FormData): AnswerFields {
  const given: AnswerFields = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("answer:") && typeof value === "string") given[key.slice("answer:".length)] = value;
  }
  return given;
}

// Every answer counts against the RSVP limit before anything is looked up, so that neither a
// flood of RSVPs nor a search for event links gets far through here.
export async function saveRsvpAction(slug: string, formData: FormData): Promise<SaveRsvpResult> {
  if (!(await consume("rsvp", await headers())).allowed) return { error: "tooFast" };
  const event = await findEventBySlug(slug);
  if (!event || !acceptsRsvps(event.state)) return { error: "closed" };

  const parsed = parseRsvpForm(fields(formData), event);
  if (!parsed.ok) return { error: parsed.error };

  const answers = parseAnswers(answersFrom(formData), await listQuestions(event.id), parsed.input.status);
  if (!answers.ok) return { error: answers.error };

  const mine = await findRsvpOnThisDevice(event.id);
  // The language the guest answers in is the one their mail about the event is written in.
  const locale = await getLocale();
  // Two writes rather than one transaction: a failure between them leaves the RSVP saved with
  // its previous answers, which the guest can put right by answering again.
  const saved = await saveRsvp(event.id, { ...parsed.input, locale }, mine);
  await saveAnswers(saved.rsvp.id, answers.answers);
  if (!mine) {
    // A new RSVP: this device now remembers the guest, so the link finds their answer next time.
    (await cookies()).set(rsvpCookieName(event.id), saved.token, rsvpCookieOptions());
  }
  // Once the RSVP is saved and remembered, so that nothing about the hosts' email can undo either.
  await notifyHostsOfRsvp(event, mine?.rsvp, saved.rsvp);
  // The guest list is a reward for answering, so it unlocks without waiting for a reload.
  revalidatePath(`/e/${slug}`);
  return { saved: guestRsvp(saved) };
}

// Withdrawing: the RSVP goes, and so does this device's memory of it. A guest may withdraw from
// an event that no longer takes answers. Counted against the RSVP limit before anything is
// looked up, as an answer is.
export async function removeRsvpAction(slug: string): Promise<{ error?: "tooFast" }> {
  if (!(await consume("rsvp", await headers())).allowed) return { error: "tooFast" };
  const event = await findEventBySlug(slug);
  if (!event) return {};
  const mine = await findRsvpOnThisDevice(event.id);
  const removed = mine && (await deleteRsvp(event.id, mine.rsvp.id));
  (await cookies()).delete(rsvpCookieName(event.id));
  await notifyHostsOfRsvp(event, removed, undefined);
  revalidatePath(`/e/${slug}`);
  return {};
}

// A host changing a guest's RSVP on their own guest list. The host's form carries no email
// field, and parseHostEdit ignores the one fields() reads, so the guest's address survives.
export async function editGuestAction(
  eventId: string,
  rsvpId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const [host, t] = await Promise.all([requireHost(), getTranslations("Guests")]);
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "guests")) return { error: t("errors.notFound") };

  const parsed = parseHostEdit(fields(formData), event);
  if (!parsed.ok) return { error: t(`errors.${parsed.error}`) };

  const previous = await editRsvpAsHost(event.id, rsvpId, parsed.edit);
  if (previous) await notifyHostsOfRsvp(event, previous, parsed.edit);
  revalidatePath(`/events/${eventId}/guests`);
  return { success: t("saved") };
}

export async function removeGuestAction(eventId: string, rsvpId: string): Promise<void> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "guests")) return;
  const removed = await deleteRsvp(event.id, rsvpId);
  await notifyHostsOfRsvp(event, removed, undefined);
  revalidatePath(`/events/${eventId}/guests`);
}
