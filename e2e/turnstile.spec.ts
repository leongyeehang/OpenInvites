import { createPublished } from "./events";
import { latestMailTo, mailCountTo, MAILPIT, newHost, OPERATOR, PASSWORD, signIn, submitSignUp } from "./hosts";
import { clientAddress, expect, scriptsNotFromTheApp, test, type APIRequestContext, type Page } from "./test";

// Ticket 09 (M3): Cloudflare Turnstile guards the email sign-up form, the RSVP form in every
// layout, and the report form. `app-social` (port 3001) runs with Cloudflare's published
// always-pass test keys: the widget is there and passes for anyone, and the server's check of each
// token is a real call to Cloudflare. `app` (port 3000) has no keys, and nothing changes there. A
// form's submit waits for the widget to pass, and Playwright's click waits for it to be enabled.
// A post with a token waits on Cloudflare's answer (five seconds at most, and slowest just after
// the container starts), so what follows one is given longer than Playwright's default.
// The guest drives the test's own page, so all of it runs at 390 pixels in the mobile project and
// at desktop width in the other.
//
// What the test keys cannot show: Cloudflare's always-pass secret accepts any token that is not
// empty, so these tests tell a form posted without a token from one posted with one, and nothing
// finer. That a token passes one check only, so that a post which spends it must wait for the
// widget to start again, and Cloudflare refusing a token, being unreachable, or answering with
// something other than a verdict, are not reached here: the verdict and those branches are unit
// tests (src/turnstile/verify.test.ts), and the reset after each post is read in the code.

const TURNSTILE_INSTANCE = "http://localhost:3001";
const CHECK_FAILED = "Please complete the check and try again.";

const botCheck = (page: Page) => page.getByRole("group", { name: "Bot check" });

// What a script posting the form without solving the check would send: the form as it is, with no
// token in it. Says how many token fields it blanked.
function blankTheToken(page: Page) {
  return page.evaluate(() => {
    const fields = document.querySelectorAll<HTMLInputElement>('input[name="cf-turnstile-response"]');
    for (const field of fields) field.value = "";
    return fields.length;
  });
}

// What a script would add to the form to pass for the code step: a code field, which the form
// holds only while a code is asked for.
function plantACode(page: Page) {
  return page.evaluate(() => {
    const code = Object.assign(document.createElement("input"), { type: "hidden", name: "code", value: "000000", id: "planted-code" });
    document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')!.form!.append(code);
  });
}

// How many emails the operator has had about reports whose reason holds these words.
async function reportMailsWith(request: APIRequestContext, words: string): Promise<number> {
  const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${OPERATOR.email}`, limit: "200" } });
  const { messages } = (await search.json()) as { messages: { ID: string }[] };
  let found = 0;
  for (const { ID } of messages) {
    const { Text } = (await (await request.get(`${MAILPIT}/api/v1/message/${ID}`)).json()) as { Text: string };
    if (Text.includes(words)) found++;
  }
  return found;
}

test.describe("on an instance whose operator has set Turnstile's keys", () => {
  test.use({ baseURL: TURNSTILE_INSTANCE });

  test("the sign-up form carries the bot check, refuses a sign-up without its token, and a host signs up past it; signing in is not checked", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(botCheck(page)).toHaveCount(0);

    await page.goto("/sign-up");
    await expect(botCheck(page)).toBeVisible();
    // Google and GitHub are not checked: their buttons work as they did.
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    const host = newHost("turnstile-signup");
    const createAccount = page.getByRole("button", { name: "Create account" });
    await expect(createAccount).toBeEnabled();
    expect(await blankTheToken(page)).toBe(1);
    await submitSignUp(page, host);
    await expect(page.getByText(CHECK_FAILED)).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up$/);

    // The widget starts again, and the sign-up goes once it has passed.
    await submitSignUp(page, host);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
    await expect(page.getByRole("banner").getByText(host.name)).toBeVisible();
  });

  test("a sign-up posted straight to the sign-up endpoint, past the form and its check, is refused", async ({ page, request }) => {
    const host = newHost("turnstile-direct");
    const response = await request.post("/api/auth/sign-up/email", { data: { name: host.name, email: host.email, password: PASSWORD } });
    expect(response.status()).toBe(403);
    // No account was made.
    await signIn(page, host.email, PASSWORD);
    await expect(page.getByText("That email and password do not match.")).toBeVisible();
  });

  test("a check that cannot load says how to get it back, and the form waits for it", async ({ page }) => {
    await page.route("https://challenges.cloudflare.com/**", (route) => route.abort());
    await page.goto("/sign-up");
    await expect(page.getByText("The check couldn’t load. Turn off your ad blocker for this page and try again.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeDisabled();
  });

  test("a check whose script never arrives says so after ten seconds, and the form waits for it", async ({ page }) => {
    // Held, as some blockers hold a request rather than refuse it.
    await page.route("https://challenges.cloudflare.com/**", () => {});
    await page.goto("/sign-up");
    const unavailable = page.getByText("The check couldn’t load. Turn off your ad blocker for this page and try again.");
    await expect(unavailable).toBeHidden();
    await expect(unavailable).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Create account" })).toBeDisabled();
  });

  test("a guest's reply sent without its token is refused, and goes once sent again", async ({ page, browser, request }) => {
    test.slow();
    const host = await createPublished(browser, request, "turnstile-poster", { rsvpStyle: "Inline", title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "1" });

    // Up to the last step, whose submit sends the reply: the check stands beside it.
    const send = page.getByRole("button", { name: "Send RSVP" });
    const answerUpToSend = async () => {
      await page.getByRole("button", { name: "Going" }).click();
      await page.getByLabel("Your name").fill("Priya Nair");
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(botCheck(page)).toBeVisible();
      await expect(send).toBeEnabled();
    };

    // Without a token, even carrying a code this event never asked for.
    await page.goto(host.link);
    await answerUpToSend();
    expect(await blankTheToken(page)).toBe(1);
    await plantACode(page);
    await send.click();
    await expect(page.getByText(CHECK_FAILED)).toBeVisible();

    // Without a token, as the form is: from the start again, so the refusal is this post's.
    await page.reload();
    await answerUpToSend();
    expect(await blankTheToken(page)).toBe(1);
    await send.click();
    await expect(page.getByText(CHECK_FAILED)).toBeVisible();

    // The widget starts again, and the reply goes once it has passed.
    await send.click();
    await expect(page.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(CHECK_FAILED)).toBeHidden();

    // The refused posts saved nothing: the host has the one reply.
    await host.page.getByRole("link", { name: "Guest list" }).click();
    await expect(host.page.getByRole("heading", { name: "Guest list" })).toBeVisible();
    await expect(host.page.getByText("1 person expected · 1 going · 0 maybe · 0 can’t go")).toBeVisible();
    await expect(host.page.getByText("Priya Nair", { exact: true })).toHaveCount(1);

    await host.context.close();
  });

  test("a guest replies on the Broadsheet past the check, then confirms the code their email was sent", async ({ page, browser, request }) => {
    test.slow();
    const host = await createPublished(browser, request, "turnstile-broadsheet", {
      layout: "Broadsheet",
      title: "Supper at Mei’s",
      start: "2027-03-06T19:00",
      plusOnes: "0",
      email: "optional",
      verifyEmail: true,
    });
    const email = newHost("turnstile-guest").email;
    const stranger = newHost("turnstile-stranger").email;

    await page.goto(host.link);
    await page.getByRole("radio", { name: "I’ll be there", exact: true }).check();
    await expect(botCheck(page)).toBeVisible();
    await page.getByLabel("Your name").fill("Mei Lin");
    const post = page.getByRole("button", { name: "Post my reply" });
    await expect(post).toBeEnabled();

    // A script posting someone else's address with a made-up code and no token is refused, and
    // nobody is sent a code.
    await page.getByLabel("Email").fill(stranger);
    expect(await mailCountTo(request, stranger)).toBe(0);
    expect(await blankTheToken(page)).toBe(1);
    await plantACode(page);
    await post.click();
    await expect(page.getByText(CHECK_FAILED)).toBeVisible();
    expect(await mailCountTo(request, stranger)).toBe(0);
    await page.evaluate(() => document.getElementById("planted-code")!.remove());

    await page.getByLabel("Email").fill(email);
    await post.click();

    // The code step keeps the check, beside "Send it again", and Confirm waits for it too.
    await expect(page.getByText(`We sent a code to ${email}.`)).toBeVisible({ timeout: 15_000 });
    await expect(botCheck(page)).toBeVisible();
    const code = (await latestMailTo(request, email)).match(/^([0-9]{6})\r?$/m)?.[1];
    await page.getByLabel("Code").fill(code!);
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Received", { exact: true })).toBeVisible({ timeout: 15_000 });

    await host.context.close();
  });

  test("a guest replies in the Thread past the check, and reports the page, once its check has passed", async ({ page, browser, request }) => {
    test.slow();
    const host = await createPublished(browser, request, "turnstile-thread", { layout: "Thread", title: "Ada’s party", start: "2027-03-06T15:00", plusOnes: "0" });

    await page.goto(host.link);
    await page.getByRole("button", { name: "Going", exact: true }).click();
    // The name is the turn that sends the reply, so the check stands over it.
    await expect(botCheck(page)).toBeVisible();
    await page.getByLabel("Your name").fill("Priya Nair");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator('[data-slot="done"]')).toBeVisible({ timeout: 15_000 });
    await expect(botCheck(page)).toHaveCount(0);

    // The report form carries the check too. Each try's reason says which it is, so the
    // operator's mail can tell them apart.
    await page.getByRole("contentinfo").getByRole("link", { name: "Report this event" }).click();
    await expect(botCheck(page)).toBeVisible();
    const marker = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const reason = `This page is not what it says it is, a test of the bot check (${marker}, first try).`;
    const field = page.getByLabel("What’s wrong with this page?");
    await field.fill(reason);
    const sendReport = page.getByRole("button", { name: "Send report" });
    await expect(sendReport).toBeEnabled();
    expect(await blankTheToken(page)).toBe(1);
    await sendReport.click();
    await expect(page.getByText(CHECK_FAILED)).toBeVisible();
    // What they wrote is kept, and the report goes once the widget has passed again.
    await expect(field).toHaveValue(reason);
    await field.fill(reason.replace("first try", "second try"));
    await sendReport.click();
    await expect(page.getByText("Thank you. Your report has reached the operator of this instance.")).toBeVisible({ timeout: 15_000 });
    // The operator's reports inbox has the report that went, and not the refused one; so has their
    // mail, which is queued as a report is kept, so the refused one would have come first.
    const operator = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
    const operatorPage = await operator.newPage();
    await signIn(operatorPage, OPERATOR.email, PASSWORD);
    await expect(operatorPage.getByRole("link", { name: "Instance settings" })).toBeVisible({ timeout: 15_000 });
    await operatorPage.goto("/instance/reports");
    await expect(operatorPage.getByRole("listitem").filter({ hasText: `${marker}, second try` })).toHaveCount(1);
    await expect(operatorPage.getByRole("listitem").filter({ hasText: `${marker}, first try` })).toHaveCount(0);
    await operator.close();
    await expect.poll(() => reportMailsWith(request, `${marker}, second try`), { timeout: 15_000 }).toBe(1);
    expect(await reportMailsWith(request, `${marker}, first try`)).toBe(0);

    await host.context.close();
  });

  test("in the Sheet style a guest replies past the check; with the check blocked, Enter on the last step sends nothing", async ({
    page,
    browser,
    request,
  }) => {
    test.slow();
    const host = await createPublished(browser, request, "turnstile-sheet", { rsvpStyle: "Sheet", title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "0" });

    // A guest whose browser blocks Cloudflare. Can't go asks only the name, so its step is the
    // last, and Enter in its one field would send the form if nothing stopped it.
    const blocked = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
    const blockedPage = await blocked.newPage();
    await blockedPage.route("https://challenges.cloudflare.com/**", (route) => route.abort());
    await blockedPage.goto(host.link);
    await blockedPage.getByRole("button", { name: "Can’t go" }).click();
    const blockedSheet = blockedPage.getByRole("dialog");
    await expect(blockedSheet.getByText("The check couldn’t load. Turn off your ad blocker for this page and try again.")).toBeVisible();
    await expect(blockedSheet.getByRole("button", { name: "Send RSVP" })).toBeDisabled();
    await blockedSheet.getByLabel("Your name").fill("Dev Patel");
    const posted = blockedPage
      .waitForRequest((sent) => sent.method() === "POST" && sent.url().startsWith(TURNSTILE_INSTANCE), { timeout: 3_000 })
      .then(
        () => true,
        () => false,
      );
    await blockedSheet.getByLabel("Your name").press("Enter");
    expect(await posted).toBe(false);
    await expect(blockedSheet.getByText(CHECK_FAILED)).toBeHidden();
    await blocked.close();

    // Everyone else replies in the sheet, with the check beside Send RSVP.
    await page.goto(host.link);
    await page.getByRole("button", { name: "Going" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Your name").fill("Priya Nair");
    await expect(botCheck(page)).toBeVisible();
    await sheet.getByRole("button", { name: "Send RSVP" }).click();
    await expect(sheet.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });

    await host.context.close();
  });
});

test("without Turnstile's keys, the sign-up page has no bot check and loads nothing from Cloudflare", async ({ page }) => {
  const cloudflare: string[] = [];
  page.on("request", (sent) => {
    if (new URL(sent.url()).hostname.endsWith("cloudflare.com")) cloudflare.push(sent.url());
  });
  await page.goto("/sign-up");
  // Once the page has done all it would do, so that a script added after hydration is caught too.
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
  await expect(botCheck(page)).toHaveCount(0);
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveCount(0);
  expect(await scriptsNotFromTheApp(page)).toEqual([]);
  expect(cloudflare).toEqual([]);
});
