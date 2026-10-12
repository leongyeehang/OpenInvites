"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { requireHost } from "@/auth/session";
import { findHostEvent } from "@/events/repository";
import { can } from "@/hosts/role";
import type { FormState } from "@/lib/form-state";
import { isUuid } from "@/lib/uuid";
import { MAX_INVITES, parseInvite } from "./invite";
import { createInvite, deleteInvite } from "./repository";

// A host's personal invites are part of who is coming, so whoever may manage the guest list may
// make and delete them (hosts/role.ts). Both pages that show them are drawn again: the invites
// page, and the guest list, whose Invited section lists those nobody has replied through.
function revalidateInvites(eventId: string): void {
  revalidatePath(`/events/${eventId}/invites`);
  revalidatePath(`/events/${eventId}/guests`);
}

// Making one personal invite: a name and, if the host gives it, an email (spec, "Personal invite
// links"). The link is on the invites page from then on, for the host to copy.
export async function createInviteAction(eventId: string, _: FormState, formData: FormData): Promise<FormState> {
  const [host, t] = await Promise.all([requireHost(), getTranslations("Invites")]);
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "guests")) return { error: t("errors.notFound") };

  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const parsed = parseInvite({ name: text("name"), email: text("email") });
  if (!parsed.ok) return { error: t(`errors.${parsed.error}`) };

  const made = await createInvite(event.id, parsed.invite);
  if (!made) return { error: t("full", { max: MAX_INVITES }) };
  revalidateInvites(event.id);
  return { success: t("made", { name: made.name }) };
}

// The link stops working; a reply made with it stays on the guest list (repository.ts).
export async function deleteInviteAction(eventId: string, id: string): Promise<void> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "guests") || !isUuid(id)) return;
  await deleteInvite(event.id, id);
  revalidateInvites(event.id);
}
