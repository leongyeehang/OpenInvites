import { mkdirSync } from "node:fs";
import sharp from "sharp";
import { createDraft } from "../e2e/events";
import { submitSignUp, verifyEmail } from "../e2e/hosts";
import { clientAddress, expect, test, type Browser, type BrowserContextOptions, type Page } from "../e2e/test";

// `pnpm screenshots`: the pictures in README.md, taken from the app on port 3000 (`pnpm dev`, or
// better the Compose test profile, which is the image an operator runs). A host with a made-up
// name publishes two events through the product, made-up guests answer one, and each picture is
// written to docs/screenshots/ as WebP, small enough to keep in the repository. Run it again when
// the look changes.

const OUT = "docs/screenshots";
const PHONE: BrowserContextOptions = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP: BrowserContextOptions = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
// Everyone is where the events are, so no page shows a second, local time.
const WHERE = { timezoneId: "Asia/Singapore" };

const HOST = { name: "Mei Lin", email: `mei-${Date.now().toString(36)}@example.test` };

const BIRTHDAY = {
  title: "Mei’s 30th",
  start: "2027-06-12T19:00",
  end: "2027-06-12T23:30",
  location: "The Glasshouse, 12 Orchard Lane",
  description: "Dinner, far too much cake, and dancing until late. Bring someone if you like.",
  plusOnes: "2",
};

const FAIR = {
  title: "Night market on the green",
  start: "2027-07-24T17:00",
  end: "2027-07-24T22:00",
  location: "Village green, by the bandstand",
  description: "Street food, string lights, and a band from eight. Everyone is welcome.",
  plusOnes: "4",
};

// Who answers the birthday, and how.
const GUESTS = [
  { name: "Arjun Mehta", status: "Going", bringing: 1 },
  { name: "Sofia Reyes", status: "Going", bringing: 0 },
  { name: "Tomás Ortega", status: "Maybe", bringing: 0 },
  { name: "Priya Nair", status: "Going", bringing: 2 },
  { name: "Kenji Sato", status: "Can’t go", bringing: 0 },
  { name: "Lena Fischer", status: "Going", bringing: 0 },
] as const;

test("README screenshots", async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const host = await (await someone(browser, DESKTOP)).newPage();
  await host.goto("/sign-up");
  await submitSignUp(host, HOST);
  await expect(host).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await verifyEmail(host, host.request, HOST.email);

  const birthday = await publish(host, BIRTHDAY);
  for (const guest of GUESTS) await reply(browser, birthday, guest);

  // A guest opens the birthday on a phone: the Birthday template, where every event starts.
  const guest = await (await someone(browser, PHONE)).newPage();
  await guest.goto(birthday);
  await save(guest, "event-birthday");

  // They answer in the sheet that rises over the invitation.
  await guest.getByRole("button", { name: "Going" }).click();
  const sheet = guest.getByRole("dialog", { name: "Your RSVP" });
  await sheet.getByLabel("Your name").fill("Hana Kim");
  await sheet.getByRole("button", { name: "Continue" }).click();
  await sheet.getByRole("radio", { name: "+1" }).click();
  await sheet.getByLabel("Guest 1").fill("Leo");
  await save(guest, "rsvp-sheet");

  // The host's guest list for the birthday.
  await host.goto("/dashboard");
  await host.getByRole("link", { name: BIRTHDAY.title }).click();
  await host.getByRole("link", { name: "Guest list" }).click();
  await expect(host.getByText(GUESTS[0].name)).toBeVisible();
  await save(host, "guest-list");

  // The fair wears the Festival template, chosen in the Design drawer, which is then opened
  // afresh, as a host finds it.
  const fair = await publish(host, FAIR);
  await host.goto(fair);
  await host.getByRole("button", { name: "Design" }).click();
  const drawer = host.getByRole("dialog", { name: "Design" });
  await drawer.getByRole("radio", { name: "Festival" }).check();
  await expect(drawer.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });
  await drawer.getByRole("button", { name: "Close" }).click();
  await host.getByRole("button", { name: "Design" }).click();
  await expect(drawer.getByText("Theme: Festival")).toBeVisible();
  await save(host, "design-drawer");

  await guest.goto(fair);
  await save(guest, "event-festival");
});

// Someone on a device of their own, reaching the instance from an address of their own, so that no
// one's replies count against another's rate limit (e2e/test.ts).
async function someone(browser: Browser, device: BrowserContextOptions) {
  return browser.newContext({ ...device, ...WHERE, extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
}

async function publish(host: Page, fields: Parameters<typeof createDraft>[1]) {
  const link = await createDraft(host, fields);
  await host.getByRole("button", { name: "Publish" }).click();
  await expect(host.getByText("Published", { exact: true })).toBeVisible();
  return link;
}

// A guest answers in the Birthday template's sheet.
async function reply(browser: Browser, link: string, guest: (typeof GUESTS)[number]) {
  const context = await someone(browser, PHONE);
  const page = await context.newPage();
  await page.goto(link);
  await page.getByRole("button", { name: guest.status, exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Your RSVP" });
  await sheet.getByLabel("Your name").fill(guest.name);
  if (guest.status !== "Can’t go") {
    await sheet.getByRole("button", { name: "Continue" }).click();
    if (guest.bringing > 0) await sheet.getByRole("radio", { name: `+${guest.bringing}` }).click();
  }
  await sheet.getByRole("button", { name: "Send RSVP" }).click();
  await expect(sheet.getByText(/^https?:\/\/\S+\/r\/\S+$/)).toBeVisible();
  await context.close();
}

// What the screen shows once its pictures and fonts are in and anything rising has risen, with
// the pointer off anything it would light up.
async function save(page: Page, name: string) {
  await page.mouse.move(0, 0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
  });
  const png = await page.screenshot({ animations: "disabled" });
  const file = `${OUT}/${name}.webp`;
  const { size } = await sharp(png).webp({ quality: 78, effort: 6 }).toFile(file);
  console.log(`${file}: ${Math.round(size / 1024)} kB`);
}
