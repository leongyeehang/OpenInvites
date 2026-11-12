"use server";

import { revalidatePath } from "next/cache";
import { requireHost } from "@/auth/session";
import { findHostEvent, type HostEvent } from "@/events/repository";
import { eventPaths } from "@/events/slug";
import { featureOn, siteFeatures } from "@/features";
import { can } from "@/hosts/role";
import { isUuid } from "@/lib/uuid";
import {
  addAward,
  closeVoting,
  countAwardVotes,
  moveAward,
  removeAward,
  renameAward,
  reopenVoting,
  setAwardScope,
  setUploaderNames,
  startVoting,
  turnOffVoting,
} from "./repository";
import { AWARD_SCOPES, parseAwardName, UPLOADER_NAMES, type AwardScope, type UploaderNames } from "./voting";

// The hosts' album vote actions (M8 ticket 10), from the Voting block in the editor's Settings:
// start, close, reopen and turn off; whether guests see who added each item (ticket 11); and the
// awards (ticket 13). Each is for the event's hosts, co-hosts included (hosts/role.ts), and each
// refreshes the editor and the event's pages, which show the vote. None acts while the operator
// has Voting switched off, or the Album it needs (M8 ticket 01). The guard and the refresh are the
// album's (album/host-actions.ts), copied, since the module imports nothing of the album's (M8
// plan, ruling 18).
//
// A press the guard turns away, or one with a value outside its list, answers `refused`, so the
// block says the press did not go through rather than showing it saved (review fix, ticket 13).

async function hostVoting(eventId: string): Promise<HostEvent | undefined> {
  const host = await requireHost();
  if (!featureOn(await siteFeatures(), "voting")) return undefined;
  const event = await findHostEvent(host.id, eventId);
  return event && can(event.role, "guests") ? event : undefined;
}

function refresh(event: HostEvent): void {
  for (const path of [`/events/${event.id}`, ...eventPaths(event)]) revalidatePath(path);
}

const isScope = (scope: unknown): scope is AwardScope => AWARD_SCOPES.includes(scope as AwardScope);
const isMove = (by: unknown): by is -1 | 1 => by === -1 || by === 1;
// An award's id, or null for Favourite before it is made where `orNull` allows it.
const isAward = (awardId: unknown, orNull = false): awardId is string | null => (orNull && awardId === null) || (typeof awardId === "string" && isUuid(awardId));

// Refused while the album is not open, which a vote needs (M8 plan, ruling 20).
export async function startVotingAction(eventId: string): Promise<{ error?: "albumNotOpen" | "refused" }> {
  const event = await hostVoting(eventId);
  if (!event) return { error: "refused" };
  const started = await startVoting(event.id, new Date());
  refresh(event);
  return started;
}

export async function closeVotingAction(eventId: string): Promise<{ error?: "refused" }> {
  const event = await hostVoting(eventId);
  if (!event) return { error: "refused" };
  await closeVoting(event.id);
  refresh(event);
  return {};
}

// Refused while the album is not open, as starting is (review fix, M8 ticket 13).
export async function reopenVotingAction(eventId: string): Promise<{ error?: "albumNotOpen" | "refused" }> {
  const event = await hostVoting(eventId);
  if (!event) return { error: "refused" };
  const reopened = await reopenVoting(event.id, new Date());
  refresh(event);
  return reopened;
}

export async function turnOffVotingAction(eventId: string): Promise<{ error?: "refused" }> {
  const event = await hostVoting(eventId);
  if (!event) return { error: "refused" };
  await turnOffVoting(event.id);
  refresh(event);
  return {};
}

// Whether guests see who added each item (M8 ticket 11).
export async function setUploaderNamesAction(eventId: string, names: UploaderNames): Promise<{ error?: "refused" }> {
  if (!UPLOADER_NAMES.includes(names)) return { error: "refused" };
  const event = await hostVoting(eventId);
  if (!event) return { error: "refused" };
  await setUploaderNames(event.id, names);
  refresh(event);
  return {};
}

// How many votes each award holds, by its id, read as a confirmation that deletes them opens
// (review fix, M8 ticket 13): the figure the page was drawn with may be old by then. Null when
// refused.
export async function awardVotesAction(eventId: string): Promise<Record<string, number> | null> {
  const event = await hostVoting(eventId);
  if (!event) return null;
  return Object.fromEntries(await countAwardVotes(event.id));
}

// The awards (M8 ticket 13). A name goes through parseAwardName; nothing typed is Favourite.
export async function addAwardAction(eventId: string, name: string, scope: AwardScope): Promise<{ error?: "full" | "nameTooLong" | "refused" }> {
  if (typeof name !== "string" || !isScope(scope)) return { error: "refused" };
  const parsed = parseAwardName(name);
  if (!parsed.ok) return { error: parsed.error };
  const event = await hostVoting(eventId);
  if (!event) return { error: "refused" };
  const added = await addAward(event.id, parsed.name, scope);
  refresh(event);
  return added === "full" ? { error: "full" } : {};
}

export async function renameAwardAction(eventId: string, awardId: string | null, name: string): Promise<{ error?: "nameTooLong" | "refused" }> {
  if (typeof name !== "string" || !isAward(awardId, true)) return { error: "refused" };
  const parsed = parseAwardName(name);
  if (!parsed.ok) return { error: parsed.error };
  const event = await hostVoting(eventId);
  if (!event) return { error: "refused" };
  await renameAward(event.id, awardId, parsed.name);
  refresh(event);
  return {};
}

export async function setAwardScopeAction(eventId: string, awardId: string | null, scope: AwardScope): Promise<{ error?: "refused" }> {
  if (!isScope(scope) || !isAward(awardId, true)) return { error: "refused" };
  const event = await hostVoting(eventId);
  if (!event) return { error: "refused" };
  await setAwardScope(event.id, awardId, scope);
  refresh(event);
  return {};
}

export async function moveAwardAction(eventId: string, awardId: string, by: -1 | 1): Promise<{ error?: "refused" }> {
  if (!isMove(by) || !isAward(awardId)) return { error: "refused" };
  const event = await hostVoting(eventId);
  if (!event) return { error: "refused" };
  await moveAward(event.id, awardId, by);
  refresh(event);
  return {};
}

// The event's last award is not removed.
export async function removeAwardAction(eventId: string, awardId: string): Promise<{ error?: "last" | "refused" }> {
  if (!isAward(awardId)) return { error: "refused" };
  const event = await hostVoting(eventId);
  if (!event) return { error: "refused" };
  const removed = await removeAward(event.id, awardId);
  refresh(event);
  return removed === "last" ? { error: "last" } : {};
}
