import { expect, type APIRequestContext, type Browser, type Locator, type Page } from "@playwright/test";
import { signUpVerified } from "./hosts";

export type QuestionFields = {
  prompt: string;
  type?: "text" | "choice" | "multiple" | "yesNo";
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
  // The Guests group's Capacity; no capacity when left out.
  capacity?: string;
  // The Guests group's "Approve each guest before they’re on the list"; off when left out.
  approval?: boolean;
  // Email "Optional", which is what asking for one meant before it could be required.
  askEmail?: boolean;
  // The Contact details choices; Don't ask when left out.
  email?: "optional" | "required";
  phone?: "optional" | "required";
  // "Check the email with a code", which the form offers once it asks for an email.
  verifyEmail?: boolean;
  // Reminders are on for a new event; false turns them off.
  reminders?: boolean;
  questions?: QuestionFields[];
  // A theme knob rather than a field of the form: createPublished sets it in the Design drawer.
  layout?: "Broadsheet" | "Thread";
};

// The event form's approval setting, in its Guests group.
export const APPROVAL = "Approve each guest before they’re on the list";

// Fills the questions editor, in the Settings sheet, which saves the list as it changes.
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

// The editor (M4 ticket 05): a new event opens as its invitation at /events/<id>, edited in place.
// Each piece is saved as it is made; the top bar's status counts the saves that came back saved,
// so a step waits for its own save rather than an earlier one's "Saved".
const saveStatus = (page: Page) => page.locator('[data-slot="save-status"]');
const savesSoFar = async (page: Page) => Number((await saveStatus(page).getAttribute("data-saves")) ?? 0);

// Runs a change in the editor and waits until it is saved.
export async function savedAfter(page: Page, change: () => Promise<void>) {
  const before = await savesSoFar(page);
  await change();
  await expect.poll(() => savesSoFar(page), { timeout: 15_000, message: "the editor's save" }).toBeGreaterThan(before);
  await expect(saveStatus(page)).toHaveAttribute("data-status", "saved");
}

// Types the title on the invitation, and finishes it with Enter.
export async function typeTitle(page: Page, title: string) {
  await savedAfter(page, async () => {
    const field = page.getByRole("textbox", { name: "Event title" });
    await field.fill(title);
    await field.press("Enter");
  });
}

// One of the details' sheets, opened from its row, filled, and done.
async function detailSheet(page: Page, row: "When" | "Where" | "About", fill: (sheet: Locator) => Promise<void>) {
  await page.getByRole("button", { name: new RegExp(`^${row}:`) }).click();
  const sheet = page.getByRole("dialog", { name: row });
  await savedAfter(page, async () => {
    await fill(sheet);
    await sheet.getByRole("button", { name: "Done" }).click();
  });
  await expect(sheet).toBeHidden();
}

export async function setWhen(page: Page, when: { start: string; end?: string; allDay?: boolean; timeZone?: string }) {
  await detailSheet(page, "When", async (sheet) => {
    if (when.allDay !== undefined) await sheet.getByLabel("All day").setChecked(when.allDay);
    await sheet.getByLabel("Starts").fill(when.start);
    await sheet.getByLabel("Ends").fill(when.end ?? "");
    await sheet.getByLabel("Time zone").selectOption(when.timeZone ?? "Asia/Singapore");
  });
}

export async function setWhere(page: Page, location: string) {
  await detailSheet(page, "Where", (sheet) => sheet.getByLabel("Where").fill(location));
}

export async function setAbout(page: Page, description: string) {
  await detailSheet(page, "About", (sheet) => sheet.getByLabel("Description").fill(description));
}

// The Settings sheet, changed and closed, which saves what was changed.
export async function editSettings(page: Page, change: (sheet: Locator) => Promise<void>) {
  await page.getByRole("navigation", { name: "Design the invitation" }).getByRole("button", { name: "Settings" }).click();
  const sheet = page.getByRole("dialog", { name: "Settings" });
  await savedAfter(page, async () => {
    await change(sheet);
    await sheet.getByRole("button", { name: "Close" }).click();
  });
  await expect(sheet).toBeHidden();
}

// More, with the 0.4 manage page's links and actions.
export async function openMore(page: Page) {
  await page.getByRole("button", { name: "More" }).click();
  const sheet = page.getByRole("dialog", { name: "More" });
  await expect(sheet).toBeVisible();
  return sheet;
}

// The event's link, which Preview opens.
export async function eventLinkIn(page: Page) {
  return (await page.getByRole("link", { name: "Preview" }).getAttribute("href"))!;
}

// Publishes from the editor's top bar, which opens the share page, and goes back to the editor.
export async function publishInEditor(page: Page) {
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  const editor = page.url();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}\/share$/, { timeout: 15_000 });
  await page.goto(editor);
}

// Shared steps for tests that need an event. The host must already be signed in and verified.
// New event opens the editor, the event's details are filled in on the invitation and in its
// sheets, and the settings in the Settings sheet, under the labels the 0.4 form gave them. The
// page is left on the editor, whose address is the event's own host page.
export async function createDraft(page: Page, fields: DraftFields) {
  await page.goto("/events/new");
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await typeTitle(page, fields.title);
  await setWhen(page, { start: fields.start, end: fields.end });
  if (fields.location) await setWhere(page, fields.location);
  if (fields.description) await setAbout(page, fields.description);
  const email = fields.email ?? (fields.askEmail ? "optional" : undefined);
  const settings =
    fields.plusOnes ||
    fields.requirePlusOneNames ||
    fields.capacity ||
    fields.approval ||
    email ||
    fields.phone ||
    fields.verifyEmail ||
    fields.reminders === false ||
    fields.questions;
  if (settings) {
    await editSettings(page, async (sheet) => {
      if (fields.plusOnes) await sheet.getByLabel("Plus-ones per guest").selectOption(fields.plusOnes);
      if (fields.requirePlusOneNames) await sheet.getByLabel("Ask for each plus-one’s name").check();
      if (fields.capacity) await sheet.getByRole("group", { name: "Guests", exact: true }).getByLabel("Capacity").fill(fields.capacity);
      if (fields.approval) await sheet.getByRole("group", { name: "Guests", exact: true }).getByLabel(APPROVAL).check();
      const contact = sheet.getByRole("group", { name: "Contact details" });
      if (email) await contact.getByLabel("Email", { exact: true }).selectOption(email);
      if (fields.phone) await contact.getByLabel("Phone number", { exact: true }).selectOption(fields.phone);
      if (fields.verifyEmail) await contact.getByLabel("Check the email with a code").check();
      if (fields.reminders === false) await sheet.getByLabel("Remind guests by email (a week before to Maybe, the day before to Going)").uncheck();
      if (fields.questions) await addQuestions(page, fields.questions);
    });
  }
  return eventLinkIn(page);
}

// A host of their own, signed up and verified, with one published event. Guest tests drive the
// event link from the test's own page, so they run at the project's viewport.
export async function createPublished(browser: Browser, request: APIRequestContext, label: string, fields: DraftFields) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const { name, email } = await signUpVerified(page, request, label);
  const link = await createDraft(page, fields);
  await publishInEditor(page);
  if (fields.layout) await chooseLayout(page, link, fields.layout);
  return { context, page, link, name, email };
}

// The layout is a theme knob too, chosen in the drawer's Layout row. The page the host is sent
// back to is the manage page, where they were.
export async function chooseLayout(page: Page, link: string, layout: "Poster" | "Broadsheet" | "Thread") {
  const manage = page.url();
  await page.goto(link);
  await page.getByRole("button", { name: "Design" }).click();
  const drawer = page.getByRole("dialog", { name: "Design" });
  await drawer.getByRole("group", { name: "Layout" }).getByRole("radio", { name: new RegExp(`^${layout}`) }).check();
  await expect(drawer.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-layout]")).toHaveAttribute("data-layout", layout.toLowerCase());
  await page.goto(manage);
}
