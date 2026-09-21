import { randomInt } from "node:crypto";

// The event link is the access key (ADR-0004): ten characters from a 62-character alphabet,
// about 59 bits, drawn from a cryptographic source and unrelated to the event's id.
export const SLUG_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const SLUG_LENGTH = 10;

export function generateSlug(): string {
  let slug = "";
  for (let i = 0; i < SLUG_LENGTH; i++) slug += SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)];
  return slug;
}

export function isSlug(value: string): boolean {
  return value.length === SLUG_LENGTH && [...value].every((char) => SLUG_ALPHABET.includes(char));
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
