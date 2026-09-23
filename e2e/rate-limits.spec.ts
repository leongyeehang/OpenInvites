import sharp from "sharp";
import { createPublished } from "./events";
import { clientAddress, expect, test } from "./test";

// Ticket 18: the rate limits, at the low values the Compose test profile and .env.development
// set. Each test comes from an address of its own (e2e/test.ts), so reaching a limit here leaves
// every other test's allowance alone.
const EVENT_PAGE_LIMIT = 40; // RATE_LIMIT_EVENT_PAGE=40/1m
const RSVP_LIMIT = 5; // RATE_LIMIT_RSVP=5/1m
const SIGN_IN_LIMIT = 5; // RATE_LIMIT_SIGN_IN=5/1m
const UPLOAD_LIMIT = 3; // RATE_LIMIT_UPLOAD=3/1m

const TOO_FAST = "You’re going too fast. Try again shortly.";

// A slug nobody was given: ten letters and digits, the shape of a real one.
function unknownSlug() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 10 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

test("someone guessing at event links is held up like anyone asking for event pages too often", async ({ page, request, extraHTTPHeaders }) => {
  for (let tried = 0; tried < EVENT_PAGE_LIMIT; tried++) {
    expect((await request.get(`/e/${unknownSlug()}`)).status()).toBe(404);
  }

  // The next guess gets a page that says what happened, with when to come back.
  const refused = await page.goto(`/e/${unknownSlug()}`);
  expect(refused?.status()).toBe(429);
  expect(Number(refused?.headers()["retry-after"])).toBeGreaterThan(0);
  await expect(page.getByRole("heading", { name: "You’re going too fast" })).toBeVisible();
  await expect(page.getByText("Try again shortly.")).toBeVisible();
  await expect(page).toHaveTitle("You’re going too fast");

  // So does everything else under an event link, whatever the slug.
  expect((await request.get(`/e/${unknownSlug()}/preview.png`)).status()).toBe(429);
  expect((await request.get(`/e/${unknownSlug()}/calendar.ics`)).status()).toBe(429);

  // Only the address the reverse proxy appended counts: one the client writes in front of it
  // changes nothing.
  const mine = extraHTTPHeaders!["x-forwarded-for"];
  const spoofed = await request.get(`/e/${unknownSlug()}`, { headers: { "x-forwarded-for": `203.0.113.9, ${mine}` } });
  expect(spoofed.status()).toBe(429);

  // Someone else, at another address, is not held up.
  expect((await request.get(`/e/${unknownSlug()}`, { headers: { "x-forwarded-for": clientAddress() } })).status()).toBe(404);
});

test("a guest who sends RSVP after RSVP is told to slow down where the flow's other messages appear", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "rate-rsvp", { title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "0" });

  await page.goto(host.link);
  await page.getByRole("button", { name: "Going" }).click();
  const sheet = page.getByRole("dialog", { name: "Your RSVP" });
  await sheet.getByLabel("Your name").fill("Priya Nair");
  await sheet.getByRole("button", { name: "Send RSVP" }).click();
  await expect(sheet.getByText("You’re going!")).toBeVisible();
  for (let sent = 1; sent < RSVP_LIMIT; sent++) {
    await sheet.getByRole("button", { name: "Edit details" }).click();
    await sheet.getByRole("button", { name: "Send RSVP" }).click();
    await expect(sheet.getByText("You’re going!")).toBeVisible();
  }

  // One more is one too many. The guest keeps their place, with the reason in front of them.
  await sheet.getByRole("button", { name: "Edit details" }).click();
  await sheet.getByLabel("Your name").fill("Priya N.");
  await sheet.getByRole("button", { name: "Send RSVP" }).click();
  await expect(sheet.getByRole("alert")).toHaveText(TOO_FAST);
  await expect(sheet.getByLabel("Your name")).toHaveValue("Priya N.");

  // The RSVP they had already sent still stands.
  await page.reload();
  await expect(page.getByText("You replied as Priya Nair.")).toBeVisible();
});

test("someone trying password after password is told to slow down in the sign-in form", async ({ page }) => {
  await page.goto("/sign-in");
  // Each attempt is answered before the next: the form empties itself once it has its answer.
  const attempt = async (password: string) => {
    await page.getByLabel("Email").fill("nobody@example.test");
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByLabel("Email")).toHaveValue("");
  };
  for (let tried = 0; tried < SIGN_IN_LIMIT; tried++) {
    await attempt(`not the password ${tried}`);
    await expect(page.getByText("That email and password do not match.")).toBeVisible();
  }

  await attempt("one more guess");
  await expect(page.getByText(TOO_FAST)).toBeVisible();
  await expect(page.getByText("That email and password do not match.")).toBeHidden();
});

test("a host uploading picture after picture is told to slow down in the Design drawer", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "rate-upload", { title: "Ada’s garden party", start: "2027-05-08T16:00", plusOnes: "0" });
  await host.page.goto(host.link);
  await host.page.getByRole("button", { name: "Design" }).click();
  const drawer = host.page.getByRole("dialog", { name: "Design" });

  const picture = async (shade: number) => ({
    name: `garden-${shade}.png`,
    mimeType: "image/png",
    buffer: await sharp({ create: { width: 64, height: 40, channels: 3, background: { r: shade, g: 120, b: 90 } } }).png().toBuffer(),
  });
  const uploadOne = async (control: string, shade: number) => {
    const answered = host.page.waitForResponse((response) => response.url().endsWith("/upload"));
    await drawer.getByLabel(control).setInputFiles(await picture(shade));
    return (await answered).status();
  };

  expect(await uploadOne("Upload your photo or poster", 40)).toBe(200);
  for (let sent = 1; sent < UPLOAD_LIMIT; sent++) {
    await expect(drawer.getByLabel("Replace")).toBeEnabled();
    expect(await uploadOne("Replace", 40 + sent * 40)).toBe(200);
  }

  await expect(drawer.getByLabel("Replace")).toBeEnabled();
  expect(await uploadOne("Replace", 220)).toBe(429);
  await expect(drawer.getByRole("alert")).toHaveText(TOO_FAST);
});
