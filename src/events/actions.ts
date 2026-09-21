"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHost } from "@/auth/session";
import { hostNeedsVerification } from "@/auth/verification";
import type { FormState } from "@/lib/form-state";
import { parseEventForm } from "./form";
import { createEvent, publishEvent, updateEvent } from "./repository";

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
  };
}

// The verification gate on creating events (spec, "Identity and access"). The page explains
// it and offers a resend; the action enforces it.
export async function createEventAction(_: FormState, formData: FormData): Promise<FormState> {
  const host = await requireHost();
  const t = await getTranslations("Events");
  if (hostNeedsVerification(host)) return { error: t("verify.text", { email: host.email }) };
  const parsed = parseEventForm(fields(formData));
  if (!parsed.ok) return { error: t(`errors.${parsed.error}`) };
  const created = await createEvent(host.id, parsed.input);
  redirect(`/events/${created.id}`);
}

export async function updateEventAction(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const host = await requireHost();
  const t = await getTranslations("Events");
  const parsed = parseEventForm(fields(formData));
  if (!parsed.ok) return { error: t(`errors.${parsed.error}`) };
  const updated = await updateEvent(host.id, id, parsed.input);
  if (!updated) return { error: t("errors.notFound") };
  // The heading and link card on the manage page show the event too.
  revalidatePath(`/events/${id}`);
  return { success: t("edit.saved") };
}

export async function publishEventAction(id: string): Promise<void> {
  const host = await requireHost();
  await publishEvent(host.id, id);
  redirect(`/events/${id}`);
}
