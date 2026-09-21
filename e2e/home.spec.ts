import { expect, test } from "@playwright/test";

test("the home page says the instance is up and remembers the chosen language", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "OpenInvites" })).toBeVisible();
  await expect(page.getByText("This instance is up.")).toBeVisible();

  await page.getByRole("button", { name: "简体中文" }).click();
  await expect(page.getByText("此实例正在运行。")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");

  await page.reload();
  await expect(page.getByText("此实例正在运行。")).toBeVisible();
});

test.describe("a browser set to Traditional Chinese", () => {
  test.use({ locale: "zh-TW" });

  test("sees the home page in Traditional Chinese without touching anything", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("此實例正在運行。")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
  });
});

test("the health endpoint reports ready", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
