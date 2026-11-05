import { signUpVerified } from "./hosts";
import { expect, test, type Page } from "./test";

// Home page, ticket 02: the home page is an invitation to the instance. `app` is Open and its
// operator has set no name, so it says "OpenInvites" with the default welcome line, and the bar
// offers Create an account first. The settings that change it are tried on `app-fresh`
// (e2e/home-page.spec.ts), never here: they would change every page of the shared instance.

const bar = (page: Page) => page.locator('[data-slot="home-bar"]');

test("the home page invites a visitor in, and remembers the chosen language", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "OpenInvites" })).toBeVisible();
  await expect(page.getByText("Event invitations, made here: one link that is the invite, the reply and the place guests come back to.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "How this works" })).toBeVisible();
  await expect(page.getByText("Create an account to make your own invitation pages.")).toBeVisible();
  await expect(bar(page).getByRole("link")).toHaveText(["Create an account", "Sign in"]);
  await expect(page.getByRole("link", { name: "Powered by OpenInvites" })).toHaveAttribute("href", "https://github.com/leongyeehang/OpenInvites");

  await bar(page).getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await page.goto("/");
  await bar(page).getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.goto("/");
  await page.getByRole("button", { name: "简体中文" }).click();
  await expect(page.getByRole("heading", { name: "使用方式" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");

  await page.reload();
  await expect(bar(page).getByRole("link")).toHaveText(["创建账号", "登录"]);
  await expect(page.getByRole("link", { name: "由 OpenInvites 驱动" })).toBeVisible();
});

test.describe("a browser set to Traditional Chinese", () => {
  test.use({ locale: "zh-TW" });

  test("sees the home page in Traditional Chinese without touching anything", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "使用方式" })).toBeVisible();
    await expect(page.getByText("開啟別人傳給你的連結就好。賓客不需要帳號。")).toBeVisible();
    await expect(bar(page).getByRole("link")).toHaveText(["建立帳號", "登入"]);
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
  });
});

test("a host who is signed in goes from the home page to their events", async ({ page, request }) => {
  test.slow();
  await signUpVerified(page, request, "home-signed-in");
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("the bar stays at the foot of the screen, and the page never scrolls sideways", async ({ page }) => {
  await page.goto("/");
  const viewport = page.viewportSize()!;
  const atFoot = async () => {
    const found = await bar(page).boundingBox();
    if (!found) throw new Error("The bar is not on screen");
    const gap = viewport.height - (found.y + found.height);
    expect(gap, "between the bar and the foot of the screen").toBeGreaterThanOrEqual(0);
    expect(gap, "between the bar and the foot of the screen").toBeLessThanOrEqual(24);
    return found;
  };
  const top = await atFoot();
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  expect(await atFoot()).toEqual(top);
  // On a wider screen the bar is at the foot of the page's column, which is a phone's width.
  expect(top.width).toBeLessThanOrEqual(26 * 16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test("the health endpoint reports ready", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
