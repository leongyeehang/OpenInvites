import { expect, test } from "./test";
import { createDraft, createPublished } from "./events";
import { signUpVerified } from "./hosts";

const EVENT = {
  title: "Ada’s birthday",
  start: "2027-03-06T19:00",
  location: "Ah Ma’s house, 3rd floor",
  plusOnes: "0",
} as const;

test("a host copies the link and holds up a code for it", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "share", EVENT);
  await host.page.getByRole("link", { name: "Share" }).click();
  await expect(host.page.getByRole("heading", { name: "Share this event" })).toBeVisible();
  await expect(host.page.getByText(host.link)).toBeVisible();

  // The code is drawn on the server, so it is in the page rather than fetched, and named with the
  // link it holds, for anyone who cannot scan it.
  const qr = host.page.getByRole("img", { name: `QR code for ${host.link}` });
  await expect(qr.locator("svg")).toBeVisible();

  await host.context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await host.page.getByRole("button", { name: "Copy link" }).click();
  await expect(host.page.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await host.page.evaluate(() => navigator.clipboard.readText())).toBe(host.link);

  await host.context.close();
});

test("the link unfurls as a card drawn from the event's theme", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "preview", EVENT);
  await page.goto(host.link);

  const source = await page.content();
  expect(source).toMatch(/<meta property="og:image" content="[^"]*\/preview\.png\?v=\d+"/);
  expect(source).toContain('<meta property="og:title" content="Ada’s birthday"');
  expect(source).toContain('<meta name="twitter:card" content="summary_large_image"');

  const card = await request.get(`${host.link}/preview.png`);
  expect(card.status()).toBe(200);
  expect(card.headers()["content-type"]).toContain("image/png");
  // A PNG, and a big enough one to be a card rather than an error.
  const bytes = await card.body();
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  expect(bytes.byteLength).toBeGreaterThan(5000);

  await host.context.close();
});

test("a draft neither unfurls nor draws a card", async ({ page, request }) => {
  test.slow();
  await signUpVerified(page, request, "preview-draft");
  // A title no interface string contains: every page carries its messages, a template named
  // Quiet among them.
  const title = "A surprise for Mei";
  const link = await createDraft(page, { title, start: "2027-05-01T12:00" });
  expect((await request.get(`${link}/preview.png`)).status()).toBe(404);
  const source = await (await request.get(link)).text();
  expect(source).not.toContain("og:image");
  expect(source).not.toContain(title);
});

test("resetting the link retires the old one and tells whoever still has it", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "reset", EVENT);
  const old = host.link;

  await page.goto(old);
  await expect(page.getByRole("heading", { name: "Ada’s birthday" })).toBeVisible();

  await host.page.goto(`${host.page.url()}/share`);
  await host.page.getByRole("button", { name: "Reset the link" }).click();
  await expect(host.page.getByText("Reset this event's link?")).toBeVisible();
  await host.page.getByRole("button", { name: "Reset it" }).click();

  // The share screen comes back carrying the new link, so wait for the old one to go.
  await expect(host.page.getByText(old, { exact: true })).toHaveCount(0, { timeout: 15_000 });
  const fresh = (await host.page.getByText(/^https?:\/\/\S+\/e\/[A-Za-z0-9]{10}$/).textContent())!.trim();
  expect(fresh).not.toBe(old);

  // The new one works, and the old one says what happened rather than looking like a typo.
  await page.goto(fresh);
  await expect(page.getByRole("heading", { name: "Ada’s birthday" })).toBeVisible();
  await page.goto(old);
  await expect(page.getByRole("heading", { name: "This link is no longer valid" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Page not found" })).toHaveCount(0);

  await host.context.close();
});
