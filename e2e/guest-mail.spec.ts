import { expect, expectNotFoundAsSent, test, type APIRequestContext, type Browser, type Page } from "./test";
import { createPublished } from "./events";
import { MAILPIT, latestMailTo, mailCountTo, newHost } from "./hosts";

// The first email to guests (ticket 02): cancelling a published event tells the Going and Maybe
// guests who gave an email, in the language they replied in, and every email to a guest ends with
// why they got it and a link to a page where one tap stops email about the event. Mail is read in
// Mailpit; each guest has an address of their own, so no other test's mail is counted.

const EVENT = { rsvpStyle: "Inline", title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "0", askEmail: true } as const;

const EDIT_LINK = /^https?:\/\/\S+\/r\/\S+$/;
const STOP_LINK = /https?:\/\/\S+\/m\/[A-Za-z0-9]{24}/;

// A guest answers on a device of their own, giving their email, and keeps the edit link they are given.
async function reply(browser: Browser, link: string, status: "Going" | "Maybe" | "Can’t go", name: string) {
  const email = newHost("guest-mail").email;
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  await page.getByRole("button", { name: status }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText(`We’ll reach you at ${email}.`)).toBeVisible({ timeout: 15_000 });
  const editLink = (await page.getByText(EDIT_LINK).textContent())!.trim();
  return { context, page, email, editLink };
}

// The host calls the event off from its manage page, where they already are.
async function cancel(hostPage: Page) {
  await hostPage.getByRole("button", { name: "Cancel event" }).click();
  await hostPage.getByRole("button", { name: "Cancel the event" }).click();
  await expect(hostPage.getByText("Cancelled", { exact: true })).toBeVisible({ timeout: 15_000 });
}

// The one email this address has, once it has come: the worker sends as soon as the host cancels,
// so it is there within seconds, and the wait allows 30.
async function onlyMailTo(request: APIRequestContext, email: string) {
  await expect.poll(() => mailCountTo(request, email), { timeout: 30_000, message: `an email to ${email}` }).toBe(1);
  const text = (await latestMailTo(request, email)).trimEnd();
  const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${email}` } });
  const { messages } = (await search.json()) as { messages: { Subject: string }[] };
  return { subject: messages[0].Subject, text };
}

test("cancelling tells the Going and Maybe guests who gave an email, and the stop link blanks a guest’s email", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "guest-mail", EVENT);
  // The guest who can't go answers first. The outbox sends in the order it was given mail, so had
  // the cancellation queued them a notice, it would be in Mailpit before the other two.
  const cant = await reply(browser, host.link, "Can’t go", "Arjun Rao");
  const going = await reply(browser, host.link, "Going", "Priya Nair");
  const maybe = await reply(browser, host.link, "Maybe", "Mei Lin");

  await cancel(host.page);

  const footer = /You are getting this because you gave your email when you replied to Ada’s birthday\. To stop emails about this event: https?:\/\/\S+\/m\/[A-Za-z0-9]{24}$/;
  const notices = [await onlyMailTo(request, going.email), await onlyMailTo(request, maybe.email)];
  for (const notice of notices) {
    expect(notice.subject).toBe("Ada’s birthday is cancelled");
    expect(notice.text).toContain("The host has cancelled Ada’s birthday.");
    expect(notice.text).toContain(host.link);
    expect(notice.text).toMatch(footer);
  }
  expect(await mailCountTo(request, cant.email)).toBe(0);
  const [goingStop, maybeStop] = notices.map((notice) => notice.text.match(STOP_LINK)![0]);

  // A mail client opening the link ahead of its reader changes nothing.
  expect((await request.get(maybeStop)).status()).toBe(200);
  await maybe.page.reload();
  await expect(maybe.page.getByText(`We’ll reach you at ${maybe.email}.`)).toBeVisible();

  // The link is no edit link, and a token nobody was given leads nowhere.
  await expectNotFoundAsSent(await request.get(goingStop.replace("/m/", "/r/"), { maxRedirects: 0 }));
  await expectNotFoundAsSent(await request.get("/m/not-a-real-token"));

  // One tap stops the email.
  await going.page.goto(goingStop);
  await expect(going.page.getByRole("heading", { name: "Ada’s birthday" })).toBeVisible();
  await expect(going.page.getByText(`The email on file for this event is ${going.email}.`)).toBeVisible();
  await going.page.getByRole("button", { name: "Stop emails about this event" }).click();
  await expect(going.page.getByText("Done. You will get no more email about Ada’s birthday.")).toBeVisible({ timeout: 15_000 });

  // The link still leads to its page, which now has nothing to stop.
  await going.page.reload();
  await expect(going.page.getByText("No email is on file for this event.")).toBeVisible();
  await expect(going.page.getByRole("button", { name: "Stop emails about this event" })).toHaveCount(0);

  // The guest's RSVP, opened through their edit link, has no email.
  const elsewhere = await browser.newContext();
  const elsewherePage = await elsewhere.newPage();
  await elsewherePage.goto(going.editLink);
  await expect(elsewherePage.getByText("You’re going!")).toBeVisible();
  await expect(elsewherePage.getByText(/We’ll reach you at/)).toHaveCount(0);
  await elsewherePage.getByRole("button", { name: "Edit details" }).click();
  await expect(elsewherePage.getByLabel("Email")).toHaveValue("");

  for (const context of [elsewhere, cant.context, going.context, maybe.context, host.context]) await context.close();
});

test("a guest who replied in Simplified Chinese is told in Simplified Chinese, and stops email in it", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "guest-mail-zh", EVENT);
  const email = newHost("guest-mail-zh").email;

  await page.goto(host.link);
  await page.getByRole("contentinfo").getByRole("form", { name: "Language" }).getByRole("button", { name: "简体中文" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
  await page.getByRole("button", { name: "参加", exact: true }).click();
  await page.getByLabel("你的名字").fill("王小明");
  await page.getByLabel("邮箱").fill(email);
  await page.getByRole("button", { name: "发送回复" }).click();
  await expect(page.getByText("期待你的到来！")).toBeVisible({ timeout: 15_000 });

  // The host's own pages are in English: the guest's mail is in the language the guest replied in.
  await cancel(host.page);

  const notice = await onlyMailTo(request, email);
  expect(notice.subject).toBe("“Ada’s birthday”已取消");
  expect(notice.text).toContain("主办人已经取消了“Ada’s birthday”。");
  expect(notice.text).toContain(host.link);
  expect(notice.text).toMatch(
    /你收到这封邮件，是因为你回复“Ada’s birthday”时留下了邮箱。如果不想再收到关于这个活动的邮件，请打开这个链接：https?:\/\/\S+\/m\/[A-Za-z0-9]{24}$/,
  );

  // The stop page is in the language of the browser that opens it, here still the guest's.
  await page.goto(notice.text.match(STOP_LINK)![0]);
  await expect(page.getByText(`你为这个活动留下的邮箱是 ${email}。`)).toBeVisible();
  await page.getByRole("button", { name: "不再接收这个活动的邮件" }).click();
  await expect(page.getByText("好了，你不会再收到关于“Ada’s birthday”的邮件。")).toBeVisible({ timeout: 15_000 });

  await host.context.close();
});
