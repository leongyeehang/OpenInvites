import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatWhen } from "@/events/time";
import { translatorFor } from "@/locale/messages";
import { invitationMail } from "./invitation-mail";

// Ada's supper club, on 6 March 2027 at 7 pm in Singapore, at her flat, which is not invite-only.
const WHEN = { startsAt: new Date("2027-03-06T11:00:00Z"), endsAt: null, allDay: false, timeZone: "Asia/Singapore" };
const SUPPER: Parameters<typeof invitationMail>[0] = {
  title: "Ada’s supper club",
  startsAt: WHEN.startsAt,
  endsAt: null,
  allDay: false,
  timeZone: "Asia/Singapore",
  location: "12 Jalan Bukit, #04-01",
  locale: "en",
  inviteOnly: false,
  lettersEnabled: true,
};

const MEI = { name: "Mei Lin", letter: "", token: "AbCdEfGhIjKlMnOpQrStUvWx" };

beforeEach(() => {
  vi.stubEnv("BASE_URL", "https://invites.example/");
});

describe("invitationMail", () => {
  it("says who invited the guest to what, when, where, and gives their personal invite link", async () => {
    const mail = invitationMail(SUPPER, MEI, "Ada Lovelace", await translatorFor("en"));
    expect(mail.subject).toBe("Ada Lovelace invited you to Ada’s supper club");
    expect(mail.body).toContain("Hi Mei Lin,");
    expect(mail.body).toContain("Ada Lovelace invited you to Ada’s supper club.");
    expect(mail.body).toContain(`When: ${formatWhen(WHEN, "en")}`);
    expect(mail.body).toContain("Where: 12 Jalan Bukit, #04-01");
    expect(mail.body).toContain("Open your invitation: https://invites.example/i/AbCdEfGhIjKlMnOpQrStUvWx");
  });

  it("carries the host's letter as they wrote it, line breaks and all, and nothing in its place when there is none", async () => {
    const t = await translatorFor("en");
    const letter = "亲爱的美玲：\n记得带上你的吉他。\n\n— Ada";
    const lettered = invitationMail(SUPPER, { ...MEI, letter }, "Ada Lovelace", t);
    expect(lettered.body).toContain(`\n\n${letter}\n\n`);
    const plain = invitationMail(SUPPER, MEI, "Ada Lovelace", t);
    expect(plain.body).not.toContain("\n\n\n");
    expect(plain.body).toBe(lettered.body.replace(`\n\n${letter}`, ""));
  });

  it("leaves the letter out while the event has personal letters off, as the event page does", async () => {
    const letter = "亲爱的美玲：\n记得带上你的吉他。";
    const t = await translatorFor("en");
    const off = invitationMail({ ...SUPPER, lettersEnabled: false }, { ...MEI, letter }, "Ada Lovelace", t);
    expect(off.body).not.toContain("亲爱的美玲");
    expect(off.body).toBe(invitationMail(SUPPER, MEI, "Ada Lovelace", t).body);
  });

  it("leaves out where when the host has not said, and when while the date is not set", async () => {
    const t = await translatorFor("en");
    const nowhere = invitationMail({ ...SUPPER, location: "" }, MEI, "Ada Lovelace", t);
    expect(nowhere.body).toContain("When: ");
    expect(nowhere.body).not.toContain("Where:");
    const undated = invitationMail({ ...SUPPER, startsAt: null }, MEI, "Ada Lovelace", t);
    expect(undated.body).not.toContain("When:");
    expect(undated.body).toContain("\n\nWhere: 12 Jalan Bukit, #04-01\n\n");
    const neither = invitationMail({ ...SUPPER, startsAt: null, location: "" }, MEI, "Ada Lovelace", t);
    expect(neither.body).not.toContain("\n\n\n");
  });

  it("says that opening it asks for a code sent to this address only on an invite-only event", async () => {
    const t = await translatorFor("en");
    expect(invitationMail(SUPPER, MEI, "Ada Lovelace", t).body).not.toContain("code");
    const closed = invitationMail({ ...SUPPER, inviteOnly: true }, MEI, "Ada Lovelace", t);
    expect(closed.body).toMatch(/code.*this address/);
  });

  it("is written in the language it is given, the event's own", async () => {
    const zh = { ...SUPPER, locale: "zh-Hans" as const };
    const mail = invitationMail(zh, MEI, "Ada Lovelace", await translatorFor("zh-Hans"));
    expect(mail.subject).toContain("Ada Lovelace");
    expect(mail.subject).toContain("Ada’s supper club");
    expect(mail.subject).not.toContain("invited you");
    expect(mail.body).toContain(formatWhen(WHEN, "zh-Hans"));
    expect(mail.body).toContain("https://invites.example/i/AbCdEfGhIjKlMnOpQrStUvWx");
  });
});
