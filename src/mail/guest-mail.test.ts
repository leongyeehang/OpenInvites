import { beforeEach, describe, expect, it, vi } from "vitest";
import { translatorFor } from "@/locale/messages";
import { guestMail } from "./guest-mail";

const GUEST = { email: "mei@example.test", mailToken: "AbCdEfGhIjKlMnOpQrStUvWx", locale: "en" as const };
const EVENT = { id: "0190a000-0000-7000-8000-000000000000", title: "Ada’s supper club" };
const CONTENT = { subject: "Ada’s supper club", body: "The words above the footer." };

beforeEach(() => {
  vi.stubEnv("BASE_URL", "https://invites.example/");
});

describe("guestMail", () => {
  it("ends an email about a reply with why the guest got it, as it always has, and the stop link", async () => {
    const mail = guestMail(GUEST, EVENT, CONTENT, await translatorFor("en"));
    expect(mail).toMatchObject({ eventId: EVENT.id, to: GUEST.email, subject: CONTENT.subject });
    expect(mail.text).toBe(
      "The words above the footer.\n\nYou’re getting this because your email is on your reply to Ada’s supper club. To stop emails about this event: https://invites.example/m/AbCdEfGhIjKlMnOpQrStUvWx",
    );
  });

  it("ends an invitation with the invitation's footer, which points at no reply, and the stop link", async () => {
    const mail = guestMail(GUEST, EVENT, CONTENT, await translatorFor("en"), "Mail.invitationFooter");
    expect(mail.text.startsWith("The words above the footer.\n\n")).toBe(true);
    expect(mail.text).not.toContain("your reply");
    expect(mail.text).toContain("Ada’s supper club");
    expect(mail.text).toMatch(/To stop emails about this event: https:\/\/invites\.example\/m\/AbCdEfGhIjKlMnOpQrStUvWx$/);
  });
});
