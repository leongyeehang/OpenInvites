import { expectNoSeriousViolations } from "./axe";
import { createPublished, openMore } from "./events";
import { closeReply, openMyReply } from "./reply";
import { expect, test, type Browser, type Locator, type Page } from "./test";

// M4 ticket 04: whoever may comment may react to a comment with one of six emoji, and take it back;
// each comment shows how many gave each, and who.

const EVENT = { title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "0" };

function commentSaying(page: Page, text: string): Locator {
  return page.getByRole("listitem").filter({ hasText: text });
}

// Posts a comment on the page already open, and waits until the box has emptied.
async function comment(page: Page, text: string) {
  const box = page.getByLabel("Add a comment");
  await box.fill(text);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(box).toHaveValue("", { timeout: 15_000 });
}

// A guest of their own answers Going on the Poster, closes the confirmation and is shown the comments.
async function guestGoing(browser: Browser, link: string, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  await closeReply(page);
  await expect(page.getByLabel("Add a comment")).toBeVisible();
  return page;
}

// Gives an emoji from the add button's six, under one comment.
async function react(page: Page, under: Locator, emoji: string) {
  await under.getByRole("button", { name: "Add a reaction" }).click();
  await page.getByRole("group", { name: "React with" }).getByRole("button", { name: emoji }).click();
}

// The names under "Who reacted", for one comment.
async function whoReacted(page: Page, under: Locator) {
  await under.getByRole("button", { name: "Who reacted" }).click();
  const list = page.getByRole("dialog", { name: "Reactions" });
  await expect(list).toBeVisible();
  const text = await list.innerText();
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  return text;
}

test("guests and the host react to a comment, see each other's counts and names, and take theirs back", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "reactions", EVENT);
  const editor = host.page.url();
  await host.page.goto(host.link);
  await comment(host.page, "Welcome, everyone!");

  // Priya gives Party: a pressed button saying so, which stays across a reload.
  const priya = await guestGoing(browser, host.link, "Priya Nair");
  const atPriya = commentSaying(priya, "Welcome, everyone!");
  await react(priya, atPriya, "Party");
  const priyaParty = atPriya.getByRole("button", { name: /^Party, / });
  await expect(priyaParty).toHaveAccessibleName("Party, 1 reaction, you reacted");
  await expect(priyaParty).toHaveAttribute("aria-pressed", "true");
  await priya.reload();
  await expect(priyaParty).toHaveAccessibleName("Party, 1 reaction, you reacted", { timeout: 15_000 });

  // Mei sees it, not pressed, and who gave it; she gives it too.
  const mei = await guestGoing(browser, host.link, "Mei Tan");
  const atMei = commentSaying(mei, "Welcome, everyone!");
  const meiParty = atMei.getByRole("button", { name: /^Party, / });
  await expect(meiParty).toHaveAccessibleName("Party, 1 reaction");
  await expect(meiParty).toHaveAttribute("aria-pressed", "false");
  expect(await whoReacted(mei, atMei)).toContain("Priya Nair");
  await meiParty.click();
  await expect(meiParty).toHaveAccessibleName("Party, 2 reactions, you reacted");
  await mei.reload();
  await expect(meiParty).toHaveAccessibleName("Party, 2 reactions, you reacted", { timeout: 15_000 });

  // Pressed again, Priya's is taken back; Mei's stays.
  await priya.reload();
  await priyaParty.click();
  await expect(priyaParty).toHaveAccessibleName("Party, 1 reaction");
  await mei.reload();
  await expect(meiParty).toHaveAccessibleName("Party, 1 reaction, you reacted", { timeout: 15_000 });

  // The host reacts as the host, under their own name.
  await host.page.reload();
  await react(host.page, commentSaying(host.page, "Welcome, everyone!"), "Heart");
  await expect(commentSaying(host.page, "Welcome, everyone!").getByRole("button", { name: /^Heart, / })).toHaveAccessibleName("Heart, 1 reaction, you reacted");
  await mei.reload();
  await expect(atMei.getByRole("button", { name: /^Heart, / })).toHaveAccessibleName("Heart, 1 reaction", { timeout: 15_000 });
  expect(await whoReacted(mei, atMei)).toContain(host.name);

  // Priya's reply removed takes her reactions with it.
  await react(priya, atPriya, "Thank you");
  await expect(atPriya.getByRole("button", { name: /^Thank you, / })).toBeVisible();
  await mei.reload();
  await expect(atMei.getByRole("button", { name: /^Thank you, / })).toHaveAccessibleName("Thank you, 1 reaction", { timeout: 15_000 });
  await openMyReply(priya);
  await priya.getByRole("button", { name: "Remove my RSVP" }).click();
  await expect(priya.getByText("You’re going!")).toHaveCount(0);
  await mei.reload();
  await expect(atMei.getByRole("button", { name: /^Thank you, / })).toHaveCount(0, { timeout: 15_000 });

  // Cancelled, the event keeps its comments and reactions, and takes no more: Mei sees the counts
  // and cannot react.
  await host.page.goto(editor);
  await openMore(host.page);
  await host.page.getByRole("button", { name: "Cancel event" }).click();
  await host.page.getByRole("button", { name: "Cancel the event" }).click();
  await expect(host.page.getByText("Cancelled", { exact: true })).toBeVisible({ timeout: 15_000 });
  await mei.reload();
  await expect(atMei.getByRole("img", { name: "Party, 1 reaction, you reacted" })).toBeVisible();
  await expect(atMei.getByRole("img", { name: "Heart, 1 reaction" })).toBeVisible();
  await expect(atMei.getByRole("button", { name: "Add a reaction" })).toHaveCount(0);
  await expect(atMei.getByRole("button", { name: /^Party, / })).toHaveCount(0);

  await Promise.all([host.context.close(), priya.context().close(), mei.context().close()]);
});

// The host, who may comment on every layout without a reply, reacts by keyboard alone.
for (const layout of ["Poster", "Broadsheet", "Thread"] as const) {
  test(`reactions by keyboard, and accessible, on the ${layout}`, async ({ browser, request }) => {
    test.slow();
    const host = await createPublished(browser, request, `reactions-${layout.toLowerCase()}`, layout === "Poster" ? EVENT : { ...EVENT, layout });
    const page = host.page;
    await page.goto(host.link);
    const opened = async () => {
      if (layout === "Thread") {
        const bubble = page.locator('[data-slot="comments"]');
        if ((await bubble.getAttribute("open")) === null) await bubble.locator("summary").click();
      }
    };
    await opened();
    await comment(page, "Doors open at seven.");
    await page.reload();
    await opened();
    const under = commentSaying(page, "Doors open at seven.");

    // Enter opens the six with the first focused; Enter gives it, and the focus is back on Add.
    const add = under.getByRole("button", { name: "Add a reaction" });
    await add.focus();
    await page.keyboard.press("Enter");
    const six = page.getByRole("group", { name: "React with" });
    await expect(six.getByRole("button", { name: "Party" })).toBeFocused();
    await expectNoSeriousViolations(page, `the six reactions open, on the ${layout}`);
    await page.keyboard.press("Tab");
    await expect(six.getByRole("button", { name: "Heart" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(six).toBeHidden();
    await expect(add).toBeFocused();
    const heart = under.getByRole("button", { name: /^Heart, / });
    await expect(heart).toHaveAccessibleName("Heart, 1 reaction, you reacted");

    // Back to it with Shift+Tab, and Space takes it back; the button goes, and the focus is on Add.
    await page.keyboard.press("Shift+Tab");
    await expect(heart).toBeFocused();
    await page.keyboard.press("Space");
    await expect(heart).toHaveCount(0);
    await expect(add).toBeFocused();
    await react(page, under, "Wow");
    await expect(under.getByRole("button", { name: /^Wow, / })).toBeVisible();
    // The chip shows at once; the page drawn again with it follows, and is what is checked.
    await page.waitForLoadState("networkidle");
    await expectNoSeriousViolations(page, `a comment with a reaction, on the ${layout}`);

    await host.context.close();
  });
}
