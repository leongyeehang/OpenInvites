"use server";

import { refresh } from "next/cache";
import { requireHost } from "@/auth/session";
import { changeEventTheme } from "@/events/repository";
import { applyChange, parseThemeChange } from "./changes";

export type ThemeChangeResult = { saved: boolean };

// One change from the Design drawer: a template applied or one knob set. The page has already
// shown it; this saves it and refreshes the page, so the host's view settles on what guests see.
export async function changeThemeAction(eventId: string, posted: unknown): Promise<ThemeChangeResult> {
  const host = await requireHost();
  const change = parseThemeChange(posted);
  if (!change) return { saved: false };
  const saved = await changeEventTheme(host.id, eventId, (theme) => applyChange(theme, change));
  if (!saved) return { saved: false };
  refresh();
  return { saved: true };
}
