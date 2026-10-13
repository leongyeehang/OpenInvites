import { createPublished } from "./events";
import { latestMailTo, newHost, PASSWORD, signIn, submitSignUp } from "./hosts";
import { expect, scriptsNotFromTheApp, test, type Page } from "./test";

// Ticket 09 (M3): Cloudflare Turnstile guards the email sign-up form, the RSVP form in every
// layout, and the report form. `app-social` (port 3001) runs with Cloudflare's published
// always-pass test keys: the widget is there and passes for anyone, and the server's check of each
// token is a real call to Cloudflare. `app` (port 3000) has no keys, and nothing changes there. A
// form's submit waits for the widget to pass, and Playwright's click waits for it to be enabled.
// The guest drives the test's own page, so all of it runs at 390 pixels in the mobile project and
// at desktop width in the other.

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
    await page.evaluate(() => {
      const code = Object.assign(document.createElement("input"), { type: "hidden", name: "code", value: "123456" });
      document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')!.form!.append(code);
    });
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
    await expect(page.getByText("You’re going!")).toBeVisible();
    await expect(page.getByText(CHECK_FAILED)).toBeHidden();

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

    await page.goto(host.link);
    await page.getByRole("radio", { name: "I’ll be there", exact: true }).check();
    await expect(botCheck(page)).toBeVisible();
    await page.getByLabel("Your name").fill("Mei Lin");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Post my reply" }).click();

    // The code step keeps the check, beside "Send it again"; the code itself goes without it.
    await expect(page.getByText(`We sent a code to ${email}.`)).toBeVisible();
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

    // The report form carries the check too.
    await page.getByRole("contentinfo").getByRole("link", { name: "Report this event" }).click();
    await expect(botCheck(page)).toBeVisible();
    const reason = "This page is not what it says it is, a test of the bot check.";
    await page.getByLabel("What’s wrong with this page?").fill(reason);
    const sendReport = page.getByRole("button", { name: "Send report" });
    await expect(sendReport).toBeEnabled();
    expect(await blankTheToken(page)).toBe(1);
    await sendReport.click();
    await expect(page.getByText(CHECK_FAILED)).toBeVisible();
    // What they wrote is kept, and the report goes once the widget has passed again.
    await expect(page.getByLabel("What’s wrong with this page?")).toHaveValue(reason);
    await sendReport.click();
    await expect(page.getByText("Thank you. Your report has reached the operator of this instance.")).toBeVisible();

    await host.context.close();
  });
});

test("without Turnstile's keys, the sign-up page has no bot check and loads nothing from Cloudflare", async ({ page }) => {
  const cloudflare: string[] = [];
  page.on("request", (sent) => {
    if (new URL(sent.url()).hostname.endsWith("cloudflare.com")) cloudflare.push(sent.url());
  });
  await page.goto("/sign-up");
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
  await expect(botCheck(page)).toHaveCount(0);
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveCount(0);
  expect(await scriptsNotFromTheApp(page)).toEqual([]);
  expect(cloudflare).toEqual([]);
});
