import { randomInt } from "node:crypto";
import { baseUrl } from "@/instance/env";

// The event link is the access key (ADR-0004): ten characters from a 62-character alphabet,
// about 59 bits, drawn from a cryptographic source and unrelated to the event's id.
export const SLUG_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const SLUG_LENGTH = 10;

function drawSlug(): string {
  let slug = "";
  for (let i = 0; i < SLUG_LENGTH; i++) slug += SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)];
  return slug;
}

// Never of the custom shape (all lowercase letters and digits, about one draw in 10^6), so the two
// kinds of link are told apart by their shape and a custom link can never be someone's random one.
export function generateSlug(): string {
  let slug = drawSlug();
  while (isCustomSlug(slug)) slug = drawSlug();
  return slug;
}

function isRandomSlug(value: string): boolean {
  return value.length === SLUG_LENGTH && [...value].every((char) => SLUG_ALPHABET.includes(char));
}

// The custom link a host may add beside the random one: easy to say aloud, so it is guessable and
// is not the private link (ADR-0004).
export const CUSTOM_SLUG_MIN = 3;
export const CUSTOM_SLUG_MAX = 40;

export function isCustomSlug(value: string): boolean {
  return value.length >= CUSTOM_SLUG_MIN && value.length <= CUSTOM_SLUG_MAX && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
}

export function normaliseCustomSlug(input: string): string {
  return input.trim().toLowerCase();
}

// Either shape of event link.
export function isSlug(value: string): boolean {
  return isRandomSlug(value) || isCustomSlug(value);
}

// Where an event's page is shown, printed and emailed: the custom link when it has one.
export function eventPath(event: { slug: string; customSlug: string | null }): string {
  return `/e/${event.customSlug ?? event.slug}`;
}

// Every path an event's page answers at, for revalidating after a change.
export function eventPaths(event: { slug: string; customSlug: string | null }): string[] {
  return [`/e/${event.slug}`, ...(event.customSlug ? [`/e/${event.customSlug}`] : [])];
}

export function eventUrl(event: { slug: string; customSlug: string | null }): string {
  return `${baseUrl()}${eventPath(event)}`;
}

export const SLUG_TAKEN = Symbol("slug taken");

// Draws a slug and hands it to `attempt`, which returns SLUG_TAKEN when another event already
// has it. A collision is a one in 2^59 event, so five tries is generosity, not a plan.
export async function withFreshSlug<T>(attempt: (slug: string) => Promise<T | typeof SLUG_TAKEN>): Promise<T> {
  for (let tries = 0; tries < 5; tries++) {
    const result = await attempt(generateSlug());
    if (result !== SLUG_TAKEN) return result;
  }
  throw new Error("Could not find a free slug in five tries");
}
