import { expect, expectNotFoundAsSent, test } from "./test";
import { createDraft, createPublished, eventLinkIn, openMore, publishInEditor, savedAfter, setAbout, setWhen, setWhere, typeTitle } from "./events";
import { newHost, signUp, signUpVerified, verifyEmail } from "./hosts";

test("a host must verify their email before creating an event, and the page offers a resend", async ({
  page,
  request,
}) => {
  const host = newHost("gate");
  await signUp(page, host);
  await page.goto("/events/new");
  await expect(page.getByRole("heading", { name: "Verify your email first" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Resend email" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Event title" })).toHaveCount(0);

  await verifyEmail(page, request, host.email);
  await page.goto("/events/new");
  await expect(page.getByRole("textbox", { name: "Event title" })).toBeVisible({ timeout: 20_000 });
});

// M4 ticket 05: the invitation is the editor. New event opens a blank invitation, the title is
// typed on it and the details set from their sheets, and it is published without a form.
test("a host makes an event on the invitation itself, from New event to published, without a form", async ({ page, request, browser }) => {
  test.slow();
  const host = await signUpVerified(page, request, "publish");
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "New event" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  // A blank invitation, a draft, and nothing a guest would call a form.
  const title = page.getByRole("textbox", { name: "Event title" });
  await expect(title).toHaveText("");
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "When: Set a date and time" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Where: Add a place" })).toBeVisible();
  await expect(page.getByRole("button", { name: "About: Say what to expect" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);

  await typeTitle(page, "Ada’s birthday");
  await setWhen(page, { start: "2027-03-06T19:00", end: "2027-03-06T22:00" });
  await setWhere(page, "Ah Ma’s house, 3rd floor");
  await setAbout(page, "Bring nothing.\nDress code: sparkly.");
  await expect(page.getByRole("button", { name: /^When:/ })).toContainText("Saturday, March 6, 2027, 7:00 – 10:00 PM GMT+8");
  const link = await eventLinkIn(page);
  expect(link).toMatch(/\/e\/[A-Za-z0-9-]+$/);

  await page.goto("/dashboard");
  const upcoming = page.getByRole("region", { name: "Upcoming" });
  await expect(upcoming.getByText("Ada’s birthday")).toBeVisible();
  await expect(upcoming.getByText("Draft")).toBeVisible();
  await expect(upcoming.getByText("0 going · 0 maybe · 0 can’t go")).toBeVisible();

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(link);
  await expect(guestPage.getByRole("heading", { name: "This invitation isn’t ready yet" })).toBeVisible();
  await expect(guestPage.getByText("Ada’s birthday")).toHaveCount(0);

  // Preview is the page as a guest will see it, and the way back is to the editor.
  await upcoming.getByRole("link", { name: /Ada’s birthday/ }).click();
  await page.getByRole("link", { name: "Preview" }).click();
  await expect(page.getByRole("heading", { name: "Ada’s birthday" })).toBeVisible();
  await expect(page.getByText("Draft. Only the hosts can see this page until you publish it.")).toBeVisible();
  await page.getByRole("link", { name: "Edit event" }).click();
  await publishInEditor(page);
  await expect(page.getByText("Live", { exact: true })).toBeVisible();

  await guestPage.goto(link);
  await expect(guestPage.getByRole("heading", { name: "Ada’s birthday" })).toBeVisible();
  await expect(guestPage.getByText(`Hosted by ${host.name}`)).toBeVisible();
  await expect(guestPage.getByText("Saturday, March 6, 2027, 7:00 – 10:00 PM GMT+8")).toBeVisible();
  await expect(guestPage.getByText("Ah Ma’s house, 3rd floor")).toBeVisible();
  await expect(guestPage.getByText("Dress code: sparkly.")).toBeVisible();

  // Edited live: the guest sees the new title.
  await typeTitle(page, "Ada’s 30th");
  await guestPage.reload();
  await expect(guestPage.getByRole("heading", { name: "Ada’s 30th" })).toBeVisible();
  await guest.close();
});

test("publishing asks for a title, then a date, and puts the focus on what is missing", async ({ page, request }) => {
  test.slow();
  await signUpVerified(page, request, "publish-refused");
  await page.goto("/events/new");
  const title = page.getByRole("textbox", { name: "Event title" });
  await expect(title).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Add a title first.")).toBeVisible();
  await expect(title).toBeFocused();

  await typeTitle(page, "Ada’s birthday");
  await expect(page.getByText("Add a title first.")).toHaveCount(0);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Add a date first.")).toBeVisible();
  const when = page.getByRole("dialog", { name: "When" });
  await expect(when).toBeVisible();
  await expect(when.getByRole("heading", { name: "When" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
});

test("what the host typed is kept when they reload mid-edit", async ({ page, request }) => {
  test.slow();
  await signUpVerified(page, request, "autosave");
  await page.goto("/events/new");
  const title = page.getByRole("textbox", { name: "Event title" });
  await expect(title).toBeVisible({ timeout: 20_000 });
  // Typed, and not finished with Enter: it is saved as the host stops typing.
  await savedAfter(page, async () => {
    await title.click();
    await page.keyboard.type("Ada’s birth");
  });
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Event title" })).toHaveText("Ada’s birth");
});

test("a save that fails says so, and Try again sends it again", async ({ page, request }) => {
  test.slow();
  await signUpVerified(page, request, "save-failed");
  await page.goto("/events/new");
  const title = page.getByRole("textbox", { name: "Event title" });
  await expect(title).toBeVisible({ timeout: 20_000 });
  const editor = page.url();

  // The server answers the next save with an error.
  let refused = false;
  await page.route(editor, async (route) => {
    if (route.request().method() !== "POST" || refused) return route.fallback();
    refused = true;
    await route.fulfill({ status: 500, body: "" });
  });
  await title.fill("Ada’s birthday");
  await title.press("Enter");
  await expect(page.locator('[data-slot="save-status"]')).toContainText("Couldn’t save");
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await savedAfter(page, () => page.getByRole("button", { name: "Try again" }).click());
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Event title" })).toHaveText("Ada’s birthday");
});

test("the end must come after the start", async ({ page, request }) => {
  await signUpVerified(page, request, "validation");
  await page.goto("/events/new");
  await expect(page.getByRole("textbox", { name: "Event title" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /^When:/ }).click();
  const when = page.getByRole("dialog", { name: "When" });
  await when.getByLabel("Starts").fill("2027-03-06T19:00");
  await when.getByLabel("Ends").fill("2027-03-06T18:00");
  await when.getByRole("button", { name: "Done" }).click();
  await expect(when.getByText("The end must come after the start.")).toBeVisible();
  await expect(when).toBeVisible();
});

test("an all-day event shows its date and no time", async ({ page, request }) => {
  await signUpVerified(page, request, "allday");
  await createDraft(page, { title: "Beach day", start: "2027-03-06T19:00" });
  await setWhen(page, { allDay: true, start: "2027-04-10" });
  await publishInEditor(page);
  await page.getByRole("link", { name: "Preview" }).click();
  await expect(page.getByText("Saturday, April 10, 2027", { exact: true })).toBeVisible();
});

test("an event that has ended is listed under Past, and a draft with no date yet under Upcoming", async ({ page, request }) => {
  await signUpVerified(page, request, "past");
  await createDraft(page, { title: "Last year’s party", start: "2020-01-01T10:00" });
  await page.goto("/events/new");
  await expect(page.getByRole("textbox", { name: "Event title" })).toBeVisible({ timeout: 20_000 });
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "Past" }).getByText("Last year’s party")).toBeVisible();
  const upcoming = page.getByRole("region", { name: "Upcoming" });
  await expect(upcoming.getByText("Untitled event")).toBeVisible();
  await expect(upcoming.getByText("No date yet")).toBeVisible();
});

test("event pages carry a noindex signal in the header and in the page", async ({ page, request }) => {
  await signUpVerified(page, request, "noindex");
  const link = await createDraft(page, { title: "Quiet", start: "2027-05-01T12:00" });
  await publishInEditor(page);
  const response = await request.get(link);
  expect(response.status()).toBe(200);
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  expect(await response.text()).toMatch(/<meta name="robots" content="noindex/);
});

test("an unknown link is not found, on a page the server sends whole in the visitor's language", async ({ page, request }) => {
  await expectNotFoundAsSent(await request.get("/e/abcdefghij"));
  await expectNotFoundAsSent(await request.get("/e/not-a-link"));
  await expectNotFoundAsSent(await request.get("/e/abcdefghij", { headers: { "accept-language": "zh-TW" } }), { lang: "zh-Hant", heading: "找不到頁面" });
  await page.goto("/e/abcdefghij");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("an event address a host mistypes is not found, on each of the event's pages", async ({ page }) => {
  await signUp(page, newHost("mistyped"));
  for (const path of [
    "/events/not-an-event",
    "/events/not-an-event/share",
    "/events/not-an-event/guests",
    "/events/not-an-event/announcements",
    "/events/not-an-event/hosts",
    "/events/0192a7b8-0000-7000-8000-00000000000",
    // Next.js routes these to the event pages, with "new" for the event.
    "/events/new/share",
    "/events/new/guests",
    "/events/new/announcements",
    "/events/new/hosts",
  ]) {
    await expectNotFoundAsSent(await page.goto(path));
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  }
});

test("a host cannot open another host's event settings", async ({ page, request, browser }) => {
  test.slow();
  await signUpVerified(page, request, "owner");
  await createDraft(page, { title: "Mine", start: "2027-06-01T12:00" });
  const manageUrl = page.url();

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signUp(otherPage, newHost("intruder"));
  await otherPage.goto(manageUrl);
  await expect(otherPage.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await other.close();
});

test("the host sees how often the event page was opened by people other than the hosts", async ({ browser, request }) => {
  test.slow();
  const { context, page, link } = await createPublished(browser, request, "views", { title: "Counted", start: "2027-07-01T12:00" });
  const manage = page.url();
  // Said in the editor's More.
  const opened = async (count: string) => {
    await openMore(page);
    await expect(page.getByText(`Opened ${count}`)).toBeVisible();
  };

  await page.goto(link);
  await page.goto(link);
  await page.goto(link);
  await page.goto(manage);
  await opened("0 times");

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(link);
  await guestPage.goto(link);
  await page.goto(manage);
  await opened("2 times");

  await guest.close();
  await context.close();
});

test("a draft a guest opens is not counted, and one opening reads once", async ({ browser, page, request }) => {
  test.slow();
  await signUpVerified(page, request, "draftviews");
  const link = await createDraft(page, { title: "Not yet", start: "2027-07-02T12:00" });
  const manage = page.url();

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(link);
  await expect(guestPage.getByRole("heading", { name: "This invitation isn’t ready yet" })).toBeVisible();
  await page.goto(manage);
  await openMore(page);
  await expect(page.getByText("Opened 0 times")).toBeVisible();
  await page.keyboard.press("Escape");

  await publishInEditor(page);
  await guestPage.goto(link);
  await page.goto(manage);
  await openMore(page);
  await expect(page.getByText("Opened once")).toBeVisible();
  await guest.close();
});
