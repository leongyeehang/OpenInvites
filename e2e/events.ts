import { expect, type Page } from "@playwright/test";

// Shared steps for tests that need an event. The host must already be signed in and verified.
export async function createDraft(
  page: Page,
  fields: { title: string; start: string; end?: string; location?: string; description?: string },
) {
  await page.goto("/events/new");
  await page.getByLabel("Title").fill(fields.title);
  await page.getByLabel("Starts").fill(fields.start);
  if (fields.end) await page.getByLabel("Ends").fill(fields.end);
  await page.getByLabel("Time zone").selectOption("Asia/Singapore");
  if (fields.location) await page.getByLabel("Where").fill(fields.location);
  if (fields.description) await page.getByLabel("Description").fill(fields.description);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  return (await page.getByText(/^https?:\/\/\S+\/e\/[A-Za-z0-9]{10}$/).textContent())!.trim();
}
