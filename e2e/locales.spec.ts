import sharp from "sharp";
import { clientAddress, expect, test, type Browser, type Page } from "./test";
import { createPublished, editSettings, HOUR, itemFromNow, savedAfter, setSchedule, utcFromNow } from "./events";
import { hostWithShelves } from "./dashboard";
import { expectHomeIn, openHome } from "./home";
import { latestMailTo, linkIn, mailCountTo, newHost, OPERATOR, PASSWORD, signIn } from "./hosts";
import { replyBar } from "./reply";

// Ticket 20: the core guest flow (open the invitation, answer Going with a plus-one, see the
// confirmation, be offered the calendar) in each of the three languages, chosen as a guest's own
// browser chooses it, by its Accept-Language, and once through the language switcher. The host
// is English-speaking, as the other specs' hosts are; what changes is the guest's browser.

const EVENT = { title: "Ada’s birthday", start: "2027-03-06T19:00", end: "2027-03-06T22:00", plusOnes: "2" } as const;

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
  // Offered in the confirmation, in the sheet over the page.
  const calendar = page.getByRole("dialog").getByRole("link", { name: copy.calendar });
  await expect(calendar).toHaveCount(1);
  await expect(calendar).toHaveAttribute("href", /\/calendar\.ics$/);
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

  // The choice is remembered on this device, over the browser's own language: the bar's one
  // button, Change, opens the answer in it.
  await page.reload();
  await replyBar(page).getByRole("button").click();
  await expect(page.getByText(COPY["zh-Hant"].done)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("contentinfo").getByRole("form", { name: "語言" }).getByRole("button", { name: "繁體中文" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await page.context().close();
  await host.context.close();
});

// Home page, ticket 05: the home page `app` draws, Open and with no name set, in each Chinese
// script as a visitor's browser asks for it, under a light gallery poster and a dark one. Its other
// two states are read the same way on an instance of their own, in e2e/home-page.spec.ts.
for (const [acceptLanguage, locale] of [
  ["zh-CN,zh;q=0.9", "zh-Hans"],
  ["zh-TW,zh;q=0.9", "zh-Hant"],
] as const) {
  test(`a visitor whose browser asks for ${acceptLanguage.split(",")[0]} reads the home page in ${locale}, under the Balloons poster and the Disco poster`, async ({ browser }) => {
    const page = await guestWithBrowserIn(browser, acceptLanguage);
    for (const poster of ["Balloons", "Disco"] as const) {
      await openHome(page, poster);
      await expectHomeIn(page, locale, "open");
    }
    await page.context().close();
  });
}

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
  await expect(page.getByText("如果需要了解更多情况，本站运营者可以回复你。")).toBeVisible();
  await page.getByRole("button", { name: "发送举报" }).click();
  await expect(page.getByText("谢谢。你的举报已经送达本站运营者。")).toBeVisible({ timeout: 15_000 });
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

// The interface says 本站 where it said 实例 (dashboard, ticket 04): the operator's account menu
// offers 站点设置, and the page it opens is headed so too.
test("the operator who switches to Simplified Chinese finds 站点设置 in their account menu", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, OPERATOR.email, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await page.getByRole("button", { name: "简体中文" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "我的活动" })).toBeVisible();
  await page.getByRole("banner").getByRole("button", { name: "账号菜单" }).click();
  await page.getByRole("menu").getByRole("menuitem", { name: "站点设置" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "站点设置" })).toBeVisible();
  await context.close();
});

// The dashboard in each Chinese script, chosen by the host's browser (dashboard, ticket 05): the
// shelves' headings and Next up's chips.
for (const [acceptLanguage, copy] of [
  ["zh-CN", { title: "我的活动", nextUp: "下一场", comingUp: "即将举行", drafts: "草稿", past: "已结束", toApprove: "1 人待批准", guests: "宾客" }],
  ["zh-TW", { title: "我的活動", nextUp: "下一場", comingUp: "即將舉行", drafts: "草稿", past: "已結束", toApprove: "1 人待核准", guests: "賓客" }],
] as const) {
  test(`a host whose browser asks for ${acceptLanguage} reads the dashboard in it`, async ({ browser, request }) => {
    test.slow();
    const host = await hostWithShelves(browser, request, `locale-shelves-${acceptLanguage}`);
    const context = await browser.newContext({ locale: acceptLanguage, storageState: await host.context.storageState() });
    const page = await context.newPage();
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: copy.title })).toBeVisible();
    for (const heading of [copy.nextUp, copy.comingUp, copy.drafts, copy.past]) await expect(page.getByRole("region", { name: heading, exact: true })).toBeVisible();
    const nextUp = page.getByRole("region", { name: copy.nextUp, exact: true });
    await expect(nextUp.getByText(copy.toApprove, { exact: true })).toBeVisible();
    await expect(nextUp.getByRole("link", { name: copy.guests })).toBeVisible();
    await context.close();
    await host.context.close();
  });
}

// M6 ticket 10: what M6 added for the host, read in Simplified Chinese by a host whose browser asks
// for it: the Schedule sheet, the Settings sheet's Album group and Invite-only switch, the Invites
// page with invite-only on and personal letters, and the stop page of an invitation once stopped.
test("a host whose browser asks for zh-CN lists a schedule, sets the album and invite-only, and keeps an invite list in Simplified Chinese", async ({ browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "locale-m6-host", EVENT);
  const editor = host.page.url();
  const context = await browser.newContext({ locale: "zh-CN", storageState: await host.context.storageState() });
  const page = await context.newPage();
  await page.goto(editor);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");

  // The Schedule sheet, from its row.
  await page.getByRole("button", { name: "日程: 添加日程" }).click();
  const schedule = page.getByRole("dialog", { name: "日程" });
  await schedule.getByRole("button", { name: "添加一项" }).click();
  await expect(schedule.getByLabel("开始时间 1", { exact: true })).toBeVisible();
  await expect(schedule.getByRole("radio", { name: "仅在打开页面时刷新" })).toBeVisible();
  await expect(schedule.getByText("不在后台发送请求：节省宾客的流量和电量，也减轻本站的负担。", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(schedule).toBeHidden();

  // The Settings sheet: the Album group, and Invite-only in the Guests group, turned on.
  await page.getByRole("navigation", { name: "设计邀请" }).getByRole("button", { name: "设置" }).click();
  const settings = page.getByRole("dialog", { name: "设置" });
  const album = settings.getByRole("group", { name: "相册", exact: true });
  await expect(album.getByLabel("谁可以看到相册")).toContainText("回复参加的宾客");
  await expect(album.getByLabel("照片须经批准才会显示")).toBeVisible();
  await savedAfter(page, () => settings.getByRole("group", { name: "宾客", exact: true }).getByLabel("仅限受邀者：只有邀请名单上的人才能打开邀请", { exact: true }).check());
  await settings.getByRole("link", { name: "管理邀请名单" }).click();

  // The Invites page: the banner, personal letters, and a row its link alone opens.
  await expect(page.getByRole("heading", { level: 1, name: "专属邀请" })).toBeVisible();
  await expect(page.getByText("已开启“仅限受邀者”：只有名单上的人才能打开邀请。")).toBeVisible();
  await page.getByRole("checkbox", { name: "专属信件" }).click();
  await expect(page.getByRole("textbox", { name: "信件", exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("名字", { exact: true }).fill("林美");
  await page.getByRole("button", { name: "生成链接" }).click();
  const lin = page.getByRole("listitem").filter({ hasText: "林美" });
  await expect(lin.getByText("任何拿到这个链接的人都能打开邀请", { exact: true })).toBeVisible({ timeout: 15_000 });

  // An invitation sent and stopped: its stop link then says so.
  const meiEmail = newHost("locale-m6-mei").email;
  await page.getByLabel("名字", { exact: true }).fill("王美");
  await page.getByLabel("邮箱", { exact: true }).fill(meiEmail);
  await page.getByRole("button", { name: "生成链接" }).click();
  const mei = page.getByRole("listitem").filter({ hasText: "王美" });
  await mei.getByRole("button", { name: "把邀请发送给 王美" }).click();
  await expect(mei.getByRole("status")).toHaveText("已把邀请发送给 王美。", { timeout: 15_000 });
  await expect.poll(() => mailCountTo(request, meiEmail), { timeout: 30_000 }).toBe(1);
  const stop = (await latestMailTo(request, meiEmail)).match(/https?:\/\/\S+\/m\/[A-Za-z0-9]{24}/)![0];
  await page.goto(stop);
  await page.getByRole("button", { name: "不再接收这个活动的邮件" }).click();
  await expect(page.getByText("好了，你不会再收到关于“Ada’s birthday”的邮件。")).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.getByText("这个活动的邮件已经停止发送。", { exact: true })).toBeVisible();
  await context.close();
  await host.context.close();
});

// M6 ticket 10: what M6 added for a guest, read in Traditional Chinese by an invitee whose browser
// asks for it, on a live invite-only event: the locked page and its code, the code's email, the
// host's letter, the schedule with an item on now, and a photo awaiting the host's approval.
test("an invitee whose browser asks for zh-TW opens an invite-only event, reads her letter and the schedule, and adds a photo that waits, in Traditional Chinese", async ({
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "locale-m6-guest", { title: "Ada’s open house", start: utcFromNow(-3 * HOUR), end: utcFromNow(6 * HOUR), timeZone: "UTC", plusOnes: "0" });
  const editor = host.page.url();
  const meiEmail = newHost("locale-m6-guest-mei").email;
  await setSchedule(host.page, [itemFromNow("Welcome drinks", -2 * HOUR, -HOUR), itemFromNow("Lunch", -HOUR / 2), itemFromNow("Garden games", 2 * HOUR)]);
  await editSettings(host.page, async (sheet) => {
    await sheet.getByRole("group", { name: "Album", exact: true }).getByLabel("Approve photos before they’re shown").check();
    await sheet.getByRole("group", { name: "Guests", exact: true }).getByLabel("Invite-only: only people on the invite list can open the invitation", { exact: true }).check();
  });
  await host.page.goto(`${editor}/invites`);
  await host.page.getByRole("checkbox", { name: "Personal letters" }).click();
  await expect(host.page.getByRole("textbox", { name: "Letter", exact: true })).toBeVisible({ timeout: 15_000 });
  await host.page.getByLabel("Name", { exact: true }).fill("Mei");
  await host.page.getByLabel("Email", { exact: true }).fill(meiEmail);
  await host.page.getByRole("textbox", { name: "Letter", exact: true }).fill("期待與你相見。");
  await host.page.getByRole("button", { name: "Make link" }).click();
  await expect(host.page.getByRole("status").filter({ hasText: /^Made a link for / })).toHaveText("Made a link for Mei.", { timeout: 15_000 });

  // The locked page, and the code's email in the language she asked in.
  const context = await browser.newContext({ locale: "zh-TW", timezoneId: "Asia/Singapore", extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
  const page = await context.newPage();
  await page.goto(host.link);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("一份私人邀請");
  await expect(page.getByText(`來自 ${host.name}`, { exact: true })).toBeVisible();
  await page.getByLabel("你的電子郵件").fill(meiEmail);
  await page.getByRole("button", { name: "寄送驗證碼" }).click();
  await expect(page.getByText("如果這個電子郵件在邀請名單上，驗證碼已經寄出，請查收。", { exact: true })).toBeVisible({ timeout: 15_000 });
  const mail = await latestMailTo(request, meiEmail);
  expect(mail).toContain("開啟「Ada’s open house」邀請的驗證碼是：");
  await page.getByLabel("驗證碼", { exact: true }).fill(mail.match(/^([0-9]{6})\r?$/m)![1]);
  await page.getByRole("button", { name: "開啟邀請" }).click();

  // Her letter, and the schedule, with the item on now marked.
  const letter = page.locator('[data-slot="letter"]');
  await expect(letter.getByRole("heading", { name: "致 Mei", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(letter).toContainText("期待與你相見。");
  const schedule = page.locator('[data-slot="schedule"]');
  await expect(schedule.getByText("時間均依 UTC 時區顯示。", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(schedule.locator('[aria-current="true"]')).toContainText("進行中");
  await expect(schedule.locator('[data-state="past"] .sr-only')).toHaveText("已結束");

  // She replies Going, and her photo waits for the host.
  await page.getByRole("button", { name: "參加", exact: true }).click();
  await expect(page.getByLabel("你的名字")).toHaveValue("Mei");
  await page.getByRole("button", { name: "送出回覆" }).click();
  await expect(page.getByText("期待你的到來！")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("dialog", { name: "你的回覆" }).getByRole("button", { name: "關閉" }).click();
  const photo = { name: "garden.jpg", mimeType: "image/jpeg", buffer: await sharp({ create: { width: 800, height: 600, channels: 3, background: "#2f6b3a" } }).jpeg().toBuffer() };
  const album = page.locator('[data-slot="album"]');
  await album.getByLabel("新增照片").setInputFiles([photo]);
  await expect(album.getByRole("status")).toHaveText("garden.jpg：已新增，等候核准", { timeout: 20_000 });
  await expect(album.getByText("等候核准", { exact: true })).toBeVisible({ timeout: 15_000 });
  await context.close();
  await host.context.close();
});
