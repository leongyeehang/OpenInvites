"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getSession, requireHost } from "@/auth/session";
import { hostNeedsVerification } from "@/auth/verification";
import { findHostEvent } from "@/events/repository";
import { isUuid } from "@/lib/uuid";
import { coHostLinkUrl, generateCoHostLinkToken, hashCoHostLinkToken, MAX_CO_HOSTS, roomForCoHost } from "./co-host-link";
import { acceptCoHostLink, countCoHosts, createCoHostLink, removeCoHost, revokeCoHostLink } from "./repository";
import { can } from "./role";

// Managing an event's co-hosts is its owner's alone (spec, "Co-hosts"); anyone else, co-host or not,
// is answered as for an event that is not theirs. A co-host may only leave.

// The link is handed back to the owner's page this once; only its hash is kept.
export type CoHostLinkFormState = { error?: string; link?: string } | undefined;

export async function createCoHostLinkAction(eventId: string): Promise<CoHostLinkFormState> {
  const [host, t] = await Promise.all([requireHost(), getTranslations("Hosts")]);
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "manageCoHosts")) return { error: t("errors.notFound") };
  if (!roomForCoHost(await countCoHosts(event.id))) return { error: t("full", { max: MAX_CO_HOSTS }) };

  const token = generateCoHostLinkToken();
  await createCoHostLink(event.id, hashCoHostLinkToken(token), new Date());
  revalidatePath(`/events/${event.id}/hosts`);
  return { link: coHostLinkUrl(token) };
}

export async function revokeCoHostLinkAction(eventId: string, linkId: string): Promise<void> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "manageCoHosts") || !isUuid(linkId)) return;
  await revokeCoHostLink(event.id, linkId, new Date());
  revalidatePath(`/events/${event.id}/hosts`);
}

export async function removeCoHostAction(eventId: string, coHostId: string): Promise<void> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "manageCoHosts") || !isUuid(coHostId)) return;
  await removeCoHost(event.id, coHostId);
  revalidatePath(`/events/${event.id}/hosts`);
}

// A co-host stepping away from an event. The owner cannot leave their own event; they delete it.
export async function leaveEventAction(eventId: string): Promise<void> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, eventId);
  if (event?.role === "coHost") await removeCoHost(event.id, host.id);
  redirect("/dashboard");
}

// Accepting a co-host link at /co-host/<token>. A visitor who is not signed in is sent to sign in
// and back. Accepted, or already a co-host, the host lands on the event's manage page; anything else
// is said on the link's page. A token no link has is not found, as its page is. With mail, a host who
// has not verified their email is refused, as the page says, whatever is posted.
export async function acceptCoHostLinkAction(token: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(`/co-host/${token}`)}`);
  const t = await getTranslations("CoHostLink");
  if (hostNeedsVerification(session.user)) return { error: t("verify", { email: session.user.email }) };
  const accepted = await acceptCoHostLink(token, session.user.id, new Date());
  if (!accepted) notFound();
  if (accepted.outcome === "accepted" || accepted.outcome === "coHost") redirect(`/events/${accepted.eventId}`);
  return { error: t(accepted.outcome, { max: MAX_CO_HOSTS }) };
}
