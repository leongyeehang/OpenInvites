"use server";

import { revalidatePath } from "next/cache";
import { requireHost } from "@/auth/session";
import { findHostEvent, type HostEvent } from "@/events/repository";
import { eventPaths } from "@/events/slug";
import { featureOn, siteFeatures } from "@/features";
import { can } from "@/hosts/role";
import { ALBUM_REMINDER_CHOICES } from "./album";
import { setAlbumReminder } from "./reminders";
import { emptyAlbum } from "./repository";

// The hosts' own album actions (M7 ticket 09): emptying it in one confirmed step, and when to be
// reminded about it. Each is for the event's hosts, co-hosts included (hosts/role.ts), and each
// refreshes the manage page, the event's pages and the dashboard, which show the album or the
// reminder. None acts while the operator has the Album switched off (M8 ticket 01).

async function hostAlbum(eventId: string): Promise<HostEvent | undefined> {
  const host = await requireHost();
  if (!featureOn(await siteFeatures(), "album")) return undefined;
  const event = await findHostEvent(host.id, eventId);
  return event && can(event.role, "guests") ? event : undefined;
}

function refresh(event: HostEvent): void {
  for (const path of [`/events/${event.id}`, ...eventPaths(event), "/dashboard"]) revalidatePath(path);
}

export async function emptyAlbumAction(eventId: string): Promise<void> {
  const event = await hostAlbum(eventId);
  if (!event) return;
  await emptyAlbum(event.id);
  refresh(event);
}

// Keep it: the reminder is answered by choosing never, which takes the notice down.
export async function keepAlbumAction(eventId: string): Promise<void> {
  const event = await hostAlbum(eventId);
  if (!event) return;
  await setAlbumReminder(event.id, null, new Date());
  refresh(event);
}

export async function setAlbumReminderAction(eventId: string, days: number | null): Promise<void> {
  const event = await hostAlbum(eventId);
  if (!event || (days !== null && !(ALBUM_REMINDER_CHOICES as readonly number[]).includes(days))) return;
  await setAlbumReminder(event.id, days, new Date());
  refresh(event);
}
