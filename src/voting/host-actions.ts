"use server";

import { revalidatePath } from "next/cache";
import { requireHost } from "@/auth/session";
import { findHostEvent, type HostEvent } from "@/events/repository";
import { eventPaths } from "@/events/slug";
import { featureOn, siteFeatures } from "@/features";
import { can } from "@/hosts/role";
import { closeVoting, reopenVoting, startVoting, turnOffVoting } from "./repository";

// The hosts' album vote actions (M8 ticket 10), from the Voting block in the editor's Settings:
// start, close, reopen and turn off. Each is for the event's hosts, co-hosts included
// (hosts/role.ts), and each refreshes the editor and the event's pages, which show the vote. None
// acts while the operator has Voting switched off, or the Album it needs (M8 ticket 01). The guard
// and the refresh are the album's (album/host-actions.ts), copied, since the module imports
// nothing of the album's (M8 plan, ruling 18).

async function hostVoting(eventId: string): Promise<HostEvent | undefined> {
  const host = await requireHost();
  if (!featureOn(await siteFeatures(), "voting")) return undefined;
  const event = await findHostEvent(host.id, eventId);
  return event && can(event.role, "guests") ? event : undefined;
}

function refresh(event: HostEvent): void {
  for (const path of [`/events/${event.id}`, ...eventPaths(event)]) revalidatePath(path);
}

// Refused while the album is not open, which a vote needs (M8 plan, ruling 20).
export async function startVotingAction(eventId: string): Promise<{ error?: "albumNotOpen" }> {
  const event = await hostVoting(eventId);
  if (!event) return {};
  const started = await startVoting(event.id, new Date());
  refresh(event);
  return started;
}

export async function closeVotingAction(eventId: string): Promise<void> {
  const event = await hostVoting(eventId);
  if (!event) return;
  await closeVoting(event.id);
  refresh(event);
}

export async function reopenVotingAction(eventId: string): Promise<void> {
  const event = await hostVoting(eventId);
  if (!event) return;
  await reopenVoting(event.id, new Date());
  refresh(event);
}

export async function turnOffVotingAction(eventId: string): Promise<void> {
  const event = await hostVoting(eventId);
  if (!event) return;
  await turnOffVoting(event.id);
  refresh(event);
}
