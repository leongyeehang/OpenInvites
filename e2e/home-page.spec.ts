import { expect, test, type Browser, type Page } from "./test";
import { mailCountTo, newHost, signUp, submitSignUp, verifyEmail } from "./hosts";
import { recreate } from "./instances";

// Home page, ticket 01: the operator's Home page card. Runs against `app-fresh` after the retention
// spec (the `home-instance` project), and recreates it first, so the first account here is the
// operator. The scenarios run in order, each leaving the instance as the next expects it.
// The home page itself is ticket 02's, which adds its scenarios below.
test.describe.configure({ mode: "serial" });

let operator: Page;
// The operator's first save, as the browser sent it, for the scenario that replays it.
let firstSave: { url: string; headers: Record<string, string>; body: Buffer } | undefined;

test.beforeAll(() => {
  test.setTimeout(180_000);
  recreate("db-fresh", "app-fresh");
});

test.afterAll(async () => {
  await operator?.context().close();
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
  await expect(page.getByRole("banner").getByText(host.name)).toBeVisible();
  return page;
}

test("the operator saves the name and the welcome line, and they are there after a reload", async ({ browser, request }) => {
  test.slow();
  operator = await (await browser.newContext()).newPage();
  const host = newHost("home");
  const mails = await mailCountTo(request, host.email);
  await signUp(operator, host);
  await verifyEmail(operator, request, host.email, mails);

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
