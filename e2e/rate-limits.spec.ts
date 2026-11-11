import sharp from "sharp";
import { createPublished, openDesign, openSettings, savedAfter } from "./events";
import { mailCountTo, newHost, signUp } from "./hosts";
import { closeReply } from "./reply";
import { clientAddress, expect, test, type Locator, type Page } from "./test";

// Ticket 18: the rate limits, at the low values the Compose test profile and .env.development
// set. Each test comes from an address of its own (e2e/test.ts), so reaching a limit here leaves
// every other test's allowance alone.
const EVENT_PAGE_LIMIT = 40; // RATE_LIMIT_EVENT_PAGE=40/1m
const RSVP_LIMIT = 5; // RATE_LIMIT_RSVP=5/1m
const SIGN_IN_LIMIT = 5; // RATE_LIMIT_SIGN_IN=5/1m
const UPLOAD_LIMIT = 3; // RATE_LIMIT_UPLOAD=3/1m
const MAIL_LIMIT = 5; // RATE_LIMIT_MAIL=5/1m
const VOTE_LIMIT = 10; // RATE_LIMIT_VOTE=10/1m

const TOO_FAST = "You’re going too fast. Try again shortly.";

// A slug nobody was given: ten letters and digits, the shape of a real one.
function unknownSlug() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 10 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

test("someone guessing at event links is held up like anyone asking for event pages too often", async ({ page, request, extraHTTPHeaders }) => {
  test.slow();
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

  // So does everything else under an event link, whatever the slug, and a personal invite link,
  // whatever the token.
  expect((await request.get(`/e/${unknownSlug()}/preview.png`)).status()).toBe(429);
  expect((await request.get(`/e/${unknownSlug()}/calendar.ics`)).status()).toBe(429);
  expect((await request.get(`/i/${unknownSlug()}${unknownSlug()}`)).status()).toBe(429);

  // Only the address the reverse proxy appended counts: one the client writes in front of it
  // changes nothing.
  const mine = extraHTTPHeaders!["x-forwarded-for"];
  const spoofed = await request.get(`/e/${unknownSlug()}`, { headers: { "x-forwarded-for": `203.0.113.9, ${mine}` } });
  expect(spoofed.status()).toBe(429);

  // Someone else, at another address, is not held up.
  expect((await request.get(`/e/${unknownSlug()}`, { headers: { "x-forwarded-for": clientAddress() } })).status()).toBe(404);
});

test("posting to event links is held up like asking for them, so a guess cannot be posted instead", async ({ page, request }) => {
  test.slow();
  // A post that is not a server action is drawn as the page would be, so it would tell a real
  // link from a guess.
  for (let tried = 0; tried < EVENT_PAGE_LIMIT; tried++) {
    const posted = tried % 2 ? { form: { guess: "yes" } } : { data: { guess: "yes" } };
    expect((await request.post(`/e/${unknownSlug()}`, posted)).status()).toBe(404);
  }
  expect((await request.post(`/e/${unknownSlug()}`, { form: { guess: "yes" } })).status()).toBe(429);
  // Posts and visits share one allowance.
  expect((await page.goto(`/e/${unknownSlug()}`))?.status()).toBe(429);
  await expect(page.getByRole("heading", { name: "You’re going too fast" })).toBeVisible();
});

test("a guest who has asked for event pages too often is told so when their answer redraws the page", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "rate-redraw", { title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "0" });
  await page.goto(host.link);
  // The guest's address uses up the rest of its allowance elsewhere, until it is refused.
  let refusedAfter = 0;
  while ((await request.get(`/e/${unknownSlug()}`)).status() !== 429) expect(++refusedAfter).toBeLessThan(EVENT_PAGE_LIMIT);

  // Answering is the page's own form, so it goes through, but the page it answers with is one
  // more request for an event page: it says so rather than showing the invitation.
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByRole("dialog", { name: "Your RSVP" }).getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("dialog", { name: "Your RSVP" }).getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByRole("heading", { name: "You’re going too fast" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ada’s birthday" })).toBeHidden();
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

  // Removing it counts as an RSVP too, and is refused the same way, with the confirmation.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await sheet.getByRole("button", { name: "Remove my RSVP" }).click();
  await expect(sheet.getByRole("alert")).toHaveText(TOO_FAST);
  await expect(sheet.getByText("You’re going!")).toBeVisible();

  // The RSVP they had already sent still stands.
  await page.reload();
  await expect(page.locator('[data-slot="rsvp-bar"]')).toContainText("You’re going");
});

test("someone asking for verification emails to another person's address is held up, so that inbox is not flooded", async ({ page, request }) => {
  // Anyone can sign up with an address that is not theirs, and then, signed in or not, ask
  // again and again for the email that verifies it.
  const victim = newHost("mail-flood");
  await signUp(page, victim);
  const asked: number[] = [];
  for (let tried = 0; tried < MAIL_LIMIT + 1; tried++) {
    const response = await request.post("/api/auth/send-verification-email", {
      data: { email: victim.email, callbackURL: "/verify-email" },
      headers: { origin: "http://localhost:3000" },
    });
    asked.push(response.status());
  }
  // The sign-up's own email was the first of the five this address may cause.
  expect(asked).toEqual([200, 200, 200, 200, 429, 429]);
  await expect.poll(() => mailCountTo(request, victim.email), { timeout: 15_000 }).toBe(MAIL_LIMIT);

  // The host's own resend button says so too, in its place.
  await page.getByRole("button", { name: "Resend email" }).first().click();
  await expect(page.getByText(TOO_FAST)).toBeVisible();
  expect(await mailCountTo(request, victim.email)).toBe(MAIL_LIMIT);
});

test("someone trying password after password is told to slow down in the sign-in form", async ({ page }) => {
  await page.goto("/sign-in");
  // Each attempt is answered before the next: the form empties itself once it has its answer.
  const attempt = async (password: string) => {
    await page.getByLabel("Email", { exact: true }).fill("nobody@example.test");
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("");
  };
  for (let tried = 0; tried < SIGN_IN_LIMIT; tried++) {
    await attempt(`not the password ${tried}`);
    await expect(page.getByText("That email and password do not match.")).toBeVisible();
  }

  await attempt("one more guess");
  await expect(page.getByText(TOO_FAST)).toBeVisible();
  await expect(page.getByText("That email and password do not match.")).toBeHidden();
});

test("a host uploading picture after picture is told to slow down in the Poster sheet", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "rate-upload", { title: "Ada’s garden party", start: "2027-05-08T16:00", plusOnes: "0" });
  const drawer = await openDesign(host.page, "Poster", "Upload");

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

// M8 ticket 12: each press of a star in an album's vote counts against the vote limit.
test("a guest pressing star after star is told to slow down", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "rate-vote", { title: "Ada’s garden party", start: "2026-01-10T16:00", plusOnes: "0" });
  const editor = host.page.url();
  const album = (page: Page) => page.locator('[data-slot="album"]');
  const photo = async (name: string, background: string) => ({
    name,
    mimeType: "image/jpeg",
    buffer: await sharp({ create: { width: 1200, height: 900, channels: 3, background } }).jpeg().toBuffer(),
  });
  await host.page.goto(host.link);
  await album(host.page).getByLabel(/^Add photos/).setInputFiles([await photo("toast.jpg", "#e0b040"), await photo("cake.jpg", "#c0506a")]);
  await expect(album(host.page).locator("li[data-item]")).toHaveCount(2, { timeout: 20_000 });
  await host.page.goto(editor);
  const block = (await openSettings(host.page)).locator('[data-slot="voting-block"]');
  await savedAfter(host.page, () => block.getByRole("button", { name: "Start voting" }).click());
  await expect(block).toHaveAttribute("data-state", "open");

  const guest = await (await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } })).newPage();
  await guest.goto(host.link);
  await guest.getByRole("button", { name: "Going" }).click();
  await guest.getByLabel("Your name").fill("Ana Ruiz");
  await guest.getByRole("button", { name: "Send RSVP" }).click();
  await expect(guest.getByText("You’re going!")).toBeVisible({ timeout: 15_000 });
  await closeReply(guest);
  const star = (n: number) => album(guest).getByRole("button", { name: new RegExp(`^Vote for Photo ${n}`) });
  const press = async (button: Locator) => {
    const answered = guest.waitForResponse((response) => response.request().method() === "POST" && response.request().headers()["next-action"] !== undefined);
    await button.click();
    await answered;
  };

  // Each press answers, moving the vote from one photo to the other, up to the limit.
  for (let pressed = 0; pressed < VOTE_LIMIT; pressed++) {
    await press(star(1 + (pressed % 2)));
    await expect(star(1 + (pressed % 2))).toHaveAttribute("aria-pressed", "true");
  }
  // One more is one too many: the vote stays where it was, and the album says why.
  await press(star(1));
  await expect(album(guest).locator('[data-slot="album-voting"]').getByRole("alert")).toHaveText(TOO_FAST);
  await expect(star(1)).toHaveAttribute("aria-pressed", "false");
  await expect(star(2)).toHaveAttribute("aria-pressed", "true");
  await Promise.all([host.context.close(), guest.context().close()]);
});
