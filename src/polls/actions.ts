"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { findEventBySlug } from "@/events/repository";
import { eventPaths } from "@/events/slug";
import { baseUrl } from "@/instance/env";
import { consume } from "@/rate-limit/rate-limit";
import { isEmail, MAX_NAME } from "@/rsvps/form";
import { rsvpCookieOptions } from "@/rsvps/token";
import { checkTurnstile } from "@/turnstile/verify";
import { mayVote, parseVotes, type VoteAnswer } from "./poll";
import { listOptions, saveVotes } from "./repository";
import { voterCookieName } from "./voter";

export type VoteRefusal = "nameRequired" | "nameTooLong" | "emailInvalid" | "voteMissing" | "closed" | "tooFast" | "checkFailed";

// What voting did: the votes as kept, with the private link that changes them, or why not.
export type VoteResult = { error?: VoteRefusal; saved?: { name: string; email: string | null; votes: Record<string, VoteAnswer>; editLink: string } };

// A guest's votes on the date poll (M4 ticket 09): their name, an email if they want the outcome,
// and Yes, If need be or No on every candidate. Counted against the RSVP limit and checked by
// Turnstile, as a reply is. Voting makes no RSVP; the device keeps the votes by a cookie, and the
// edit link carries the same token to any other device.
export async function voteAction(slug: string, formData: FormData): Promise<VoteResult> {
  const requestHeaders = await headers();
  if (!(await consume("rsvp", requestHeaders)).allowed) return { error: "tooFast" };
  if ((await checkTurnstile(formData, requestHeaders)) === "failed") return { error: "checkFailed" };
  const event = await findEventBySlug(slug);
  if (!event || !mayVote(event)) return { error: "closed" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "nameRequired" };
  if (name.length > MAX_NAME) return { error: "nameTooLong" };
  const email = String(formData.get("email") ?? "").trim();
  if (email && !isEmail(email)) return { error: "emailInvalid" };

  const options = await listOptions(event.id);
  const posted = Object.fromEntries(options.map((option) => [option.id, formData.get(`vote-${option.id}`)]));
  const votes = parseVotes(
    options.map((option) => option.id),
    posted,
  );
  if (!votes.ok) return { error: votes.error };

  const jar = await cookies();
  const saved = await saveVotes(event.id, jar.get(voterCookieName(event.id))?.value, { name, email: email || null, locale: await getLocale() }, votes.votes);
  if (saved === "closed") return { error: "closed" };
  jar.set(voterCookieName(event.id), saved.token, rsvpCookieOptions());
  for (const path of eventPaths(event)) revalidatePath(path);
  return { saved: { name, email: email || null, votes: Object.fromEntries(votes.votes), editLink: `${baseUrl()}/v/${saved.token}` } };
}
