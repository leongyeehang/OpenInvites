import { expect, test, type Page } from "./test";
import { createDraft, createPublished } from "./events";
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

// Ticket 20: the page asks for the one title font it uses from its head, beside the stylesheet,
// shows the title in a fallback of the same size until it arrives rather than hiding it, and
// never fetches the others. A curated scene is served with the page.
test("a guest's page asks early for its own title font and no other, and a scene background arrives with it", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "theme-font", { title: "Ada’s birthday", start: "2027-03-06T19:00" });
  const preloaded = async () => {
    const html = await (await request.get(host.link)).text();
    return [...html.matchAll(/<link rel="preload"[^>]*as="font"[^>]*>/g)].map(([tag]) => tag.match(/href="([^"]+)"/)?.[1]);
  };
  const fonts = (guest: Page) =>
    guest.evaluate(() => performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname).filter((path) => path.startsWith("/fonts/")));

  // Birthday's serif, and only that face is fetched; it is shown by swapping in, never hidden.
  expect(await preloaded()).toEqual(["/fonts/instrument-serif-400.woff2"]);
  await page.goto(host.link);
  await expect.poll(() => fonts(page)).toEqual(["/fonts/instrument-serif-400.woff2"]);
  const displays = await page.evaluate(() => [...document.fonts].filter((face) => !/Fallback/.test(face.family)).map((face) => face.display));
  expect(displays.length).toBeGreaterThan(0);
  expect(new Set(displays)).toEqual(new Set(["swap"]));

  // The host chooses Syne and a scene: the page now asks for Syne alone, and the scene is there.
  await host.page.goto(host.link);
  await host.page.getByRole("button", { name: "Design" }).click();
  const drawer = host.page.getByRole("dialog", { name: "Design" });
  await drawer.getByRole("radio", { name: "Bokeh" }).check();
  await drawer.getByRole("button", { name: "Details" }).click();
  await drawer.getByRole("radio", { name: "Syne" }).check();
  await expect.poll(preloaded, { timeout: 15_000 }).toEqual(["/fonts/syne-800.woff2"]);
  const another = await browser.newContext();
  const guest = await another.newPage();
  const scene = guest.waitForResponse((response) => new URL(response.url()).pathname === "/backgrounds/bokeh.svg");
  await guest.goto(host.link);
  expect((await scene).status()).toBe(200);
  expect((await scene).headers()["content-type"]).toContain("image/svg+xml");
  await expect.poll(() => fonts(guest)).toEqual(["/fonts/syne-800.woff2"]);
  await another.close();
  await host.context.close();
});

// Ticket 20: the invitation rises into place, fading in from a trace rather than from nothing, so
// the browser counts it as the page's largest paint in the frame it is first drawn in. From
// nothing it was never counted, and the largest paint waited for whatever came after the scripts.
test("the invitation is the page's largest paint from the first frame it is drawn in", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "theme-lcp", { title: "Ada’s birthday", start: "2027-03-06T19:00" });
  await host.context.close();
  await page.addInitScript(() => {
    const seen: { time: number; inInvitation: boolean }[] = [];
    Object.assign(window, { largestPaints: seen });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { element?: Element | null })[]) {
        seen.push({ time: entry.startTime, inInvitation: !!entry.element?.closest('[data-slot="poster-card"]') });
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await page.goto(host.link);
  await expect(page.getByRole("heading", { level: 1, name: "Ada’s birthday" })).toBeVisible();
  await page.waitForTimeout(1500);
  const { paints, firstPaint } = await page.evaluate(() => ({
    paints: (window as unknown as { largestPaints: { time: number; inInvitation: boolean }[] }).largestPaints,
    firstPaint: performance.getEntriesByName("first-contentful-paint")[0]?.startTime,
  }));
  expect(paints.length, "a largest paint").toBeGreaterThan(0);
  expect(paints[0].inInvitation).toBe(true);
  expect(paints[0].time).toBe(firstPaint);
});
