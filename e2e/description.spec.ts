import { expect, test, type Page } from "./test";
import { createPublished, savedAfter } from "./events";

// The description is written in the editor's About sheet (M4 ticket 05), opened from its row.
async function openAbout(page: Page) {
  await page.getByRole("button", { name: /^About:/ }).click();
  const sheet = page.getByRole("dialog", { name: "About" });
  await expect(sheet).toBeVisible();
  return sheet;
}

// Done saves it, and the sheet closes once it has.
async function done(page: Page) {
  const sheet = page.getByRole("dialog", { name: "About" });
  await savedAfter(page, () => sheet.getByRole("button", { name: "Done" }).click());
  await expect(sheet).toBeHidden();
}

test("formatting survives saving, reopening, and the guest's page", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "description", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    description: "Bring nothing.",
  });

  // Bold the whole description, add a bullet list, and save. The label is the editor's, and the
  // toolbar says which formatting is on where the cursor is.
  const about = await openAbout(host.page);
  const editor = about.getByLabel("Description");
  await about.getByText("Description", { exact: true }).click();
  await expect(editor).toBeFocused();
  await host.page.keyboard.press("ControlOrMeta+a");
  const bold = about.getByRole("button", { name: "Bold" });
  await expect(bold).toHaveAttribute("aria-pressed", "false");
  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "true");
  await expect(about.getByRole("button", { name: "Italic" })).toHaveAttribute("aria-pressed", "false");
  await done(host.page);

  // It comes back bold when the host opens it again.
  await host.page.reload();
  await expect((await openAbout(host.page)).getByLabel("Description").locator("strong")).toHaveText("Bring nothing.");

  // And the guest sees it that way too.
  await page.goto(host.link);
  await expect(page.getByText("About")).toBeVisible();
  await expect(page.locator('[data-slot="description"] strong')).toHaveText("Bring nothing.");

  await host.context.close();
});

test("a host adds a link and a bullet list from the toolbar", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "description-toolbar", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    description: "The venue",
  });

  host.page.on("dialog", (dialog) => dialog.accept("https://example.test/venue"));
  const about = await openAbout(host.page);
  await about.getByLabel("Description").click();
  await host.page.keyboard.press("ControlOrMeta+a");
  await about.getByRole("button", { name: "Add a link" }).click();
  await about.getByRole("button", { name: "Bullet list" }).click();
  await done(host.page);

  await page.goto(host.link);
  const link = page.locator('[data-slot="description"] li a');
  await expect(link).toHaveText("The venue");
  await expect(link).toHaveAttribute("href", "https://example.test/venue");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(link).toHaveAttribute("target", "_blank");

  await host.context.close();
});

test("a hostile paste leaves nothing but words behind", async ({ page, request, browser }) => {
  test.slow();
  const host = await createPublished(browser, request, "description-hostile", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    description: "placeholder",
  });

  // What a paste from a hostile page would leave in the editable area.
  const editor = (await openAbout(host.page)).getByLabel("Description");
  await editor.evaluate((element) => {
    element.innerHTML =
      '<p>Safe <b>bold</b> <a href="javascript:alert(1)">tap me</a></p>' +
      '<script>alert(2)</script><iframe src="https://evil.test"></iframe>' +
      '<img src=x onerror="alert(3)"><h1>Shouty</h1>';
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // The browser tries the picture, gives up, and draws a broken icon in its place, which moves
  // the rest of the sheet down. The host saves once the editor has settled.
  await expect(editor.locator("img")).toHaveJSProperty("complete", true);
  await done(host.page);

  await page.goto(host.link);
  const about = page.locator('[data-slot="description"]');
  await expect(about).toContainText("Safe");
  await expect(about.locator("strong")).toHaveText("bold");
  // The words survive; the link, the script, the frame and the image do not.
  await expect(about).toContainText("tap me");
  await expect(about.locator("a[href^='javascript']")).toHaveCount(0);
  await expect(about.locator("script, iframe, img, h1")).toHaveCount(0);
  expect(await page.content()).not.toContain("alert(2)");
  expect(await page.content()).not.toContain("evil.test");

  await host.context.close();
});

test("a description the server cannot read is refused, not thrown away", async ({ page, request, browser }) => {
  test.slow();
  const host = await createPublished(browser, request, "description-unreadable", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    description: "Bring nothing.",
  });

  // Whatever mangles the field, the host's words are not quietly replaced with nothing: the sheet
  // stays open, saying so.
  const about = await openAbout(host.page);
  await about.locator('input[name="description"]').evaluate((field) => {
    (field as HTMLInputElement).value = "not a document at all";
  });
  await about.getByRole("button", { name: "Done" }).click();
  await expect(about.getByText("The description could not be read.")).toBeVisible();

  await page.goto(host.link);
  await expect(page.getByText("Bring nothing.")).toBeVisible();

  await host.context.close();
});
