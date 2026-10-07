import { expect, test, type APIRequestContext, type Page } from "./test";
import { createPublished } from "./events";
import { latestMailTo, mailCountTo } from "./hosts";

// The host is emailed when a guest replies (story 105), and can turn it off (story 106). Mail is
// read in Mailpit. Each host's inbox already holds one email, the verification from signing up.

// The host's newest email, waited for until it says this. The worker runs as soon as an RSVP is
// saved, so it is there within seconds; the wait allows 30.
async function expectNewestMail(request: APIRequestContext, email: string, says: string) {
  await expect.poll(() => latestMailTo(request, email), { timeout: 30_000, message: `an email to the host saying “${says}”` }).toContain(says);
}

// On the event's manage page, loaded afresh so that "Saved." is this save's and not the last one's.
async function saveEmailSetting(hostPage: Page, on: boolean) {
  await hostPage.reload();
  await hostPage.getByLabel("Email me when a guest replies").setChecked(on);
  await hostPage.getByRole("button", { name: "Save changes" }).click();
  await expect(hostPage.getByText("Saved.")).toBeVisible({ timeout: 15_000 });
}

test("the host is emailed when a guest replies and changes their status, and not once they turn it off", async ({
  page,
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "notify", {
    rsvpStyle: "Inline",
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "1",
  });
  const guestList = `${host.page.url()}/guests`;

  await page.goto(host.link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "+1" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });

  await expectNewestMail(request, host.email, "Priya Nair replied to Ada’s birthday: Going, bringing one more person.");
  expect(await latestMailTo(request, host.email)).toContain(guestList);
  expect(await mailCountTo(request, host.email)).toBe(2);

  await page.getByRole("button", { name: "Change my answer" }).click();
  await page.getByRole("button", { name: "Maybe" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "Just me" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re a maybe.")).toBeVisible({ timeout: 15_000 });

  await expectNewestMail(request, host.email, "Priya Nair changed their RSVP to Ada’s birthday: Maybe.");
  expect(await mailCountTo(request, host.email)).toBe(3);

  // A new name keeps the status, which is not worth an email.
  await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByLabel("Your name").fill("Priya N.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("Priya N., just you.")).toBeVisible({ timeout: 15_000 });

  // The host turns the emails off, and a new guest replies.
  await saveEmailSetting(host.page, false);
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(host.link);
  await otherPage.getByRole("button", { name: "Going" }).click();
  await otherPage.getByLabel("Your name").fill("Mei Lin");
  await otherPage.getByRole("button", { name: "Continue" }).click();
  await otherPage.getByRole("radio", { name: "Just me" }).click();
  await otherPage.getByRole("button", { name: "Send RSVP" }).click();
  await expect(otherPage.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });

  // That nothing came can only be seen by waiting. Rather than wait out the worker's minute, the
  // host turns the emails back on and the next one marks the spot: the outbox sends mail in the
  // order it was queued, so anything the new name or Mei's reply had queued would be there first.
  await saveEmailSetting(host.page, true);
  await otherPage.getByRole("button", { name: "Change my answer" }).click();
  await otherPage.getByRole("button", { name: "Can’t go" }).click();
  await otherPage.getByRole("button", { name: "Send RSVP" }).click();
  await expect(otherPage.getByText("We’ll miss you.")).toBeVisible({ timeout: 15_000 });

  await expectNewestMail(request, host.email, "Mei Lin changed their RSVP to Ada’s birthday: Can’t go.");
  expect(await mailCountTo(request, host.email)).toBe(4);

  await other.close();
  await host.context.close();
});
