import { createPublished } from "./events";
import { expect, test, type APIRequestContext, type Locator, type Page } from "./test";

// Ticket 11 (M2): the theme's effect, chosen in the Design drawer's Details. Sparkles and doodles
// are drawn in the backdrop, the doodles tilt the Poster layout's date sticker, and confetti falls
// once over the page when a guest's answer makes them Going. Under reduced motion none of it is
// drawn and nothing moves; the sticker stays tilted. The page is a new event's, which starts on
// the Birthday template: it sparkles.

const EVENT = { title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "0" } as const;

type Effect = "sparkles" | "doodles" | "confetti";
const drawn = (page: Page, effect: Effect) => page.locator(`[data-effect="${effect}"]`);
const sticker = (page: Page) => page.locator('[data-slot="date-sticker"]');
const tilt = (page: Page) => sticker(page).evaluate((element) => getComputedStyle(element).rotate);
// How much confetti is on the page this instant. It comes with the confirmation, in the same
// paint, so once the confirmation shows, none now means none at all: waiting for none would also
// pass for confetti that fell and was gone.
const confettiNow = (page: Page) => drawn(page, "confetti").count();

// What a guest's browser is sent for the page, which is the saved theme.
async function guestHtml(request: APIRequestContext, link: string) {
  return (await request.get(link)).text();
}

async function openDetails(page: Page) {
  await page.getByRole("button", { name: "Design" }).click();
  const drawer = page.getByRole("dialog", { name: "Design" });
  await drawer.getByRole("button", { name: "Details" }).click();
  return drawer;
}

// The host picks an effect, and it is saved before a guest looks.
async function chooseEffect(drawer: Locator, request: APIRequestContext, link: string, name: string) {
  await drawer.getByRole("group", { name: "Effect" }).getByRole("radio", { name }).check();
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain(`effect\\":\\"${name.toLowerCase()}`);
}

// The guest answers, from the status button to the confirmation, in whichever style the page
// has. Coming back to change it, their name is already there.
async function answer(page: Page, status: "Going" | "Maybe", name: string) {
  await page.getByRole("button", { name: status }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText(status === "Going" ? "You’re going!" : "You’re a maybe.")).toBeVisible();
}

test("a host picks each effect in the Design drawer, and guests see it", async ({ page, browser, request }) => {
  test.slow();
  // Guests answer inline, so the confirmation is on the page itself, under the confetti. (In the
  // sheet the page takes no taps until the sheet closes, confetti or not.)
  const host = await createPublished(browser, request, "effects", { ...EVENT, rsvpStyle: "Inline" });
  await host.page.goto(host.link);

  // Birthday sparkles, over the backdrop, for the host and for a guest.
  const drawer = await openDetails(host.page);
  const effects = drawer.getByRole("group", { name: "Effect" });
  await expect(effects.getByRole("radio", { name: "Sparkles" })).toBeChecked();
  await expect(drawn(host.page, "sparkles")).toBeVisible();
  await page.goto(host.link);
  await expect(drawn(page, "sparkles")).toBeVisible();
  await expect(drawn(page, "doodles")).toHaveCount(0);
  expect(await tilt(page)).toBe("none");

  // Doodles: shapes in the backdrop, and the date sticker lands tilted.
  await chooseEffect(drawer, request, host.link, "Doodles");
  await expect(drawn(host.page, "doodles")).toBeVisible();
  await expect(drawn(host.page, "sparkles")).toHaveCount(0);
  await expect.poll(() => tilt(host.page)).toBe("-6deg");
  await page.reload();
  await expect(drawn(page, "doodles")).toBeVisible();
  await expect(drawn(page, "sparkles")).toHaveCount(0);
  await expect.poll(() => tilt(page)).toBe("-6deg");

  // None: nothing over the backdrop, and the sticker sits straight.
  await chooseEffect(drawer, request, host.link, "None");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const effect of ["sparkles", "doodles"] as const) await expect(drawn(page, effect)).toHaveCount(0);
  expect(await tilt(page)).toBe("none");

  // Confetti: nothing in the backdrop, and nothing falls until a guest says Going.
  await chooseEffect(drawer, request, host.link, "Confetti");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const effect of ["sparkles", "doodles", "confetti"] as const) await expect(drawn(page, effect)).toHaveCount(0);
  await answer(page, "Going", "Priya Nair");
  const confetti = drawn(page, "confetti");
  await expect(confetti).toBeVisible();
  // It falls over the page without getting in the way: the guest goes on at once, under it.
  await page.getByRole("button", { name: "Edit details" }).click();
  await expect(confetti).toBeVisible();
  // Once, and then it is gone.
  await expect(confetti).toHaveCount(0, { timeout: 5_000 });

  // An edit that keeps them Going brings none.
  await page.getByLabel("Your name").fill("Priya N.");
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();
  expect(await confettiNow(page)).toBe(0);

  // Nor does Maybe.
  await page.getByRole("button", { name: "Change my answer" }).click();
  await answer(page, "Maybe", "Priya N.");
  expect(await confettiNow(page)).toBe(0);

  // A change back to Going does.
  await page.getByRole("button", { name: "Change my answer" }).click();
  await answer(page, "Going", "Priya N.");
  await expect(confetti).toBeVisible();
  await expect(confetti).toHaveCount(0, { timeout: 5_000 });

  // A first reply of Maybe, from another guest on their own device, brings none; nor does coming
  // back to the page, which shows the RSVP already there.
  const other = await browser.newContext();
  const second = await other.newPage();
  await second.goto(host.link);
  await answer(second, "Maybe", "Mei Tan");
  expect(await confettiNow(second)).toBe(0);
  await other.close();
  await page.reload();
  await expect(page.getByText("You’re going!")).toBeVisible();
  expect(await confettiNow(page)).toBe(0);

  await host.context.close();
});

test.describe("under reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("no effect is drawn, confetti never falls, and the tilted sticker stays still", async ({ page, browser, request }) => {
    test.slow();
    const host = await createPublished(browser, request, "effects-still", EVENT);
    await host.page.emulateMedia({ reducedMotion: "reduce" });
    await host.page.goto(host.link);

    // Birthday's sparkles are not drawn at all, for the host or a guest.
    await expect(drawn(host.page, "sparkles")).toBeHidden();
    await page.goto(host.link);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(drawn(page, "sparkles")).toBeHidden();

    // Nor are the doodles' shapes; the sticker is tilted from the first, and does not move.
    const drawer = await openDetails(host.page);
    await chooseEffect(drawer, request, host.link, "Doodles");
    await expect(drawn(host.page, "doodles")).toBeHidden();
    expect(await tilt(host.page)).toBe("-6deg");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(drawn(page, "doodles")).toBeHidden();
    expect(await tilt(page)).toBe("-6deg");
    expect(await sticker(page).evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);

    // Confetti never falls.
    await chooseEffect(drawer, request, host.link, "Confetti");
    await page.reload();
    await answer(page, "Going", "Priya Nair");
    expect(await confettiNow(page)).toBe(0);

    await host.context.close();
  });
});

test("the link's preview card is the same whatever the effect", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "effects-card", EVENT);
  // The card the page links to, which is drawn afresh for each version of the theme.
  const card = async () => {
    const preview = (await guestHtml(request, host.link)).match(/<meta property="og:image" content="([^"]+)"/)![1].replaceAll("&amp;", "&");
    return (await request.get(preview)).body();
  };
  const sparkling = await card();

  await host.page.goto(host.link);
  const drawer = await openDetails(host.page);
  for (const name of ["Doodles", "Confetti", "None"]) {
    await chooseEffect(drawer, request, host.link, name);
    expect((await card()).equals(sparkling), name).toBe(true);
  }

  await host.context.close();
});
