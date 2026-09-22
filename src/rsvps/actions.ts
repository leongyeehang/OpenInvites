"use server";

import { cookies } from "next/headers";
import { findEventBySlug } from "@/events/repository";
import { parseRsvpForm, type RsvpFormFields } from "./form";
import { findRsvpOnThisDevice, guestRsvp, type SaveRsvpResult } from "./guest";
import { deleteRsvp, saveRsvp } from "./repository";
import { rsvpCookieName, rsvpCookieOptions } from "./token";

function fields(formData: FormData): RsvpFormFields {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return {
    status: text("status"),
    name: text("name"),
    plusOnes: text("plusOnes"),
    plusOneNames: formData.getAll("plusOneNames").map((value) => (typeof value === "string" ? value : "")),
    email: text("email"),
  };
}

export async function saveRsvpAction(slug: string, formData: FormData): Promise<SaveRsvpResult> {
  const event = await findEventBySlug(slug);
  // Only a published event takes answers. A draft's page is the host's alone, and ticket 16
  // closes a cancelled event the same way.
  if (!event || event.state !== "published") return { error: "closed" };

  const parsed = parseRsvpForm(fields(formData), event);
  if (!parsed.ok) return { error: parsed.error };

  const mine = await findRsvpOnThisDevice(event.id);
  const saved = await saveRsvp(event.id, parsed.input, mine);
  if (!mine) {
    // A new RSVP: this device now remembers the guest, so the link finds their answer next time.
    (await cookies()).set(rsvpCookieName(event.id), saved.token, rsvpCookieOptions());
  }
  return { saved: guestRsvp(saved) };
}

// Withdrawing: the RSVP goes, and so does this device's memory of it. A guest may withdraw from
// an event that no longer takes answers.
export async function removeRsvpAction(slug: string): Promise<void> {
  const event = await findEventBySlug(slug);
  if (!event) return;
  const mine = await findRsvpOnThisDevice(event.id);
  if (mine) await deleteRsvp(mine.rsvp.id);
  (await cookies()).delete(rsvpCookieName(event.id));
}
