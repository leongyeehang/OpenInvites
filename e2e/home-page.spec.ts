import { expectNoSeriousViolations } from "./axe";
import { clientAddress, expect, test, type APIRequestContext, type Browser, type BrowserContextOptions, type Locator, type Page } from "./test";
import { expectHomeIn, homeByKeyboard, openHome } from "./home";
import { dismissOperatorWelcome, expectSignedInAs, latestMailTo, mailCountTo, MAILPIT, newHost, signUp, submitSignUp, verifyEmail } from "./hosts";
import { recreate } from "./instances";
import { expectStill } from "./still";

// Home page, tickets 01 to 03 and 05: the operator's Home page card, and the home page it sets. Runs
// against `app-fresh` after the retention spec (the `home-instance` project), and recreates it
// first, so the first account here is the operator. The scenarios run in order, each leaving the
// instance as the next expects it: the fresh home page before anyone signs up, then the operator's
// account, the card, and the home page as each of its settings changes it, then the name where it
// is not the home page: the tab, the header and the account emails. Registration stays
// Invitation only, the default, until the last scenario opens it. The fresh and Invitation only
// home pages are also put through the checks every page passes (ticket 05), which need this
// instance: `app` is Open.
test.describe.configure({ mode: "serial" });

let operator: Page;
let operatorName: string;
let operatorEmail: string;
// The operator's first save, as the browser sent it, for the scenario that replays it.
let firstSave: { url: string; headers: Record<string, string>; body: Buffer } | undefined;

test.beforeAll(() => {
  test.setTimeout(180_000);
  recreate("db-fresh", "app-fresh");
});

test.afterAll(async () => {
  await operator?.context().close();
});

// The home page's bar, and the poster it shows.
const bar = (page: Page) => page.locator('[data-slot="home-bar"]');
const posterSrc = (page: Page) => page.locator('[data-slot="poster-card"] img').getAttribute("src");

// A heading's words as they are drawn: how many lines they take, and at what size.
const drawn = (heading: Locator) =>
  heading.evaluate((element) => {
    const text = [element, ...element.querySelectorAll("*")].find((each) => [...each.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()))!;
    const style = getComputedStyle(text);
    return { lines: Math.round(text.getBoundingClientRect().height / parseFloat(style.lineHeight)), size: parseFloat(style.fontSize) };
  });

// The Home page card's form.
const homeForm = (page: Page) => page.locator("form").filter({ has: page.getByLabel("Welcome line") });

async function save(page: Page) {
  const form = homeForm(page);
  await form.getByRole("button", { name: "Save" }).click();
  return form;
}

// Opens a host invitation as the operator and signs a second host up with it, in a context of
// their own.
async function secondHost(browser: Browser): Promise<Page> {
  await operator.goto("/instance");
  await operator.getByRole("button", { name: "Create host invitation" }).click();
  await expect(operator.getByText("Host invitation created.")).toBeVisible();
  const link = await operator.getByLabel("Host invitation link").inputValue();
  const page = await (await browser.newContext()).newPage();
  const host = newHost("home-second");
  await page.goto(link);
  await submitSignUp(page, host);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expectSignedInAs(page, host.name);
  return page;
}

// Ticket 05: the checks every page passes (accessibility.spec.ts, keyboard.spec.ts,
// reduced-motion.spec.ts and locales.spec.ts), on the home page in a state only this instance has,
// under a light gallery poster and a dark one, on a phone at 390 px and on a desktop: axe finds
// nothing serious, a visitor reaches every control and the first way in by keyboard, nothing moves
// under reduced motion, and it reads in both Chinese scripts. `app`'s Open home page has the same
// rows in those specs.
const PHONE: BrowserContextOptions = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const DESKTOP: BrowserContextOptions = { viewport: { width: 1280, height: 800 } };

async function passesTheChecks(browser: Browser, state: "fresh" | "invitationOnly", { title, ways, to }: { title: string; ways: string[]; to: RegExp }) {
  const visitor = async (options: BrowserContextOptions) => (await browser.newContext({ ...options, extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
  for (const [width, device] of [["390 px", PHONE], ["a desktop", DESKTOP]] as const) {
    for (const poster of ["Balloons", "Disco"] as const) {
      const where = `the home page, ${state === "fresh" ? "before the first account" : "Invitation only"}, under ${poster} on ${width}`;
      const page = await visitor(device);
      await openHome(page, poster);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expectNoSeriousViolations(page, where);
      await homeByKeyboard(page, ways);
      await expect(page).toHaveURL(to);
      await page.context().close();

      const still = await visitor({ ...device, reducedMotion: "reduce" });
      await openHome(still, poster);
      await expect(still.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expectStill(still, where);
      await still.context().close();
    }
  }
  // In each Chinese script, as the visitor's browser asks for it.
  for (const device of [PHONE, DESKTOP]) {
    for (const [locale, acceptLanguage] of [
      ["zh-Hans", "zh-CN"],
      ["zh-Hant", "zh-TW"],
    ] as const) {
      const page = await visitor({ ...device, locale: acceptLanguage });
      for (const poster of ["Balloons", "Disco"] as const) {
        await openHome(page, poster);
        await expectHomeIn(page, locale, state);
      }
      await page.context().close();
    }
  }
}

test("before anyone signs up, the home page asks for the operator account first", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Your OpenInvites is ready" })).toBeVisible();
  await expect(page).toHaveTitle("OpenInvites");
  await expect(page.getByText("Create the first account to finish setting up. That account runs this site:")).toBeVisible();
  const card = page.locator('[data-slot="how"]');
  await expect(card.getByRole("heading", { level: 2 })).toHaveText("Three steps");
  await expect(card.getByRole("listitem").getByRole("heading")).toHaveText(["Create the operator account", "Name your site", "Invite your hosts"]);
  await expect(bar(page).getByRole("link")).toHaveText(["Create the operator account"]);

  await bar(page).getByRole("link", { name: "Create the operator account" }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
});

test("before anyone signs up, the home page passes the checks every page passes", async ({ browser }) => {
  test.slow();
  await passesTheChecks(browser, "fresh", { title: "Your OpenInvites is ready", ways: ["Create the operator account"], to: /\/sign-up$/ });
});

test("once the operator exists, with nothing set, an Invitation only site offers Sign in alone", async ({ browser, request, page }) => {
  test.slow();
  operator = await (await browser.newContext()).newPage();
  const host = newHost("home");
  operatorName = host.name;
  operatorEmail = host.email;
  const mails = await mailCountTo(request, host.email);
  await signUp(operator, host);
  await dismissOperatorWelcome(operator);
  await verifyEmail(operator, request, host.email, mails);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "OpenInvites" })).toBeVisible();
  await expect(page.getByText("Event invitations, made here: one link that is the invite, the reply and the place guests come back to.")).toBeVisible();
  await expect(bar(page).getByRole("link")).toHaveText(["Sign in"]);
  await expect(page.getByText("Sign in to make an invitation. New hosts join with an invitation from whoever runs this site.")).toBeVisible();
  await expect(page.getByText(/^Run by/)).toBeHidden();
});

test("with Invitation only and nothing set, the home page passes the checks every page passes", async ({ browser }) => {
  test.slow();
  await passesTheChecks(browser, "invitationOnly", { title: "OpenInvites", ways: ["Sign in"], to: /\/sign-in$/ });
});

test("the operator saves the name and the welcome line, and they are there after a reload", async () => {
  await operator.goto("/instance");
  await expect(operator.locator("main h2").first()).toHaveText("Home page");
  await expect(operator.getByText("What visitors see at this site’s address.")).toBeVisible();
  await expect(operator.getByLabel("Name", { exact: true })).toHaveAttribute("placeholder", "OpenInvites");

  operator.on("request", (sent) => {
    if (sent.method() === "POST" && sent.headers()["next-action"] && sent.postDataBuffer()?.includes("Casa Ada")) {
      firstSave = { url: sent.url(), headers: sent.headers(), body: sent.postDataBuffer()! };
    }
  });
  await operator.getByLabel("Name", { exact: true }).fill("Casa Ada");
  await operator.getByLabel("Welcome line").fill("Come as you are.");
  await expect((await save(operator)).getByText("Saved.")).toBeVisible();
  expect(firstSave).toBeDefined();

  await operator.reload();
  await expect(operator.getByLabel("Name", { exact: true })).toHaveValue("Casa Ada");
  await expect(operator.getByLabel("Welcome line")).toHaveValue("Come as you are.");
});

test("More options starts closed, and one poster must be picked for Always the same poster", async () => {
  const more = operator.getByRole("button", { name: "More options" });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");

  await operator.getByLabel("Always the same poster").check();
  const form = await save(operator);
  await expect(form.getByText("Pick the poster to show.")).toBeVisible();

  await operator.getByLabel("Only the ones I pick").check();
  await expect((await save(operator)).getByText("Pick at least one poster.")).toBeVisible();

  // Folded away again, a refused save opens More options on its error.
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect((await save(operator)).getByText("Pick at least one poster.")).toBeVisible();
  await expect(more).toHaveAttribute("aria-expanded", "true");
});

test("a poster picked for Always the same poster is kept, and More options opens on it", async () => {
  await operator.getByLabel("Always the same poster").check();
  await operator.getByText("Disco", { exact: true }).click();
  await expect((await save(operator)).getByText("Saved.")).toBeVisible();

  await operator.reload();
  await expect(operator.getByRole("button", { name: "More options" })).toHaveAttribute("aria-expanded", "true");
  await expect(operator.getByLabel("Always the same poster")).toBeChecked();
  await expect(operator.getByLabel("Disco")).toBeChecked();
});

test("a name of 41 characters is refused with its sentence, and the one saved stays", async () => {
  await operator.getByLabel("Name", { exact: true }).fill("a".repeat(41));
  const form = await save(operator);
  await expect(form.getByText("Keep the name to 40 characters.")).toBeVisible();
  await expect(operator.getByLabel("Name", { exact: true })).toHaveValue("a".repeat(41));

  await operator.getByLabel("Name", { exact: true }).fill("Casa Ada");
  await operator.getByLabel("Welcome line").fill("a".repeat(141));
  await expect((await save(operator)).getByText("Keep the welcome line to 140 characters.")).toBeVisible();

  await operator.reload();
  await expect(operator.getByLabel("Name", { exact: true })).toHaveValue("Casa Ada");
  await expect(operator.getByLabel("Welcome line")).toHaveValue("Come as you are.");
});

test("a host who is not the operator cannot save the settings by replaying the operator's request", async ({ browser }) => {
  // What the operator holds now differs from that first save, so a replay that worked would show.
  await operator.getByLabel("Name", { exact: true }).fill("Held by the operator");
  await expect((await save(operator)).getByText("Saved.")).toBeVisible();

  const second = await secondHost(browser);
  expect(firstSave).toBeDefined();
  const replay = await second.request.post(firstSave!.url, {
    headers: { "content-type": firstSave!.headers["content-type"], "next-action": firstSave!.headers["next-action"] },
    data: firstSave!.body,
  });
  expect(replay.ok()).toBe(false);

  await operator.goto("/instance");
  await expect(operator.getByLabel("Name", { exact: true })).toHaveValue("Held by the operator");
  await expect(operator.getByLabel("Welcome line")).toHaveValue("Come as you are.");
  await second.context().close();
});

test("the saved name and welcome line are the home page's, and the name is the tab's title", async ({ page }) => {
  await operator.goto("/instance");
  await operator.getByLabel("Name", { exact: true }).fill("Casa Ada");
  await operator.getByLabel("Welcome line").fill("Come as you are.");
  await expect((await save(operator)).getByText("Saved.")).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Casa Ada" })).toBeVisible();
  await expect(page.getByText("Come as you are.")).toBeVisible();
  await expect(page).toHaveTitle("Casa Ada");
});

test("a name of 40 characters with no spaces wraps, and the page does not scroll sideways on a phone", async ({ page }) => {
  const long = "Adaandbo".repeat(5);
  await operator.goto("/instance");
  await operator.getByLabel("Name", { exact: true }).fill(long);
  await expect((await save(operator)).getByText("Saved.")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const title = page.getByRole("heading", { level: 1, name: long });
  await expect(title).toBeVisible();
  // More than one line: it wrapped inside the page's column.
  expect((await drawn(title)).lines).toBeGreaterThan(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  // The operator's own header keeps to one line with the long name, which is cut short there
  // (dashboard, ticket 02).
  await operator.setViewportSize({ width: 390, height: 844 });
  await operator.goto("/dashboard");
  const header = operator.getByRole("banner");
  await expect(header.getByRole("link", { name: long })).toBeVisible();
  const heights = await header.evaluate((banner) => [banner.getBoundingClientRect().height, banner.querySelector("a")!.getBoundingClientRect().height]);
  expect(heights[0]).toBeLessThanOrEqual(64);
  expect(heights[1]).toBeLessThan(40);
  await expect(header.getByRole("link", { name: "New event" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Account menu" })).toBeVisible();
  expect(await operator.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await operator.setViewportSize({ width: 1280, height: 800 });
  await operator.goto("/instance");

  await operator.getByLabel("Name", { exact: true }).fill("Casa Ada");
  await expect((await save(operator)).getByText("Saved.")).toBeVisible();
});

test("Always the same poster shows that poster on every visit", async ({ page }) => {
  await operator.goto("/instance");
  await operator.getByLabel("Always the same poster").check();
  await operator.getByText("Disco", { exact: true }).click();
  await expect(operator.getByLabel("Disco")).toBeChecked();
  await expect((await save(operator)).getByText("Saved.")).toBeVisible();

  for (let visit = 0; visit < 2; visit++) {
    await page.goto("/");
    expect(await posterSrc(page)).toContain("disco-ball");
  }
});

test("Only the ones I pick shows none but those", async ({ page }) => {
  await operator.goto("/instance");
  await operator.getByLabel("Only the ones I pick").check();
  // The thumbnails' boxes are hidden behind their pictures: a person taps the poster.
  for (const name of ["Disco", "Candlelight", "Rose garden"]) await operator.getByText(name, { exact: true }).click();
  await expect(operator.getByLabel("Disco")).not.toBeChecked();
  await expect(operator.getByLabel("Candlelight")).toBeChecked();
  await expect(operator.getByLabel("Rose garden")).toBeChecked();
  await expect((await save(operator)).getByText("Saved.")).toBeVisible();

  for (let visit = 0; visit < 5; visit++) {
    await page.goto("/");
    expect(await posterSrc(page)).toMatch(/\/posters\/(candlelight|rose-garden)\./);
  }
});

test("Run by names the operator only while it is turned on", async ({ page }) => {
  await operator.goto("/instance");
  const runBy = operator.getByLabel("Show “Run by” with my display name");
  await runBy.check();
  await expect((await save(operator)).getByText("Saved.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(`Run by ${operatorName}`, { exact: true })).toBeVisible();

  await runBy.uncheck();
  await expect((await save(operator)).getByText("Saved.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Casa Ada" })).toBeVisible();
  await expect(page.getByText(/^Run by/)).toBeHidden();
});

// Ticket 03. The name goes into plain-text mail and the tab as typed, "&" and "<" included.
async function nameThe(instance: string) {
  await operator.goto("/instance");
  await operator.getByLabel("Name", { exact: true }).fill(instance);
  await expect((await save(operator)).getByText("Saved.")).toBeVisible();
}

// Asks for a reset link as the operator and returns the email that arrives, once there is a new one.
async function resetMail(request: APIRequestContext, page: Page): Promise<{ subject: string; text: string }> {
  const before = await mailCountTo(request, operatorEmail);
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(operatorEmail);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("a reset link is on its way")).toBeVisible();
  const text = await latestMailTo(request, operatorEmail, before);
  const { messages } = (await (await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${operatorEmail}` } })).json()) as { messages: { Subject: string }[] };
  return { subject: messages[0].Subject, text };
}

test("the name is the host header's, the tab's, and the account emails' as typed", async ({ request, page }) => {
  await nameThe("Lim & <Family>");
  await operator.goto("/dashboard");
  await expect(operator.getByRole("banner").getByRole("link", { name: "Lim & <Family>", exact: true })).toBeVisible();
  // Every page names its own tab, so the root layout's title is the fallback no visitor reaches;
  // the home page's tab is where a visitor sees the name.
  await page.goto("/");
  await expect(page).toHaveTitle("Lim & <Family>");

  const mail = await resetMail(request, page);
  expect(mail.subject).toBe("Reset your Lim & <Family> password");
  expect(mail.text).toContain("choose a new password for Lim & <Family>.");
});

test("with the name cleared, the header, the tab and the next reset email say OpenInvites", async ({ request, page }) => {
  await nameThe("");
  await operator.goto("/dashboard");
  await expect(operator.getByRole("banner").getByRole("link", { name: "OpenInvites", exact: true })).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveTitle("OpenInvites");

  const mail = await resetMail(request, page);
  expect(mail.subject).toBe("Reset your OpenInvites password");
  expect(mail.text).toContain("choose a new password for OpenInvites.");
});

test("with registration Open, the home page offers Create an account first", async ({ page }) => {
  await operator.goto("/instance");
  await operator.getByLabel("Open", { exact: true }).check();
  await operator.locator("form").filter({ has: operator.getByLabel("Open", { exact: true }) }).getByRole("button", { name: "Save" }).click();
  await expect(operator.locator("form").filter({ has: operator.getByLabel("Open", { exact: true }) }).getByText("Saved.")).toBeVisible();

  await page.goto("/");
  await expect(bar(page).getByRole("link")).toHaveText(["Create an account", "Sign in"]);
  await expect(page.getByText("Create an account to make your own invitation pages.")).toBeVisible();
});

// The review of ticket 02: "OpenInvites" in Bricolage Grotesque at the everyday size was wider than
// the column on a wide screen, and broke in two. One poster of each face and placement, with
// Sunshine and Aurora, the grotesque below the poster, at 390 px and at desktop width.
test("the name keeps its word whole on every face and placement, on a phone and a wide screen", async ({ page }) => {
  test.slow();
  await operator.goto("/instance");
  await operator.getByLabel("Name", { exact: true }).fill("");
  await operator.getByLabel("Always the same poster").check();
  for (const poster of ["Sunshine", "Aurora", "Seaside", "Candles", "Candlelight", "Disco", "Balloons"]) {
    await operator.getByText(poster, { exact: true }).click();
    await expect((await save(operator)).getByText("Saved.")).toBeVisible();
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      const title = page.getByRole("heading", { level: 1, name: "OpenInvites" });
      await expect(title).toBeVisible();
      // On one line, and no smaller than a fitted title is drawn (1.75rem).
      const { lines, size } = await drawn(title);
      expect(lines, `${poster} at ${viewport.width} px`).toBe(1);
      expect(size, `${poster} at ${viewport.width} px`).toBeGreaterThanOrEqual(28);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    }
  }
});
