import { expect, type Page } from "./test";

// The Poster layout's reply (M4 ticket 03): the bar fixed to the foot of the screen, with Going,
// Maybe and Can't go, or once the guest has answered, what they answered and Change; and the sheet
// the steps and the confirmation rise in. A guest's answer leaves the confirmation open in the
// sheet, over the page; a guest coming back finds their answer in the bar, and Change opens it.
export const replyBar = (page: Page) => page.locator('[data-slot="rsvp-bar"]');
export const rsvpSheet = (page: Page) => page.getByRole("dialog", { name: "Your RSVP" });

// Opens the guest's saved answer from the bar, as a guest coming back does.
export async function openMyReply(page: Page) {
  await replyBar(page).getByRole("button", { name: "Change", exact: true }).click();
  await expect(rsvpSheet(page)).toBeVisible();
}

// Closes the sheet, once the guest has read their confirmation, back to the page under it.
export async function closeReply(page: Page) {
  const sheet = rsvpSheet(page);
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
}
