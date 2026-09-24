import sharp from "sharp";
import { createDraft } from "./events";
import { OPERATOR, PASSWORD, signIn, signUpVerified } from "./hosts";
import { expect, test, type APIRequestContext, type Page } from "./test";

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
  test.setTimeout(240_000);
  for (const path of ["/", "/sign-up", "/sign-in", "/privacy", "/terms", "/too-fast", "/e/abcdefghij"]) {
    await page.goto(path);
    await expectStill(page, path);
  }

  // A host with an event, on their own pages: the form as they create it, and their draft.
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const host = await context.newPage();
  await signUpVerified(host, request, "still");
  await host.goto("/dashboard");
  await expectStill(host, "the dashboard");
  await host.goto("/events/new");
  await host.getByRole("button", { name: "Add a question" }).click();
  await expectStill(host, "the event form, creating");
  const link = await createDraft(host, { title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "1", questions: [{ prompt: "Any allergies?" }] });
  const manage = host.url();
  await host.goto(link);
  await expectStill(host, "a draft, as its host sees it");
  await page.goto(link);
  await expectStill(page, "a draft, as a guest sees it");
  await host.goto(manage);
  await host.getByRole("button", { name: "Publish" }).click();
  await expect(host.getByText("Published", { exact: true })).toBeVisible({ timeout: 15_000 });
  await host.getByRole("button", { name: "Delete event" }).hover();
  await host.getByRole("button", { name: "Delete event" }).click();
  await expect(host.getByRole("alertdialog")).toBeVisible();
  await expectStill(host, "the event form, with the delete dialog open");
  await host.keyboard.press("Escape");
  await expectStill(host, "the event form, the dialog closed");

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
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain("rose-garden");
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

  // Inline, another guest answers under the buttons, step by step.
  await host.getByRole("button", { name: "Design" }).click();
  await drawer.getByRole("button", { name: "Details" }).click();
  await drawer.getByRole("group", { name: "RSVP style" }).getByRole("radio", { name: "Inline" }).check();
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain('rsvpStyle\\":\\"inline');
  const second = await browser.newContext({ reducedMotion: "reduce" });
  const inline = await second.newPage();
  await inline.goto(link);
  await inline.getByRole("button", { name: "Going" }).click();
  await inline.getByLabel("Your name").fill("Mei Tan");
  await expect(inline.getByRole("dialog")).toHaveCount(0);
  await expectStill(inline, "the Inline RSVP flow, the name step");
  await inline.getByRole("button", { name: "Continue" }).click();
  await inline.getByRole("radio", { name: "+1" }).click();
  await expectStill(inline, "the Inline RSVP flow, the plus-ones step");
  await inline.getByRole("button", { name: "Continue" }).click();
  await expectStill(inline, "the Inline RSVP flow, the questions step");
  await inline.getByRole("button", { name: "Send RSVP" }).click();
  await expect(inline.getByText("You’re going!")).toBeVisible();
  await expectStill(inline, "the Inline RSVP flow, the confirmation");
  await second.close();

  // The host's picture as the poster.
  await drawer.getByLabel("Upload your photo or poster").setInputFiles(await picture());
  await expect(drawer.getByRole("group", { name: "Use it as" })).toBeVisible({ timeout: 20_000 });
  await drawer.getByRole("group", { name: "Use it as" }).getByRole("radio", { name: "Poster" }).check();
  await expect.poll(() => guestHtml(request, link), { timeout: 15_000 }).toContain("poster.webp");
  await expectStill(host, "the Design drawer, with the host's picture");
  await page.reload();
  await expect(page.locator('[data-slot="poster-card"] img')).toBeVisible();
  await expectStill(page, "the event page, poster mode");

  // The host's guest list, with the guest opened for editing, and the share screen.
  await host.goto(`${manage}/guests`);
  await host.getByRole("button", { name: "Edit" }).first().click();
  await expectStill(host, "the guest list");
  await host.goto(`${manage}/share`);
  await expectStill(host, "the share screen");

  // Called off: the page with its notice.
  await host.goto(manage);
  await host.getByRole("button", { name: "Cancel event" }).click();
  await host.getByRole("button", { name: "Cancel the event" }).click();
  await expect(host.getByText("Cancelled", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("This event is cancelled")).toBeVisible();
  await expectStill(page, "a cancelled event");
  await context.close();

  // The operator's instance settings.
  await signIn(page, OPERATOR.email, PASSWORD);
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await page.goto("/instance");
  await expectStill(page, "the instance settings");
});

// What a guest's browser is sent for the page, which is the saved theme.
async function guestHtml(request: APIRequestContext, link: string) {
  return (await request.get(link)).text();
}

// A poster made in another tool.
async function picture() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1350"><rect width="100%" height="100%" fill="#1d2340"/><circle cx="450" cy="450" r="220" fill="#f5c16c"/></svg>`;
  return { name: "poster.jpg", mimeType: "image/jpeg", buffer: await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer() };
}
