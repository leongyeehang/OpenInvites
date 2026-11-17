import { createDraft, createPublished, publishInEditor } from "./events";
import { clientAddress, expect, type APIRequestContext, type Browser } from "./test";

// A host whose dashboard has an event on every shelf (dashboard, tickets 03 and 05): Next up, with
// a reply waiting for approval; a later published event under Coming up; a draft under Drafts; and
// a draft that has ended under Past. The accessibility, keyboard, locale and reduced-motion specs
// check the dashboard as it is with them.
export const SHELVES = {
  nextUp: "Ada’s supper club",
  comingUp: "Spring picnic",
  draft: "Not ready yet",
  past: "Last year’s party",
} as const;

export async function hostWithShelves(browser: Browser, request: APIRequestContext, label: string) {
  const host = await createPublished(browser, request, label, { title: SHELVES.nextUp, start: "2027-03-06T19:00", approval: true });
  const guestContext = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
  const guest = await guestContext.newPage();
  await guest.goto(host.link);
  await guest.getByRole("button", { name: "Going", exact: true }).click();
  await guest.getByLabel("Your name").fill("Asha Menon");
  if (await guest.getByRole("button", { name: "Continue" }).isVisible()) {
    await guest.getByRole("button", { name: "Continue" }).click();
    await guest.getByRole("radio", { name: "Just me" }).click();
  }
  await guest.getByRole("button", { name: "Send RSVP" }).click();
  await expect(guest.getByRole("heading", { name: "Your reply is waiting for the host’s approval." })).toBeVisible({ timeout: 15_000 });
  await guestContext.close();

  await createDraft(host.page, { title: SHELVES.comingUp, start: "2027-04-10T12:00" });
  await publishInEditor(host.page);
  await createDraft(host.page, { title: SHELVES.draft, start: "2027-03-01T19:00" });
  await createDraft(host.page, { title: SHELVES.past, start: "2020-01-01T10:00" });
  await host.page.goto("/dashboard");
  await expect(host.page.getByRole("region", { name: "Past", exact: true }).getByText(SHELVES.past)).toBeVisible();
  return host;
}
