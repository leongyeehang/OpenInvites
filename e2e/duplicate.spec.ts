import { expect, test } from "./test";
import sharp from "sharp";
import { createPublished, type DraftFields } from "./events";

// Ticket 09: a host duplicates an event into a new draft with its details, look, questions,
// settings and picture; replies stay with the event they were made to.
const EVENT: DraftFields = {
  title: "Ada’s garden party",
  start: "2027-05-08T16:00",
  location: "The back garden",
  plusOnes: "0",
  reminders: false,
  questions: [{ prompt: "Starter?", type: "choice", required: true, choices: "Soup, Salad" }],
};

const PICTURE_SRC = /src="(\/uploads\/[0-9a-f-]{36}\/background\.webp)"/;

test("duplicating makes a new draft with the same details, questions, settings and picture, and none of the replies", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "duplicate", EVENT);
  const sourceManage = host.page.url();

  // The picture, uploaded as a host does in the Design drawer of the event page.
  await host.page.goto(host.link);
  await host.page.getByRole("button", { name: "Design" }).click();
  const photo = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#1d2340" } }).jpeg().toBuffer();
  await host.page
    .getByRole("dialog", { name: "Design" })
    .getByLabel("Upload your photo or poster")
    .setInputFiles({ name: "garden.jpg", mimeType: "image/jpeg", buffer: photo });
  await expect.poll(async () => (await host.page.content()).match(PICTURE_SRC)?.[1], { timeout: 20_000 }).toBeTruthy();
  const sourcePicture = (await host.page.content()).match(PICTURE_SRC)![1];

  // A guest replies to the source.
  await page.goto(host.link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "Soup" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("You’re going!")).toBeVisible();
  await host.page.goto(`${sourceManage}/guests`);
  await expect(host.page.getByText("Priya Nair")).toBeVisible();

  // Duplicate from the manage page: the copy opens as a draft, and says where it came from.
  await host.page.goto(sourceManage);
  await host.page.getByRole("button", { name: "Duplicate" }).click();
  await expect(host.page).toHaveURL(/\/events\/[0-9a-f-]{36}\?from=[0-9a-f-]{36}$/, { timeout: 15_000 });
  expect(host.page.url().split("?")[0]).not.toBe(sourceManage);
  await expect(host.page.getByText("Duplicated from Ada’s garden party", { exact: true })).toBeVisible();
  await expect(host.page.getByText("Draft", { exact: true })).toBeVisible();
  const copyManage = host.page.url().split("?")[0];
  const copyLink = (await host.page.getByText(/^https?:\/\/\S+\/e\/[A-Za-z0-9]{10}$/).textContent())!.trim();
  expect(copyLink).not.toBe(host.link);

  // The form holds the same values and the question.
  await expect(host.page.getByLabel("Title")).toHaveValue("Ada’s garden party (copy)");
  await expect(host.page.getByLabel("Starts")).toHaveValue("2027-05-08T16:00");
  await expect(host.page.getByLabel("Where")).toHaveValue("The back garden");
  await expect(host.page.getByLabel("Plus-ones per guest")).toHaveValue("0");
  await expect(host.page.getByLabel("Remind guests by email (a week before to Maybe, the day before to Going)")).not.toBeChecked();
  await expect(host.page.getByLabel("Question 1", { exact: true })).toHaveValue("Starter?");
  await expect(host.page.getByLabel("Question 1 choices")).toHaveValue("Soup, Salad");

  // The host sees the picture on the copy's page, as a file of its own, and the replies stayed behind.
  await host.page.goto(copyLink);
  const copyPicture = (await host.page.content()).match(PICTURE_SRC)?.[1];
  expect(copyPicture).toBeTruthy();
  expect(copyPicture).not.toBe(sourcePicture);
  expect((await host.page.request.get(copyPicture!)).status()).toBe(200);
  await host.page.goto(`${copyManage}/guests`);
  await expect(host.page.getByText("Priya Nair")).toHaveCount(0);

  await host.context.close();
});

test("a notice names only an event the host can open", async ({ browser, request }) => {
  const host = await createPublished(browser, request, "duplicate-notice", { title: "Ada’s garden party", start: "2027-05-08T16:00" });
  await host.page.goto(`${host.page.url()}?from=0194f0a0-0000-7000-8000-000000000001`);
  await expect(host.page.getByRole("heading", { name: "Ada’s garden party" })).toBeVisible();
  await expect(host.page.getByText(/Duplicated from/)).toHaveCount(0);
  await host.context.close();
});
