import sharp from "sharp";
import { createDraft, createPublished, openDesign, openMore, publishInEditor, toEditor } from "./events";
import { signUpVerified } from "./hosts";
import { clientAddress, expect, test, type Page } from "./test";

// The dashboard as a shelf of invitations (dashboard, ticket 03): the soonest published event is
// Next up, with its replies and the ways to manage it; the rest are poster tiles under Coming up,
// Drafts and Past. Every test signs up a host of its own on the shared `app`.

const region = (page: Page, name: "Next up" | "Coming up" | "Drafts" | "Past") => page.getByRole("region", { name, exact: true });

async function cancelInEditor(page: Page) {
  await openMore(page);
  await page.getByRole("button", { name: "Cancel event" }).click();
  await page.getByRole("button", { name: "Cancel the event" }).click();
  await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
}

test("the soonest published event is Next up, and the others are under Coming up, Drafts and Past", async ({ page, request }) => {
  test.slow();
  await signUpVerified(page, request, "shelves");
  await createDraft(page, { title: "Ada’s supper", start: "2027-03-06T19:00" });
  await publishInEditor(page);
  const supper = page.url();
  await createDraft(page, { title: "Spring picnic", start: "2027-04-10T12:00" });
  await publishInEditor(page);
  await createDraft(page, { title: "Not ready yet", start: "2027-03-01T19:00" });
  await createDraft(page, { title: "Last year’s party", start: "2020-01-01T10:00" });

  await page.goto("/dashboard");
  const nextUp = region(page, "Next up");
  await expect(nextUp.getByText("Ada’s supper")).toBeVisible();
  await expect(nextUp.getByText("0 going", { exact: true })).toBeVisible();
  await expect(nextUp.getByText("no one expected yet")).toBeVisible();
  await expect(region(page, "Coming up").getByRole("link", { name: /Spring picnic/ })).toBeVisible();
  await expect(region(page, "Drafts").getByRole("link", { name: /Not ready yet/ })).toContainText("Draft");
  await expect(region(page, "Past").getByRole("link", { name: /Last year’s party/ })).toBeVisible();
  // A draft is never Next up, however soon, and nothing is on two shelves.
  await expect(page.getByText("Not ready yet")).toHaveCount(1);

  await nextUp.getByRole("link", { name: "Guests" }).click();
  await expect(page).toHaveURL(`${supper}/guests`);
  await page.goto("/dashboard");
  await region(page, "Next up").getByRole("link", { name: "Share" }).click();
  await expect(page).toHaveURL(`${supper}/share`);
  await page.goto("/dashboard");
  await region(page, "Next up").getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(supper);
});

test("a reply waiting for approval shows on Next up as one to approve", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "to-approve", { title: "Ada’s supper club", start: "2027-03-06T19:00", approval: true });
  const guest = await (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
  await guest.goto(host.link);
  await guest.getByRole("button", { name: "Going", exact: true }).click();
  await guest.getByLabel("Your name").fill("Asha Menon");
  if (await guest.getByRole("button", { name: "Continue" }).isVisible()) {
    await guest.getByRole("button", { name: "Continue" }).click();
    await guest.getByRole("radio", { name: "Just me" }).click();
  }
  await guest.getByRole("button", { name: "Send RSVP" }).click();
  await expect(guest.getByRole("heading", { name: "Your reply is waiting for the host’s approval." })).toBeVisible({ timeout: 15_000 });

  await host.page.goto("/dashboard");
  await expect(region(host.page, "Next up").getByText("1 to approve", { exact: true })).toBeVisible();
});

test("a cancelled event, however soon, is under Coming up and not Next up", async ({ page, request }) => {
  test.slow();
  await signUpVerified(page, request, "cancelled-shelf");
  await createDraft(page, { title: "Called off", start: "2027-02-01T19:00" });
  await publishInEditor(page);
  await cancelInEditor(page);
  await createDraft(page, { title: "Still on", start: "2027-05-01T19:00" });
  await publishInEditor(page);

  await page.goto("/dashboard");
  await expect(region(page, "Next up").getByText("Still on")).toBeVisible();
  await expect(region(page, "Coming up").getByRole("link", { name: /Called off/ })).toContainText("Cancelled");
});

test("a host with no events is offered one way to start", async ({ page, request }) => {
  await signUpVerified(page, request, "first-invitation");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Make your first invitation" })).toBeVisible();
  await expect(region(page, "Next up")).toHaveCount(0);
  await page.getByRole("link", { name: "Start an invitation" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 20_000 });
});

test("an event with the host's own picture shows that picture on the dashboard", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "tile-upload", { title: "Garden lunch", start: "2027-06-06T12:00" });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#2b6a4a"/><circle cx="400" cy="420" r="220" fill="#f3d27a"/></svg>`;
  const buffer = await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
  await toEditor(host.page);
  await openDesign(host.page, "Poster", "Upload");
  await host.page.getByRole("dialog", { name: "Poster" }).getByLabel("Upload your photo or poster").setInputFiles({ name: "garden.jpg", mimeType: "image/jpeg", buffer });
  await expect
    .poll(async () => (await (await host.page.request.get(host.link)).text()).includes("/uploads/"), { timeout: 20_000 })
    .toBe(true);

  await host.page.goto("/dashboard");
  await expect(region(host.page, "Next up").locator('img[src*="/uploads/"]')).toHaveCount(1);
});

test("on a phone, many past events scroll inside their row, every one reachable by Tab, and a long title wraps", async ({ page, request }) => {
  test.slow();
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpVerified(page, request, "many-past");
  const long = "The very long name of our neighbourhood’s yearly lantern walk";
  await createDraft(page, { title: long, start: "2027-09-09T19:00" });
  for (let year = 2010; year < 2020; year++) await createDraft(page, { title: `Lantern walk ${year}`, start: `${year}-09-09T19:00` });

  await page.goto("/dashboard");
  const past = region(page, "Past");
  await expect(past.getByRole("link")).toHaveCount(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  const row = past.getByRole("list");
  expect(await row.evaluate((list) => list.scrollWidth > list.clientWidth)).toBe(true);

  const last = past.getByRole("link", { name: /Lantern walk 2010/ });
  await past.getByRole("link").first().focus();
  for (let tab = 0; tab < 9; tab++) await page.keyboard.press("Tab");
  await expect(last).toBeFocused();
  await expect(last).toBeInViewport();

  // The long title wraps inside its tile: the tile is no wider than its column.
  const tile = region(page, "Drafts").getByRole("link", { name: new RegExp(long) });
  const [tileWidth, titleWidth] = await tile.evaluate((link) => [link.getBoundingClientRect().width, link.querySelector("p")!.scrollWidth]);
  expect(titleWidth).toBeLessThanOrEqual(tileWidth);
});
