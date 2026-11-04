import sharp from "sharp";
import en from "../messages/en.json";
import { createPublished, savedAfter } from "../e2e/events";
import { expect, test, type Page } from "../e2e/test";
import { BACKGROUNDS, type CuratedBackground } from "../src/themes/backgrounds";
import { hexToRgb, luminance, type Rgb } from "../src/themes/legibility";
import { SWATCHES } from "../src/themes/swatches";

// `pnpm measure:backgrounds`: measures what src/themes/backgrounds.ts stores about each of the
// gallery's colours that has to be measured, its `luminance`, `lightest` and `darkest`, the way the
// comment there says they are measured, and prints them beside the stored values. `-g <id>`
// measures one. It drives the app on port 3000 (`pnpm dev`, or the Compose test profile) through
// the product: a host publishes an event and picks the colour as the poster in the editor,
// and the page a guest is sent is photographed with everything but the backdrop hidden. (The
// gallery's pictures are measured as they are built, by `pnpm posters`.)
// docs/contributing/backgrounds.md says when to run it.

// The phone the average luminance is taken on, and every screen the extremes are looked for on.
const PHONE = { width: 390, height: 844 };
const VIEWPORTS = [{ width: 360, height: 740 }, PHONE, { width: 768, height: 1024 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }];

// Where the two blobs over a gradient are in their drift: at rest, and at the far end.
const DRIFT = [0, 0.5];

// Everything but the backdrop hidden, and a pane with the glass's own blur (backdrop-blur-xl,
// glass.tsx) over the whole screen: what is left is what a glass surface sees.
const AS_GLASS_SEES_IT = `
  body * { visibility: hidden !important; }
  .event-page > .grain, .event-page > .grain * { visibility: visible !important; }
  #glass-pane { position: fixed; inset: 0; z-index: 2147483647; visibility: visible !important; backdrop-filter: blur(24px); }
`;
// The gradient alone: no blobs, scrim, fade or grain.
const ALONE = `
  body * { visibility: hidden !important; }
  .event-page > .grain > :first-child, .event-page > .grain > :first-child * { visibility: visible !important; }
  .event-page > .grain::after { display: none !important; }
`;

// The brightest blob there can be is a white one, so the lightest point is looked for with the
// White accent. No one accent makes the darkest blob, so the darkest point is looked for with each.
const WHITE = en.Design.swatches.white;
const EVERY_ACCENT = [en.Design.auto, ...SWATCHES.map((swatch) => en.Design.swatches[swatch.id])];
// The page a tone is on: light text is on the Dark page, dark text on the Light one.
const PAGE = { light: en.Design.pages.dark, dark: en.Design.pages.light };

type Measured = Pick<CuratedBackground, "luminance" | "lightest" | "darkest">;

for (const background of BACKGROUNDS) {
  test(background.id, async ({ browser, request, page }) => {
    const host = await createPublished(browser, request, "measure", { title: "Measuring the backdrop", start: "2027-03-06T19:00" });
    await choose(host.page, "poster", en.Design.colours, en.Design.colourNames[background.id], en.Design.tabs.colour);

    const measured = {
      luminance: await averageLuminance(page, host.link),
      lightest: await extreme(page, host.page, host.link, "light", [WHITE]),
      darkest: await extreme(page, host.page, host.link, "dark", EVERY_ACCENT),
    };
    console.log(report(background, measured));
    await host.context.close();
  });
}

// The host picks one of a group's choices in one of the editor's design sheets (on its tab, if it
// has tabs), and it is saved before a guest looks.
async function choose(editor: Page, sheet: "poster" | "theme", group: string, name: string, tab?: string) {
  await editor.getByRole("navigation", { name: en.Editor.toolbar }).getByRole("button", { name: en.Design.sheets[sheet] }).click();
  const opened = editor.getByRole("dialog", { name: en.Design.sheets[sheet] });
  if (tab) await opened.getByRole("tab", { name: tab }).click();
  const choice = opened.getByRole("group", { name: group }).getByRole("radio", { name, exact: true });
  if (!(await choice.isChecked())) await savedAfter(editor, () => choice.check());
  await editor.keyboard.press("Escape");
  await expect(opened).toBeHidden();
}

// The page a guest is sent, showing only what `css` leaves visible.
async function openAsGuest(page: Page, link: string, css: string) {
  await page.goto(link);
  await page.addStyleTag({ content: css });
}

// The mean of (0.2126 R + 0.7152 G + 0.0722 B) / 255 over the background alone, on a phone.
async function averageLuminance(page: Page, link: string) {
  await openAsGuest(page, link, ALONE);
  await page.setViewportSize(PHONE);
  const data = await pixels(page);
  let sum = 0;
  for (let i = 0; i < data.length; i += 3) sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  return Math.round((sum / (data.length / 3)) * 100) / 100;
}

// The lightest pixel of the backdrop as the glass sees it in the light tone, or the darkest in
// the dark tone, over every accent given, every viewport and both ends of the drift.
async function extreme(page: Page, editor: Page, link: string, tone: "light" | "dark", accents: string[]) {
  let best: { luminance: number; rgb: Rgb } | undefined;
  await choose(editor, "theme", en.Design.page, PAGE[tone]);
  for (const accent of accents) {
    await choose(editor, "theme", en.Design.accent, accent);
    await openAsGuest(page, link, AS_GLASS_SEES_IT);
    await expect(page.locator("[data-tone]")).toHaveAttribute("data-tone", tone);
    await page.evaluate(() => document.body.append(Object.assign(document.createElement("div"), { id: "glass-pane" })));
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      for (const at of DRIFT) {
        await driftTo(page, at);
        const data = await pixels(page);
        for (let i = 0; i < data.length; i += 3) {
          const value = 0.2126 * LINEAR[data[i]] + 0.7152 * LINEAR[data[i + 1]] + 0.0722 * LINEAR[data[i + 2]];
          if (!best || (tone === "light" ? value > best.luminance : value < best.luminance)) best = { luminance: value, rgb: [data[i], data[i + 1], data[i + 2]] };
        }
      }
    }
  }
  return `#${best!.rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

// Each channel's share of WCAG's relative luminance, as legibility.ts computes it, for a quick
// pass over millions of pixels.
const LINEAR = Array.from({ length: 256 }, (_, channel) => luminance([channel, 0, 0]) / 0.2126);

// Holds the backdrop's animations (the blobs' drift) at a point of their cycle, 0 to 1.
async function driftTo(page: Page, at: number) {
  await page.evaluate((at) => {
    for (const animation of document.getAnimations()) {
      const effect = animation.effect;
      if (!(effect instanceof KeyframeEffect) || !effect.target?.closest(".event-page > .grain")) continue;
      animation.pause();
      animation.currentTime = Number(effect.getTiming().delay ?? 0) + Number(effect.getComputedTiming().duration) * at;
    }
  }, at);
}

// The screen's pixels as RGB, once it has stopped changing: after a resize a scene is drawn
// again at its new size a few frames later, and a picture taken before then shows it stretched.
async function pixels(page: Page) {
  let last = await page.screenshot();
  for (let attempt = 0; attempt < 50; attempt++) {
    await page.waitForTimeout(100);
    const next = await page.screenshot();
    if (next.equals(last)) return (await sharp(next).removeAlpha().raw().toBuffer({ resolveWithObject: true })).data;
    last = next;
  }
  throw new Error("The page never stopped changing");
}

// The measurements beside the stored values. The same to within a step of every channel, and a
// hundredth of luminance, is the same: legibility.ts solves a hair above AA for that rounding.
function report(background: CuratedBackground, measured: Measured) {
  const line = ({ luminance, lightest, darkest }: Measured) => `luminance: ${luminance}, lightest: "${lightest}", darkest: "${darkest}"`;
  const near = (a: string, b: string) => hexToRgb(a).every((channel, index) => Math.abs(channel - hexToRgb(b)[index]) <= 1);
  // In hundredths, since 0.3 - 0.29 is a hair over 0.01 in floating point.
  const hundredths = Math.abs(Math.round(measured.luminance * 100) - Math.round(background.luminance * 100));
  const same = hundredths <= 1 && near(measured.lightest, background.lightest) && near(measured.darkest, background.darkest);
  const verdict = same ? "the same, to within rounding" : "different: put the measured values in src/themes/backgrounds.ts";
  return `${background.id}\n  measured ${line(measured)}\n  stored   ${line(background)}\n  ${verdict}`;
}
