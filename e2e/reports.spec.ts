import { createDraft, createPublished } from "./events";
import { MAILPIT, OPERATOR, PASSWORD, signIn } from "./hosts";
import { clientAddress, expect, expectNotFoundAsSent, test, type APIRequestContext, type Browser, type Page } from "./test";

// Ticket 02: a guest reports an event page from its footer, and the operator reads the report on
// /instance/reports and by email, deletes the event or marks it handled. `app` runs with
// RATE_LIMIT_REPORT=5/1m. The operator's account is shared by every spec, and the mobile and
// desktop projects send reports at once, so each test finds its own report by words only it uses,
// in the inbox and in Mailpit alike.

const footer = (page: Page) => page.getByRole("contentinfo");

// A reason of at least 20 characters that no other test (or run) wrote.
function reasonFor(label: string) {
  return `This page is not what it says it is (${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}).`;
}

// The operator on a device of their own, on the reports page.
async function operatorOnReports(browser: Browser) {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
  const page = await context.newPage();
  await signIn(page, OPERATOR.email, PASSWORD);
  await expect(page.getByRole("link", { name: "Instance settings" })).toBeVisible({ timeout: 15_000 });
  await page.goto("/instance/reports");
  await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
  return { context, page };
}

// One report in the inbox, found by its reason.
const inbox = (page: Page, reason: string) => page.getByRole("listitem").filter({ hasText: reason });

async function sendReport(page: Page, link: string, reason: string, contact?: string, viaFooter = true) {
  if (viaFooter) {
    await page.goto(link);
    await footer(page).getByRole("link", { name: "Report this event" }).click();
  } else {
    await page.goto(`${link}/report`);
  }
  await page.getByLabel("What’s wrong with this page?").fill(reason);
  if (contact) await page.getByLabel("Your email (optional)").fill(contact);
  await page.getByRole("button", { name: "Send report" }).click();
}

// The text of the email to the operator that carries this reason.
async function operatorMailAbout(request: APIRequestContext, reason: string): Promise<string> {
  let text = "";
  await expect
    .poll(
      async () => {
        const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${OPERATOR.email}`, limit: "200" } });
        const { messages } = (await search.json()) as { messages: { ID: string }[] };
        for (const { ID } of messages) {
          const { Text } = (await (await request.get(`${MAILPIT}/api/v1/message/${ID}`)).json()) as { Text: string };
          if (Text.includes(reason)) {
            text = Text;
            return true;
          }
        }
        return false;
      },
      { timeout: 20_000, message: "the report's email to the operator" },
    )
    .toBe(true);
  return text;
}

test("a guest reports an event from its footer, and the operator reads it, by email and in the inbox, and marks it handled", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "report-handled", { title: "Ada’s birthday", start: "2027-03-06T19:00" });
  const reason = reasonFor("handled");
  const contact = `reporter-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await sendReport(page, host.link, reason, contact);
  await expect(page.getByText("Thank you. Your report has reached the operator of this instance.")).toBeVisible();
  await page.getByRole("link", { name: "Back to the event page" }).click();
  await expect(page).toHaveURL(new URL(host.link).pathname);

  const mail = await operatorMailAbout(request, reason);
  expect(mail).toContain("Ada’s birthday");
  expect(mail).toContain(reason);
  expect(mail).toContain(contact);
  expect(mail).toContain(new URL(host.link).pathname);
  expect(mail).toContain("/instance/reports");

  const operator = await operatorOnReports(browser);
  const report = inbox(operator.page, reason);
  await expect(report.getByRole("link", { name: "Ada’s birthday" })).toHaveAttribute("href", new URL(host.link).pathname);
  await expect(report.getByRole("link", { name: contact })).toHaveAttribute("href", `mailto:${contact}`);
  await expect(report.getByText("Handled", { exact: true })).toHaveCount(0);

  await operator.page.goto("/instance");
  await expect(operator.page.getByRole("link", { name: /^Reports \(\d+\)$/ })).toBeVisible();
  await operator.page.getByRole("link", { name: /^Reports/ }).click();

  await report.getByRole("button", { name: "Mark handled" }).click();
  await expect(report.getByText("Handled", { exact: true })).toBeVisible();
  await expect(report.getByRole("button", { name: "Mark handled" })).toHaveCount(0);
  await expect(report.getByRole("button", { name: "Delete event" })).toHaveCount(0);
  await operator.context.close();
  await host.context.close();
});

test("the operator deletes a reported event from the inbox: its link says it was deleted, and the report says so", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "report-deleted", { title: "Grace’s reunion", start: "2027-04-10T18:00" });
  const reason = reasonFor("deleted");
  await sendReport(page, host.link, reason);
  await expect(page.getByText("Thank you. Your report has reached the operator of this instance.")).toBeVisible();

  const operator = await operatorOnReports(browser);
  const report = inbox(operator.page, reason);
  await report.getByRole("button", { name: "Delete event" }).click();
  const dialog = operator.page.getByRole("alertdialog");
  await expect(dialog.getByText("The event, its guest list and everything else about it will be deleted.")).toBeVisible();
  await dialog.getByRole("button", { name: "Delete event" }).click();
  await expect(report.getByText("Event deleted")).toBeVisible();
  await expect(report.getByText("Handled", { exact: true })).toBeVisible();
  await expect(report.getByRole("link", { name: "Grace’s reunion" })).toHaveCount(0);
  await expect(report.getByRole("button", { name: "Delete event" })).toHaveCount(0);

  await page.goto(host.link);
  await expect(page.getByText("This event has been deleted.")).toBeVisible();
  await operator.context.close();
  await host.context.close();
});

test("a draft's page, seen by its host, has no report link, and nobody can open its report page", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "report-draft", { title: "Not yet", start: "2027-05-01T12:00" });
  // A second event of the same host, left as a draft.
  const draftLink = await createDraft(host.page, { title: "Still a draft", start: "2027-05-02T12:00" });
  await host.page.goto(draftLink);
  await expect(host.page.getByRole("heading", { name: "Still a draft" })).toBeVisible();
  await expect(footer(host.page).getByRole("link", { name: "Privacy policy" })).toBeVisible();
  await expect(footer(host.page).getByRole("link", { name: "Report this event" })).toHaveCount(0);
  await expectNotFoundAsSent(await page.goto(`${draftLink}/report`));

  // A published event's page has it, and an address nothing lives at has no report page.
  await page.goto(host.link);
  await expect(footer(page).getByRole("link", { name: "Report this event" })).toBeVisible();
  await expectNotFoundAsSent(await page.goto("/e/nosuchlink/report"));
  await host.context.close();
});

test("a reason of ten characters is refused under its field, and what was typed stays", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "report-short", { title: "Short reasons", start: "2027-06-01T12:00" });
  await sendReport(page, host.link, "Too short.", "reporter@example.com");
  await expect(page.getByText("Tell us a little more: at least 20 characters.")).toBeVisible();
  await expect(page.getByLabel("What’s wrong with this page?")).toHaveValue("Too short.");
  await expect(page.getByLabel("Your email (optional)")).toHaveValue("reporter@example.com");
  await expect(page.getByText("Thank you.")).toHaveCount(0);
  await host.context.close();
});

test("the sixth report from one client in a minute is refused as too fast", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "report-fast", { title: "Many reports", start: "2027-07-01T12:00" });
  for (let sent = 1; sent <= 5; sent++) {
    await sendReport(page, host.link, reasonFor(`fast ${sent}`), undefined, sent === 1);
    await expect(page.getByText("Thank you. Your report has reached the operator of this instance.")).toBeVisible();
  }
  await sendReport(page, host.link, reasonFor("fast 6"), undefined, false);
  await expect(page.getByText("You’re going too fast. Try again shortly.")).toBeVisible();
  await expect(page.getByText("Thank you.")).toHaveCount(0);
  await host.context.close();
});
