import sharp from "sharp";
import { expectNoSeriousViolations } from "./axe";
import { createDraft, createPublished, type DraftFields } from "./events";
import { OPERATOR, PASSWORD, signIn, signUpVerified } from "./hosts";
import { expect, test, type APIRequestContext, type Locator, type Page } from "./test";

// Ticket 20: axe-core finds nothing serious or critical on any page a person meets, at 390px and
// at desktop width (the two projects), and on the event page in both text tones. Each check is
// e2e/axe.ts's, the same everywhere.

const EVENT = {
  title: "Ada’s birthday",
  start: "2027-03-06T19:00",
  location: "Ah Ma’s house",
  description: "Bring nothing but yourself.",
  plusOnes: "2",
  questions: [
    { prompt: "Any allergies?", required: true },
    { prompt: "Staying for dinner?", type: "yesNo" },
  ],
} satisfies DraftFields;

const ALT = "A garden at dusk, strung with paper lanterns";

async function openDrawer(page: Page) {
  await page.getByRole("button", { name: "Design" }).click();
  const drawer = page.getByRole("dialog", { name: "Design" });
  await expect(drawer).toBeVisible();
  return drawer;
}

// What a guest's browser is sent for the page, which is the saved theme.
async function guestHtml(request: APIRequestContext, link: string) {
  return (await request.get(link)).text();
}

// The host sets the text tone in the drawer, on the event page, and it is saved before a guest
// looks: the page a guest is sent says so.
async function chooseTone(drawer: Locator, request: APIRequestContext, link: string, tone: "Light" | "Dark") {
  const details = drawer.getByRole("button", { name: "Details" });
  if ((await details.getAttribute("aria-expanded")) === "false") await details.click();
  await drawer.getByRole("group", { name: "Text tone" }).getByRole("radio", { name: tone }).check();
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain(`data-tone="${tone.toLowerCase()}"`);
}

// A garden at dusk, light enough that the text tone turns dark by itself.
async function photo() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600">
    <rect width="100%" height="100%" fill="#f3ead8"/>
    <circle cx="300" cy="400" r="160" fill="#f8c9a0"/><circle cx="900" cy="1100" r="220" fill="#e4ecd6"/>
  </svg>`;
  return { name: "garden.jpg", mimeType: "image/jpeg", buffer: await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer() };
}

test("the pages anyone can open: home, signing up and in, the legal pages, too fast, and not found", async ({ page }) => {
  test.slow();
  for (const [path, heading] of [
    ["/", "OpenInvites"],
    ["/sign-up", "Create your host account"],
    ["/sign-in", "Sign in"],
    ["/forgot-password", "Reset your password"],
    ["/privacy", "Privacy policy"],
    ["/terms", "Terms of use"],
    ["/too-fast", "You’re going too fast"],
    ["/e/abcdefghij", "Page not found"],
    ["/no-such-page", "Page not found"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expectNoSeriousViolations(page, path);
  }
});

test("a host's own pages: the dashboard, the event form, the share screen and the guest list", async ({ page, browser, request }) => {
  test.slow();
  await signUpVerified(page, request, "a11y-host");
  await page.goto("/dashboard");
  await expectNoSeriousViolations(page, "the dashboard, empty");

  await page.goto("/events/new");
  await page.getByRole("button", { name: "Add a question" }).click();
  await expectNoSeriousViolations(page, "the event form, creating");
  const link = await createDraft(page, EVENT);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();
  const manage = page.url();
  await expectNoSeriousViolations(page, "the event form, editing");

  await page.goto("/dashboard");
  await expectNoSeriousViolations(page, "the dashboard, with an event");

  await page.goto(`${manage}/share`);
  await expect(page.getByRole("heading", { level: 1, name: "Share this event" })).toBeVisible();
  await expectNoSeriousViolations(page, "the share screen");

  // One guest answers, so the list has someone on it.
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(link);
  await guestPage.getByRole("button", { name: "Going" }).click();
  const sheet = guestPage.getByRole("dialog", { name: "Your RSVP" });
  await sheet.getByLabel("Your name").fill("Priya Nair");
  await sheet.getByRole("button", { name: "Continue" }).click();
  await sheet.getByRole("button", { name: "Continue" }).click();
  await sheet.getByLabel(/Any allergies/).fill("None");
  await sheet.getByRole("button", { name: "Send RSVP" }).click();
  await expect(sheet.getByText("You’re going!")).toBeVisible();
  await guest.close();

  await page.goto(`${manage}/guests`);
  await expect(page.getByText("Priya Nair")).toBeVisible();
  await expectNoSeriousViolations(page, "the guest list");
  await page.getByRole("button", { name: "Edit" }).click();
  await expectNoSeriousViolations(page, "the guest list, editing a guest");
});

test("the instance settings page", async ({ page }) => {
  test.slow();
  await signIn(page, OPERATOR.email, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await page.goto("/instance");
  await expect(page.getByRole("heading", { level: 1, name: "Instance settings" })).toBeVisible();
  await expectNoSeriousViolations(page, "the instance settings page");
});

test("the Design drawer, open with Details expanded, in both text tones", async ({ browser, request }) => {
  test.slow();
  // A bottom sheet in the mobile project, a side panel in the desktop one.
  const host = await createPublished(browser, request, "a11y-drawer", EVENT);
  await host.page.goto(host.link);
  const drawer = await openDrawer(host.page);
  await drawer.getByRole("button", { name: "Details" }).click();
  await expectNoSeriousViolations(host.page, "the Design drawer, light tone");
  await chooseTone(drawer, request, host.link, "Dark");
  await expectNoSeriousViolations(host.page, "the Design drawer, dark tone");
  await host.context.close();
});

test("the event page with the host's picture as the background and as the poster, in both text tones, described", async ({ page, browser, request }) => {
  test.setTimeout(180_000);
  const host = await createPublished(browser, request, "a11y-picture", EVENT);
  await host.page.goto(host.link);
  const drawer = await openDrawer(host.page);
  await drawer.getByLabel("Upload your photo or poster").setInputFiles(await photo());
  await expect(drawer.getByLabel("Describe your picture")).toBeVisible({ timeout: 20_000 });
  await drawer.getByLabel("Describe your picture").fill(ALT);
  await drawer.getByLabel("Describe your picture").press("Enter");
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain(ALT);
  await expectNoSeriousViolations(host.page, "the Design drawer, with the host's picture");

  // As the background, light enough for dark text, described once for a screen reader.
  await page.goto(host.link);
  await expect(page.locator("[data-tone]")).toHaveAttribute("data-tone", "dark");
  await expect(page.getByRole("img", { name: ALT })).toHaveCount(1);
  await expectNoSeriousViolations(page, "the event page, the host's picture as the background, dark tone");

  await chooseTone(drawer, request, host.link, "Light");
  await page.reload();
  await expectNoSeriousViolations(page, "the event page, the host's picture as the background, light tone");

  // As the poster, the picture itself carries the description.
  await drawer.getByRole("group", { name: "Use it as" }).getByRole("radio", { name: "Poster" }).check();
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain("poster.webp");
  await page.reload();
  const poster = page.locator('[data-slot="poster-card"] img');
  await expect(poster).toHaveAccessibleName(ALT);
  await expect(page.getByRole("img", { name: ALT })).toHaveCount(1);
  await expectNoSeriousViolations(page, "the event page, poster mode, light tone");

  await chooseTone(drawer, request, host.link, "Dark");
  await page.reload();
  await expectNoSeriousViolations(page, "the event page, poster mode, dark tone");

  await drawer.getByRole("group", { name: "Title placement" }).getByRole("radio", { name: "On the poster" }).check();
  await expect.poll(() => guestHtml(request, host.link), { timeout: 15_000 }).toContain("--theme-title-scrim");
  await page.reload();
  await expectNoSeriousViolations(page, "the event page, poster mode, the title on the poster, dark tone");

  await host.context.close();
});

test("a draft, as a guest and as its host, and a cancelled event, in both text tones", async ({ page, browser, request }) => {
  test.slow();
  const context = await browser.newContext();
  const hostPage = await context.newPage();
  await signUpVerified(hostPage, request, "a11y-states");
  const link = await createDraft(hostPage, EVENT);
  const manage = hostPage.url();

  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1, name: "This invitation isn’t ready yet" })).toBeVisible();
  await expectNoSeriousViolations(page, "a draft, as a guest sees it");
  // Only its host sees the draft's page, so its tone is set and read there.
  await hostPage.goto(link);
  await expectNoSeriousViolations(hostPage, "a draft, as its host sees it, light tone");
  const drawer = await openDrawer(hostPage);
  await drawer.getByRole("button", { name: "Details" }).click();
  await drawer.getByRole("group", { name: "Text tone" }).getByRole("radio", { name: "Dark" }).check();
  await expect(drawer.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });
  await hostPage.reload();
  await expect(hostPage.locator("[data-tone]")).toHaveAttribute("data-tone", "dark");
  await expectNoSeriousViolations(hostPage, "a draft, as its host sees it, dark tone");

  await hostPage.goto(manage);
  await hostPage.getByRole("button", { name: "Publish" }).click();
  await expect(hostPage.getByText("Published", { exact: true })).toBeVisible({ timeout: 15_000 });
  await hostPage.getByRole("button", { name: "Cancel event" }).click();
  await hostPage.getByRole("button", { name: "Cancel the event" }).click();
  await expect(hostPage.getByText("Cancelled", { exact: true })).toBeVisible();
  await page.goto(link);
  await expect(page.getByText("This event is cancelled")).toBeVisible();
  await expectNoSeriousViolations(page, "a cancelled event, dark tone");
  await hostPage.goto(link);
  await chooseTone(await openDrawer(hostPage), request, link, "Light");
  await page.reload();
  await expectNoSeriousViolations(page, "a cancelled event, light tone");

  await context.close();
});

// Every step of the RSVP flow, as a guest sees it, and the confirmation. `flow` is where the steps
// appear: the page itself inline, the sheet in the Sheet style.
async function everyStep(page: Page, flow: Locator | Page, where: string) {
  await expectNoSeriousViolations(page, `${where}: the RSVP buttons`);
  await page.getByRole("button", { name: "Going" }).click();
  await expect(flow.getByLabel("Your name")).toBeVisible();
  await expectNoSeriousViolations(page, `${where}: the name step`);
  await flow.getByLabel("Your name").fill("Priya Nair");
  await flow.getByRole("button", { name: "Continue" }).click();
  await flow.getByRole("radio", { name: "+1" }).click();
  await flow.getByLabel("Guest 1").fill("Arjun");
  await expectNoSeriousViolations(page, `${where}: the plus-ones step`);
  await flow.getByRole("button", { name: "Continue" }).click();
  await expect(flow.getByLabel(/Any allergies/)).toBeVisible();
  await expectNoSeriousViolations(page, `${where}: the questions step`);
  await flow.getByLabel(/Any allergies/).fill("None");
  await flow.getByRole("button", { name: "Send RSVP" }).click();
  await expect(flow.getByText("You’re going!")).toBeVisible();
  await expectNoSeriousViolations(page, `${where}: the confirmation`);
}

for (const style of ["Inline", "Sheet"] as const) {
  test(`the RSVP flow in the ${style} style, every step and the confirmation, in both text tones`, async ({ browser, request }) => {
    // Ten pages to read, each a view at a time.
    test.setTimeout(180_000);
    const host = await createPublished(browser, request, `a11y-${style.toLowerCase()}`, { ...EVENT, rsvpStyle: style });
    await host.page.goto(host.link);
    const drawer = await openDrawer(host.page);
    for (const tone of ["Light", "Dark"] as const) {
      await chooseTone(drawer, request, host.link, tone);
      // A guest of their own for each tone, who has not answered yet.
      const guest = await browser.newContext();
      const page = await guest.newPage();
      await page.goto(host.link);
      const flow = style === "Sheet" ? page.getByRole("dialog", { name: "Your RSVP" }) : page;
      await everyStep(page, flow, `the ${style} RSVP flow, ${tone.toLowerCase()} tone`);
      await guest.close();
    }
    await host.context.close();
  });
}

// The Broadsheet layout (ticket 12): the event page, every state of its ballot and the receipt, with
// the guest list and the comments open, in both text tones; then a cancelled event.
test("the Broadsheet layout: the event page, its ballot and the receipt, in both text tones, and cancelled", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const host = await createPublished(browser, request, "a11y-broadsheet", { ...EVENT, layout: "Broadsheet" });
  const manage = host.page.url();
  await host.page.goto(host.link);
  const drawer = await openDrawer(host.page);
  for (const tone of ["Light", "Dark"] as const) {
    await chooseTone(drawer, request, host.link, tone);
    // A guest of their own for each tone, who has not answered yet.
    const guest = await browser.newContext();
    const page = await guest.newPage();
    await page.goto(host.link);
    const where = `the Broadsheet, ${tone.toLowerCase()} tone`;
    await expectNoSeriousViolations(page, `${where}: the page and the ballot`);
    await page.getByRole("radio", { name: "I’ll be there" }).check();
    await page.getByLabel("Your name").fill("Priya Nair");
    await page.getByRole("button", { name: "One guest more" }).click();
    await page.getByLabel("Guest 1").fill("Arjun");
    await page.getByRole("radio", { name: "Yes" }).check();
    // The required question is left, so the ballot says so.
    await page.getByRole("button", { name: "Post my reply" }).click();
    await expect(page.getByText("The host would like an answer to this one.")).toBeVisible();
    await expectNoSeriousViolations(page, `${where}: the ballot filled in, with a refusal`);
    await page.getByLabel(/Any allergies/).fill("None");
    await page.getByRole("button", { name: "Post my reply" }).click();
    await expect(page.getByText("You’re going!")).toBeVisible();
    await expect(page.getByLabel("Add a comment")).toBeVisible();
    await expectNoSeriousViolations(page, `${where}: the receipt, the guest list and the comments`);
    await guest.close();
  }

  await host.page.goto(manage);
  await host.page.getByRole("button", { name: "Cancel event" }).click();
  await host.page.getByRole("button", { name: "Cancel the event" }).click();
  await expect(host.page.getByText("Cancelled", { exact: true })).toBeVisible({ timeout: 15_000 });
  const visitor = await browser.newContext();
  const page = await visitor.newPage();
  await page.goto(host.link);
  await expect(page.getByText("This event is cancelled")).toBeVisible();
  await expectNoSeriousViolations(page, "the Broadsheet, a cancelled event, dark tone");
  await visitor.close();
  await host.context.close();
});

// The Thread layout (ticket 13): the event page and every kind of turn of its conversation, then
// the done bubble with the guest list and the comments open, in both text tones; then a cancelled
// event.
test("the Thread layout: the event page, each turn of the conversation and the done bubble, in both text tones, and cancelled", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const host = await createPublished(browser, request, "a11y-thread", { ...EVENT, layout: "Thread" });
  const manage = host.page.url();
  await host.page.goto(host.link);
  const drawer = await openDrawer(host.page);
  for (const tone of ["Light", "Dark"] as const) {
    await chooseTone(drawer, request, host.link, tone);
    // A guest of their own for each tone, who has not answered yet.
    const guest = await browser.newContext();
    const page = await guest.newPage();
    await page.goto(host.link);
    const where = `the Thread, ${tone.toLowerCase()} tone`;
    await expectNoSeriousViolations(page, `${where}: the page and the ask`);
    await page.getByRole("button", { name: "Going", exact: true }).click();
    await page.getByLabel("Your name").fill("Priya Nair");
    await expectNoSeriousViolations(page, `${where}: the name in the composer`);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByRole("button", { name: "+1", exact: true })).toBeVisible();
    await expectNoSeriousViolations(page, `${where}: the plus-one chips`);
    await page.getByRole("button", { name: "+1", exact: true }).click();
    await expect(page.getByLabel("Any allergies?")).toBeVisible();
    await expectNoSeriousViolations(page, `${where}: a written answer in the composer`);
    await page.getByLabel("Any allergies?").fill("None");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByRole("button", { name: "Yes", exact: true })).toBeVisible();
    await expectNoSeriousViolations(page, `${where}: yes or no as chips, with Skip`);
    await page.getByRole("button", { name: "Yes", exact: true }).click();
    await expect(page.locator('[data-slot="done"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-slot="comments"] summary').click();
    await expect(page.getByLabel("Add a comment")).toBeVisible();
    await expectNoSeriousViolations(page, `${where}: the done bubble, who's coming and the comments`);
    await guest.close();
  }

  await host.page.goto(manage);
  await host.page.getByRole("button", { name: "Cancel event" }).click();
  await host.page.getByRole("button", { name: "Cancel the event" }).click();
  await expect(host.page.getByText("Cancelled", { exact: true })).toBeVisible({ timeout: 15_000 });
  const visitor = await browser.newContext();
  const page = await visitor.newPage();
  await page.goto(host.link);
  await expect(page.getByText("This event is cancelled")).toBeVisible();
  await expectNoSeriousViolations(page, "the Thread, a cancelled event, dark tone");
  await visitor.close();
  await host.context.close();
});
