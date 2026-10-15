"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { requireHost } from "@/auth/session";
import { getDb } from "@/db/client";
import { acceptsRsvps } from "@/events/access";
import { findEventBySlug, findHostEvent } from "@/events/repository";
import { can } from "@/hosts/role";
import { findInviteOnThisDevice } from "@/invites/device";
import { parseAnswers, type AnswerFields } from "@/questions/answers";
import { listQuestions, saveAnswers } from "@/questions/repository";
import type { FormState } from "@/lib/form-state";
import { isMailConfigured } from "@/mail/config";
import { kickMailWorker } from "@/mail/worker";
import { consume } from "@/rate-limit/rate-limit";
import { checkTurnstile } from "@/turnstile/verify";
import { admit } from "./admission";
import { proveEmail } from "./email-code";
import { parseHostEdit, parseRsvpForm, type RsvpFormFields } from "./form";
import { findRsvpOnThisDevice, guestRsvp, type SaveRsvpResult } from "./guest";
import { repliesAtLimit } from "./limit";
import { notifyHostsOfRsvp } from "./notify-hosts";
import { approveRsvp, countHeadcount, declineRsvp, deleteRsvp, editRsvpAsHost, moveToGoing, saveRsvp } from "./repository";
import { rsvpCookieName, rsvpCookieOptions } from "./token";
import { needsCode } from "./verification";
import { eventPaths } from "@/events/slug";

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
    phone: text("phone"),
  };
}

// The questions step posts an answer against each question's id, once per pick.
function answersFrom(formData: FormData): AnswerFields {
  const given: AnswerFields = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("answer:") && typeof value === "string") (given[key.slice("answer:".length)] ??= []).push(value);
  }
  return given;
}

// A write of an RSVP that promoted guests from the waitlist, or that a host approved, queued their
// email in its transaction: it goes as soon as the action has answered.
function sendQueuedMail(mailed: boolean): void {
  if (mailed) after(kickMailWorker);
}

// Every answer counts against the RSVP limit before anything is looked up, so that neither a
// flood of RSVPs nor a search for event links gets far through here. When the host has the email
// proven by a code, an answer is saved only once the guest has entered the code sent to it
// (email-code.ts); until then nothing is written but the code.
//
// When the operator has Turnstile on, every answer passes its check next, before anything else
// (spec, "Turnstile"): the first, "Send it again", and the one with the code, since a wrong, dead
// or made-up code is answered with a new one, sent to whatever address the answer names.
export async function saveRsvpAction(slug: string, formData: FormData): Promise<SaveRsvpResult> {
  const requestHeaders = await headers();
  if (!(await consume("rsvp", requestHeaders)).allowed) return { error: "tooFast" };
  if ((await checkTurnstile(formData, requestHeaders)) === "failed") return { error: "checkFailed" };
  const event = await findEventBySlug(slug);
  if (!event || !acceptsRsvps(event.state)) return { error: "closed" };

  const parsed = parseRsvpForm(fields(formData), event);
  if (!parsed.ok) return { error: parsed.error };

  const answers = parseAnswers(answersFrom(formData), await listQuestions(event.id), parsed.input.status);
  if (!answers.ok) return { error: answers.error };

  // Checked again under the event's lock as the reply is written (repository.ts); here first, so
  // that no code is sent for a reply the event cannot take. A guest with no RSVP on this device who
  // opened a personal invite to the event that nobody has replied through replies through it; one
  // who has an RSVP here changes that one, whatever invite they opened (invites/device.ts).
  const mine = await findRsvpOnThisDevice(event.id);
  const invite = mine ? undefined : await findInviteOnThisDevice(event.id);
  if (!mine && (await repliesAtLimit(event.id))) return { error: "limitReached" };
  // So too a Going guest who brings more people than there is room for: they are told how many may
  // come before their email is proven, so no code is sent, nor a right one used up, for a save the
  // event cannot take. Only a guest already Going can be refused so (admission.ts).
  if (mine && event.capacity !== null) {
    const admitted = admit({
      approvalRequired: event.approvalRequired,
      capacity: event.capacity,
      headcount: await countHeadcount(event.id, getDb(), mine.rsvp.id),
      invited: false,
      wanted: parsed.input.status,
      party: 1 + parsed.input.plusOnes,
      current: { status: mine.rsvp.status, approval: mine.rsvp.approval, party: 1 + mine.rsvp.plusOnes },
    });
    if ("refused" in admitted) return { error: "capacityFull", placesLeft: admitted.placesLeft };
  }

  // Once the answer would be taken, its email is proven first when the host asks for it. The email
  // on the guest's personal invite is the host's word for it, so it is proven as it is, with no
  // code (spec, "Contact details").
  const { email } = parsed.input;
  let proven = !!email && email === invite?.email;
  if (!proven && email && needsCode({ verifyEmail: event.verifyEmail, emailField: event.emailField, mailConfigured: isMailConfigured(), email, current: mine?.rsvp })) {
    const proof = await proveEmail(event, email, formData.get("code"), requestHeaders);
    if (proof !== "proven") return proof;
    proven = true;
  }

  // The language the guest answers in is the one their mail about the event is written in.
  const locale = await getLocale();
  // The approval and the capacity decide what the reply becomes, in the transaction that writes it:
  // waiting for the host, Going, on the waitlist, or refused when a Going guest brings more people
  // than there is room for.
  const outcome = await saveRsvp(event.id, { ...parsed.input, locale }, mine, proven, invite);
  if ("refused" in outcome) {
    return outcome.refused === "capacityFull" ? { error: "capacityFull", placesLeft: outcome.placesLeft } : { error: outcome.refused };
  }
  const { saved, written, previous, waitlistPosition, mailed } = outcome;
  sendQueuedMail(mailed);
  // Two writes rather than one transaction: a failure between them leaves the RSVP saved with
  // its previous answers, which the guest can put right by answering again.
  await saveAnswers(saved.rsvp.id, answers.answers);
  const jar = await cookies();
  if (jar.get(rsvpCookieName(event.id))?.value !== saved.token) {
    // A new RSVP, or one this device held only by the personal invite it opened: this device now
    // remembers the guest, so the link finds their answer next time. One saved through a personal
    // invite is remembered by the invite's token, its edit token.
    jar.set(rsvpCookieName(event.id), saved.token, rsvpCookieOptions());
  }
  // Once the RSVP is saved and remembered, so that nothing about the hosts' email can undo either.
  // The hosts hear of what the guest did, not of a promotion it led to.
  await notifyHostsOfRsvp(event, previous, written);
  // The guest list is a reward for answering, so it unlocks without waiting for a reload.
  for (const path of eventPaths(event)) revalidatePath(path);
  return { saved: guestRsvp(saved, waitlistPosition) };
}

// Withdrawing: the RSVP goes, and so does this device's memory of it. A guest may withdraw from
// an event that no longer takes answers. Counted against the RSVP limit before anything is
// looked up, as an answer is.
export async function removeRsvpAction(slug: string): Promise<{ error?: "tooFast" }> {
  if (!(await consume("rsvp", await headers())).allowed) return { error: "tooFast" };
  const event = await findEventBySlug(slug);
  if (!event) return {};
  const mine = await findRsvpOnThisDevice(event.id);
  const { removed, mailed } = mine ? await deleteRsvp(event.id, mine.rsvp.id, "guest") : { removed: undefined, mailed: false };
  sendQueuedMail(mailed);
  (await cookies()).delete(rsvpCookieName(event.id));
  await notifyHostsOfRsvp(event, removed, undefined);
  for (const path of eventPaths(event)) revalidatePath(path);
  return {};
}

// A host changing a guest's RSVP on their own guest list. The host's form carries every field
// it sets, the email and the phone number among them, filled with what is stored, so a save
// keeps what the host left alone.
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

  const changed = await editRsvpAsHost(event.id, rsvpId, parsed.edit);
  if (changed) {
    sendQueuedMail(changed.mailed);
    await notifyHostsOfRsvp(event, changed.previous, changed.current);
  }
  revalidatePath(`/events/${eventId}/guests`);
  return { success: t("saved") };
}

// The host's Move to Going on a waitlisted guest's row (spec, story 145): never refused by the
// capacity. The guest is emailed as a promoted guest is, and the hosts are told as of any change a
// host makes.
export async function moveToGoingAction(eventId: string, rsvpId: string): Promise<void> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "guests")) return;
  const moved = await moveToGoing(event.id, rsvpId);
  if (moved) {
    sendQueuedMail(moved.mailed);
    await notifyHostsOfRsvp(event, moved.previous, moved.current);
  }
  revalidatePath(`/events/${eventId}/guests`);
}

// The host's Approve on a reply waiting for their approval, or one they declined (spec,
// "Approval"): the guest is on the list, Going or on the waitlist as the capacity has it, and is
// emailed. A host's own decision, so the hosts are not emailed about it.
export async function approveGuestAction(eventId: string, rsvpId: string): Promise<void> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "guests")) return;
  const approved = await approveRsvp(event.id, rsvpId);
  if (approved) sendQueuedMail(approved.mailed);
  revalidatePath(`/events/${eventId}/guests`);
}

// The host's Decline on a reply waiting for their approval (spec, "Approval"). Nobody is emailed:
// the guest's page says so when they return.
export async function declineGuestAction(eventId: string, rsvpId: string): Promise<void> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "guests")) return;
  await declineRsvp(event.id, rsvpId);
  revalidatePath(`/events/${eventId}/guests`);
}

// A host taking a guest's RSVP off the list. One made through a personal invite takes the invite
// with it (repository.ts, deleteRsvp), so the invites page is drawn again too.
export async function removeGuestAction(eventId: string, rsvpId: string): Promise<void> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "guests")) return;
  const { removed, mailed } = await deleteRsvp(event.id, rsvpId, "host");
  sendQueuedMail(mailed);
  await notifyHostsOfRsvp(event, removed, undefined);
  revalidatePath(`/events/${eventId}/guests`);
  revalidatePath(`/events/${eventId}/invites`);
}
