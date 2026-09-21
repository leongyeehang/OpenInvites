import { expect, test, type Page } from "@playwright/test";
import { newHost, signUp, signUpVerified, verifyEmail } from "./hosts";

async function createDraft(page: Page, fields: { title: string; start: string; end?: string; location?: string; description?: string }) {
  await page.goto("/events/new");
  await page.getByLabel("Title").fill(fields.title);
  await page.getByLabel("Starts").fill(fields.start);
  if (fields.end) await page.getByLabel("Ends").fill(fields.end);
  await page.getByLabel("Time zone").selectOption("Asia/Singapore");
  if (fields.location) await page.getByLabel("Where").fill(fields.location);
  if (fields.description) await page.getByLabel("Description").fill(fields.description);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  return (await page.getByText(/^https?:\/\/\S+\/e\/[A-Za-z0-9]{10}$/).textContent())!.trim();
}

test("a host must verify their email before creating an event, and the page offers a resend", async ({
  page,
  request,
}) => {
  const host = newHost("gate");
  await signUp(page, host);
  await page.goto("/events/new");
  await expect(page.getByRole("heading", { name: "Verify your email first" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Resend email" })).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveCount(0);

  await verifyEmail(page, request, host.email);
  await page.goto("/events/new");
  await expect(page.getByLabel("Title")).toBeVisible();
});

test("a host creates a draft, previews it, publishes it, and edits it", async ({ page, request, browser }) => {
  test.slow();
  const host = await signUpVerified(page, request, "publish");
  const link = await createDraft(page, {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    end: "2027-03-06T22:00",
    location: "Ah Ma’s house, 3rd floor",
    description: "Bring nothing.\nDress code: sparkly.",
  });
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  expect(link).toMatch(/\/e\/[A-Za-z0-9]{10}$/);

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

  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Ada’s birthday" })).toBeVisible();
  await expect(page.getByText("Draft. Only you can see this page until you publish it.")).toBeVisible();
  await page.getByRole("link", { name: "Edit event" }).click();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();

  await guestPage.goto(link);
  await expect(guestPage.getByRole("heading", { name: "Ada’s birthday" })).toBeVisible();
  await expect(guestPage.getByText(`Hosted by ${host.name}`)).toBeVisible();
  await expect(guestPage.getByText("Saturday, March 6, 2027, 7:00 – 10:00 PM GMT+8")).toBeVisible();
  await expect(guestPage.getByText("Ah Ma’s house, 3rd floor")).toBeVisible();
  await expect(guestPage.getByText("Dress code: sparkly.")).toBeVisible();

  await page.getByLabel("Title").fill("Ada’s 30th");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ada’s 30th", level: 1 })).toBeVisible();
  await guestPage.reload();
  await expect(guestPage.getByRole("heading", { name: "Ada’s 30th" })).toBeVisible();
  await guest.close();
});

test("the end must come after the start", async ({ page, request }) => {
  await signUpVerified(page, request, "validation");
  await page.goto("/events/new");
  await page.getByLabel("Title").fill("Backwards");
  await page.getByLabel("Starts").fill("2027-03-06T19:00");
  await page.getByLabel("Ends").fill("2027-03-06T18:00");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("The end must come after the start.")).toBeVisible();
  await expect(page).toHaveURL(/\/events\/new$/);
});

test("an all-day event shows its date and no time", async ({ page, request }) => {
  await signUpVerified(page, request, "allday");
  await page.goto("/events/new");
  await page.getByLabel("Title").fill("Beach day");
  await page.getByLabel("All day").check();
  await page.getByLabel("Starts").fill("2027-04-10");
  await page.getByLabel("Time zone").selectOption("Asia/Singapore");
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByRole("link", { name: "Open the event page" }).click();
  await expect(page.getByText("Saturday, April 10, 2027", { exact: true })).toBeVisible();
});

test("an event that has ended is listed under Past", async ({ page, request }) => {
  await signUpVerified(page, request, "past");
  await createDraft(page, { title: "Last year’s party", start: "2020-01-01T10:00" });
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "Past" }).getByText("Last year’s party")).toBeVisible();
  await expect(page.getByRole("region", { name: "Upcoming" }).getByText("Nothing coming up.")).toBeVisible();
});

test("event pages carry a noindex signal in the header and in the page", async ({ page, request }) => {
  await signUpVerified(page, request, "noindex");
  const link = await createDraft(page, { title: "Quiet", start: "2027-05-01T12:00" });
  await page.getByRole("button", { name: "Publish" }).click();
  const response = await request.get(link);
  expect(response.status()).toBe(200);
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  expect(await response.text()).toMatch(/<meta name="robots" content="noindex/);
});

test("an unknown link is not found", async ({ page, request }) => {
  const response = await request.get("/e/abcdefghij");
  expect(response.status()).toBe(404);
  await page.goto("/e/abcdefghij");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
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
