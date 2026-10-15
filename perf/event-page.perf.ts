import { createPublished, type DraftFields } from "../e2e/events";
import { clientAddress, expect, test, type APIRequestContext, type Browser } from "../e2e/test";
import { audit, describe, summarise, type Run } from "./lighthouse";
import { fairPoster, gardenPhoto } from "./pictures";

// Ticket 20: the event page scores at least 90 for performance in a Lighthouse mobile audit, a
// mid-range phone on slow 4G, against the production image (pnpm perf, README "Tests"). An event
// in each kind of theme a host can give the page, in each layout (ticket 15), is made through the
// product, as the browser tests make theirs, and then audited as a guest opening the link, three
// times in each language; the median must be 90 or more. Not part of CI: scores vary between machines, and a gate that
// fails at random is worse than none.

const RUNS = 3;
const TARGET = 90;

// An event as a host writes one: every detail filled in.
const EVENT: DraftFields = {
  title: "Ada’s garden party",
  start: "2027-05-08T16:00",
  end: "2027-05-08T22:00",
  location: "12 Orchard Lane, round the back",
  description:
    "Lanterns, a long table and far too much food. Come as you are, bring someone if you like, and stay as late as the fairy lights do. If it rains we move into the conservatory, so come either way.",
  plusOnes: "2",
};

const PHOTO_ALT = "The garden at dusk, strung with fairy lights";
const POSTER_ALT = "Summer fair poster, 10 July on the village green";

const LANGUAGES = [
  { name: "English", acceptLanguage: "en-US,en;q=0.9", lang: "en" },
  { name: "Simplified Chinese", acceptLanguage: "zh-CN,zh;q=0.9", lang: "zh-Hans" },
] as const;

type Themed = { name: string; make: (browser: Browser, request: APIRequestContext) => Promise<string> };

const THEMES: Themed[] = [
  // Every event starts from the Birthday template: Golden hour, sparkles, and the Sheet style.
  { name: "Curated background with sparkles, Sheet RSVP style", make: (browser, request) => published(browser, request, { ...EVENT, rsvpStyle: "Sheet" }) },
  { name: "Curated background with sparkles, Inline RSVP style", make: (browser, request) => published(browser, request, { ...EVENT, rsvpStyle: "Inline" }) },
  { name: "Uploaded photo as background", make: (browser, request) => withPicture(browser, request, "background") },
  { name: "Portrait poster", make: (browser, request) => withPicture(browser, request, "poster") },
  // The other two layouts, as their templates apply them.
  { name: "Supper club template, Broadsheet layout", make: (browser, request) => withTemplate(browser, request, "Supper club", "broadsheet") },
  { name: "Kids’ party template, Thread layout", make: (browser, request) => withTemplate(browser, request, "Kids’ party", "thread") },
];

async function published(browser: Browser, request: APIRequestContext, fields: DraftFields) {
  const host = await createPublished(browser, request, "perf", fields);
  await host.context.close();
  return host.link;
}

// The host uploads a phone's photo as the background, or a poster exported for print as the
// poster, and describes it, as the Design drawer asks.
async function withPicture(browser: Browser, request: APIRequestContext, as: "background" | "poster") {
  const host = await createPublished(browser, request, "perf", EVENT);
  const guestHtml = async () => (await request.get(host.link)).text();
  await host.page.goto(host.link);
  await host.page.getByRole("button", { name: "Design" }).click();
  const drawer = host.page.getByRole("dialog", { name: "Design" });
  await drawer.getByLabel("Upload your photo or poster").setInputFiles(as === "poster" ? await fairPoster() : await gardenPhoto());
  const useAs = drawer.getByRole("group", { name: "Use it as" });
  await expect(useAs.getByRole("radio", { name: "Background" })).toBeChecked({ timeout: 30_000 });
  const alt = as === "poster" ? POSTER_ALT : PHOTO_ALT;
  await drawer.getByLabel("Describe your picture").fill(alt);
  await drawer.getByLabel("Describe your picture").press("Enter");
  await expect.poll(guestHtml, { timeout: 15_000 }).toContain(alt);
  if (as === "poster") {
    await useAs.getByRole("radio", { name: "Poster" }).check();
    // Only the poster is an <img>, and so only the poster carries its description as alt.
    await expect.poll(guestHtml, { timeout: 15_000 }).toContain(`alt="${alt}"`);
  }
  await host.context.close();
  return host.link;
}

// The host applies a template in the Design drawer, which brings its layout with it.
async function withTemplate(browser: Browser, request: APIRequestContext, template: string, layout: "broadsheet" | "thread") {
  const host = await createPublished(browser, request, "perf", EVENT);
  await host.page.goto(host.link);
  await host.page.getByRole("button", { name: "Design" }).click();
  const drawer = host.page.getByRole("dialog", { name: "Design" });
  await drawer.getByRole("group", { name: "Templates" }).getByRole("radio", { name: template }).check();
  await expect.poll(async () => (await request.get(host.link)).text(), { timeout: 15_000 }).toContain(`data-layout="${layout}"`);
  await host.context.close();
  return host.link;
}

for (const theme of THEMES) {
  test(theme.name, async ({ browser, request }, testInfo) => {
    test.setTimeout(10 * 60_000);
    const link = await theme.make(browser, request);
    for (const language of LANGUAGES) {
      // The page as a guest's browser asks for it in that language. Asked for once first, which
      // also checks the language, so no run meets a server that has not drawn the page yet.
      const headers = { "Accept-Language": language.acceptLanguage };
      expect(await (await request.get(link, { headers })).text()).toContain(`<html lang="${language.lang}"`);
      const runs: Run[] = [];
      for (let run = 1; run <= RUNS; run++) {
        // A guest of their own for each run, as the rate limits count per guest (e2e/test.ts).
        runs.push(await audit(link, { ...headers, "X-Forwarded-For": clientAddress() }, testInfo.outputPath(`${language.lang}-${run}.report.json`)));
      }
      const summary = summarise(runs);
      const name = `${theme.name}, ${language.name}`;
      console.log(describe(name, runs, summary));
      testInfo.annotations.push({ type: "median", description: `${name}: ${summary.score}` });
      expect.soft(summary.score, name).toBeGreaterThanOrEqual(TARGET);
    }
  });
}
