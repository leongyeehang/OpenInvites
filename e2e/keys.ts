import type { Locator, Page } from "@playwright/test";

// Tab until the target has the focus, or give up after thirty presses: how the keyboard rows reach
// a control through whatever stands before it.
export async function tabUntil(page: Page, target: Locator) {
  for (let presses = 0; presses < 30; presses++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`never reached ${target}`);
}
