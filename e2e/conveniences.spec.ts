import { expect, test } from "./test";
import { createDraft, createPublished } from "./events";
import { signUpVerified } from "./hosts";

const EVENT = {
  title: "Ada’s birthday",
  start: "2027-03-06T19:00",
  end: "2027-03-06T22:00",
  location: "Ah Ma’s house, 3rd floor",
  description: "Bring nothing.",
  plusOnes: "0",
} as const;

test("a guest can put the event straight into their calendar", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "calendar", EVENT);
  await page.goto(host.link);

  // The file itself: the right instant, the title, and the way back to the invitation.
  const file = await request.get(`${host.link}/calendar.ics`);
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toContain("text/calendar");
  expect(file.headers()["content-disposition"]).toContain(".ics");
  const ics = await file.text();
  expect(ics).toContain("SUMMARY:Ada’s birthday");
  expect(ics).toContain("DTSTART:20270306T110000Z");
  expect(ics).toContain("DTEND:20270306T140000Z");
  expect(ics).toContain("LOCATION:Ah Ma’s house\\, 3rd floor");
  expect(ics).toContain(`URL:${host.link}`);
  expect(ics).toContain("UID:");

  // The link a guest actually taps hands the file over.
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Add to calendar" }).first().click();
  expect((await download).suggestedFilename()).toMatch(/\.ics$/);

  // And the two that live on the web, prefilled.
  const google = page.getByRole("link", { name: "Google Calendar" }).first();
  await expect(google).toHaveAttribute("href", /calendar\.google\.com/);
  await expect(google).toHaveAttribute("href", /dates=20270306T110000Z%2F20270306T140000Z/);
  const outlook = page.getByRole("link", { name: "Outlook" }).first();
  await expect(outlook).toHaveAttribute("href", /outlook\.live\.com/);
  await expect(outlook).toHaveAttribute("href", /startdt=2027-03-06T11%3A00%3A00.000Z/);

  await host.context.close();
});

test("a cancelled event is not offered to anyone's calendar", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "calendar-cancelled", EVENT);
  await host.page.getByRole("button", { name: "Cancel event" }).click();
  await host.page.getByRole("button", { name: "Cancel the event" }).click();
  await expect(host.page.getByText("Cancelled", { exact: true })).toBeVisible();

  await page.goto(host.link);
  await expect(page.getByText("This event is cancelled")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add to calendar" })).toHaveCount(0);
  expect((await request.get(`${host.link}/calendar.ics`)).status()).toBe(404);

  await host.context.close();
});

test("a draft's calendar file is as private as its page", async ({ page, request }) => {
  test.slow();
  await signUpVerified(page, request, "calendar-draft");
  const link = await createDraft(page, { title: "Quiet", start: "2027-05-01T12:00" });
  expect((await request.get(`${link}/calendar.ics`)).status()).toBe(404);
});

test("the page counts down and opens the venue in a maps app", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "countdown", EVENT);
  await page.goto(host.link);

  await expect(page.getByText(/^Starts in \d+ days$/)).toBeVisible();
  const maps = page.getByRole("link", { name: "Open in Maps" });
  await expect(maps).toHaveAttribute("href", /google\.com\/maps\/search/);
  await expect(maps).toHaveAttribute("href", /3rd%20floor/);

  await host.context.close();
});

test("a guest in another zone is told what the time is where they are", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "zones", EVENT);

  const elsewhere = await browser.newContext({ timezoneId: "America/New_York" });
  const elsewherePage = await elsewhere.newPage();
  await elsewherePage.goto(host.link);
  // 19:00 in Singapore is 06:00 the same morning in New York.
  await expect(elsewherePage.getByText(/where you are/)).toContainText("6:00");
  await elsewhere.close();

  // A guest in the event's own zone is told nothing they already know.
  const athome = await browser.newContext({ timezoneId: "Asia/Singapore" });
  const athomePage = await athome.newPage();
  await athomePage.goto(host.link);
  await expect(athomePage.getByText(/where you are/)).toHaveCount(0);
  await athome.close();

  await host.context.close();
});

test("a guest who has just replied is offered the calendar there and then", async ({ page, browser, request }) => {
  test.slow();
  // Inline, so the offer in the confirmation and the calendar tile below it are counted together.
  const host = await createPublished(browser, request, "calendar-done", { ...EVENT, rsvpStyle: "Inline" });

  await page.goto(host.link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add to calendar" }).first()).toBeVisible();

  // Someone who cannot come is not offered a calendar entry for it.
  await page.getByRole("button", { name: "Change my answer" }).click();
  await page.getByRole("button", { name: "Can’t go" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("We’ll miss you.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add to calendar" })).toHaveCount(1);

  await host.context.close();
});
