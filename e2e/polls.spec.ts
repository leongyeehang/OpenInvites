import { expectNoSeriousViolations } from "./axe";
import { eventLinkIn, publishInEditor, savedAfter, typeTitle } from "./events";
import { latestMailTo, newHost, signUpVerified } from "./hosts";
import { expect, test, type Browser, type Page } from "./test";

// M4 ticket 09: a host without a fixed date offers candidates; guests vote Yes, If need be or No on
// each with their name; the host picks one, which becomes the date, and voters with an email are
// told. Until then, the page's When reads "Date to be decided" and the bar "Vote on a date".

const SATURDAY = "Sat, May 8, 2027 · 7:00 PM";

// Intl puts narrow spaces in times; the page's text is compared with plain ones.
const plain = (text: string) => text.replace(/[  ]/g, " ");

// The host makes a draft whose date is a poll of Saturday evening and Sunday, all day, and
// publishes it. Returns the event link.
async function pollEvent(page: Page, request: Parameters<typeof signUpVerified>[1], label: string) {
  await signUpVerified(page, request, label);
  await page.goto("/events/new");
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await typeTitle(page, "Ada’s supper");
  await page.getByRole("button", { name: /^When:/ }).click();
  const sheet = page.getByRole("dialog", { name: "When" });
  await sheet.getByRole("button", { name: "Not sure yet? Let guests vote" }).click();
  await sheet.getByLabel("Date 1", { exact: true }).fill("2027-05-08");
  await sheet.getByLabel("Start time 1 (optional)").fill("19:00");
  await sheet.getByLabel("Date 2", { exact: true }).fill("2027-05-09");
  await savedAfter(page, () => sheet.getByRole("button", { name: "Done" }).click());
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("button", { name: /^When:/ })).toHaveAccessibleName("When: Date to be decided · no votes yet");
  const link = await eventLinkIn(page);
  await publishInEditor(page);
  return link;
}

async function guest(browser: Browser) {
  const context = await browser.newContext();
  return context.newPage();
}

test("guests vote on the date, one changes their votes, the host picks it, voters are told, and the reply starts from their name", async ({ page, browser, request }) => {
  test.slow();
  const link = await pollEvent(page, request, "poll-host");
  const editor = page.url();
  const priyaEmail = newHost("poll-priya").email;

  // Priya opens the invitation: no date, the candidates, and the vote in the bar.
  const priya = await guest(browser);
  await priya.goto(link);
  const when = priya.locator('[data-slot="poll"]');
  await expect(when).toContainText("Date to be decided");
  expect(plain(await when.innerText())).toContain(SATURDAY);
  await expect(priya.getByRole("button", { name: "Going" })).toHaveCount(0);
  await priya.locator('[data-slot="rsvp-bar"]').getByRole("button", { name: "Vote on a date" }).click();
  // Every date needs an answer.
  const sheet = priya.getByRole("dialog", { name: "Which dates work for you?" });
  await expect(sheet).toBeVisible();
  const saturday = sheet.getByRole("group").first();
  const sunday = sheet.getByRole("group").nth(1);
  await saturday.getByRole("radio", { name: "Yes" }).check();
  await sunday.getByRole("radio", { name: "If need be" }).check();
  await sheet.getByLabel("Your name").fill("Priya Nair");
  await sheet.getByLabel("Email (optional)").fill(priyaEmail);
  await expectNoSeriousViolations(priya, "the vote's sheet");
  await sheet.getByRole("button", { name: "Send my votes" }).click();
  await expect(sheet.getByRole("status")).toHaveText("Thanks, Priya Nair. Your votes are in.", { timeout: 15_000 });
  await expect(sheet.getByText(/\/v\//)).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();

  // Her votes come back on her device.
  await priya.reload();
  await priya.locator('[data-slot="rsvp-bar"]').getByRole("button", { name: "Change my votes" }).click();
  await expect(sheet.getByRole("group").first().getByRole("radio", { name: "Yes" })).toBeChecked();
  await expect(sheet.getByLabel("Your name")).toHaveValue("Priya Nair");
  await priya.keyboard.press("Escape");

  // Mei votes No to Saturday, then changes her mind.
  const mei = await guest(browser);
  await mei.goto(link);
  await mei.locator('[data-slot="rsvp-bar"]').getByRole("button", { name: "Vote on a date" }).click();
  const meiSheet = mei.getByRole("dialog", { name: "Which dates work for you?" });
  await meiSheet.getByRole("group").first().getByRole("radio", { name: "No" }).check();
  await meiSheet.getByRole("group").nth(1).getByRole("radio", { name: "Yes" }).check();
  await meiSheet.getByLabel("Your name").fill("Mei Tan");
  await meiSheet.getByRole("button", { name: "Send my votes" }).click();
  await expect(meiSheet.getByRole("status")).toBeVisible({ timeout: 15_000 });
  await meiSheet.getByRole("button", { name: "Close" }).click();
  await mei.reload();
  await mei.locator('[data-slot="rsvp-bar"]').getByRole("button", { name: "Change my votes" }).click();
  await meiSheet.getByRole("group").first().getByRole("radio", { name: "Yes" }).check();
  await meiSheet.getByRole("button", { name: "Send my votes" }).click();
  await expect(meiSheet.getByRole("status")).toBeVisible({ timeout: 15_000 });
  await meiSheet.getByRole("button", { name: "Close" }).click();
  await mei.reload();
  await expect(mei.locator('[data-slot="poll"]').getByText("2 yes")).toBeVisible();

  // The host sees the votes by name, and picks Saturday, which most can make.
  await page.goto(editor);
  await page.getByRole("button", { name: "When: Date to be decided · 2 votes" }).click();
  const votes = page.getByRole("dialog", { name: "When" });
  const saturdayVotes = votes.getByRole("listitem").filter({ hasText: "Most can make it" });
  await expect(saturdayVotes).toContainText("Priya Nair, Mei Tan");
  await expectNoSeriousViolations(page, "the votes in the When sheet");
  await saturdayVotes.getByRole("button", { name: /^Pick / }).click();
  await savedAfter(page, () => page.getByRole("alertdialog").getByRole("button", { name: "Pick it" }).click());
  await expect(page.getByRole("button", { name: /^When: Saturday, May 8, 2027/ })).toBeVisible({ timeout: 15_000 });

  // Priya, who gave an email, is told, with the link to reply.
  await expect.poll(async () => (await latestMailTo(request, priyaEmail)).includes("The host has picked the date for Ada’s supper"), { timeout: 20_000 }).toBe(true);
  expect(await latestMailTo(request, priyaEmail)).toContain(link);

  // The page asks for replies now, and Priya's starts from her name.
  await priya.reload();
  await expect(priya.locator('[data-slot="poll"]')).toHaveCount(0);
  await priya.getByRole("button", { name: "Going" }).click();
  await expect(priya.getByLabel("Your name")).toHaveValue("Priya Nair");

  // A sheet still open from before the pick is refused.
  await mei.locator('[data-slot="rsvp-bar"]').getByRole("button", { name: "Change my votes" }).click();
  await meiSheet.getByRole("button", { name: "Send my votes" }).click();
  await expect(meiSheet.getByRole("alert")).toHaveText("Voting on the date has closed.", { timeout: 15_000 });

  await Promise.all([priya.context().close(), mei.context().close()]);
});

test("the vote by keyboard, and in Simplified Chinese", async ({ page, browser, request }) => {
  test.slow();
  const link = await pollEvent(page, request, "poll-keys");
  const guestPage = await guest(browser);
  await guestPage.goto(link);

  // From the When row: the button opens the sheet with its heading read, and Escape gives the focus back.
  const open = guestPage.locator('[data-slot="poll"]').getByRole("button", { name: "Vote on a date" });
  await open.focus();
  await guestPage.keyboard.press("Enter");
  const sheet = guestPage.getByRole("dialog", { name: "Which dates work for you?" });
  await expect(sheet).toBeVisible();
  // The first date's first answer has the focus as it opens.
  await expect(sheet.getByRole("group").first().getByRole("radio").first()).toBeFocused();
  await guestPage.keyboard.press("Space");
  await expect(sheet.getByRole("group").first().getByRole("radio", { name: "Yes" })).toBeChecked();
  await guestPage.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(open).toBeFocused();
  await expectNoSeriousViolations(guestPage, "the guest page while the date is voted on");

  // In Simplified Chinese.
  await guestPage.getByRole("contentinfo").getByRole("form", { name: "Language" }).getByRole("button", { name: "简体中文" }).click();
  await expect(guestPage.locator("html")).toHaveAttribute("lang", "zh-Hans");
  await expect(guestPage.locator('[data-slot="poll"]')).toContainText("日期待定");
  await expect(guestPage.locator('[data-slot="rsvp-bar"]').getByRole("button", { name: "投票选日期" })).toBeVisible();
  await guestPage.context().close();
});

test("a draft becomes a poll and back, and a date set by hand replaces a poll nobody voted on", async ({ page, request }) => {
  test.slow();
  await signUpVerified(page, request, "poll-back");
  await page.goto("/events/new");
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await typeTitle(page, "Ada’s supper");

  // Too few candidates are refused beside Done.
  await page.getByRole("button", { name: /^When:/ }).click();
  const sheet = page.getByRole("dialog", { name: "When" });
  await sheet.getByRole("button", { name: "Not sure yet? Let guests vote" }).click();
  await sheet.getByLabel("Date 1", { exact: true }).fill("2027-05-08");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Offer at least two dates.");
  await sheet.getByLabel("Date 2", { exact: true }).fill("2027-05-09");
  await savedAfter(page, () => sheet.getByRole("button", { name: "Done" }).click());
  await expect(page.getByRole("button", { name: "When: Date to be decided · no votes yet" })).toBeVisible();

  // Set one date instead: the poll goes, and the event has that date.
  await page.getByRole("button", { name: /^When:/ }).click();
  await sheet.getByRole("button", { name: "Set one date instead" }).click();
  await sheet.getByLabel("Starts").fill("2027-05-08T19:00");
  await sheet.getByLabel("Time zone").selectOption("Asia/Singapore");
  await savedAfter(page, () => sheet.getByRole("button", { name: "Done" }).click());
  await expect(page.getByRole("button", { name: /^When: Saturday, May 8, 2027/ })).toBeVisible();
});
