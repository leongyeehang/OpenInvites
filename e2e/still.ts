import { expect, type Page } from "@playwright/test";

// Ticket 20 (spec, story 65): what reduced-motion.spec.ts checks after each thing a person does,
// shared with the specs that check a page of their own under reduced motion
// (e2e/home-page.spec.ts). The page is running no animation or transition, and no element (nor
// its ::before or ::after) would run one: every duration is zero.
export async function expectStill(page: Page, where: string) {
  const moving = await page.evaluate(() => {
    const running = document.getAnimations().map((animation) => `${animation.constructor.name} on ${describe(animation.effect instanceof KeyframeEffect ? animation.effect.target : null)}`);
    const timed = [...document.querySelectorAll("*")].flatMap((element) =>
      [null, "::before", "::after"].flatMap((pseudo) => {
        const style = getComputedStyle(element, pseudo);
        const lasts = (durations: string) => durations.split(",").some((duration) => parseFloat(duration) > 0);
        return lasts(style.animationDuration) || lasts(style.transitionDuration)
          ? [`${describe(element)}${pseudo ?? ""}: animation ${style.animationName} ${style.animationDuration}, transition ${style.transitionProperty} ${style.transitionDuration}`]
          : [];
      }),
    );
    return [...running, ...timed];

    function describe(element: Element | null) {
      if (!element) return "nothing";
      const classes = typeof element.className === "string" ? element.className.split(/\s+/).slice(0, 4).join(".") : "";
      return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}`;
    }
  });
  expect.soft(moving, `what moves on ${where}`).toEqual([]);
}
