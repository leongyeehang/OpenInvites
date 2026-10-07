"use server";

import { refresh } from "next/cache";
import { requireHost } from "@/auth/session";
import { changeEventTheme, findHostEvent } from "@/events/repository";
import { can } from "@/hosts/role";
import { findHostUploadId } from "@/uploads/repository";
import { applyChange, parseThemeChange } from "./changes";

export type ThemeChangeResult = { saved: boolean };

// One change from the Design drawer: a template applied or one knob set. The page has already
// shown it; this saves it and refreshes the page, so the host's view settles on what guests see.
export async function changeThemeAction(eventId: string, posted: unknown): Promise<ThemeChangeResult> {
  const host = await requireHost();
  const event = await findHostEvent(host.id, eventId);
  if (!event || !can(event.role, "design")) return { saved: false };
  // The only upload a theme can show is the event's own.
  const change = parseThemeChange(posted, await findHostUploadId(host.id, eventId));
  if (!change) return { saved: false };
  const saved = await changeEventTheme(host.id, eventId, (theme) => applyChange(theme, change));
  if (!saved) return { saved: false };
  refresh();
  return { saved: true };
}
