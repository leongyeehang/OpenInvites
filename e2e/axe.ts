import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Ticket 20: the automated accessibility check every spec runs the same way. axe-core runs all of
// its rules against the page as it stands, once whatever is still settling into place (a piece
// rising in, a sheet sliding up) has finished, since a colour read halfway through a fade is not
// the colour a person reads. A serious or critical violation fails the test, after the rest of
// the test has run, so one run shows every page that has one.
//
// What axe found at each impact is kept as an annotation on the test, for the report, with what
// it could not decide ("incomplete", by rule) and how many pieces of text it measured the
// contrast of. axe cannot measure text over a picture or a gradient, which is all the text on an
// event page: it says so rather than guess, so there those pieces are counted as incomplete, not
// as passing. The event page's contrast is legibility.ts's rule, which solves every surface
// against the backdrop at its most extreme and is unit-tested for every combination the drawer
// offers.
export async function expectNoSeriousViolations(page: Page, where: string) {
  await settled(page);
  const { violations, incomplete, contrastMeasured } = await readPage(page);
  const found = Object.fromEntries(IMPACTS.map((impact) => [impact, violations.filter((violation) => violation.impact === impact).length]));
  const unsure = Object.fromEntries([...incomplete].map(([id, targets]) => [id, targets.size]));
  test.info().annotations.push({ type: "axe", description: `${where}: ${JSON.stringify({ ...found, incomplete: unsure, contrastMeasured })}` });
  const serious = violations.filter(({ impact }) => impact === "serious" || impact === "critical");
  expect
    .soft(
      serious.map(({ impact, id, help, targets }) => `${impact} ${id} (${help}): ${targets.join(", ")}`),
      `serious or critical accessibility violations on ${where}`,
    )
    .toEqual([]);
}

const IMPACTS = ["critical", "serious", "moderate", "minor"] as const;
const CONTRAST = "color-contrast";

type Violation = { id: string; impact?: string | null; help: string; targets: string[] };

// Every rule reads the whole page once. Colour contrast is read again, a view at a time, on a page
// with a backdrop fixed to the screen (the event page). axe works out what is behind a piece of
// text from where each element is on the screen when it runs (each goes into its grid at its
// bounding client rect), so such a backdrop covers only the screenful in view, and text further
// down the page would be read against the white of the body beneath it: a colour no one ever sees
// there. So the page is scrolled half a screen at a time, and so is anything on it that scrolls
// on its own (the Design drawer's list, down, and its row of templates, across), and each
// verdict on contrast is kept only from a view where its text is wholly in sight: on the screen,
// and inside everything that clips it. Text taller or wider than half its view is never wholly in
// sight, and is left out.
async function readPage(page: Page) {
  const violations: Violation[] = [];
  const contrast = new Map<string, Violation>();
  const incomplete = new Map<string, Set<string>>();
  const measured = new Set<string>();
  const fixedBackdrop = await page.evaluate(() =>
    [...document.querySelectorAll("body *")].some((element) => {
      const rect = element.getBoundingClientRect();
      const { clientWidth, clientHeight } = document.documentElement;
      return getComputedStyle(element).position === "fixed" && rect.width >= clientWidth && rect.height >= clientHeight;
    }),
  );

  const note = (id: string, target: string) => {
    const targets = incomplete.get(id) ?? new Set<string>();
    targets.add(target);
    incomplete.set(id, targets);
  };

  // All the rules, once, from the top.
  const from = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollTo(0, 0));
  const whole = await new AxeBuilder({ page }).analyze();
  for (const { id, impact, help, nodes } of whole.violations) {
    if (id !== CONTRAST || !fixedBackdrop) violations.push({ id, impact, help, targets: nodes.map(({ target }) => target.join(" ")) });
  }
  for (const { id, nodes } of whole.incomplete) {
    if (id !== CONTRAST || !fixedBackdrop) for (const { target } of nodes) note(id, target.join(" "));
  }
  for (const rule of [...whole.passes, ...whole.violations].filter(({ id }) => id === CONTRAST && !fixedBackdrop)) {
    for (const { target } of rule.nodes) measured.add(target.join(" "));
  }

  if (fixedBackdrop) {
    // Colour contrast from one view: its verdicts on text wholly in sight.
    const readContrast = async () => {
      const read = await new AxeBuilder({ page }).withRules([CONTRAST]).analyze();
      const verdicts = [
        ...read.violations.map((rule) => ({ rule, kind: "violation" as const })),
        ...read.passes.map((rule) => ({ rule, kind: "pass" as const })),
        ...read.incomplete.map((rule) => ({ rule, kind: "incomplete" as const })),
      ].flatMap(({ rule, kind }) => rule.nodes.map(({ target }) => ({ rule, kind, target: target.join(" ") })));
      const inSight = await page.evaluate((targets) => targets.map((target) => whollyInSight(document.querySelector(target))), verdicts.map(({ target }) => target));
      verdicts.forEach(({ rule, kind, target }, at) => {
        if (!inSight[at]) return;
        if (kind === "incomplete") return note(rule.id, target);
        measured.add(target);
        if (kind === "pass") return;
        const violation = contrast.get(rule.id) ?? { id: rule.id, impact: rule.impact, help: rule.help, targets: [] };
        if (!violation.targets.includes(target)) violation.targets.push(target);
        contrast.set(rule.id, violation);
      });
    };
    await page.evaluate(WHOLLY_IN_SIGHT);

    // Down the page.
    const height = await page.evaluate(() => window.innerHeight);
    for (let top = 0; ; top += height / 2) {
      const reached = await page.evaluate((y) => {
        window.scrollTo(0, y);
        return window.scrollY;
      }, top);
      await readContrast();
      // The foot of the page, or as far as it scrolls (not at all under a modal sheet).
      if (reached < top || reached + height >= (await page.evaluate(() => document.documentElement.scrollHeight))) break;
    }
    await page.evaluate(() => window.scrollTo(0, 0));

    // Through everything on the screen that scrolls on its own, each way it scrolls.
    const scrollers = await page.evaluate(() => {
      const found: { mark: string; axis: "x" | "y"; view: number; length: number }[] = [];
      [...document.querySelectorAll("body *")].forEach((element, index) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.width === 0) return;
        const mark = String(index);
        const down = /auto|scroll/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
        const across = /auto|scroll/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
        if (down || across) element.setAttribute("data-axe-scrolls", mark);
        if (down) found.push({ mark, axis: "y", view: element.clientHeight, length: element.scrollHeight });
        if (across) found.push({ mark, axis: "x", view: element.clientWidth, length: element.scrollWidth });
      });
      return found;
    });
    const scrollTo = (mark: string, axis: "x" | "y", at: number) =>
      page.evaluate(
        ({ mark, axis, at }) => {
          const element = document.querySelector(`[data-axe-scrolls="${mark}"]`)!;
          if (axis === "y") element.scrollTop = at;
          else element.scrollLeft = at;
        },
        { mark, axis, at },
      );
    for (const { mark, axis, view, length } of scrollers) {
      // Half a view at a time, to where it scrolls no further.
      for (let at = view / 2; ; at += view / 2) {
        await scrollTo(mark, axis, at);
        await readContrast();
        if (at >= length - view) break;
      }
      await scrollTo(mark, axis, 0);
    }
    await page.evaluate(() => document.querySelectorAll("[data-axe-scrolls]").forEach((element) => element.removeAttribute("data-axe-scrolls")));
  }

  await page.evaluate((y) => window.scrollTo(0, y), from);
  // Text measured from one view is not also counted as undecided from another.
  for (const target of measured) incomplete.get(CONTRAST)?.delete(target);
  return { violations: [...violations, ...contrast.values()], incomplete, contrastMeasured: measured.size };
}

// Puts whollyInSight on the page: whether an element is wholly on the screen and inside everything
// that clips it.
const WHOLLY_IN_SIGHT = () => {
  (window as unknown as { whollyInSight: (element: Element | null) => boolean }).whollyInSight = (element) => {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    if (rect.top < 0 || rect.left < 0 || rect.bottom > window.innerHeight || rect.right > window.innerWidth) return false;
    for (let clip = element.parentElement; clip && clip !== document.body; clip = clip.parentElement) {
      const style = getComputedStyle(clip);
      if (style.overflowX === "visible" && style.overflowY === "visible") continue;
      const bounds = clip.getBoundingClientRect();
      if (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1 || rect.left < bounds.left - 1 || rect.right > bounds.right + 1) return false;
    }
    return true;
  };
};

declare function whollyInSight(element: Element | null): boolean;

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
