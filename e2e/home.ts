import { expect, type Page, type Route } from "@playwright/test";
import { expectVisibleFocus, tabTo } from "./focus";

// The home page (home page spec, .scratch/home-page/spec.md) as the specs that check it meet it:
// e2e/home.spec.ts and e2e/home-page.spec.ts, and the rows ticket 05 added to the accessibility,
// keyboard, locale and reduced-motion specs.

// The bar at the foot of the page, which holds the ways in.
export const homeBar = (page: Page) => page.locator('[data-slot="home-bar"]');

// The gallery posters those rows are run under, by the name of their files: Balloons, a light
// poster with the title under it in the rounded face, and Disco, a dark one with the title on it in
// the display face.
export const HOME_POSTERS = { Balloons: "balloons", Disco: "disco-ball" } as const;
export type HomePoster = keyof typeof HOME_POSTERS;

// Opens the home page as a visitor who drew `poster` sees it. The page draws its poster afresh on
// every visit, and only the operator's settings narrow the draw, which no spec on the shared `app`
// may change. So the visit is asked of the server again until the page it sends wears that poster,
// and the browser is given that page as it was sent.
export async function openHome(page: Page, poster: HomePoster) {
  const file = `/posters/${HOME_POSTERS[poster]}.`;
  const drawn = async (route: Route) => {
    if (route.request().resourceType() !== "document") return route.fallback();
    // One poster in twenty: 200 visits all drawing another happen about once in 30,000 runs.
    for (let visit = 0; visit < 200; visit++) {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes(file)) return route.fulfill({ response, body });
    }
    await route.abort();
  };
  const home = (url: URL) => url.pathname === "/";
  await page.route(home, drawn);
  await page.goto("/");
  await page.unroute(home, drawn);
  await expect(page.locator('[data-slot="poster-card"] img')).toHaveAttribute("src", new RegExp(file.replace(".", "\\.")));
}

// The home page by keyboard alone, from the top: the first stops are the ways in on the bar, in
// order, then on through the footer to its last control, every stop showing its focus. Then back
// to the first way in, which Enter follows.
export async function homeByKeyboard(page: Page, ways: string[]) {
  for (const way of ways) {
    await page.keyboard.press("Tab");
    await expect(homeBar(page).getByRole("link", { name: way })).toBeFocused();
    await expectVisibleFocus(page);
  }
  await tabTo(page, page.getByRole("link", { name: "Powered by OpenInvites" }));
  await tabTo(page, page.getByRole("contentinfo").getByRole("button", { name: "繁體中文" }));

  const first = homeBar(page).getByRole("link", { name: ways[0] });
  for (let presses = 0; presses < 20; presses++) {
    if (await first.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press("Shift+Tab");
    await expectVisibleFocus(page);
  }
  await expect(first).toBeFocused();
  await page.keyboard.press("Enter");
}

// What the home page says in each Chinese script (messages/zh-Hans.json and zh-Hant.json, Home).
export const HOME_COPY = {
  "zh-Hans": {
    language: "语言",
    poweredBy: "由 OpenInvites 驱动",
    welcome: "在这里制作活动邀请：一条链接，就是邀请函、回复处，也是宾客日后回来看看的地方。",
    how: "使用方式",
    invited: "打开别人发给你的链接就行。宾客不需要账号。",
    hosting: { open: "创建账号，制作你自己的邀请页面。", invitationOnly: "登录后即可制作邀请函。新的主办人需要本站运营者发出的邀请才能加入。" },
    ways: { open: ["创建账号", "登录"], invitationOnly: ["登录"] },
    fresh: {
      title: "你的 OpenInvites 已准备就绪",
      text: "创建第一个账号，完成设置。这个账号负责运营本站：由你决定它的名称、谁可以加入，以及活动保留多久。",
      stepsTitle: "三个步骤",
      steps: ["创建运营者账号", "为你的实例命名", "邀请主办人"],
      way: "创建运营者账号",
    },
  },
  "zh-Hant": {
    language: "語言",
    poweredBy: "由 OpenInvites 驅動",
    welcome: "在這裡製作活動邀請：一個連結，就是邀請函、回覆處，也是賓客日後回來看看的地方。",
    how: "使用方式",
    invited: "開啟別人傳給你的連結就好。賓客不需要帳號。",
    hosting: { open: "建立帳號，製作你自己的邀請頁面。", invitationOnly: "登入後即可製作邀請函。新的主辦人需要本站營運者發出的邀請才能加入。" },
    ways: { open: ["建立帳號", "登入"], invitationOnly: ["登入"] },
    fresh: {
      title: "你的 OpenInvites 已準備就緒",
      text: "建立第一個帳號，完成設定。這個帳號負責營運本站：由你決定它的名稱、誰可以加入，以及活動保留多久。",
      stepsTitle: "三個步驟",
      steps: ["建立營運者帳號", "為你的實例命名", "邀請主辦人"],
      way: "建立營運者帳號",
    },
  },
} as const;

// The home page as a browser asking for `locale` is sent it, in one of its three states: before the
// first account, or with registration Invitation only or Open and no name set.
export async function expectHomeIn(page: Page, locale: keyof typeof HOME_COPY, state: "fresh" | "invitationOnly" | "open") {
  const copy = HOME_COPY[locale];
  const card = page.locator('[data-slot="how"]');
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  if (state === "fresh") {
    await expect(page.getByRole("heading", { level: 1, name: copy.fresh.title })).toBeVisible();
    await expect(page.getByText(copy.fresh.text)).toBeVisible();
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(copy.fresh.stepsTitle);
    await expect(card.getByRole("listitem").getByRole("heading")).toHaveText([...copy.fresh.steps]);
    await expect(homeBar(page).getByRole("link")).toHaveText([copy.fresh.way]);
  } else {
    await expect(page.getByRole("heading", { level: 1, name: "OpenInvites" })).toBeVisible();
    await expect(page.getByText(copy.welcome)).toBeVisible();
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(copy.how);
    await expect(card.getByText(copy.invited)).toBeVisible();
    await expect(card.getByText(copy.hosting[state])).toBeVisible();
    await expect(homeBar(page).getByRole("link")).toHaveText([...copy.ways[state]]);
  }
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: copy.poweredBy })).toBeVisible();
  await expect(footer.getByRole("form", { name: copy.language }).getByRole("button", { name: locale === "zh-Hans" ? "简体中文" : "繁體中文" })).toHaveAttribute("aria-current", "true");
}
