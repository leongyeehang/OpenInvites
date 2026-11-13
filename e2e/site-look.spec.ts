import sharp from "sharp";
import { expectHoverEdgeStandsOut, expectMarkStandsOut, expectRingStandsOut, worstContrast } from "./contrast";
import { closeDesign, createDraft, createPublished, editSettings, openDesign, openMore, pickDesign, publishInEditor } from "./events";
import { hostWithShelves } from "./dashboard";
import { latestMailTo, mailCountTo, newHost, OPERATOR, PASSWORD, signIn, signUpVerified } from "./hosts";
import { tabTo } from "./focus";
import { backdropPainted, expectSiteLook, SITE_POSTERS } from "./site-look";
import { clientAddress, expect, expectNotFoundAsSent, test, type Browser, type Locator, type Page } from "./test";

// M8 ticket 18: every page that is not an event page sits on a still poster, in glass, and the
// notice pages come first. The pages drawn without the database (too fast, privacy, terms, not
// found) wear the fallback area's poster from the whole gallery; the notices a guest meets on an
// event's link wear the guest area's poster from the site's set, never the event's Theme, so they
// read the same whatever the host chose. The shared `app` keeps the whole gallery as its set.
// Ticket 19: the signed-out screens and the co-host link wear the welcome area's poster from the
// site's set, with the site's name above their cards. Ticket 20: every signed-in page sits in one
// frame, a glass header over a still poster: a host's own pages wear their next event's poster, or
// the host area's, and Site settings and reports the site area's. Ticket 21: the pages where a host
// manages one event wear that event's own Theme, held still, with the heading in its title face.
// Ticket 22: a poster a host picks in Account's Backdrop card dresses their own pages instead.
// Ticket 23: every area read in both text tones, a long list to its last row, forced colours, and
// what a former co-host is sent. Nothing on these pages moves, so motion is welcome here and still nothing runs. Each test runs at
// 390 pixels in the mobile project and at desktop width in the other.

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
  // The edge that shows a default button hovered, in its words' colour on the accent (ticket 19).
  await expectHoverEdgeStandsOut(page, submit);
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

    // The event's guest list, on the event's own poster: one frame, and a guest's row on glass.
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

// The five pages where a host manages one event, each by the heading it opens with (ticket 21).
const EVENT_PAGES = [
  ["guests", "Guest list"],
  ["invites", "Invites"],
  ["share", "Share this event"],
  ["hosts", "Hosts"],
  ["announcements", "Announcements"],
] as const;

test("an event's pages wear its poster, still, with its title font", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "site-look-event-pages", { title: "Ada’s disco", start: "2027-03-06T19:00" });
  // Disco's look brings sparkles, which the event page draws and these pages do not, and Syne.
  await pickDesign(host.page, "Poster", "Poster", "Disco", "Gallery");
  const editor = host.page.url();
  const page = host.page;
  for (const [path, heading] of EVENT_PAGES) {
    await page.goto(`${editor}/${path}`);
    const title = page.getByRole("heading", { level: 1, name: heading });
    await expect(title).toBeVisible();
    await expectSiteLook(page, DISCO);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    // Its picture, its scrim and its fade: no effect is drawn.
    await expect(page.locator('[data-slot="backdrop"] > *'), `${path}'s backdrop`).toHaveCount(3);
    expect(await title.evaluate((element) => getComputedStyle(element).fontFamily), `${path}'s title face`).toMatch(/Syne/);
  }
  await host.context.close();
});

test("the dashboard keeps the host's poster beside an event's own", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "site-look-two-events", { title: "Ada’s birthday", start: "2027-03-06T19:00" });
  await pickDesign(host.page, "Poster", "Poster", "Cake", "Gallery");
  await createDraft(host.page, { title: "Ada’s disco", start: "2027-05-08T21:00" });
  await publishInEditor(host.page);
  await pickDesign(host.page, "Poster", "Poster", "Disco", "Gallery");
  const later = host.page.url();

  await host.page.goto(`${later}/guests`);
  await expect(host.page.getByRole("heading", { level: 1, name: "Guest list" })).toBeVisible();
  await expectSiteLook(host.page, DISCO);
  await host.page.goto("/dashboard");
  await expect(host.page.getByRole("heading", { level: 1, name: "Your events" })).toBeVisible();
  await expectSiteLook(host.page, CAKE);
  await host.context.close();
});

test("a colour poster's blobs stand still", async ({ browser, request }) => {
  const host = await createPublished(browser, request, "site-look-colour", { title: "Ada’s dusk", start: "2027-03-06T19:00" });
  await pickDesign(host.page, "Poster", "Colours", "Dusk", "Colour");
  const page = host.page;
  await page.goto(`${page.url()}/share`);
  await expect(page.getByRole("heading", { level: 1, name: "Share this event" })).toBeVisible();
  await expect(page.locator(".site-page")).toHaveCount(1);
  await expect(page.locator('[data-slot="backdrop"] [style*="linear-gradient"]')).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => document.getAnimations().map((animation) => animation.constructor.name)), { message: "what moves" })
    .toEqual([]);
  await host.context.close();
});

// A picture of black and white bands, 60 pixels tall: the backdrop's blurred copy of it is as busy
// as a host's picture gets.
async function bands() {
  const [width, height] = [1200, 1500];
  const pixels = Buffer.alloc(width * height * 3);
  for (let row = 0; row < height; row++) pixels.fill(Math.floor(row / 60) % 2 === 0 ? 0 : 255, row * width * 3, (row + 1) * width * 3);
  return { name: "bands.jpg", mimeType: "image/jpeg", buffer: await sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg().toBuffer() };
}

test("a guest list reads on a busy picture in both tones", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "site-look-bands", { title: "Ada’s stripes", start: "2027-03-06T19:00", plusOnes: "0" });
  const page = host.page;
  const editor = page.url();
  const upload = await openDesign(page, "Poster", "Upload");
  await upload.getByLabel("Upload your photo or poster").setInputFiles(await bands());
  await expect(upload.getByLabel("Describe your picture")).toBeVisible({ timeout: 20_000 });
  await closeDesign(page, "Poster");
  await replyGoing(browser, host.link, "Priya Nair");

  // The text tone is the page's darkness in the Theme sheet: light text on the Dark page.
  for (const tone of ["light", "dark"] as const) {
    await page.goto(editor);
    await pickDesign(page, "Theme", "Page", tone === "light" ? "Dark" : "Light");
    await page.goto(`${editor}/guests`);
    const title = page.getByRole("heading", { level: 1, name: "Guest list" });
    await expect(title).toBeVisible();
    await expect(page.locator('[data-slot="backdrop"] [style*="/uploads/"]')).toHaveCount(1);
    await expect(page.locator(".site-page")).toHaveAttribute("data-tone", tone);
    await backdropPainted(page);
    const going = page.getByRole("region", { name: /^Going/ });
    const read = async (text: Locator, what: string) => expect(await worstContrast(text), `${what}, under ${tone} text`).toBeGreaterThanOrEqual(4.5);
    await read(title, "the title");
    await read(going.getByText("Priya Nair", { exact: true }), "the guest's name");
    await read(going.getByText(/^Replied /), "the reply's time");
    await expectRingStandsOut(page, page.getByRole("link", { name: "Back to the event" }));
    await expectRingStandsOut(page, going.getByRole("button").first());
  }
  await host.context.close();
});

test("an event deleted while its guests page is open", async ({ browser, request }) => {
  const host = await createPublished(browser, request, "site-look-deleted", { title: "Ada’s birthday", start: "2027-03-06T19:00" });
  const editor = host.page.url();
  const guests = await host.context.newPage();
  await guests.goto(`${editor}/guests`);
  await expect(guests.getByRole("heading", { level: 1, name: "Guest list" })).toBeVisible();

  // In the editor's tab, the event is deleted.
  await openMore(host.page);
  await host.page.getByRole("button", { name: "Delete event" }).click();
  await host.page.getByRole("button", { name: "Delete it" }).click();
  await expect(host.page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  // The open page goes on to Invites as a link does, within the frame it is drawn in.
  await guests.evaluate((to) => (window as unknown as { next: { router: { push: (href: string) => void } } }).next.router.push(to), `${new URL(editor).pathname}/invites`);
  await expect(guests.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible({ timeout: 15_000 });
  await expect(guests.locator('[data-slot="backdrop"]')).toHaveCount(1);
  await expect(guests.getByRole("contentinfo")).toHaveCount(1);
  await host.context.close();
});

test("a poster changed in the editor shows on the guests page at once", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "site-look-repostered", { title: "Ada’s disco", start: "2027-03-06T19:00" });
  const page = host.page;
  await pickDesign(page, "Poster", "Poster", "Disco", "Gallery");
  const editor = page.url();
  await page.goto(`${editor}/guests`);
  await expectSiteLook(page, DISCO);

  // Back in the editor, another poster, and on to Guests by the editor's own link, with no reload.
  await page.goto(editor);
  await pickDesign(page, "Poster", "Poster", "Cake", "Gallery");
  await (await openMore(page)).getByRole("link", { name: "Guest list", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Guest list" })).toBeVisible();
  await expectSiteLook(page, CAKE);
  await host.context.close();
});

// Ticket 22: a host picks, in Account's Backdrop card, the poster behind their own pages: the
// dashboard, Account and New event. An event's own pages keep that event's poster, and Automatic
// is their next event's poster, else the site's for hosts.
const AURORA = "aurora-copy";

function backdropCard(page: Page) {
  return page.locator("#backdrop");
}

// The Backdrop card's form sent, and its answer arrived.
async function sendBackdrop(page: Page) {
  const answered = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/account");
  await backdropCard(page).getByRole("button", { name: "Save", exact: true }).click();
  await answered;
}

// Chooses Automatic or a poster by the words on it, and saves.
async function saveBackdrop(page: Page, choice: string) {
  const card = backdropCard(page);
  await card.getByText(choice, { exact: true }).click();
  await expect(card.getByRole("radio", { name: choice, exact: true })).toBeChecked();
  await sendBackdrop(page);
  await expect(card.getByText("Backdrop saved.")).toBeVisible({ timeout: 15_000 });
}

test("a host's pick dresses their own pages and not an event's", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "site-look-pick", { title: "Ada’s disco", start: "2027-03-06T19:00" });
  await pickDesign(host.page, "Poster", "Poster", "Disco", "Gallery");
  const editor = host.page.url();
  const page = host.page;

  await page.goto("/account");
  await expectSiteLook(page, DISCO);
  await expect(backdropCard(page).getByRole("radio", { name: "Automatic", exact: true })).toBeChecked();
  await saveBackdrop(page, "Aurora");
  // The frame round the page wears it in the same response.
  await expectSiteLook(page, AURORA);
  await expectOwnPagesWear(page, AURORA);

  // The event's own pages keep the event's poster.
  await page.goto(`${editor}/guests`);
  await expect(page.getByRole("heading", { level: 1, name: "Guest list" })).toBeVisible();
  await expectSiteLook(page, DISCO);

  await page.goto("/account");
  await expect(backdropCard(page).getByRole("radio", { name: "Aurora", exact: true })).toBeChecked();

  // A value that is no gallery poster is refused and nothing is stored: the form says which poster
  // and nothing else, so a tampered one is all a host could send. It is tampered with once chosen,
  // as drawing the choice puts the poster's own value back.
  await backdropCard(page).getByText("Cake", { exact: true }).click();
  await backdropCard(page)
    .getByRole("radio", { name: "Cake", exact: true })
    .evaluate((input) => ((input as HTMLInputElement).value = "disco-ball"));
  await sendBackdrop(page);
  await expect(backdropCard(page).getByText("Choose Automatic or one of the gallery’s posters.")).toBeVisible({ timeout: 15_000 });
  await page.goto("/account");
  await expect(backdropCard(page).getByRole("radio", { name: "Aurora", exact: true })).toBeChecked();
  await expectSiteLook(page, AURORA);

  // Another host's pages are their own: no events and no pick, the site's poster for hosts.
  const other = await (await browser.newContext({ reducedMotion: "no-preference", extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
  await signUpVerified(other, request, "site-look-pick-other");
  await other.goto("/dashboard");
  await expect(other.getByRole("heading", { level: 1, name: "Your events" })).toBeVisible();
  await expectSiteLook(other, SITE_POSTERS.host);
  await other.goto("/account");
  await expect(backdropCard(other).getByRole("radio", { name: "Automatic", exact: true })).toBeChecked();
  await other.context().close();
  await host.context.close();
});

test("Automatic brings back the next event's poster", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "site-look-automatic", { title: "Ada’s disco", start: "2027-03-06T19:00" });
  await pickDesign(host.page, "Poster", "Poster", "Disco", "Gallery");
  const page = host.page;
  await page.goto("/account");
  await saveBackdrop(page, "Aurora");
  await expectSiteLook(page, AURORA);

  await saveBackdrop(page, "Automatic");
  await expectSiteLook(page, DISCO);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Your events" })).toBeVisible();
  await expectSiteLook(page, DISCO);
  await host.context.close();
});

// The card's words on the glass under light text (Disco) and dark text (Cake), its rings, and a
// walk through it by keyboard: a test each, as each makes a host of its own.
for (const [poster, copy, tone] of [
  ["Disco", DISCO, "light"],
  ["Cake", CAKE, "dark"],
] as const) {
  test(`the Backdrop card by keyboard, and its words: ${poster}, under ${tone} text`, async ({ browser, request }) => {
    test.slow();
    const host = await createPublished(browser, request, `site-look-backdrop-${tone}`, { title: `Ada’s ${poster.toLowerCase()} party`, start: "2027-03-06T19:00" });
    await pickDesign(host.page, "Poster", "Poster", poster, "Gallery");
    const page = host.page;
    await page.goto("/account");
    await expectSiteLook(page, copy);
    await expect(page.locator(".site-page")).toHaveAttribute("data-tone", tone);
    const card = backdropCard(page);
    const automatic = card.getByRole("radio", { name: "Automatic", exact: true });
    const aurora = card.getByRole("radio", { name: "Aurora", exact: true });
    const save = card.getByRole("button", { name: "Save", exact: true });

    await backdropPainted(page);
    const read = async (text: Locator, what: string) => expect(await worstContrast(text), `${what}, on ${poster}`).toBeGreaterThanOrEqual(4.5);
    await read(card.getByText("Automatic", { exact: true }), "Automatic");
    await read(card.getByText("Your next event’s poster, or one of this site’s."), "Automatic's hint");
    await read(card.getByText("Aurora", { exact: true }), "a poster's name");
    for (const control of [automatic, aurora, save]) await expectRingStandsOut(page, control);

    // The chosen one is ringed and ticked, not told by its colour alone.
    await card.getByText("Aurora", { exact: true }).click();
    const tick = (name: string) => card.locator("label").filter({ has: page.getByRole("radio", { name, exact: true }) }).locator("svg");
    await expect(tick("Aurora")).toBeVisible();
    await expect(tick("Rings")).toBeHidden();
    await read(card.getByText("Aurora", { exact: true }), "the chosen poster's name");
    // The tick, a graphic, on its disc of the accent (WCAG 1.4.11: 3:1), and the ring round the
    // chosen poster against the card, with no focus anywhere.
    await page.mouse.move(0, 0);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    expect(await worstContrast(tick("Aurora")), `the chosen poster's tick, on ${poster}`).toBeGreaterThanOrEqual(3);
    const blurred = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expectMarkStandsOut(page, card.locator("label").filter({ has: page.getByRole("radio", { name: "Aurora", exact: true }) }), `the ring round the chosen poster, on ${poster}`, {
      on: async () => {
        await card.getByText("Aurora", { exact: true }).click();
        await blurred();
      },
      off: async () => {
        await card.getByText("Automatic", { exact: true }).click();
        await blurred();
      },
    });

    // By keyboard, from the top of the page: Tab reaches Automatic, the arrow keys move along the
    // posters to Aurora, Tab reaches Save and Enter saves. Opened afresh, not reloaded, so that the
    // browser does not put back the choice left unsaved.
    await page.goto("/account");
    await expect(automatic).toBeChecked();
    await tabTo(page, automatic);
    for (let presses = 0; presses < 20 && !(await aurora.evaluate((input) => input === document.activeElement)); presses++) await page.keyboard.press("ArrowRight");
    await expect(aurora).toBeFocused();
    await expect(aurora).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(save).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(card.getByText("Backdrop saved.")).toBeVisible({ timeout: 15_000 });
    await expectSiteLook(page, AURORA);
    await host.context.close();
  });
}

// Ticket 21's review: the invite-only notice on an event's Invites page, its title in the attention
// ink on strong glass, reads on an event whose Theme takes light text.
test("the invite-only notice reads under light text", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "site-look-invite-only", { title: "Ada’s disco", start: "2027-03-06T19:00" });
  await pickDesign(host.page, "Poster", "Poster", "Disco", "Gallery");
  const editor = host.page.url();
  await editSettings(host.page, (sheet) => sheet.getByRole("group", { name: "Guests", exact: true }).getByLabel(INVITE_ONLY, { exact: true }).check());
  const page = host.page;
  await page.goto(`${editor}/invites`);
  await expectSiteLook(page, DISCO);
  await expect(page.locator(".site-page")).toHaveAttribute("data-tone", "light");
  await backdropPainted(page);
  const notice = page.getByText("Invite-only is on: only these people can open the invitation.");
  expect(await worstContrast(notice), "the invite-only notice").toBeGreaterThanOrEqual(4.5);
  await host.context.close();
});

// M8 ticket 23: a guest list as long as a party's, read to its last row, on the busiest picture a
// host can give (the bands above). Thirty guests reply, each from an address of their own (the
// shared `app` takes five replies a minute from one), a few at a time.
test("a long guest list reads to its last row on a busy picture", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const host = await createPublished(browser, request, "site-look-long-list", { title: "Ada’s long table", start: "2027-03-06T19:00", plusOnes: "0" });
  const page = host.page;
  const editor = page.url();
  const upload = await openDesign(page, "Poster", "Upload");
  await upload.getByLabel("Upload your photo or poster").setInputFiles(await bands());
  await expect(upload.getByLabel("Describe your picture")).toBeVisible({ timeout: 20_000 });
  await closeDesign(page, "Poster");
  const names = Array.from({ length: 30 }, (_, at) => `Guest ${String(at + 1).padStart(2, "0")}`);
  for (let at = 0; at < names.length; at += 5) await Promise.all(names.slice(at, at + 5).map((name) => replyGoing(browser, host.link, name)));

  await page.goto(`${editor}/guests`);
  const going = page.getByRole("region", { name: /^Going/ });
  await expect(going.getByRole("listitem")).toHaveCount(30);
  await expect(page.locator('[data-slot="backdrop"] [style*="/uploads/"]')).toHaveCount(1);
  await backdropPainted(page);
  const tone = await page.locator(".site-page").getAttribute("data-tone");
  const read = async (text: Locator, what: string) => expect(await worstContrast(text), `${what}, under ${tone} text`).toBeGreaterThanOrEqual(4.5);
  // The site's name in the header at the top, then the last row, scrolled to.
  await read(page.getByRole("banner").getByRole("link", { name: "OpenInvites", exact: true }), "the site's name");
  const last = going.getByRole("listitem").last();
  await last.scrollIntoViewIfNeeded();
  await read(last.getByText(/^Guest \d\d$/), "the last guest's name");
  await read(last.getByText(/^Replied /), "the last guest's reply time");
  await host.context.close();
});

// M8 ticket 23: each area of the site in its tone, the title, a muted line and the ring round its
// first control: the signed-out screens (Bokeh, light text), the pages drawn without the database
// (Cake, dark text), Site settings (Rose, light text) and a host's Account with the Backdrop set to
// Cake, then Disco. Privacy holds no control in its main, so the footer's first link is read there.
test("every area reads in both text tones", async ({ page, browser, request }) => {
  test.slow();
  const reads = async (where: Page, copy: string, tone: "light" | "dark", title: Locator, muted: Locator, control: Locator) => {
    await expectSiteLook(where, copy);
    await expect(where.locator(".site-page")).toHaveAttribute("data-tone", tone);
    await backdropPainted(where);
    expect(await worstContrast(title), `the title, on ${copy}`).toBeGreaterThanOrEqual(4.5);
    expect(await worstContrast(muted), `a muted line, on ${copy}`).toBeGreaterThanOrEqual(4.5);
    await expectRingStandsOut(where, control);
  };
  const privacyLink = (where: Page) => where.getByRole("contentinfo").getByRole("link", { name: "Privacy policy" });

  await page.goto("/sign-in");
  await reads(page, SITE_POSTERS.welcome, "light", page.getByRole("heading", { level: 1, name: "Sign in" }), privacyLink(page), page.getByLabel("Email", { exact: true }));
  await page.goto("/privacy");
  await reads(page, SITE_POSTERS.fallback, "dark", page.getByRole("heading", { level: 1, name: "Privacy policy" }), privacyLink(page), privacyLink(page));

  const operator = await (await browser.newContext({ reducedMotion: "no-preference" })).newPage();
  await signIn(operator, OPERATOR.email, PASSWORD);
  await expect(operator).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await operator.goto("/instance");
  await reads(
    operator,
    SITE_POSTERS.site,
    "light",
    operator.getByRole("heading", { level: 1, name: "Site settings" }),
    operator.getByText("What visitors see at this site’s address."),
    operator.getByLabel("Name", { exact: true }),
  );
  await operator.context().close();

  const host = await (await browser.newContext({ reducedMotion: "no-preference", extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
  await signUpVerified(host, request, "site-look-areas");
  for (const [poster, copy, tone] of [
    ["Cake", CAKE, "dark"],
    ["Disco", DISCO, "light"],
  ] as const) {
    await host.goto("/account");
    await saveBackdrop(host, poster);
    await host.goto("/account");
    const displayName = host.locator('[data-slot="card"]').filter({ has: host.getByRole("heading", { level: 2, name: "Display name" }) });
    await reads(host, copy, tone, host.getByRole("heading", { level: 1, name: "Account settings" }), displayName.getByText("Guests see it as “Hosted by”."), host.getByLabel("Display name"));
  }
  await host.context().close();
});

// M8 ticket 23 (review focus): under forced colours, as Windows' contrast themes draw a page, the
// glass and the poster give way to the system's colours, and every heading, label and button still
// has a colour of its own against what is behind it, and a focused field its outline.
test("forced colours keep every word apart from what is behind it", async ({ page, request }) => {
  await page.emulateMedia({ forcedColors: "active" });
  const apart = (where: Page) =>
    where.evaluate(() =>
      [...document.querySelectorAll("main :is(h1, h2, h3, label, button)")]
        .filter((element) => (element as HTMLElement).offsetParent !== null && element.textContent!.trim() !== "")
        .flatMap((element) => {
          let behind = "rgba(0, 0, 0, 0)";
          for (let at: Element | null = element; at && /rgba\(.*, 0\)$|transparent/.test(behind); at = at.parentElement) behind = getComputedStyle(at).backgroundColor;
          const colour = getComputedStyle(element).color;
          return colour === behind ? [`${element.tagName.toLowerCase()} “${element.textContent!.trim().slice(0, 40)}”: ${colour} on ${behind}`] : [];
        }),
    );
  const outline = (where: Page) => where.evaluate(() => parseFloat(getComputedStyle(document.activeElement!).outlineWidth));

  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  expect(await apart(page), "words that would vanish on sign-in").toEqual([]);
  await page.keyboard.press("Shift");
  await page.getByLabel("Email", { exact: true }).focus();
  expect(await outline(page), "the focused email field's outline").toBeGreaterThanOrEqual(2);

  await signUpVerified(page, request, "site-look-forced");
  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1, name: "Account settings" })).toBeVisible();
  expect(await apart(page), "words that would vanish on Account").toEqual([]);
  await page.keyboard.press("Shift");
  await page.getByLabel("Display name").focus();
  expect(await outline(page), "the focused display name's outline").toBeGreaterThanOrEqual(2);
});

// M8 ticket 23: a co-host who is removed is sent the not-found page for the event's pages, and it
// carries nothing of the event's look: not its poster's copy, nor its title face's file. While they
// were a co-host the same request carried both, so their absence is the removal's doing.
test("a former co-host learns nothing of an event's look", async ({ browser, request }) => {
  test.slow();
  const owner = await createPublished(browser, request, "site-look-former-owner", { title: "Ada’s disco", start: "2027-03-06T19:00" });
  // Disco wears Syne, the display face.
  await pickDesign(owner.page, "Poster", "Poster", "Disco", "Gallery");
  const editor = owner.page.url();
  const link = await makeCoHostLink(owner.page);
  const coHost = await (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
  await signUpVerified(coHost, request, "site-look-former-co-host");
  await coHost.goto(link);
  await coHost.getByRole("button", { name: "Accept" }).click();
  await expect(coHost).toHaveURL(editor, { timeout: 15_000 });
  const guests = `${editor}/guests`;
  const before = await (await coHost.request.get(guests)).text();
  expect(before, "the poster's copy, to a co-host").toContain(DISCO);
  expect(before, "the title face's file, to a co-host").toContain("/fonts/syne-800.");

  await owner.page.goto(`${editor}/hosts`);
  const row = owner.page.getByRole("listitem").filter({ has: owner.page.getByText("Co-host", { exact: true }) });
  await row.getByRole("button", { name: "Remove" }).click();
  await owner.page.getByRole("alertdialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(row).toHaveCount(0, { timeout: 15_000 });

  const response = await coHost.request.get(guests);
  await expectNotFoundAsSent(response);
  const after = await response.text();
  expect(after, "the poster's copy, to a former co-host").not.toContain("disco-ball");
  expect(after, "the title face's file, to a former co-host").not.toContain("syne-800");
  await coHost.context().close();
  await owner.context.close();
});
