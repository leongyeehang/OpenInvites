import { expect, test, type Page } from "./test";
import { createDraft, createPublished } from "./events";
import { signUpVerified } from "./hosts";

// The Inline RSVP style: the steps open under the three buttons, and the confirmation takes the
// buttons' place. (The Sheet style, the same flow in a sheet, is rsvp-sheet.spec.ts.) The guest
// drives the test's own page, so the whole flow runs at 390 pixels in the mobile project and at
// desktop width in the other.

const EDIT_LINK = /^https?:\/\/\S+\/r\/\S+$/;

async function counts(hostPage: Page) {
  await hostPage.goto("/dashboard");
  return hostPage.getByRole("region", { name: "Upcoming" });
}

test("a guest goes, brings someone, and lands on a confirmation with an edit link", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "rsvp-going", {
    rsvpStyle: "Inline",
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "2",
    requirePlusOneNames: true,
    askEmail: true,
  });

  await page.goto(host.link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByLabel("Email").fill("priya at example");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("You can bring up to 2 people.")).toBeVisible();
  await page.getByRole("radio", { name: "+1" }).click();
  await page.getByLabel("Guest 1").fill("Arjun");
  await page.getByRole("button", { name: "Send RSVP" }).click();

  // The address is wrong, so the guest is taken back to the step that holds the field, not left
  // staring at a message about something they cannot see.
  await expect(page.getByText("That does not look like an email address.")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await page.getByLabel("Email").fill("priya@example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();

  await expect(page.getByText("You’re going!")).toBeVisible();
  await expect(page.getByText("Priya Nair, plus one more.")).toBeVisible();
  await expect(page.getByText("Bringing Arjun.")).toBeVisible();
  await expect(page.getByText("We’ll reach you at priya@example.test.")).toBeVisible();
  await expect(page.getByText(EDIT_LINK)).toBeVisible();

  // The host counts the guest and the person they bring.
  await expect((await counts(host.page)).getByText("1 going · 0 maybe · 0 can’t go")).toBeVisible();
  await expect((await counts(host.page)).getByText("2 people expected")).toBeVisible();

  // Coming back on the same device finds the answer rather than an empty form.
  await page.reload();
  await expect(page.getByText("You’re going!")).toBeVisible();
  await page.getByRole("button", { name: "Edit details" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("Priya Nair");
  await expect(page.getByLabel("Email")).toHaveValue("priya@example.test");

  await host.context.close();
});

test("a guest who can’t go answers in one step and is never asked who they are bringing", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "rsvp-cant", {
    rsvpStyle: "Inline",
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "2",
  });

  await page.goto(host.link);
  await page.getByRole("button", { name: "Can’t go" }).click();
  await page.getByLabel("Your name").fill("Mei Lin");
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
  await page.getByRole("button", { name: "Send RSVP" }).click();

  await expect(page.getByText("We’ll miss you.")).toBeVisible();
  await expect(page.getByText("Mei Lin, marked as can’t go.")).toBeVisible();

  const upcoming = await counts(host.page);
  await expect(upcoming.getByText("0 going · 0 maybe · 1 can’t go · no one expected yet")).toBeVisible();

  await host.context.close();
});

test("answering again from the same device replaces the earlier RSVP", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "rsvp-again", {
    rsvpStyle: "Inline",
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "2",
  });

  await page.goto(host.link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "+1" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();

  await page.getByRole("button", { name: "Change my answer" }).click();
  await page.getByRole("button", { name: "Maybe" }).click();
  // The name is kept: changing an answer does not ask for it again.
  await expect(page.getByLabel("Your name")).toHaveValue("Priya Nair");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "Just me" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re a maybe.")).toBeVisible();

  // One guest, not two, and a maybe never joins the headcount.
  const upcoming = await counts(host.page);
  await expect(upcoming.getByText("0 going · 1 maybe · 0 can’t go · no one expected yet")).toBeVisible();

  await host.context.close();
});

test("the edit link opens the RSVP on a device that has never seen the invitation", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "rsvp-editlink", {
    rsvpStyle: "Inline",
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
  });

  await page.goto(host.link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("button", { name: "Send RSVP" }).click();
  const editLink = (await page.getByText(EDIT_LINK).textContent())!.trim();

  const elsewhere = await browser.newContext();
  const elsewherePage = await elsewhere.newPage();
  await elsewherePage.goto(editLink);
  // The token does its work and gets out of the way.
  await expect(elsewherePage).toHaveURL(host.link);
  await expect(elsewherePage.getByText("You’re going!")).toBeVisible();

  await elsewherePage.getByRole("button", { name: "Edit details" }).click();
  await elsewherePage.getByLabel("Your name").fill("Priya N.");
  await elsewherePage.getByRole("button", { name: "Send RSVP" }).click();
  await expect(elsewherePage.getByText("Priya N., just you.")).toBeVisible();

  // Still one guest, and the first device sees the change.
  await expect((await counts(host.page)).getByText("1 going · 0 maybe · 0 can’t go")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Priya N., just you.")).toBeVisible();

  await elsewhere.close();
  await host.context.close();
});

test("a guest removes their RSVP and the event forgets them", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "rsvp-remove", {
    rsvpStyle: "Inline",
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "0",
  });

  await page.goto(host.link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();

  await page.getByRole("button", { name: "Remove my RSVP" }).click();
  await expect(page.getByText("You’re going!")).toHaveCount(0);
  // The device has forgotten too, so the link opens a fresh invitation.
  await page.reload();
  await expect(page.getByText("You’re going!")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Going" })).toBeEnabled();

  await expect((await counts(host.page)).getByText("0 going · 0 maybe · 0 can’t go · no one expected yet")).toBeVisible();
  await host.context.close();
});

test("the host's plus-one settings decide what the guest is asked", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "rsvp-settings", {
    rsvpStyle: "Inline",
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    plusOnes: "1",
    requirePlusOneNames: true,
  });

  await page.goto(host.link);
  // No email field: this host did not ask for one.
  await page.getByRole("button", { name: "Going" }).click();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("You can bring one person.")).toBeVisible();
  await expect(page.getByRole("radio", { name: "+2" })).toHaveCount(0);
  await page.getByRole("radio", { name: "+1" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("The host would like every guest’s name.")).toBeVisible();

  await page.getByLabel("Guest 1").fill("Arjun");
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("Bringing Arjun.")).toBeVisible();

  // The host changes their mind and allows nobody. The guest can still edit their RSVP: the
  // plus-one they can no longer bring is dropped rather than blocking every save.
  await host.page.getByLabel("Plus-ones per guest").selectOption("0");
  await host.page.getByRole("button", { name: "Save changes" }).click();
  await expect(host.page.getByText("Saved.")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("Priya Nair, just you.")).toBeVisible();

  await host.context.close();
});

test("a draft takes no RSVPs", async ({ page, request }) => {
  test.slow();
  await signUpVerified(page, request, "rsvp-draft");
  const link = await createDraft(page, { title: "Ada’s birthday", start: "2027-03-06T19:00" });

  await page.goto(link);
  await expect(page.getByRole("button", { name: "Going" })).toBeDisabled();
  await expect(page.getByText("This invitation is not taking RSVPs.")).toBeVisible();
});

test("an edit link nobody was given leads nowhere", async ({ request }) => {
  const response = await request.get("/r/not-a-real-token", { maxRedirects: 0 });
  expect(response.status()).toBe(404);
});
