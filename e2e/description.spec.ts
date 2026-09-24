import { expect, test } from "./test";
import { createPublished } from "./events";

test("formatting survives saving, reopening, and the guest's page", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "description", {
    title: "Ada’s birthday",
    start: "2027-03-06T19:00",
    description: "Bring nothing.",
  });

  // Bold the whole description, add a bullet list, and save. The label is the editor's, and the
  // toolbar says which formatting is on where the cursor is.
  const editor = host.page.getByLabel("Description");
  await host.page.getByText("Description", { exact: true }).click();
  await expect(editor).toBeFocused();
  await host.page.keyboard.press("ControlOrMeta+a");
  const bold = host.page.getByRole("button", { name: "Bold" });
  await expect(bold).toHaveAttribute("aria-pressed", "false");
  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "true");
  await expect(host.page.getByRole("button", { name: "Italic" })).toHaveAttribute("aria-pressed", "false");
  await host.page.getByRole("button", { name: "Save changes" }).click();
  await expect(host.page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });

  // It comes back bold when the host returns to the form.
  await host.page.reload();
  await expect(host.page.getByLabel("Description").locator("strong")).toHaveText("Bring nothing.");

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
  await host.page.getByLabel("Description").click();
  await host.page.keyboard.press("ControlOrMeta+a");
  await host.page.getByRole("button", { name: "Add a link" }).click();
  await host.page.getByRole("button", { name: "Bullet list" }).click();
  await host.page.getByRole("button", { name: "Save changes" }).click();
  await expect(host.page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });

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
  const editor = host.page.getByLabel("Description");
  await editor.evaluate((element) => {
    element.innerHTML =
      '<p>Safe <b>bold</b> <a href="javascript:alert(1)">tap me</a></p>' +
      '<script>alert(2)</script><iframe src="https://evil.test"></iframe>' +
      '<img src=x onerror="alert(3)"><h1>Shouty</h1>';
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // The browser tries the picture, gives up, and draws a broken icon in its place, which moves
  // the rest of the form down. The host saves once the editor has settled.
  await expect(editor.locator("img")).toHaveJSProperty("complete", true);
  await host.page.getByRole("button", { name: "Save changes" }).click();
  await expect(host.page.getByText("Saved.")).toBeVisible({ timeout: 15_000 });

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

  // Whatever mangles the field, the host's words are not quietly replaced with nothing.
  await host.page.locator('input[name="description"]').evaluate((field) => {
    (field as HTMLInputElement).value = "not a document at all";
  });
  await host.page.getByRole("button", { name: "Save changes" }).click();
  await expect(host.page.getByText("The description could not be read.")).toBeVisible();

  await page.goto(host.link);
  await expect(page.getByText("Bring nothing.")).toBeVisible();

  await host.context.close();
});
