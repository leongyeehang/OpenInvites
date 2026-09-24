import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Ticket 20: the automated accessibility check every spec runs the same way. axe-core runs all of
// its rules against the page as it stands, once whatever is still settling into place (a piece
// rising in, a sheet sliding up) has finished, since a colour read halfway through a fade is not
// the colour a person reads. A serious or critical violation fails the test, after the rest of
// the test has run, so one run shows every page that has one. What axe found at each impact is
// kept as an annotation on the test, for the report.
export async function expectNoSeriousViolations(page: Page, where: string) {
  await settled(page);
  const violations = await violationsOn(page);
  const found = Object.fromEntries(IMPACTS.map((impact) => [impact, violations.filter((violation) => violation.impact === impact).length]));
  test.info().annotations.push({ type: "axe", description: `${where}: ${JSON.stringify(found)}` });
  const serious = violations.filter(({ impact }) => impact === "serious" || impact === "critical");
  expect
    .soft(
      serious.map(({ impact, id, help, targets }) => `${impact} ${id} (${help}): ${targets.join(", ")}`),
      `serious or critical accessibility violations on ${where}`,
    )
    .toEqual([]);
}

const IMPACTS = ["critical", "serious", "moderate", "minor"] as const;

type Violation = { id: string; impact?: string | null; help: string; targets: string[] };

// Every rule reads the whole page once, except colour contrast on a page with a backdrop fixed
// to the screen (the event page), which is read a screenful at a time. axe works out what is
// behind a piece of text from where each element is on the screen when it runs (each goes into
// its grid at its bounding client rect), so such a backdrop covers only the screenful in view,
// and text further down the page is read against the white of the body beneath it: a colour no
// one ever sees there. Scrolled half a screen at a time, every piece of text shorter than that is
// wholly on screen once, over what is really behind it, and is judged then. Nothing is left out:
// the rule runs over the whole page each time, and only its verdicts on text off the screen are
// set aside.
async function violationsOn(page: Page): Promise<Violation[]> {
  const found: Violation[] = [];
  const contrast = new Map<string, Violation>();
  const { from, height, fixedBackdrop } = await page.evaluate(() => ({
    from: window.scrollY,
    height: window.innerHeight,
    fixedBackdrop: [...document.querySelectorAll("body *")].some((element) => {
      const rect = element.getBoundingClientRect();
      const { clientWidth, clientHeight } = document.documentElement;
      return getComputedStyle(element).position === "fixed" && rect.width >= clientWidth && rect.height >= clientHeight;
    }),
  }));
  for (let top = 0; ; top += height / 2) {
    const reached = await page.evaluate((y) => {
      window.scrollTo(0, y);
      return window.scrollY;
    }, top);
    const axe = new AxeBuilder({ page });
    const { violations } = await (top === 0 ? axe : axe.withRules([CONTRAST])).analyze();
    for (const { id, impact, help, nodes } of violations) {
      const targets = nodes.map(({ target }) => target.join(" "));
      if (id !== CONTRAST || !fixedBackdrop) {
        found.push({ id, impact, help, targets });
        continue;
      }
      const onScreen = await page.evaluate(
        (selectors) =>
          selectors.map((selector) => {
            const rect = document.querySelector(selector)?.getBoundingClientRect();
            return rect !== undefined && rect.top >= 0 && rect.bottom <= window.innerHeight;
          }),
        targets,
      );
      const violation = contrast.get(id) ?? { id, impact, help, targets: [] };
      for (const [at, target] of targets.entries()) if (onScreen[at] && !violation.targets.includes(target)) violation.targets.push(target);
      if (violation.targets.length > 0) contrast.set(id, violation);
    }
    // Read whole, or down to the foot of the page, or as far as it scrolls (not at all under a
    // modal sheet).
    if (!fixedBackdrop || reached < top || reached + height >= (await page.evaluate(() => document.documentElement.scrollHeight))) break;
  }
  await page.evaluate((y) => window.scrollTo(0, y), from);
  return [...found, ...contrast.values()];
}

const CONTRAST = "color-contrast";

// Every animation that ends has ended. The backdrop's drift never does, and moves no text.
async function settled(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}
