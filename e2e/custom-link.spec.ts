import { createPublished } from "./events";
import { latestMailTo, mailCountTo, newHost } from "./hosts";
import { expect, test, type Page } from "./test";

// Ticket 03 of M3: a host may give an event a custom link beside its random one. Both open the
// page; the custom one is shown, printed and emailed. Changing it retires the old custom link, and
// resetting the link retires both. Each test's links carry a suffix of its own, as the links are
// unique across the whole instance.

const EVENT = {
  rsvpStyle: "Inline",
  title: "Ada’s birthday",
  start: "2027-03-06T19:00",
  location: "12 Orchard Road",
  plusOnes: "0",
  askEmail: true,
} as const;

function suffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function openShare(hostPage: Page) {
  await hostPage.goto(`${hostPage.url().replace(/\/share$/, "")}/share`);
  await expect(hostPage.getByRole("heading", { name: "Custom link" })).toBeVisible();
}

async function saveCustom(hostPage: Page, value: string) {
  await hostPage.getByRole("textbox", { name: "Custom link" }).fill(value);
  await hostPage.getByRole("button", { name: "Save", exact: true }).click();
}

test("a custom link opens the page beside the random one, and the host's pages show it", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "custom", EVENT);
  const random = host.link;
  const manage = host.page.url();
  const custom = `adas-birthday-${suffix()}`;
  const customUrl = random.replace(/\/e\/.*$/, `/e/${custom}`);

  await openShare(host.page);
  await expect(host.page.getByText("Anyone can guess a custom link. The random link stays known only to those you share it with.")).toBeVisible();
  await expect(host.page.getByText("Reset retires the custom link too.")).toBeVisible();
  await saveCustom(host.page, custom);
  await expect(host.page.getByText(customUrl, { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(host.page.getByRole("button", { name: "Copy custom link" })).toBeVisible();
  await expect(host.page.getByRole("button", { name: "Remove" })).toBeVisible();

  await page.goto(`/e/${custom}`);
  await expect(page.getByRole("heading", { name: "Ada’s birthday" })).toBeVisible();
  // Opened at the custom link, nothing the visitor can read holds the random one, the private link.
  const randomSlug = random.replace(/^.*\/e\//, "");
  expect(await page.content()).not.toContain(randomSlug);
  const calendar = await request.get(`/e/${custom}/calendar.ics`);
  expect(calendar.status()).toBe(200);
  expect(calendar.headers()["content-disposition"]).toBe(`attachment; filename="${custom}.ics"`);
  expect(await calendar.text()).not.toContain(randomSlug);
  await page.goto(random);
  await expect(page.getByRole("heading", { name: "Ada’s birthday" })).toBeVisible();
  // The report page answers at the custom link too, and the page's footer points at it.
  await page.goto(`/e/${custom}`);
  await page.getByRole("link", { name: "Report this event" }).click();
  await expect(page).toHaveURL(new RegExp(`/e/${custom}/report$`));
  await expect(page.getByRole("heading", { name: /Report/ })).toBeVisible();
  expect(await page.content()).not.toContain(randomSlug);
  await page.getByLabel("What’s wrong with this page?").fill("This page is a test report, long enough to be sent.");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Thank you. Your report has reached the operator of this instance.")).toBeVisible({ timeout: 15_000 });

  await host.page.goto(manage);
  await expect(host.page.getByText(customUrl, { exact: true })).toBeVisible();
  await host.context.close();
});

test("a link typed in capitals is saved in lowercase, and the field can be emptied to remove it", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "custom-case", EVENT);
  const word = suffix();
  await openShare(host.page);
  await saveCustom(host.page, `ADAS-Birthday-${word}`);
  await expect(host.page.getByRole("textbox", { name: "Custom link" })).toHaveValue(`adas-birthday-${word}`, { timeout: 15_000 });
  await expect(host.page.getByText(new RegExp(`/e/adas-birthday-${word}$`))).toBeVisible();

  await host.page.getByRole("textbox", { name: "Custom link" }).fill("");
  await host.page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(host.page.getByRole("status")).toHaveText("Removed.", { timeout: 15_000 });
  await expect(host.page.getByRole("textbox", { name: "Custom link" })).toHaveValue("");
  await expect(host.page.getByText(host.link, { exact: true })).toBeVisible();
  await expect(host.page.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await host.context.close();
});

test("another event cannot take a link that is in use, and a link of the wrong shape is refused", async ({ browser, request }) => {
  test.slow();
  const first = await createPublished(browser, request, "custom-first", EVENT);
  const second = await createPublished(browser, request, "custom-second", EVENT);
  const custom = `shared-name-${suffix()}`;

  await openShare(first.page);
  await saveCustom(first.page, custom);
  await expect(first.page.getByRole("button", { name: "Remove" })).toBeVisible({ timeout: 15_000 });

  await openShare(second.page);
  await saveCustom(second.page, custom);
  await expect(second.page.getByText("That link is taken.")).toBeVisible({ timeout: 15_000 });
  for (const refused of ["ab", "-abc", "abc-", "a--bc", "a".repeat(41), "café-party"]) {
    await openShare(second.page);
    await expect(second.page.getByText("Use 3 to 40 lowercase letters, digits and hyphens.")).toHaveCount(0);
    await saveCustom(second.page, refused);
    await expect(second.page.getByText("Use 3 to 40 lowercase letters, digits and hyphens.")).toBeVisible({ timeout: 15_000 });
  }
  await expect(second.page.getByRole("button", { name: "Remove" })).toHaveCount(0);
  // Remove on the first event also shows the random link while a custom one is set, and clears a refusal.
  await expect(first.page.getByText("The random link still works:")).toBeVisible();
  await first.page.getByRole("textbox", { name: "Custom link" }).fill("x");
  await first.page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(first.page.getByText("Use 3 to 40 lowercase letters, digits and hyphens.")).toBeVisible({ timeout: 15_000 });
  await first.page.getByRole("button", { name: "Remove" }).click();
  await expect(first.page.getByRole("status")).toHaveText("Removed.", { timeout: 15_000 });
  await expect(first.page.getByText("Use 3 to 40 lowercase letters, digits and hyphens.")).toHaveCount(0);
  await first.context.close();
  await second.context.close();
});

test("changing the custom link retires the old one", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "custom-change", EVENT);
  const old = `old-name-${suffix()}`;
  const next = `new-name-${suffix()}`;
  await openShare(host.page);
  await saveCustom(host.page, old);
  await expect(host.page.getByText(new RegExp(`/e/${old}$`))).toBeVisible({ timeout: 15_000 });
  await saveCustom(host.page, next);
  await expect(host.page.getByText(new RegExp(`/e/${next}$`))).toBeVisible({ timeout: 15_000 });

  await page.goto(`/e/${old}`);
  await expect(page.getByRole("heading", { name: "This link is no longer valid" })).toBeVisible();
  await page.goto(`/e/${next}`);
  await expect(page.getByRole("heading", { name: "Ada’s birthday" })).toBeVisible();
  await page.goto(host.link);
  await expect(page.getByRole("heading", { name: "Ada’s birthday" })).toBeVisible();

  // A retired link is not given out again, not even to the event that retired it.
  await saveCustom(host.page, old);
  await expect(host.page.getByText("That link is taken.")).toBeVisible({ timeout: 15_000 });
  await host.context.close();
});

test("an announcement's reminder draft and the guests' mail carry the custom path", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "custom-mail", EVENT);
  const custom = `mail-name-${suffix()}`;
  await openShare(host.page);
  await saveCustom(host.page, custom);
  await expect(host.page.getByText(new RegExp(`/e/${custom}$`))).toBeVisible({ timeout: 15_000 });

  const guest = newHost("custom-guest");
  const context = await browser.newContext();
  const guestPage = await context.newPage();
  await guestPage.goto(host.link);
  await guestPage.getByRole("button", { name: "Going" }).click();
  await guestPage.getByLabel("Your name").fill("Priya Nair");
  await guestPage.getByLabel("Email").fill(guest.email);
  await guestPage.getByRole("button", { name: "Send RSVP" }).click();
  await expect(guestPage.getByText(`We’ll reach you at ${guest.email}.`)).toBeVisible({ timeout: 15_000 });

  await host.page.goto(host.page.url().replace(/\/share$/, "/announcements"));
  await host.page.getByRole("button", { name: "Send a reminder now" }).click();
  const message = host.page.getByLabel("Message");
  await expect(message).toHaveValue(/Ada’s birthday/);
  expect(await message.inputValue()).toMatch(new RegExp(`/e/${custom}\\b`));
  await host.page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(message).toHaveValue("", { timeout: 15_000 });
  await expect.poll(() => mailCountTo(request, guest.email), { timeout: 30_000, message: `an email to ${guest.email}` }).toBe(1);
  expect(await latestMailTo(request, guest.email)).toMatch(new RegExp(`/e/${custom}\\b`));

  await context.close();
  await host.context.close();
});

test("resetting the link retires both links and clears the field", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "custom-reset", EVENT);
  const random = host.link;
  const custom = `reset-name-${suffix()}`;
  await openShare(host.page);
  await saveCustom(host.page, custom);
  await expect(host.page.getByText(new RegExp(`/e/${custom}$`))).toBeVisible({ timeout: 15_000 });

  await host.page.getByRole("button", { name: "Reset the link" }).click();
  await host.page.getByRole("button", { name: "Reset it" }).click();
  await expect(host.page.getByText(random, { exact: true })).toHaveCount(0, { timeout: 15_000 });
  await expect(host.page.getByRole("textbox", { name: "Custom link" })).toHaveValue("");

  for (const gone of [random, `/e/${custom}`]) {
    await page.goto(gone);
    await expect(page.getByRole("heading", { name: "This link is no longer valid" })).toBeVisible();
  }
  await host.context.close();
});
