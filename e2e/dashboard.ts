import sharp from "sharp";
import { createDraft, createPublished, publishInEditor } from "./events";
import { clientAddress, expect, type APIRequestContext, type Browser, type Locator } from "./test";

// A host whose dashboard has an event on every shelf (dashboard, tickets 03 and 05): Next up, with
// a reply waiting for approval; a later published event under Coming up; a draft under Drafts; and
// a draft that has ended under Past. The accessibility, keyboard, locale and reduced-motion specs
// check the dashboard as it is with them.
export const SHELVES = {
  nextUp: "Ada’s supper club",
  comingUp: "Spring picnic",
  draft: "Not ready yet",
  past: "Last year’s party",
} as const;

export async function hostWithShelves(browser: Browser, request: APIRequestContext, label: string) {
  const host = await createPublished(browser, request, label, { title: SHELVES.nextUp, start: "2027-03-06T19:00", approval: true });
  const guestContext = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": clientAddress() } });
  const guest = await guestContext.newPage();
  await guest.goto(host.link);
  await guest.getByRole("button", { name: "Going", exact: true }).click();
  await guest.getByLabel("Your name").fill("Asha Menon");
  if (await guest.getByRole("button", { name: "Continue" }).isVisible()) {
    await guest.getByRole("button", { name: "Continue" }).click();
    await guest.getByRole("radio", { name: "Just me" }).click();
  }
  await guest.getByRole("button", { name: "Send RSVP" }).click();
  await expect(guest.getByRole("heading", { name: "Your reply is waiting for the host’s approval." })).toBeVisible({ timeout: 15_000 });
  await guestContext.close();

  await createDraft(host.page, { title: SHELVES.comingUp, start: "2027-04-10T12:00" });
  await publishInEditor(host.page);
  await createDraft(host.page, { title: SHELVES.draft, start: "2027-03-01T19:00" });
  await createDraft(host.page, { title: SHELVES.past, start: "2020-01-01T10:00" });
  await host.page.goto("/dashboard");
  await expect(host.page.getByRole("region", { name: "Past", exact: true }).getByText(SHELVES.past)).toBeVisible();
  return host;
}

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

function luminance(rgb: number[]) {
  return rgb
    .map((channel) => channel / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, at) => sum + c * [0.2126, 0.7152, 0.0722][at], 0);
}
