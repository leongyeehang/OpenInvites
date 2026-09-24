import { expect, expectNotFoundAsSent, test, type Page } from "./test";
import { createPublished } from "./events";
import { PASSWORD } from "./hosts";

async function rsvp(page: Page, link: string, name: string) {
  await page.goto(link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();
}

test("a cancelled event keeps its page, with the news and no way to reply", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "cancel", {
    // Inline, so the confirmation is in place of the buttons when the guest comes back.
    rsvpStyle: "Inline",
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
  });
  await rsvp(page, host.link, "Priya Nair");

  await host.page.getByRole("button", { name: "Cancel event" }).click();
  await expect(host.page.getByText("Cancel “Ada’s birthday”?")).toBeVisible();
  await host.page.getByRole("button", { name: "Cancel the event" }).click();
  await expect(host.page.getByText("Cancelled", { exact: true })).toBeVisible();

  // The invitation is still there, and so is the news.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ada’s birthday" })).toBeVisible();
  await expect(page.getByText("This event is cancelled")).toBeVisible();
  await page.getByRole("button", { name: "Change my answer" }).click();
  await expect(page.getByRole("button", { name: "Going" })).toBeDisabled();
  await expect(page.getByText("This invitation is not taking RSVPs.")).toBeVisible();

  // The host keeps the guest list they already have.
  await host.page.goto(`${host.page.url()}/guests`);
  await expect(host.page.getByText("Priya Nair")).toBeVisible();

  await host.context.close();
});

test("a host is told what deleting an event costs, and then the link is gone", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "delete-event", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
    questions: [{ prompt: "Any dietary needs?", type: "text" }],
  });
  await page.goto(host.link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Any dietary needs?").fill("No nuts");
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();

  await host.page.reload();
  await host.page.getByRole("button", { name: "Delete event" }).click();
  await expect(host.page.getByText("Delete “Ada’s birthday”?")).toBeVisible();
  await expect(host.page.getByText("One RSVP, and the answers with it, are deleted.")).toBeVisible();
  await host.page.getByRole("button", { name: "Delete it" }).click();
  await expect(host.page).toHaveURL(/\/dashboard$/);
  await expect(host.page.getByText("Ada’s birthday")).toHaveCount(0);

  await expectNotFoundAsSent(await request.get(host.link));
  await page.goto(host.link);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  await host.context.close();
});

test("deleting an account takes its events and its guests' answers with it", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "delete-account", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
  });
  await rsvp(page, host.link, "Priya Nair");

  await host.page.goto("/account");
  await host.page.getByRole("button", { name: "Delete account" }).click();
  await host.page.getByRole("alertdialog").getByLabel("Password").fill(PASSWORD);
  await host.page.getByRole("button", { name: "Delete my account" }).click();
  await expect(host.page).toHaveURL(/\/sign-in/);

  expect((await request.get(host.link)).status()).toBe(404);
  await host.context.close();
});
