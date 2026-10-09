import { createPublished, type DraftFields } from "./events";
import { latestMailTo, linkIn, newHost } from "./hosts";
import { expect, test } from "./test";

// Ticket 04 (M3): contact details. The host asks for an email and a phone number each in one of
// three ways, don't ask, optional or required; a guest is held to them in every layout, and the
// host reads both on the guest list and can set them there. The guest drives the test's own page,
// so all of it runs at 390 pixels in the mobile project and at desktop width in the other.

const PARTY = { rsvpStyle: "Inline", title: "Ada’s birthday", start: "2027-03-06T19:00", plusOnes: "1" } satisfies DraftFields;

test("an event that requires an email and a phone number refuses each left blank, at the step that holds it", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "contact-required", { ...PARTY, email: "required", phone: "required" });

  await page.goto(host.link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  // Both are marked as required, and neither is called optional.
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-required", "true");
  await expect(page.getByLabel("Phone number")).toHaveAttribute("aria-required", "true");
  await expect(page.getByLabel("Phone number")).toHaveAttribute("inputmode", "tel");
  await expect(page.getByLabel("Phone number")).toHaveAttribute("autocomplete", "tel");
  await expect(page.getByText("The host can reach you here.", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Optional\./)).toHaveCount(0);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "Just me" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();

  // Back at the step with the fields, with the line in front of the guest.
  await expect(page.getByText("The host would like your email address.")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Just me" })).toBeHidden();
  await page.getByLabel("Email").fill("priya@example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();

  await expect(page.getByText("The host would like your phone number.")).toBeVisible();
  await page.getByLabel("Phone number").fill("12");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();

  await expect(page.getByText("Enter a phone number of 5 to 20 digits.")).toBeVisible();
  await expect(page.getByLabel("Phone number")).toBeVisible();
  await page.getByLabel("Phone number").fill("+65 9123 4567");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();

  await expect(page.getByText("You’re going!")).toBeVisible();
  await expect(page.getByText("We’ll reach you at priya@example.test.")).toBeVisible();
  await expect(page.getByText("Phone: +65 9123 4567", { exact: true })).toBeVisible();

  await host.context.close();
});

test("a phone number asked for optionally reaches the host's guest list, and the host can change it and give an email", async ({
  page,
  browser,
  request,
}) => {
  test.slow();
  const host = await createPublished(browser, request, "contact-phone", { ...PARTY, phone: "optional" });
  const manage = host.page.url();
  const email = newHost("contact-guest").email;

  await page.goto(host.link);
  await page.getByRole("button", { name: "Going" }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  // The host does not ask for an email, so there is no field for one.
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByLabel("Phone number")).not.toHaveAttribute("aria-required");
  await expect(page.getByText("Optional. Only the hosts see it.", { exact: true })).toBeVisible();
  await page.getByLabel("Phone number").fill("(02) 555-1234");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "Just me" }).click();
  await page.getByRole("button", { name: "Send RSVP" }).click();
  await expect(page.getByText("Phone: (02) 555-1234", { exact: true })).toBeVisible();

  await host.page.goto(`${host.page.url()}/guests`);
  const going = host.page.getByRole("region", { name: /^Going/ });
  await expect(going.getByText("(02) 555-1234", { exact: true })).toBeVisible();

  // Told a new number and an email in person, the host puts them on the guest's RSVP, though the
  // form never asked the guest for an email.
  await host.page.getByRole("button", { name: "Edit" }).click();
  await expect(host.page.getByLabel("Phone number")).toHaveValue("(02) 555-1234");
  await expect(host.page.getByLabel("Email")).toHaveValue("");
  await host.page.getByLabel("Phone number").fill("12");
  await host.page.getByRole("button", { name: "Save" }).click();
  await expect(host.page.getByText("Enter a phone number of 5 to 20 digits.")).toBeVisible();
  await host.page.getByLabel("Phone number").fill("+65 8123 0000");
  await host.page.getByLabel("Email").fill(email);
  await host.page.getByRole("button", { name: "Save" }).click();
  await expect(host.page.getByText("Saved.")).toBeVisible();
  await expect(going.getByText("+65 8123 0000", { exact: true })).toBeVisible();
  await expect(going.getByText("(02) 555-1234", { exact: true })).toHaveCount(0);
  await expect(going.getByText(email, { exact: true })).toBeVisible();

  // The guest sees what the host set.
  await page.reload();
  await expect(page.getByText("Phone: +65 8123 0000", { exact: true })).toBeVisible();
  await expect(page.getByText(`We’ll reach you at ${email}.`)).toBeVisible();

  // An email the host gave is a guest's email like any other: an announcement reaches it, with the
  // stop link at its foot.
  await host.page.goto(manage);
  await host.page.getByRole("link", { name: "Announcements" }).click();
  await host.page.getByLabel("Message").fill("Doors open at seven.");
  await host.page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(host.page.getByRole("status")).toHaveText("Posted to the event page and emailed to 1 guest.", { timeout: 15_000 });
  const mail = await latestMailTo(request, email);
  expect(mail).toContain("Doors open at seven.");
  expect(new URL(linkIn(mail)).pathname).toMatch(/^\/m\/[A-Za-z0-9]{24}$/);

  await host.context.close();
});

test("the Broadsheet's ballot refuses a blank email the host requires, then takes one", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "contact-broadsheet", {
    layout: "Broadsheet",
    title: "Supper at Mei’s",
    start: "2027-03-06T19:00",
    plusOnes: "0",
    email: "required",
  });

  await page.goto(host.link);
  await page.getByRole("radio", { name: "I’ll be there", exact: true }).check();
  await page.getByLabel("Your name").fill("Priya Nair");
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-required", "true");
  await expect(page.getByLabel("Phone number")).toHaveCount(0);
  await page.getByRole("button", { name: "Post my reply" }).click();
  await expect(page.getByText("The host would like your email address.")).toBeVisible();

  await page.getByLabel("Email").fill("priya@example.test");
  await page.getByRole("button", { name: "Post my reply" }).click();
  await expect(page.getByText("Received", { exact: true })).toBeVisible();
  await expect(page.getByText("We’ll reach you at priya@example.test.")).toBeVisible();

  await host.context.close();
});

test("the Thread asks for an email the host requires with no skip, and takes it once it is an address", async ({ page, browser, request }) => {
  test.slow();
  const host = await createPublished(browser, request, "contact-thread", {
    layout: "Thread",
    title: "Ada’s party",
    start: "2027-03-06T15:00",
    plusOnes: "0",
    email: "required",
  });
  const conversation = page.getByRole("log");
  const send = page.getByRole("button", { name: "Send", exact: true });

  await page.goto(host.link);
  await page.getByRole("button", { name: "Going", exact: true }).click();
  await page.getByLabel("Your name").fill("Priya Nair");
  await send.click();

  // Asked without the offer of a skip, and a blank answer cannot be sent.
  await expect(conversation.getByText("And your email, so I can reach you?", { exact: true })).toBeVisible();
  const email = page.getByLabel("Email");
  await expect(email).toHaveAttribute("aria-required", "true");
  await expect(page.getByRole("button", { name: "Skip", exact: true })).toHaveCount(0);
  await expect(send).toBeDisabled();
  await email.fill("   ");
  await expect(send).toBeDisabled();

  // Something that is not an address is refused, and the guest is asked for the email again.
  await email.fill("priya at example");
  await send.click();
  await expect(page.getByText("That does not look like an email address.")).toBeVisible();
  await expect(email).toBeVisible();
  await email.fill("priya@example.test");
  await send.click();

  await expect(conversation.getByText("priya@example.test", { exact: true })).toBeVisible();
  await expect(page.locator('[data-slot="done"]')).toContainText("You’re in, Priya!", { timeout: 15_000 });

  await host.context.close();
});
