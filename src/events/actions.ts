"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHost } from "@/auth/session";
import { hostNeedsVerification } from "@/auth/verification";
import type { FormState } from "@/lib/form-state";
import { parseQuestions } from "@/questions/question";
import { saveQuestions } from "@/questions/repository";
import { parseEventForm } from "./form";
import { cancelEvent, createEvent, deleteEvent, publishEvent, updateEvent } from "./repository";

function fields(formData: FormData) {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return {
    title: text("title"),
    allDay: formData.get("allDay") === "on",
    start: text("start"),
    end: text("end"),
    timeZone: text("timeZone"),
    location: text("location"),
    description: text("description"),
    plusOnesAllowed: text("plusOnesAllowed"),
    requirePlusOneNames: formData.get("requirePlusOneNames") === "on",
    askEmail: formData.get("askEmail") === "on",
    guestListVisibility: text("guestListVisibility"),
  };
}

// The editor writes its whole list into one field. A payload that is not JSON at all is null,
// which parseQuestions refuses like any other shape it does not know.
function postedQuestions(formData: FormData): unknown {
  const raw = formData.get("questions");
  if (typeof raw !== "string" || !raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// The verification gate on creating events (spec, "Identity and access"). The page explains
// it and offers a resend; the action enforces it.
export async function createEventAction(_: FormState, formData: FormData): Promise<FormState> {
  const host = await requireHost();
  const t = await getTranslations("Events");
  if (hostNeedsVerification(host)) return { error: t("verify.text", { email: host.email }) };
  const parsed = parseEventForm(fields(formData));
  if (!parsed.ok) return { error: t(`errors.${parsed.error}`) };
  const questions = parseQuestions(postedQuestions(formData));
  if (!questions.ok) return { error: t(`errors.${questions.error}`) };

  const created = await createEvent(host.id, parsed.input);
  await saveQuestions(created.id, questions.questions);
  redirect(`/events/${created.id}`);
}

export async function updateEventAction(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const host = await requireHost();
  const t = await getTranslations("Events");
  const parsed = parseEventForm(fields(formData));
  if (!parsed.ok) return { error: t(`errors.${parsed.error}`) };
  const questions = parseQuestions(postedQuestions(formData));
  if (!questions.ok) return { error: t(`errors.${questions.error}`) };

  const updated = await updateEvent(host.id, id, parsed.input);
  if (!updated) return { error: t("errors.notFound") };
  await saveQuestions(updated.id, questions.questions);
  // The heading and link card on the manage page show the event too.
  revalidatePath(`/events/${id}`);
  return { success: t("edit.saved") };
}

export async function publishEventAction(id: string): Promise<void> {
  const host = await requireHost();
  await publishEvent(host.id, id);
  redirect(`/events/${id}`);
}

export async function cancelEventAction(id: string): Promise<void> {
  const host = await requireHost();
  await cancelEvent(host.id, id);
  revalidatePath(`/events/${id}`);
  redirect(`/events/${id}`);
}

export async function deleteEventAction(id: string): Promise<void> {
  const host = await requireHost();
  await deleteEvent(host.id, id);
  redirect("/dashboard");
}
