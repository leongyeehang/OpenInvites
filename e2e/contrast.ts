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
// and without.
export async function expectRingStandsOut(page: Page, control: Locator) {
  const shown = control.locator("xpath=ancestor-or-self::label[1]").or(control).first();
  await page.keyboard.press("Shift");
  await control.focus();
  expect(await control.evaluate((element) => element.matches(":focus-visible")), `${control} shows its focus`).toBe(true);
  const focused = await stripBeside(page, shown);
  await control.blur();
  const unfocused = await stripBeside(page, shown);
  const beyond = unfocused[0];
  const standsOut = Math.max(...focused.map((pixel, at) => Math.min(contrast(pixel, unfocused[at]), contrast(pixel, beyond))));
  expect(standsOut, `the ring round ${control}`).toBeGreaterThanOrEqual(3);
}

// The 12px to the left of an element, at half its height, as it is on screen, once whatever is
// fading in or out has finished.
async function stripBeside(page: Page, element: Locator) {
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
  const clip = { x: Math.floor(box.x) - 12, y: Math.floor(box.y + box.height / 2), width: 12, height: 1 };
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
