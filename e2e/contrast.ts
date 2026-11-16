import sharp from "sharp";
import { expect, type Locator, type Page } from "./test";

// How text and focus rings read on screen, in pixels: the browser's half of the legibility guarantee
// wherever axe cannot measure, as over a fixed backdrop (e2e/axe.ts), and legibility.test.ts the
// other half. The dashboard, keyboard and site look specs read them.

// How a text reads against what is behind it, in pixels (dashboard, final review): the text is made
// transparent, its box photographed, and its colour set against the background pixel that is
// worst for it (the darkest for dark text, the lightest for light text; the 2% at the extreme are
// left out as edge noise). WCAG 2's ratio.
export async function worstContrast(text: Locator): Promise<number> {
  const colour = await text.evaluate((element) => {
    const canvas = document.createElement("canvas").getContext("2d")!;
    canvas.fillStyle = getComputedStyle(element).color;
    canvas.fillRect(0, 0, 1, 1);
    return [...canvas.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  });
  await text.evaluate((element) => {
    const style = (element as HTMLElement).style;
    style.color = "transparent";
    style.textShadow = "none";
    style.filter = "none";
  });
  const png = await text.screenshot({ animations: "disabled" });
  await text.evaluate((element) => ["color", "text-shadow", "filter"].forEach((name) => (element as HTMLElement).style.removeProperty(name)));
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const luminances: number[] = [];
  for (let at = 0; at < info.width * info.height; at++) luminances.push(luminance([0, 1, 2].map((channel) => data[at * info.channels + channel])));
  luminances.sort((a, b) => a - b);
  const textLuminance = luminance(colour);
  const worst = textLuminance > 0.5 ? luminances[Math.floor(luminances.length * 0.98)] : luminances[Math.floor(luminances.length * 0.02)];
  const [lighter, darker] = [textLuminance, worst].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

// Focuses the control as the keyboard does (the last thing done was a key, so it shows its focus
// as it does for Tab), and reads the strip beside it (or beside the tile it sits in) with the focus
// and without. The strip reaches 12px out to the control's left, so it assumes nothing filled sits
// within those 12px: a neighbour there is read as the page beyond the ring (keyboard.spec.ts hides
// the New event pill while it reads the ring round the header's initials).
export async function expectRingStandsOut(page: Page, control: Locator) {
  const shown = control.locator("xpath=ancestor-or-self::label[1]").or(control).first();
  await expectMarkStandsOut(page, shown, `the ring round ${control}`, {
    on: async () => {
      await page.keyboard.press("Shift");
      await control.focus();
      expect(await control.evaluate((element) => element.matches(":focus-visible")), `${control} shows its focus`).toBe(true);
    },
    off: () => control.blur(),
  });
}

// A mark drawn round `shown` by `on` and taken away by `off` (a focus ring, the ring round a chosen
// poster), read in the 12px strip to its left with the mark and without (M8 ticket 23): somewhere
// along the strip the mark stands out at 3:1 or more both from what was there without it and from
// the page beyond. A mark drawn in `shown` itself (a native radio, checked) is read `across` it
// instead, from 4px outside its left edge to 4px outside its right.
export async function expectMarkStandsOut(
  page: Page,
  shown: Locator,
  what: string,
  { on, off, across = false }: { on: () => Promise<void>; off: () => Promise<void>; across?: boolean },
) {
  const strip = async () => (across ? stripAt(page, shown, -4, Math.ceil((await shown.boundingBox())!.width) + 8) : stripBeside(page, shown));
  await on();
  const marked = await strip();
  await off();
  const unmarked = await strip();
  const beyond = unmarked[0];
  const standsOut = Math.max(...marked.map((pixel, at) => Math.min(contrast(pixel, unmarked[at]), contrast(pixel, beyond))));
  expect(standsOut, what).toBeGreaterThanOrEqual(3);
}

// A button's edge drawn when it is hovered (a default button on a site page keeps its whole fill
// and is edged inside it in its words' colour instead, tickets 19 and 23), read across its left
// edge, from 2px outside it to 4px inside, hovered and not: somewhere there the edge stands out at
// 3:1 or more both from what was there unhovered and from the fill inside it as it is hovered, so
// that a hover that changed the fill is read against the fill it changed to.
export async function expectHoverEdgeStandsOut(page: Page, button: Locator) {
  await button.hover();
  const hovered = await stripAcrossLeftEdge(page, button);
  await page.mouse.move(0, 0);
  const rest = await stripAcrossLeftEdge(page, button);
  const fill = hovered[hovered.length - 1];
  const standsOut = Math.max(...hovered.map((pixel, at) => Math.min(contrast(pixel, rest[at]), contrast(pixel, fill))));
  expect(standsOut, `the hovered edge of ${button}`).toBeGreaterThanOrEqual(3);
}

// The 12px to the left of an element, at half its height, as it is on screen, once whatever is
// fading in or out has finished.
async function stripBeside(page: Page, element: Locator) {
  return stripAt(page, element, -12, 12);
}

// The 6px across an element's left edge, 2px outside it to 4px inside, at half its height.
async function stripAcrossLeftEdge(page: Page, element: Locator) {
  return stripAt(page, element, -2, 6);
}

// `width` pixels of one row at half an element's height, from `from` pixels right of its left edge,
// as it is on screen once whatever is fading in or out has finished.
async function stripAt(page: Page, element: Locator, from: number, width: number) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  await element.scrollIntoViewIfNeeded();
  const box = (await element.boundingBox())!;
  const clip = { x: Math.floor(box.x) + from, y: Math.floor(box.y + box.height / 2), width, height: 1 };
  const { data, info } = await sharp(await page.screenshot({ clip })).raw().toBuffer({ resolveWithObject: true });
  return Array.from({ length: info.width }, (_, at) => [0, 1, 2].map((channel) => data[at * info.channels + channel]));
}

// WCAG 2's contrast ratio, from sRGB channels 0 to 255.
function contrast(a: number[], b: number[]) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

// WCAG 2's relative luminance, from sRGB channels 0 to 255.
function luminance(rgb: number[]) {
  return rgb
    .map((channel) => channel / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, at) => sum + c * [0.2126, 0.7152, 0.0722][at], 0);
}
