import { expectNoSeriousViolations } from "./axe";
import { createPublished, openSettings, savedAfter } from "./events";
import { expect, test, type Locator, type Page } from "./test";

// M8 ticket 10: the album vote, a module of its own (src/voting). The host starts it, closes it,
// reopens it and turns it off from the Voting block in the editor's Settings, below the album's;
// turning it off is confirmed with the number of votes it deletes. It cannot start before the
// album opens, at the start of the event.

const PAST = { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" };
const AHEAD = { title: "Ada’s garden party", start: "2027-11-20T16:00", plusOnes: "0" };

const votingBlock = (sheet: Locator) => sheet.locator('[data-slot="voting-block"]');

// A press in the block, saved through the editor's save status, and the state it leaves.
async function press(page: Page, block: Locator, name: string, state: "off" | "open" | "closed") {
  await savedAfter(page, () => block.getByRole("button", { name, exact: true }).click());
  await expect(block).toHaveAttribute("data-state", state);
}

test("the host starts, closes, reopens and turns off the album vote from Settings", async ({ browser, request }) => {
  const host = await createPublished(browser, request, "album-voting", PAST);
  const sheet = await openSettings(host.page);
  const block = votingBlock(sheet);
  await expect(sheet.getByRole("group", { name: "Voting", exact: true })).toHaveAttribute("data-slot", "voting-block");
  await expect(block).toHaveAttribute("data-state", "off");
  await expect(block).toContainText("Guests pick their favourite photos and videos. Each person has one vote in each award.");

  await press(host.page, block, "Start voting", "open");
  await expect(block).toContainText("Voting is open");
  await expectNoSeriousViolations(host.page, "the Settings sheet with the vote open");

  await press(host.page, block, "Close voting", "closed");
  await expect(block).toContainText("Voting closed");

  await press(host.page, block, "Reopen voting", "open");
  await expect(block).toContainText("Voting is open");

  // Turn off asks first, giving the number of votes it deletes; Never mind keeps the vote.
  await block.getByRole("button", { name: "Turn off voting" }).click();
  const confirm = host.page.getByRole("alertdialog", { name: "Turn off voting?" });
  await expect(confirm).toContainText("Nobody has voted yet. The awards and settings stay.");
  await confirm.getByRole("button", { name: "Never mind" }).click();
  await expect(confirm).toBeHidden();
  await expect(block).toHaveAttribute("data-state", "open");

  await block.getByRole("button", { name: "Turn off voting" }).click();
  await savedAfter(host.page, () => confirm.getByRole("button", { name: "Turn it off" }).click());
  await expect(confirm).toBeHidden();
  await expect(block).toHaveAttribute("data-state", "off");
  await expect(block.getByRole("button", { name: "Start voting" })).toBeEnabled();

  // The vote's state is the event's, not the sheet's: it is there after a reload.
  await press(host.page, block, "Start voting", "open");
  await host.page.reload();
  await expect(votingBlock(await openSettings(host.page))).toHaveAttribute("data-state", "open");
  await host.context.close();
});

test("voting cannot start before the album opens", async ({ browser, request }) => {
  const host = await createPublished(browser, request, "album-voting-ahead", AHEAD);
  const block = votingBlock(await openSettings(host.page));
  await expect(block).toHaveAttribute("data-state", "off");
  const start = block.getByRole("button", { name: "Start voting" });
  await expect(start).toBeDisabled();
  await expect(start).toHaveAccessibleDescription("Voting can start once the album opens, at the start of the event.");
  await host.context.close();
});
