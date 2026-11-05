import { expect, test, type Browser, type Page } from "./test";
import { mailCountTo, newHost, signUp, submitSignUp, verifyEmail } from "./hosts";
import { recreate } from "./instances";

// Home page, tickets 01 and 02: the operator's Home page card, and the home page it sets. Runs
// against `app-fresh` after the retention spec (the `home-instance` project), and recreates it
// first, so the first account here is the operator. The scenarios run in order, each leaving the
// instance as the next expects it: the fresh home page before anyone signs up, then the operator's
// account, the card, and the home page as each of its settings changes it. Registration stays
// Invitation only, the default, until the last scenario opens it.
test.describe.configure({ mode: "serial" });

let operator: Page;
let operatorName: string;
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
  await expect(page.getByRole("banner").getByText(host.name)).toBeVisible();
  return page;
}

test("before anyone signs up, the home page asks for the operator account first", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Your OpenInvites is ready" })).toBeVisible();
  await expect(page).toHaveTitle("OpenInvites");
  await expect(page.getByText("Create the first account to finish setting up. That account runs this site:")).toBeVisible();
  const card = page.locator('[data-slot="how"]');
  await expect(card.getByRole("heading", { level: 2 })).toHaveText("Three steps");
  await expect(card.getByRole("listitem").getByRole("heading")).toHaveText(["Create the operator account", "Name your instance", "Invite your hosts"]);
  await expect(bar(page).getByRole("link")).toHaveText(["Create the operator account"]);

  await bar(page).getByRole("link", { name: "Create the operator account" }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
});

test("once the operator exists, with nothing set, an Invitation only site offers Sign in alone", async ({ browser, request, page }) => {
  test.slow();
  operator = await (await browser.newContext()).newPage();
  const host = newHost("home");
  operatorName = host.name;
  const mails = await mailCountTo(request, host.email);
  await signUp(operator, host);
  await verifyEmail(operator, request, host.email, mails);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "OpenInvites" })).toBeVisible();
  await expect(page.getByText("Event invitations, made here: one link that is the invite, the reply and the place guests come back to.")).toBeVisible();
  await expect(bar(page).getByRole("link")).toHaveText(["Sign in"]);
  await expect(page.getByText("Sign in to make an invitation. New hosts join with an invitation from whoever runs this site.")).toBeVisible();
  await expect(page.getByText(/^Run by/)).toBeHidden();
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
  expect(await title.evaluate((element) => element.getBoundingClientRect().height > parseFloat(getComputedStyle(element).lineHeight) * 1.5)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

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

test("with registration Open, the home page offers Create an account first", async ({ page }) => {
  await operator.goto("/instance");
  await operator.getByLabel("Open", { exact: true }).check();
  await operator.locator("form").filter({ has: operator.getByLabel("Open", { exact: true }) }).getByRole("button", { name: "Save" }).click();
  await expect(operator.locator("form").filter({ has: operator.getByLabel("Open", { exact: true }) }).getByText("Saved.")).toBeVisible();

  await page.goto("/");
  await expect(bar(page).getByRole("link")).toHaveText(["Create an account", "Sign in"]);
  await expect(page.getByText("Create an account to make your own invitation pages.")).toBeVisible();
});
