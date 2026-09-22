import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { signUpVerified } from "./hosts";

export type QuestionFields = {
  prompt: string;
  type?: "text" | "choice" | "yesNo";
  required?: boolean;
  choices?: string;
};

export type DraftFields = {
  title: string;
  start: string;
  end?: string;
  location?: string;
  description?: string;
  plusOnes?: string;
  requirePlusOneNames?: boolean;
  askEmail?: boolean;
  questions?: QuestionFields[];
};

// Fills the questions editor, which is a list the host builds before saving the event.
export async function addQuestions(page: Page, questions: QuestionFields[]) {
  for (const [index, question] of questions.entries()) {
    await page.getByRole("button", { name: "Add a question" }).click();
    const row = page.locator("form ol > li").nth(index);
    await page.getByLabel(`Question ${index + 1}`, { exact: true }).fill(question.prompt);
    if (question.type) await page.getByLabel(`Question ${index + 1} type`).selectOption(question.type);
    if (question.required) await row.getByRole("checkbox").check();
    if (question.choices) await page.getByLabel(`Question ${index + 1} choices`).fill(question.choices);
  }
}

// Shared steps for tests that need an event. The host must already be signed in and verified.
export async function createDraft(page: Page, fields: DraftFields) {
  await page.goto("/events/new");
  await page.getByLabel("Title").fill(fields.title);
  await page.getByLabel("Starts").fill(fields.start);
  if (fields.end) await page.getByLabel("Ends").fill(fields.end);
  await page.getByLabel("Time zone").selectOption("Asia/Singapore");
  if (fields.location) await page.getByLabel("Where").fill(fields.location);
  if (fields.description) await page.getByLabel("Description").fill(fields.description);
  if (fields.plusOnes) await page.getByLabel("Plus-ones per guest").selectOption(fields.plusOnes);
  if (fields.requirePlusOneNames) await page.getByLabel("Ask for each plus-one’s name").check();
  if (fields.askEmail) await page.getByLabel("Ask guests for an email address").check();
  if (fields.questions) await addQuestions(page, fields.questions);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  return (await page.getByText(/^https?:\/\/\S+\/e\/[A-Za-z0-9]{10}$/).textContent())!.trim();
}

// A host of their own, signed up and verified, with one published event. Guest tests drive the
// event link from the test's own page, so they run at the project's viewport.
export async function createPublished(browser: Browser, request: APIRequestContext, label: string, fields: DraftFields) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signUpVerified(page, request, label);
  const link = await createDraft(page, fields);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();
  return { context, page, link };
}
