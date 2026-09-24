import { expect, test as base, type APIResponse, type Response } from "@playwright/test";

export * from "@playwright/test";

// Every test is someone on their own device, reaching the instance through the reverse proxy in
// front of it, which says who each client is by appending their address to X-Forwarded-For. The
// app believes the entry that proxy appended (TRUSTED_PROXY_HOPS, 1 by default) and counts every
// rate limit per address, so each test sends one address of its own, from every browser context
// and request it makes, as the proxy would: no test uses up another's allowance, whatever runs
// beside it. Specs import `test` from here rather than from Playwright.
export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, provide) => {
    await provide({ ...extraHTTPHeaders, "x-forwarded-for": clientAddress() });
  },
});

// The not-found page as the server sends it, with 404: whole, in the visitor's language, its
// heading there before any script runs (ticket 20; src/proxy.ts).
export async function expectNotFoundAsSent(response: APIResponse | Response | null, { lang = "en", heading = "Page not found" } = {}) {
  expect(response?.status()).toBe(404);
  const html = (await response?.text()) ?? "";
  expect(html).toContain(`<html lang="${lang}"`);
  expect(html.replace(/<script[\s\S]*?<\/script>/g, "")).toMatch(new RegExp(`<h1[^>]*>${heading}</h1>`));
}

// An address from a private range, a different one for every test in the run.
export function clientAddress() {
  const byte = () => Math.floor(Math.random() * 254) + 1;
  return `10.${byte()}.${byte()}.${byte()}`;
}
