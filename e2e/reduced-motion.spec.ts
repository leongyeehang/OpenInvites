import { createDraft } from "./events";
import { OPERATOR, PASSWORD, signIn, signUpVerified } from "./hosts";
import { expect, test, type Page } from "./test";

// Ticket 20 (spec, story 65): when the guest's device asks for reduced motion, nothing moves
// anywhere. After each thing a person does, the page is running no animation or transition, and
// no element (nor its ::before or ::after) would run one: every duration is zero.
test.use({ contextOptions: { reducedMotion: "reduce" } });

async function expectStill(page: Page, where: string) {
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

test("under reduced motion nothing moves, on any page, whatever a person does", async ({ page, browser, request }) => {
  test.slow();
  for (const path of ["/", "/sign-up", "/sign-in", "/privacy", "/terms", "/too-fast", "/e/abcdefghij"]) {
    await page.goto(path);
    await expectStill(page, path);
  }

  // A host with an event, on their own pages.
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const host = await context.newPage();
  await signUpVerified(host, request, "still");
  await host.goto("/dashboard");
  await expectStill(host, "the dashboard");
  const link = await createDraft(host, { title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "1", questions: [{ prompt: "Any allergies?" }] });
  await host.getByRole("button", { name: "Publish" }).click();
  await expect(host.getByText("Published", { exact: true })).toBeVisible();
  await host.getByRole("button", { name: "Delete event" }).hover();
  await host.getByRole("button", { name: "Delete event" }).click();
  await expect(host.getByRole("alertdialog")).toBeVisible();
  await expectStill(host, "the event form, with the delete dialog open");
  await host.keyboard.press("Escape");
  await expectStill(host, "the event form, the dialog closed");
  const manage = host.url();

  // The Design drawer: opened, a template, a knob, closed.
  await host.goto(link);
  await host.getByRole("button", { name: "Design" }).hover();
  await host.getByRole("button", { name: "Design" }).click();
  const drawer = host.getByRole("dialog", { name: "Design" });
  await expectStill(host, "the Design drawer, open");
  // Vows, like Birthday, has guests answer in the sheet.
  await drawer.getByRole("radio", { name: "Vows" }).check();
  await drawer.getByRole("button", { name: "Details" }).click();
  await drawer.getByRole("radio", { name: "Glass" }).check();
  await expect(drawer.getByText("Theme: Custom, started from Vows")).toBeVisible();
  await expectStill(host, "the Design drawer, after a template and a knob");
  await host.keyboard.press("Escape");
  await expectStill(host, "the event page, the drawer closed");

  // A guest answers in the sheet, from the first tap to the confirmation, and closes it.
  await page.goto(link);
  await expectStill(page, "the event page");
  await page.getByRole("button", { name: "Going" }).hover();
  await page.getByRole("button", { name: "Going" }).click();
  const sheet = page.getByRole("dialog", { name: "Your RSVP" });
  await sheet.getByLabel("Your name").fill("Priya Nair");
  await expectStill(page, "the RSVP sheet, open");
  await sheet.getByRole("button", { name: "Continue" }).click();
  await sheet.getByRole("radio", { name: "+1" }).click();
  await expectStill(page, "the RSVP sheet, grown by a step");
  await sheet.getByRole("button", { name: "Continue" }).click();
  await sheet.getByRole("button", { name: "Send RSVP" }).click();
  await expect(sheet.getByText("You’re going!")).toBeVisible();
  await expectStill(page, "the RSVP sheet, the confirmation");
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
  await expectStill(page, "the event page, the sheet closed");

  // The host's guest list, with the guest opened for editing, and the share screen.
  await host.goto(`${manage}/guests`);
  await host.getByRole("button", { name: "Edit" }).click();
  await expectStill(host, "the guest list");
  await host.goto(`${manage}/share`);
  await expectStill(host, "the share screen");
  await context.close();

  // The operator's instance settings.
  await signIn(page, OPERATOR.email, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await page.goto("/instance");
  await expectStill(page, "the instance settings");
});
