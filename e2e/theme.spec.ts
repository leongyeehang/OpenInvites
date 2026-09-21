import { expect, test } from "@playwright/test";
import { createDraft } from "./events";
import { signUpVerified } from "./hosts";

// Ticket 06: every new event wears the Birthday template's Poster look without the host doing
// anything. The theme is resolved on the server into CSS variables and the title font.
test("a new event's page wears the Birthday template: serif title, golden accent, light text", async ({ page, request }) => {
  test.slow();
  await signUpVerified(page, request, "theme");
  const link = await createDraft(page, {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    end: "2027-03-06T22:00",
    location: "Ah Ma’s house, 3rd floor",
    description: "Bring nothing.",
  });
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();

  await page.goto(link);
  const root = page.locator("[data-layout]");
  await expect(root).toHaveAttribute("data-tone", "light");
  await expect(root).toHaveAttribute("data-layout", "poster");

  const variables = await root.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      accent: style.getPropertyValue("--theme-accent").trim(),
      onAccent: style.getPropertyValue("--theme-on-accent").trim(),
      text: style.getPropertyValue("--theme-text").trim(),
      titleFont: style.getPropertyValue("--theme-title-font").trim(),
    };
  });
  expect(variables.accent).toBe("#ffc36b");
  expect(variables.onAccent).toBe("#2a1540");
  expect(variables.text).not.toBe("");
  expect(variables.titleFont).toMatch(/instrument/i);

  const title = page.getByRole("heading", { name: "Ada’s birthday", level: 1 });
  await expect(title).toBeVisible();
  const titleStyle = await title.evaluate(async (element) => {
    await document.fonts.ready;
    const style = getComputedStyle(element);
    // The first family is the self-hosted face; the second is a synthesised fallback.
    const family = style.fontFamily.split(",")[0];
    return { fontFamily: style.fontFamily, color: style.color, loaded: document.fonts.check(`${style.fontSize} ${family}`) };
  });
  expect(titleStyle.fontFamily).toMatch(/instrument/i);
  expect(titleStyle.color).toBe("rgb(255, 255, 255)");
  expect(titleStyle.loaded).toBe(true);

  // The details are all there, in glass tiles under the poster card.
  await expect(page.getByText("You’re invited to")).toBeVisible();
  await expect(page.getByText("Saturday, March 6, 2027, 7:00 – 10:00 PM GMT+8")).toBeVisible();
  await expect(page.getByText("Ah Ma’s house, 3rd floor")).toBeVisible();
  await expect(page.getByText("Bring nothing.")).toBeVisible();

  // The poster card rises in on load, and stays put when the guest asks for reduced motion.
  const card = page.locator('[data-slot="poster-card"]');
  expect(await card.evaluate((element) => getComputedStyle(element).animationName)).not.toBe("none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  expect(await card.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
});
