import { expectRingStandsOut, worstContrast } from "./contrast";
import { createDraft, createPublished, editSettings, openMore, pickDesign } from "./events";
import { hostWithShelves } from "./dashboard";
import { latestMailTo, mailCountTo, newHost, OPERATOR, PASSWORD, signIn, signUpVerified } from "./hosts";
import { backdropPainted, expectSiteLook, SITE_POSTERS } from "./site-look";
import { clientAddress, expect, test, type Browser, type Locator, type Page } from "./test";

// M8 ticket 18: every page that is not an event page sits on a still poster, in glass, and the
// notice pages come first. The pages drawn without the database (too fast, privacy, terms, not
// found) wear the fallback area's poster from the whole gallery; the notices a guest meets on an
// event's link wear the guest area's poster from the site's set, never the event's Theme, so they
// read the same whatever the host chose. The shared `app` keeps the whole gallery as its set.
// Ticket 19: the signed-out screens and the co-host link wear the welcome area's poster from the
// site's set, with the site's name above their cards. Ticket 20: every signed-in page sits in one
// frame, a glass header over a still poster: a host's own pages wear their next event's poster, or
// the host area's, and Site settings and reports the site area's. Nothing on these pages moves, so
// motion is welcome here and still nothing runs. Each test runs at 390 pixels in the mobile project
// and at desktop width in the other.

test.use({ contextOptions: { reducedMotion: "no-preference" } });

const STOP_LINK = /https?:\/\/\S+\/m\/[A-Za-z0-9]{24}/;
const INVITE_ONLY = "Invite-only: only people on the invite list can open the invitation";
const DISCO = "disco-ball-copy";
const CAKE = "birthday-cake-copy";

// What is no part of what is behind a button's words, painted with its fill while it is pictured
// (ticket 19): its edge, its rounded corners, and the row of pixels its box shares with what is
// round it, as a button can sit half a pixel off the grid.
const EDGELESS = ["border-color", "background-clip", "border-radius", "box-shadow", "transition"];

async function buttonWordsContrast(button: Locator) {
  await button.evaluate((element) => {
    const style = (element as HTMLElement).style;
    const fill = getComputedStyle(element).backgroundColor;
    Object.assign(style, { transition: "none", borderColor: "transparent", backgroundClip: "border-box", borderRadius: "0", boxShadow: `0 0 0 2px ${fill}` });
  });
  const ratio = await worstContrast(button);
  await button.evaluate((element, names) => names.forEach((name) => (element as HTMLElement).style.removeProperty(name)), EDGELESS);
  return ratio;
}

// A field's typed words, its own border left out of the picture (ticket 18): light under light
// text, and no part of what is behind its words.
async function typedContrast(field: Locator) {
  await field.blur();
  await field.evaluate((element) => ((element as HTMLElement).style.borderColor = "transparent"));
  const ratio = await worstContrast(field);
  await field.evaluate((element) => (element as HTMLElement).style.removeProperty("border-color"));
  return ratio;
}
const CO_HOST_LINK = /^https?:\/\/\S+\/co-host\/[A-Za-z0-9_-]{32}$/;

// A guest on a device of their own.
async function newGuest(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ reducedMotion: "no-preference", extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
  return context.newPage();
}

// The page as the server sent it and as it stands holds nothing of the event's poster.
async function expectNoDisco(page: Page) {
  expect(await page.content(), "the event's poster").not.toContain(DISCO);
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

// The site's name above a signed-out screen's cards: the shared `app`'s, leading home.
async function expectSiteName(page: Page) {
  const name = page.locator('[data-slot="site-name"]');
  await expect(name).toHaveCount(1);
  await expect(page.getByRole("link", { name: "OpenInvites", exact: true })).toHaveAttribute("href", "/");
  await expect(name).toHaveText("OpenInvites");
}

test("the signed-out screens wear one poster of the site's, the same on every visit, still", async ({ page }) => {
  for (const [path, heading] of [
    ["/sign-in", "Sign in"],
    ["/sign-in", "Sign in"],
    ["/sign-up", "Create your host account"],
    ["/forgot-password", "Reset your password"],
    ["/verify-email?error=invalid_token", "That link did not work"],
    ["/sign-in?linkError=1", "Sign in"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expectSiteLook(page, SITE_POSTERS.welcome);
    await expectSiteName(page);
  }
  await page.getByRole("link", { name: "OpenInvites", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

// From the editor's More, as co-hosts.spec.ts makes one: the hosts page's co-host link, shown once.
async function makeCoHostLink(owner: Page): Promise<string> {
  await openMore(owner);
  await owner.getByRole("link", { name: "Hosts", exact: true }).click();
  await expect(owner.getByRole("heading", { name: "Hosts", level: 1 })).toBeVisible();
  await owner.getByRole("button", { name: "Make a co-host link" }).click();
  const link = owner.getByRole("textbox", { name: "Co-host link" });
  await expect(link).toBeVisible({ timeout: 15_000 });
  const url = await link.inputValue();
  expect(url).toMatch(CO_HOST_LINK);
  return url;
}

test("a co-host link wears the same poster, signed out and signed in", async ({ page, browser, request }) => {
  test.slow();
  const owner = await createPublished(browser, request, "site-look-owner", { title: "Ada’s disco", start: "2027-03-06T19:00" });
  await pickDesign(owner.page, "Poster", "Poster", "Disco", "Gallery");
  const link = await makeCoHostLink(owner.page);

  // A visitor who is not signed in is asked to sign in.
  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1, name: "Ada’s disco" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in to accept this co-host link" })).toBeVisible();
  await expectSiteLook(page, SITE_POSTERS.welcome);
  await expectNoDisco(page);

  // A second host, signed in, is offered the button.
  const second = await (await browser.newContext({ reducedMotion: "no-preference", extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
  await signUpVerified(second, request, "site-look-co-host");
  await second.goto(link);
  await expect(second.getByRole("heading", { level: 1, name: "Ada’s disco" })).toBeVisible();
  await expect(second.getByRole("button", { name: "Accept" })).toBeVisible();
  await expectSiteLook(second, SITE_POSTERS.welcome);
  await expectNoDisco(second);

  await second.context().close();
  await owner.context.close();
});

test("sign-in reads on its poster", async ({ page }) => {
  // Bokeh, under light text.
  await page.goto("/sign-in");
  await expectSiteLook(page, SITE_POSTERS.welcome);
  await expect(page.locator(".site-page")).toHaveAttribute("data-tone", "light");
  await backdropPainted(page);
  const email = page.getByLabel("Email", { exact: true });
  const submit = page.getByRole("button", { name: "Sign in", exact: true });
  const forgot = page.locator('[data-slot="card-footer"]').getByRole("link", { name: "Forgot your password?" });
  // Typed, and left, so that its border is the field's own and not the focus ring's.
  await email.fill("ada@example.com");
  await email.blur();
  expect(await worstContrast(page.getByRole("heading", { level: 1, name: "Sign in" })), "the title").toBeGreaterThanOrEqual(4.5);
  // The field's own border, light under light text and no part of what is behind its words, is
  // left out of the picture.
  await email.evaluate((element) => ((element as HTMLElement).style.borderColor = "transparent"));
  expect(await worstContrast(email), "the typed email").toBeGreaterThanOrEqual(4.5);
  await email.evaluate((element) => (element as HTMLElement).style.removeProperty("border-color"));
  expect(await worstContrast(forgot), "the way to reset a password").toBeGreaterThanOrEqual(4.5);
  for (const control of [email, submit, forgot]) await expectRingStandsOut(page, control);

  // Hovered, a button keeps a fill its words are proven on: the accent, and strong glass for an
  // outline button. Its edge, which shows the hover, is left out of the picture (EDGELESS).
  for (const [button, what] of [
    [submit, "Sign in, hovered"],
    [page.getByRole("button", { name: "Send me the link" }), "Send me the link, hovered"],
  ] as const) {
    await button.hover();
    expect(await buttonWordsContrast(button), what).toBeGreaterThanOrEqual(4.5);
  }
});

test("a signed-out screen's notices and refusals read on its poster", async ({ page }) => {
  // The notice of a sign-in link that has expired, on glass of its own above the card.
  await page.goto("/sign-in?linkError=1");
  await expectSiteLook(page, SITE_POSTERS.welcome);
  await backdropPainted(page);
  expect(await worstContrast(page.getByText("That sign-in link has expired or was already used.")), "the notice").toBeGreaterThanOrEqual(4.5);

  // A refused sign-in, in the danger ink on the card.
  await page.getByLabel("Email", { exact: true }).fill(newHost("site-look-refused").email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const refusal = page.getByText("That email and password do not match.");
  await expect(refusal).toBeVisible({ timeout: 15_000 });
  await page.mouse.move(0, 0);
  expect(await worstContrast(refusal), "the refusal").toBeGreaterThanOrEqual(4.5);
});

// A host's own pages, each wearing `copy`. New event sends for its draft as soon as it is on
// screen and opens the editor: its post is held unanswered, so that the page itself is looked at.
async function expectOwnPagesWear(page: Page, copy: string) {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Your events" })).toBeVisible();
  await expectSiteLook(page, copy);
  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1, name: "Account settings" })).toBeVisible();
  await expectSiteLook(page, copy);
  await page.route("**/events/new", async (route) => {
    if (route.request().method() !== "POST") await route.continue();
  });
  await page.goto("/events/new");
  await expect(page.getByRole("heading", { level: 1, name: "New event" })).toBeVisible();
  // Its button fades to show it is busy, which is the page answering, not the page moving.
  await expect(page.getByText("Starting your invitation…")).toBeVisible();
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
  await expectSiteLook(page, copy);
}

test("a new host's dashboard, Account and New event wear the site's poster for hosts", async ({ page, request }) => {
  test.slow();
  await signUpVerified(page, request, "site-look-new-host");
  // The first invitation's tile shows the poster the page is on.
  await page.goto("/dashboard");
  const tile = page.getByRole("region", { name: "Make your first invitation" }).locator("img");
  await expect(tile).toHaveAttribute("src", new RegExp(`^/posters/${SITE_POSTERS.host.replace(/-copy$/, "")}\\.`));
  await expectOwnPagesWear(page, SITE_POSTERS.host);
});

test("a host's own pages wear their next event's poster", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "site-look-next", { title: "Ada’s disco", start: "2027-03-06T19:00" });
  await pickDesign(host.page, "Poster", "Poster", "Disco", "Gallery");
  await expectOwnPagesWear(host.page, DISCO);
  await host.context.close();
});

test("Site settings and reports wear the site's poster", async ({ page }) => {
  await signIn(page, OPERATOR.email, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  for (const [path, heading] of [
    ["/instance", "Site settings"],
    ["/instance/reports", "Reports"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expectSiteLook(page, SITE_POSTERS.site);
  }
});

test("the header is a bar of glass and the shelves are glass panels", async ({ browser, request }) => {
  test.slow();
  const { page, context } = await hostWithShelves(browser, request, "site-look-shelves");
  const expectGlass = async (element: Locator, what: string) => {
    const { filter, fill } = await element.evaluate((found) => ({ filter: getComputedStyle(found).backdropFilter, fill: getComputedStyle(found).backgroundColor }));
    expect(filter, `${what}'s blur`).toContain("blur");
    expect(fill, `${what}'s fill`).not.toBe("rgba(0, 0, 0, 0)");
  };
  await expectGlass(page.getByRole("banner"), "the header");
  for (const name of ["Next up", "Coming up", "Drafts", "Past"]) {
    await expectGlass(page.getByRole("region", { name, exact: true }).locator(":scope > div").first(), name);
  }
  // The chip on a poster keeps its own opaque colours, whatever the picture under it.
  await page.waitForLoadState("networkidle");
  const draft = page.getByRole("region", { name: "Drafts", exact: true }).getByText("Draft", { exact: true });
  expect(await worstContrast(draft), "the Draft chip").toBeGreaterThanOrEqual(4.5);
  await context.close();
});

// A guest's reply, on a device of their own, so that the guest list has a row.
async function replyGoing(browser: Browser, link: string, name: string) {
  const guest = await newGuest(browser);
  await guest.goto(link);
  await guest.getByRole("button", { name: "Going", exact: true }).click();
  await guest.getByLabel("Your name").fill(name);
  await guest.getByRole("button", { name: "Send RSVP" }).click();
  await expect(guest.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  await guest.context().close();
}

// Cake under dark text and Disco under light text, a test each, as each makes a host of its own.
for (const [poster, copy, tone] of [
  ["Cake", CAKE, "dark"],
  ["Disco", DISCO, "light"],
] as const) {
  test(`a host's pages read on a light poster and a dark one: ${poster}, under ${tone} text`, async ({ browser, request }) => {
    test.slow();
    const host = await createPublished(browser, request, `site-look-${tone}`, { title: `Ada’s ${poster.toLowerCase()} party`, start: "2027-03-06T19:00", plusOnes: "0" });
    await pickDesign(host.page, "Poster", "Poster", poster, "Gallery");
    const editor = host.page.url();
    await replyGoing(browser, host.link, "Priya Nair");
    const page = host.page;
    const read = async (text: Locator, what: string) => expect(await worstContrast(text), `${what}, on ${poster}`).toBeGreaterThanOrEqual(4.5);

    await page.goto("/dashboard");
    await expectSiteLook(page, copy);
    await expect(page.locator(".site-page")).toHaveAttribute("data-tone", tone);
    await backdropPainted(page);
    const nextUp = page.getByRole("region", { name: "Next up", exact: true });
    await read(page.getByRole("banner").getByRole("link", { name: "OpenInvites", exact: true }), "the site's name");
    await read(page.getByRole("heading", { level: 1, name: "Your events" }), "the title");
    await read(nextUp.getByRole("heading", { name: "Next up" }), "Next up");
    await read(nextUp.getByText("1 person expected"), "the headcount");

    await page.goto("/account");
    await expectSiteLook(page, copy);
    await backdropPainted(page);
    const displayName = page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { level: 2, name: "Display name" }) });
    await read(displayName.getByRole("heading", { level: 2, name: "Display name" }), "the card's title");
    await read(displayName.getByText("Guests see it as “Hosted by”."), "the card's description");
    expect(await typedContrast(page.getByLabel("Display name")), `the typed name, on ${poster}`).toBeGreaterThanOrEqual(4.5);
    // A destructive button's words, in the danger ink on strong glass, and an outline button's
    // hovered, its fill kept.
    expect(await buttonWordsContrast(page.getByRole("button", { name: "Delete account" })), `Delete account, on ${poster}`).toBeGreaterThanOrEqual(4.5);
    const signOut = page.getByRole("main").getByRole("button", { name: "Sign out" });
    await signOut.hover();
    expect(await buttonWordsContrast(signOut), `Sign out, hovered, on ${poster}`).toBeGreaterThanOrEqual(4.5);

    // An event's guest list: one frame, in one glass panel until the event's own Theme dresses it.
    await page.goto(`${editor}/guests`);
    await expect(page.getByRole("heading", { level: 1, name: "Guest list" })).toBeVisible();
    await expectSiteLook(page, copy);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    await backdropPainted(page);
    await read(page.getByRole("heading", { level: 1, name: "Guest list" }), "the guest list's title");
    await read(page.getByRole("region", { name: /^Going/ }).getByText("Priya Nair", { exact: true }), "a guest's row");
    await host.context.close();
  });
}
