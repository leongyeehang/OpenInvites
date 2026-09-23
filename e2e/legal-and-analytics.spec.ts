import { createPublished } from "./events";
import { expect, test, type Page } from "./test";

// Ticket 18: the operator's privacy policy and terms of use, linked from every page's footer, and
// the operator's own analytics snippet. `app` (the default base URL) has neither, so it shows the
// shipped placeholders and loads no analytics. `app-social` (port 3001) has the operator's
// pages, one from the environment and one from a mounted file (e2e/legal/terms.md), and a snippet.
const OPERATOR_INSTANCE = "http://localhost:3001";

// The footer a person sees, whichever page they are on.
const footer = (page: Page) => page.getByRole("contentinfo");

// The operator's address under a legal page (OPERATOR_CONTACT_EMAIL, which differs between the
// Compose test profile and .env.development).
const contact = (page: Page) => page.getByText("Questions? Contact the operator of this instance at").getByRole("link");

// The scripts in the page's head that did not come from the app itself.
function scriptsNotFromTheApp(page: Page) {
  return page.evaluate(() =>
    [...document.head.querySelectorAll("script")].filter((script) => !script.src || !new URL(script.src).pathname.startsWith("/_next/")).map((script) => script.outerHTML),
  );
}

test.describe("on an instance whose operator has written nothing", () => {
  test("the legal pages say what is missing, and who to ask", async ({ page }) => {
    await page.goto("/");
    await footer(page).getByRole("link", { name: "Privacy policy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
    await expect(page.getByText("The operator of this instance has not published a privacy policy yet.")).toBeVisible();
    await expect(page.getByText("PRIVACY_POLICY_FILE", { exact: true })).toBeVisible();
    await expect(contact(page)).toHaveAttribute("href", /^mailto:\S+@\S+$/);

    await footer(page).getByRole("link", { name: "Terms of use" }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole("heading", { level: 1, name: "Terms of use" })).toBeVisible();
    await expect(page.getByText("The operator of this instance has not published terms of use yet.")).toBeVisible();
    await expect(page.getByText("TERMS_FILE", { exact: true })).toBeVisible();
    await expect(contact(page)).toBeVisible();
  });

  test("no page loads any analytics", async ({ page }) => {
    for (const path of ["/", "/sign-in", "/privacy", "/e/nosuchlink"]) {
      await page.goto(path);
      expect(await scriptsNotFromTheApp(page), path).toEqual([]);
    }
    expect(await page.evaluate(() => "operatorAnalytics" in window)).toBe(false);
  });

  test("an event page carries the footer too, in the event's own theme", async ({ page, browser, request }) => {
    test.slow();
    const host = await createPublished(browser, request, "legal-footer", { title: "Ada’s birthday", start: "2027-03-06T19:00" });

    // The footer is on the host's pages and the pages before signing in.
    await expect(footer(host.page).getByRole("link", { name: "Privacy policy" })).toBeVisible();
    await page.goto("/sign-in");
    await expect(footer(page).getByRole("link", { name: "Terms of use" })).toBeVisible();

    // On the event page there is one footer, and its text is the invitation's own secondary
    // colour rather than the host area's.
    await page.goto(host.link);
    await expect(footer(page)).toHaveCount(1);
    const privacy = footer(page).getByRole("link", { name: "Privacy policy" });
    await expect(privacy).toBeVisible();
    const colour = (text: string) => page.getByText(text).first().evaluate((element) => getComputedStyle(element).color);
    expect(await privacy.evaluate((element) => getComputedStyle(element).color)).toBe(await colour("Hosted by"));

    await privacy.click();
    await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  });
});

test.describe("on an instance whose operator has written their own", () => {
  test.use({ baseURL: OPERATOR_INSTANCE });

  test("the privacy policy and the terms are the operator's text, from the environment and from a file", async ({ page }) => {
    await page.goto("/");
    await footer(page).getByRole("link", { name: "Privacy policy" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "What this instance keeps" })).toBeVisible();
    await expect(page.getByText("Your name and your answers, for the host who asked.")).toBeVisible();
    await expect(page.getByText("name", { exact: true })).toHaveCSS("font-weight", "600");
    // Markup in the operator's text is shown as they typed it, not obeyed.
    await expect(page.getByText("Markup such as <b>this</b> is shown as it was typed.")).toBeVisible();
    await expect(page.getByText("not published a privacy policy")).toBeHidden();
    await expect(page.getByRole("link", { name: "operator@openinvites.test" })).toBeVisible();

    await footer(page).getByRole("link", { name: "Terms of use" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Terms of use" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Using this instance" })).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveText(["Be kind to your guests.", "Keep their details to yourself."]);
    await expect(page.getByRole("link", { name: "operator@openinvites.test" })).toBeVisible();
  });

  test("the operator's analytics snippet is in the head of every page, as they gave it", async ({ page, browser, request }) => {
    test.slow();
    const host = await createPublished(browser, request, "analytics", { title: "Ada’s birthday", start: "2027-03-06T19:00" });
    const snippet = '<script data-analytics="operator">window.operatorAnalytics = (window.operatorAnalytics || 0) + 1</script>';
    // Among them a not-found page, which Next.js builds in the browser rather than sending whole.
    for (const path of ["/", "/sign-in", "/privacy", host.link, "/e/nosuchlink"]) {
      await page.goto(path);
      expect(await scriptsNotFromTheApp(page), path).toContain(snippet);
      // It ran once, as a script the operator pasted into their own page would.
      expect(await page.evaluate(() => (window as { operatorAnalytics?: number }).operatorAnalytics), path).toBe(1);
    }
  });
});
