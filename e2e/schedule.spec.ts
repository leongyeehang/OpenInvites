import { expectNoSeriousViolations } from "./axe";
import { createDraft, saveStatus, setSchedule } from "./events";
import { signUpVerified } from "./hosts";
import { expect, test, type Page } from "./test";

// M6 ticket 01: the host lists the day's timed items in the editor's Schedule sheet, opened from
// the details list. They are saved as a whole and kept in day-and-time order, whatever order they
// were typed in; a refusal names the row and keeps the sheet open.

async function openSchedule(page: Page) {
  await page.getByRole("button", { name: /^Schedule:/ }).click();
  const sheet = page.getByRole("dialog", { name: "Schedule" });
  await expect(sheet).toBeVisible();
  return sheet;
}

test("the host lists the schedule out of order, it is kept in order, and a mistake is refused by its row", async ({ page, request }) => {
  test.slow();
  await signUpVerified(page, request, "schedule-host");
  await createDraft(page, { title: "Ada’s wedding", start: "2027-05-08T15:00", end: "2027-05-09T13:00" });
  await expect(page.getByRole("button", { name: /^Schedule:/ })).toHaveAccessibleName("Schedule: Add a schedule");

  // Three items, typed out of order: the next morning's brunch first, then the cake before the
  // dinner. The two on the event's day keep the day a new row starts on.
  await setSchedule(
    page,
    [
      { day: "2027-05-09", start: "10:00", title: "Brunch", place: "The terrace" },
      { start: "21:00", title: "Cake" },
      { start: "19:00", end: "21:00", title: "Dinner", place: "The garden", note: "Jackets for the evening" },
    ],
    "reload",
  );
  await expect(page.getByRole("button", { name: /^Schedule:/ })).toHaveAccessibleName("Schedule: 3 items");

  // Reopened, the items are in day-and-time order, each as typed, with the freshness chosen.
  const sheet = await openSchedule(page);
  await expect(sheet.locator("ol > li")).toHaveCount(3);
  for (const [index, title] of ["Dinner", "Cake", "Brunch"].entries()) {
    await expect(sheet.getByLabel(`Title ${index + 1}`, { exact: true })).toHaveValue(title);
  }
  await expect(sheet.getByLabel("Day 1", { exact: true })).toHaveValue("2027-05-08");
  await expect(sheet.getByLabel("Day 2", { exact: true })).toHaveValue("2027-05-08");
  await expect(sheet.getByLabel("Day 3", { exact: true })).toHaveValue("2027-05-09");
  await expect(sheet.getByLabel("Start time 1", { exact: true })).toHaveValue("19:00");
  await expect(sheet.getByLabel("End time 1 (optional)")).toHaveValue("21:00");
  await expect(sheet.getByLabel("Place 1 (optional)")).toHaveValue("The garden");
  await expect(sheet.getByLabel("Note 1 (optional)")).toHaveValue("Jackets for the evening");
  await expect(sheet.getByLabel("End time 2 (optional)")).toHaveValue("");
  await expect(sheet.getByRole("radio", { name: "Only when the page is opened" })).toBeChecked();
  await expect(sheet.getByRole("radio", { name: "Refresh every minute while the event is on" })).not.toBeChecked();
  await expectNoSeriousViolations(page, "the schedule's sheet");

  // The cake ending before it starts is refused, naming its row, and the sheet stays open.
  await sheet.getByLabel("End time 2 (optional)").fill("20:30");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Item 2 needs its end time to be later than its start.");
  await expect(saveStatus(page)).toHaveAttribute("data-status", "failed");
  await expect(sheet).toBeVisible();

  // So is the brunch without its title.
  await sheet.getByLabel("End time 2 (optional)").fill("");
  await sheet.getByLabel("Title 3", { exact: true }).fill("");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Item 3 needs a title.");
  await expect(sheet).toBeVisible();

  // Closed without saving, the schedule is as it was.
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("button", { name: /^Schedule:/ })).toHaveAccessibleName("Schedule: 3 items");
  await openSchedule(page);
  await expect(sheet.getByLabel("Title 3", { exact: true })).toHaveValue("Brunch");
});
