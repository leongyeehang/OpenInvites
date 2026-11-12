import { expectRingStandsOut, worstContrast } from "./contrast";
import { createDraft, createPublished, editSettings, openMore, pickDesign } from "./events";
import { latestMailTo, mailCountTo, newHost } from "./hosts";
import { expectSiteLook, SITE_POSTERS } from "./site-look";
import { clientAddress, expect, test, type Browser, type Page } from "./test";

// M8 ticket 18: every page that is not an event page sits on a still poster, in glass, and the
// notice pages come first. The pages drawn without the database (too fast, privacy, terms, not
// found) wear the fallback area's poster from the whole gallery; the notices a guest meets on an
// event's link wear the guest area's poster from the site's set, never the event's Theme, so they
// read the same whatever the host chose. The shared `app` keeps the whole gallery as its set.
// Nothing on them moves, so motion is welcome here and still nothing runs. Each test runs at 390
// pixels in the mobile project and at desktop width in the other.

test.use({ contextOptions: { reducedMotion: "no-preference" } });

const STOP_LINK = /https?:\/\/\S+\/m\/[A-Za-z0-9]{24}/;
const INVITE_ONLY = "Invite-only: only people on the invite list can open the invitation";
const DISCO = "disco-ball-copy";

// A guest on a device of their own.
async function newGuest(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ reducedMotion: "no-preference", extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
  return context.newPage();
}

// The page as the server sent it and as it stands holds nothing of the event's poster.
async function expectNoDisco(page: Page) {
  expect(await page.content(), "the event's poster").not.toContain(DISCO);
}

// Once the backdrop's picture has arrived and been decoded, so that pixels are read against it and
// not against the colour under it.
async function backdropPainted(page: Page) {
  await page.locator('[data-slot="backdrop"] [style*="url("]').evaluate(async (element) => {
    const url = getComputedStyle(element).backgroundImage.match(/url\("?([^")]+)"?\)/)![1];
    const picture = new Image();
    picture.src = url;
    await picture.decode();
  });
}

test("the pages drawn without the database wear one poster from the whole gallery, still", async ({ page }) => {
  for (const [path, heading] of [
    ["/too-fast", "You’re going too fast"],
    ["/privacy", "Privacy policy"],
    ["/terms", "Terms of use"],
    ["/no-such-page", "Page not found"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expectSiteLook(page, SITE_POSTERS.fallback);
  }
});

test("a guest's notice pages wear the site's poster, never the event's", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "site-look", { title: "Ada’s disco", start: "2027-03-06T19:00", plusOnes: "0", askEmail: true });
  await pickDesign(host.page, "Poster", "Poster", "Disco", "Gallery");
  const editor = host.page.url();

  // The guest replies on the event's own page, which wears the event's poster, with an email.
  const email = newHost("site-look-guest").email;
  await page.goto(host.link);
  await expect(page.locator(`[data-slot="backdrop"] [style*="${DISCO}"]`)).toHaveCount(1);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText(`We’ll reach you at ${email}.`)).toBeVisible({ timeout: 15_000 });

  // The report form.
  await page.goto(`${host.link}/report`);
  await expect(page.getByRole("heading", { level: 1, name: "Report Ada’s disco" })).toBeVisible();
  await expectSiteLook(page, SITE_POSTERS.guest);
  await expectNoDisco(page);

  // A draft on the same poster, opened by a guest.
  const draftLink = await createDraft(host.page, { title: "Ada’s next disco", start: "2027-04-10T19:00" });
  await pickDesign(host.page, "Poster", "Poster", "Disco", "Gallery");
  const visitor = await newGuest(browser);
  await visitor.goto(draftLink);
  await expect(visitor.getByRole("heading", { level: 1, name: "This invitation isn’t ready yet" })).toBeVisible();
  await expectSiteLook(visitor, SITE_POSTERS.guest);
  await expectNoDisco(visitor);

  // The locked page, to a device that is not in once the event is invite-only.
  await host.page.goto(editor);
  await editSettings(host.page, (sheet) => sheet.getByRole("group", { name: "Guests", exact: true }).getByLabel(INVITE_ONLY, { exact: true }).check());
  await visitor.goto(host.link);
  await expect(visitor.getByRole("heading", { level: 1, name: "A private invitation" })).toBeVisible();
  await expectSiteLook(visitor, SITE_POSTERS.guest);
  await expectNoDisco(visitor);

  // The link the host has reset.
  await host.page.goto(`${editor}/share`);
  await host.page.getByRole("button", { name: "Reset the link" }).click();
  await host.page.getByRole("button", { name: "Reset it" }).click();
  await expect(host.page.getByText(host.link, { exact: true })).toHaveCount(0, { timeout: 15_000 });
  await page.goto(host.link);
  await expect(page.getByRole("heading", { level: 1, name: "This link is no longer valid" })).toBeVisible();
  await expectSiteLook(page, SITE_POSTERS.guest);
  await expectNoDisco(page);

  // The stop-mail page, from the email cancelling the event.
  await host.page.goto(editor);
  await openMore(host.page);
  await host.page.getByRole("button", { name: "Cancel event" }).click();
  await host.page.getByRole("button", { name: "Cancel the event" }).click();
  await expect(host.page.getByText("Cancelled", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => mailCountTo(request, email), { timeout: 30_000, message: `an email to ${email}` }).toBe(1);
  await page.goto((await latestMailTo(request, email)).match(STOP_LINK)![0]);
  await expect(page.getByRole("button", { name: "Stop emails about this event" })).toBeVisible();
  await expectSiteLook(page, SITE_POSTERS.guest);
  await expectNoDisco(page);

  await visitor.context().close();
  await host.context.close();
});

test("a legal page reads on a light poster and the report form on a dark one", async ({ page, browser, request }) => {
  test.slow();
  // Cake, under dark text.
  await page.goto("/privacy");
  await expectSiteLook(page, SITE_POSTERS.fallback);
  await expect(page.locator(".site-page")).toHaveAttribute("data-tone", "dark");
  await backdropPainted(page);
  expect(await worstContrast(page.getByRole("heading", { level: 1, name: "Privacy policy" })), "the title").toBeGreaterThanOrEqual(4.5);
  expect(await worstContrast(page.locator('[data-slot="legal-text"] p').first()), "the operator's text").toBeGreaterThanOrEqual(4.5);

  // Cocktails, under light text.
  const host = await createPublished(browser, request, "site-look-report", { title: "Ada’s birthday", start: "2027-03-06T19:00" });
  await page.goto(`${host.link}/report`);
  await expectSiteLook(page, SITE_POSTERS.guest);
  await expect(page.locator(".site-page")).toHaveAttribute("data-tone", "light");
  await backdropPainted(page);
  const reason = page.getByLabel("What’s wrong with this page?");
  const email = page.getByLabel("Your email (optional)");
  const send = page.getByRole("button", { name: "Send report" });
  // Typed, and left, so that its border is the field's own and not the focus ring's.
  await reason.fill("This page is not what it says it is.");
  await reason.blur();
  expect(await worstContrast(page.getByRole("heading", { level: 1, name: "Report Ada’s birthday" })), "the title").toBeGreaterThanOrEqual(4.5);
  expect(await worstContrast(page.getByText("What’s wrong with this page?", { exact: true })), "the label").toBeGreaterThanOrEqual(4.5);
  // The field's own border, light under light text and no part of what is behind its words, is
  // left out of the picture.
  await reason.evaluate((element) => ((element as HTMLElement).style.borderColor = "transparent"));
  expect(await worstContrast(reason), "the typed reason").toBeGreaterThanOrEqual(4.5);
  await reason.evaluate((element) => (element as HTMLElement).style.removeProperty("border-color"));
  for (const control of [reason, email, send]) await expectRingStandsOut(page, control);
  await host.context.close();
});
