"use server";

import { refresh } from "next/cache";
import { requireHost } from "@/auth/session";
import { describeUpload } from "./repository";
import { parseAltText } from "./validate";

// The host's description of their picture, from the Design drawer. The page says it to guests
// who use a screen reader; this saves it and refreshes the page, so the host's view has it too.
export async function describeUploadAction(eventId: string, posted: unknown): Promise<{ saved: boolean }> {
  const host = await requireHost();
  const altText = parseAltText(posted);
  if (altText === undefined) return { saved: false };
  const saved = await describeUpload(host.id, eventId, altText);
  if (saved) refresh();
  return { saved };
}
