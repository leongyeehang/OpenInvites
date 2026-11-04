"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHost } from "@/auth/session";
import { can } from "@/hosts/role";
import type { FormState } from "@/lib/form-state";
import { listQuestions, saveQuestions } from "@/questions/repository";
import { notifyGuestsOfCancellation } from "@/rsvps/notify-cancellation";
import { copyPicture } from "@/uploads/copy";
import { findEventUpload } from "@/uploads/repository";
import { duplicateInput } from "./duplicate";
import { eventsOwnedAtLimit } from "./limit";
import { cancelEvent, createEvent, CUSTOM_SLUG_TAKEN, deleteEvent, findHostEvent, resetEventLink, setCustomSlug } from "./repository";
import { eventPaths, isCustomSlug, normaliseCustomSlug } from "./slug";

export async function cancelEventAction(id: string): Promise<void> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, id);
  const cancelled = event && can(event.role, "cancel") ? await cancelEvent(host.id, id) : undefined;
  if (cancelled) await notifyGuestsOfCancellation(cancelled);
  revalidatePath(`/events/${id}`);
  redirect(`/events/${id}`);
}

export async function deleteEventAction(id: string): Promise<void> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, id);
  if (event && can(event.role, "delete")) await deleteEvent(host.id, id);
  redirect("/dashboard");
}

export async function resetLinkAction(id: string): Promise<void> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, id);
  const reset = event && can(event.role, "resetLink") ? await resetEventLink(host.id, id) : undefined;
  // The manage page shows the link too, so it must not keep showing the retired one; the pages
  // the event answered at before are now the retired page.
  if (event && reset) for (const path of [...eventPaths(event), ...eventPaths(reset)]) revalidatePath(path);
  revalidatePath(`/events/${id}`);
  revalidatePath(`/events/${id}/share`);
  redirect(`/events/${id}/share`);
}

// Gives the event a custom link, or takes it away when the field is empty. A refusal says why,
// under the field; a success refreshes every page that shows the link.
// A refusal hands back what was typed, as a form action's reset would otherwise empty the field.
export type CustomLinkState = (NonNullable<FormState> & { typed?: string }) | undefined;

export async function setCustomLinkAction(id: string, _: CustomLinkState, formData: FormData): Promise<CustomLinkState> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, id);
  const t = await getTranslations("Events.share.customLink");
  if (!event || !can(event.role, "share")) return { error: t("errors.notFound") };
  const posted = formData.get("customSlug");
  // Remove is the same form's other button, so the refusal it answers goes with the field.
  const typed = formData.has("remove") ? "" : typeof posted === "string" ? posted : "";
  const custom = normaliseCustomSlug(typed);
  if (custom !== "" && !isCustomSlug(custom)) return { error: t("errors.shape"), typed };
  const changed = await setCustomSlug(host.id, id, custom === "" ? null : custom);
  if (changed === CUSTOM_SLUG_TAKEN) return { error: t("errors.taken"), typed };
  if (!changed) return { error: t("errors.notFound") };
  refreshLinkPages(event, changed);
  return { success: custom === "" ? t("removed") : t("saved") };
}

// The link is on the manage page, the share page and the event page itself, under both the old and
// the new custom link.
function refreshLinkPages(before: { id: string; slug: string; customSlug: string | null }, after: { slug: string; customSlug: string | null }) {
  for (const path of [...eventPaths(before), ...eventPaths(after)]) revalidatePath(path);
  revalidatePath(`/events/${before.id}`);
  revalidatePath(`/events/${before.id}/share`);
}

// A new draft with the same details, look, questions, settings and picture, owned by the host who
// asks, who is taken to its manage page, which names the event it came from. A host at the
// operator's limit is told so instead.
export async function duplicateEventAction(id: string): Promise<FormState> {
  const host = await requireHost();
  const source = await findHostEvent(host.id, id);
  if (!source || !can(source.role, "duplicate")) redirect(`/events/${id}`);
  const t = await getTranslations("Events");
  const owned = await eventsOwnedAtLimit(host.id);
  if (owned !== undefined) return { error: t("errors.limitReached", { count: owned }) };
  const { event, questions } = duplicateInput(source, await listQuestions(id), await getLocale(), t("duplicate.copySuffix"));

  const created = await createEvent(host.id, event);
  try {
    await saveQuestions(created.id, questions);
    const picture = await findEventUpload(id);
    if (picture) await copyPicture(picture, host.id, created.id);
  } catch (error) {
    // Nothing half-made is left in the host's dashboard; the host can try again.
    await deleteEvent(host.id, created.id);
    throw error;
  }
  redirect(`/events/${created.id}?from=${id}`);
}
