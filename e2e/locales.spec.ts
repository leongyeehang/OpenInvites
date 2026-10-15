import { expect, test, type Browser, type Page } from "./test";
import { createPublished } from "./events";
import { latestMailTo, linkIn, newHost, PASSWORD } from "./hosts";

// Ticket 20: the core guest flow (open the invitation, answer Going with a plus-one, see the
// confirmation, be offered the calendar) in each of the three languages, chosen as a guest's own
// browser chooses it, by its Accept-Language, and once through the language switcher. The host
// is English-speaking, as the other specs' hosts are; what changes is the guest's browser.

const EVENT = { title: "Ada’s birthday", start: "2027-03-06T19:00", end: "2027-03-06T22:00", plusOnes: "2", rsvpStyle: "Inline" } as const;

// What a guest reads in each language. The when-line is Intl's own long date in the event's zone,
// so it is matched by its date, which is what a guest checks.
const COPY = {
  en: {
    lang: "en",
    when: /Saturday, March 6, 2027/,
    countdown: /^Starts in \d+ days$/,
    going: "Going",
    name: "Your name",
    continue: "Continue",
    hint: "You can bring up to 2 people.",
    plusOneName: "Guest 1",
    send: "Send RSVP",
    done: "You’re going!",
    summary: "Priya, plus one more.",
    bringing: "Bringing Arjun.",
    calendar: "Add to calendar",
  },
  "zh-Hans": {
    lang: "zh-Hans",
    when: /2027年3月6日\s?星期六/,
    countdown: /^\d+ 天后开始$/,
    going: "参加",
    name: "你的名字",
    continue: "继续",
    hint: "你最多可以带 2 位同伴。",
    plusOneName: "同伴 1",
    send: "发送回复",
    done: "期待你的到来！",
    summary: "Priya，另带 1 位同伴。",
    bringing: "同伴：Arjun",
    calendar: "添加到日历",
  },
  "zh-Hant": {
    lang: "zh-Hant",
    when: /2027年3月6日\s?星期六/,
    countdown: /^\d+ 天後開始$/,
    going: "參加",
    name: "你的名字",
    continue: "繼續",
    hint: "你最多可以帶 2 位同伴。",
    plusOneName: "同伴 1",
    send: "送出回覆",
    done: "期待你的到來！",
    summary: "Priya，另外帶 1 位同伴。",
    bringing: "同伴：Arjun",
    calendar: "加入行事曆",
  },
} as const;

type Copy = (typeof COPY)[keyof typeof COPY];

async function guestWithBrowserIn(browser: Browser, acceptLanguage: string): Promise<Page> {
  const context = await browser.newContext({ locale: acceptLanguage });
  return context.newPage();
}

// Opening the invitation, then answering Going for the guest and one more, as the guest reads it.
async function goingWithAPlusOne(page: Page, copy: Copy) {
  await expect(page.locator("html")).toHaveAttribute("lang", copy.lang);
  await expect(page.getByText(copy.when)).toBeVisible();
  await expect(page.getByText(copy.countdown)).toBeVisible();

  await page.getByRole("button", { name: copy.going, exact: true }).click();
  await page.getByLabel(copy.name).fill("Priya");
  await page.getByRole("button", { name: copy.continue }).click();
  await expect(page.getByText(copy.hint)).toBeVisible();
  await page.getByRole("radio", { name: "+1" }).click();
  await page.getByLabel(copy.plusOneName).fill("Arjun");
  await page.getByRole("button", { name: copy.send }).click();

  await expect(page.getByText(copy.done)).toBeVisible();
  await expect(page.getByText(copy.summary)).toBeVisible();
  await expect(page.getByText(copy.bringing)).toBeVisible();
  // Offered in the confirmation, and in the page's own calendar card.
  const calendar = page.getByRole("link", { name: copy.calendar });
  await expect(calendar).toHaveCount(2);
  await expect(calendar.first()).toHaveAttribute("href", /\/calendar\.ics$/);
}

for (const [acceptLanguage, locale] of [
  ["en-US,en;q=0.9", "en"],
  ["zh-CN,zh;q=0.9", "zh-Hans"],
  ["zh-TW,zh;q=0.9", "zh-Hant"],
] as const) {
  test(`a guest whose browser asks for ${acceptLanguage.split(",")[0]} replies in ${locale}`, async ({ browser, request }) => {
    test.slow();
    const host = await createPublished(browser, request, `locale-${locale}`, EVENT);
    const page = await guestWithBrowserIn(browser, acceptLanguage);
    await page.goto(host.link);
    await goingWithAPlusOne(page, COPY[locale]);
    await page.context().close();
    await host.context.close();
  });
}

test("a guest switches the invitation to Traditional Chinese, and it stays that way", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "locale-switch", EVENT);
  const page = await guestWithBrowserIn(browser, "en-US,en;q=0.9");
  await page.goto(host.link);
  await expect(page.getByRole("button", { name: "Going", exact: true })).toBeVisible();

  const switcher = page.getByRole("contentinfo").getByRole("form", { name: "Language" });
  await expect(switcher.getByRole("button", { name: "English" })).toHaveAttribute("aria-current", "true");
  await switcher.getByRole("button", { name: "繁體中文" }).click();
  await goingWithAPlusOne(page, COPY["zh-Hant"]);

  // The choice is remembered on this device, over the browser's own language.
  await page.reload();
  await expect(page.getByText(COPY["zh-Hant"].done)).toBeVisible();
  await expect(page.getByRole("contentinfo").getByRole("form", { name: "語言" }).getByRole("button", { name: "繁體中文" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await page.context().close();
  await host.context.close();
});

test("a host who signs up in Simplified Chinese is sent their verification email in it", async ({ browser, request }) => {
  test.slow();
  const host = newHost("locale-mail");
  const page = await guestWithBrowserIn(browser, "zh-CN");
  await page.goto("/sign-up");
  await page.getByLabel("显示名称").fill("王小明");
  await page.getByLabel("邮箱").fill(host.email);
  await page.getByLabel("密码").fill(PASSWORD);
  await page.getByRole("button", { name: "创建账号" }).click();
  await expect(page.getByText("验证你的邮箱")).toBeVisible({ timeout: 15_000 });

  const mail = await latestMailTo(request, host.email);
  expect(mail).toContain("王小明，你好：");
  expect(mail).toContain("请打开下面的链接，确认这是你的邮箱地址。");
  await page.goto(linkIn(mail));
  await expect(page.getByRole("heading", { name: "邮箱已验证" })).toBeVisible();
  await page.context().close();
});

// The other two layouts (tickets 12 and 13), each read in one of the Chinese scripts: their own
// words, and the shared flow's, in the guest's language.
test("a guest whose browser asks for zh-CN replies on the Broadsheet's ballot in Simplified Chinese", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "locale-broadsheet", { ...EVENT, layout: "Broadsheet" });
  const page = await guestWithBrowserIn(browser, "zh-CN,zh;q=0.9");
  await page.goto(host.link);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
  await expect(page.getByText(COPY["zh-Hans"].when).first()).toBeVisible();
  await expect(page.getByText("倒计时", { exact: true })).toBeVisible();
  await expect(page.getByText("天后开始", { exact: true })).toBeVisible();

  await page.getByRole("radio", { name: "我会来" }).check();
  await page.getByLabel(COPY["zh-Hans"].name).fill("Priya");
  await expect(page.getByText(COPY["zh-Hans"].hint)).toBeVisible();
  await page.getByRole("button", { name: "多一位同伴" }).click();
  await page.getByLabel(COPY["zh-Hans"].plusOneName).fill("Arjun");
  await page.getByRole("button", { name: "发送我的回复" }).click();

  await expect(page.getByText("已收到", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(COPY["zh-Hans"].done)).toBeVisible();
  await expect(page.getByText(COPY["zh-Hans"].summary)).toBeVisible();
  await expect(page.getByText(COPY["zh-Hans"].bringing)).toBeVisible();
  await expect(page.getByRole("link", { name: COPY["zh-Hans"].calendar })).toHaveAttribute("href", /\/calendar\.ics$/);
  await page.context().close();
  await host.context.close();
});

test("a guest whose browser asks for zh-TW replies in the Thread's conversation in Traditional Chinese", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "locale-thread", { ...EVENT, layout: "Thread" });
  const page = await guestWithBrowserIn(browser, "zh-TW,zh;q=0.9");
  await page.goto(host.link);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
  await expect(page.locator("header").getByText("邀請函", { exact: true })).toBeVisible();
  await expect(page.getByText(COPY["zh-Hant"].when).first()).toBeVisible();
  await expect(page.getByText(COPY["zh-Hant"].countdown)).toBeVisible();

  const conversation = page.getByRole("log");
  await expect(conversation.getByText("那麼，你能來嗎？", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: COPY["zh-Hant"].going, exact: true }).click();
  await expect(conversation.getByText("我會來！", { exact: true })).toBeVisible();
  await expect(conversation.getByText("太好了！我該怎麼稱呼你？", { exact: true })).toBeVisible();
  await page.getByLabel(COPY["zh-Hant"].name).fill("Priya");
  await page.getByRole("button", { name: "傳送", exact: true }).click();
  await expect(conversation.getByText("好呀，Priya。會帶朋友一起來嗎？最多可以帶 2 位。", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "+1", exact: true }).click();
  await expect(conversation.getByText("我會帶 1 位", { exact: true })).toBeVisible();

  await expect(page.locator('[data-slot="done"]')).toContainText("Priya，記下你啦！好期待見到你。", { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "複製修改連結" })).toBeVisible();
  await expect(page.getByRole("link", { name: COPY["zh-Hant"].calendar })).toHaveAttribute("href", /\/calendar\.ics$/);
  await page.context().close();
  await host.context.close();
});

// Ticket 12 (after 0.4): a host who asks for a phone number, optionally, is given one by a guest in
// the Thread's conversation in Simplified Chinese, and the host's guest list shows it.
test("a guest whose browser asks for zh-CN gives the Thread a phone number the host asked for, and the host's list shows it", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "locale-thread-phone", { ...EVENT, layout: "Thread", phone: "optional" });
  const page = await guestWithBrowserIn(browser, "zh-CN,zh;q=0.9");
  await page.goto(host.link);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");

  const conversation = page.getByRole("log");
  await page.getByRole("button", { name: COPY["zh-Hans"].going, exact: true }).click();
  await page.getByLabel(COPY["zh-Hans"].name).fill("Priya");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(conversation.getByText("再留个电话号码吗？万一需要打给你。（不想留可以跳过）", { exact: true })).toBeVisible();
  await page.getByLabel("电话号码").fill("(02) 555-1234");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(conversation.getByText("(02) 555-1234", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "只有我", exact: true }).click();
  await expect(page.locator('[data-slot="done"]')).toContainText("Priya", { timeout: 15_000 });

  await host.page.goto(`${host.page.url()}/guests`);
  await expect(host.page.getByRole("region", { name: /^Going/ }).getByText("(02) 555-1234", { exact: true })).toBeVisible();
  await page.context().close();
  await host.context.close();
});

// M3 (ticket 11): a guest reports an event page in Simplified Chinese, its refusal included, and a
// host makes a personal invite link in Traditional Chinese, chosen in the footer.
test("a guest whose browser asks for zh-CN reports an event page in Simplified Chinese", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "locale-report", EVENT);
  const page = await guestWithBrowserIn(browser, "zh-CN,zh;q=0.9");
  await page.goto(host.link);
  await page.getByRole("contentinfo").getByRole("link", { name: "举报这个活动" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
  await expect(page.getByRole("heading", { level: 1, name: "举报“Ada’s birthday”" })).toBeVisible();

  const reason = page.getByLabel("这个页面有什么问题？");
  await reason.fill("太短了。");
  await page.getByRole("button", { name: "发送举报" }).click();
  await expect(page.getByText("请再多写一点：至少 20 个字符。")).toBeVisible();
  await reason.fill(`这个页面和它说的不一样，请看看是不是骗人的（${Date.now().toString(36)}）。`);
  await page.getByLabel("你的邮箱（选填）").fill("reporter@example.com");
  await expect(page.getByText("如果需要了解更多情况，实例运营者可以回复你。")).toBeVisible();
  await page.getByRole("button", { name: "发送举报" }).click();
  await expect(page.getByText("谢谢。你的举报已经送达这个实例的运营者。")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "返回活动页面" })).toBeVisible();
  await page.context().close();
  await host.context.close();
});

test("a host makes a personal invite link in Traditional Chinese", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "locale-invites", EVENT);
  const page = host.page;
  await page.goto(`${page.url()}/invites`);
  await page.getByRole("contentinfo").getByRole("form", { name: "Language" }).getByRole("button", { name: "繁體中文" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
  await expect(page.getByRole("heading", { level: 1, name: "專屬邀請" })).toBeVisible();
  await expect(page.getByText("還沒有專屬邀請。")).toBeVisible();

  await page.getByLabel("名字", { exact: true }).fill("林美");
  await page.getByRole("button", { name: "產生連結" }).click();
  await expect(page.getByRole("status")).toHaveText("已為 林美 產生連結。", { timeout: 15_000 });
  const row = page.getByRole("listitem").filter({ hasText: "林美" });
  await expect(row.getByText("未開啟", { exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "複製給 林美 的連結" })).toBeVisible();
  await row.getByRole("button", { name: "刪除給 林美 的專屬邀請" }).click();
  const dialog = page.getByRole("alertdialog", { name: "要刪除給 林美 的專屬邀請嗎？" });
  await expect(dialog.getByText("連結會失效。透過它送出的回覆會保留在賓客名單上。")).toBeVisible();
  await dialog.getByRole("button", { name: "刪除專屬邀請" }).click();
  await expect(page.getByText("還沒有專屬邀請。")).toBeVisible({ timeout: 15_000 });
  await host.context.close();
});
