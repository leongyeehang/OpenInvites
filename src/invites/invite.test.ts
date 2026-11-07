import { describe, expect, it } from "vitest";
import { SLUG_ALPHABET } from "@/events/slug";
import { awaitsInvitation, canMailInvite, generateInviteToken, inviteState, MAX_INVITES, MAX_LETTER, parseInvite, parseInviteLines, parseLetter, roomForInvite, type InviteFields } from "./invite";

// What the host's form posts, its fields left blank unless a test fills them.
function posted(fields: Partial<InviteFields>): InviteFields {
  return { name: "", email: "", phone: "", letter: "", ...fields };
}

// One invite as trusted, with no email, phone or letter unless a test gives them.
function invited(fields: { name: string; email?: string; phone?: string; letter?: string }) {
  return { email: null, phone: null, letter: "", ...fields };
}

describe("parseInvite", () => {
  it("takes a name, trimmed, and no email", () => {
    expect(parseInvite(posted({ name: "  Mei Lin " }))).toEqual({ ok: true, invite: invited({ name: "Mei Lin" }) });
    expect(parseInvite(posted({ name: "Mei Lin", email: "   " }))).toEqual({ ok: true, invite: invited({ name: "Mei Lin" }) });
  });

  it("takes an email, trimmed, by the RSVP form's rule", () => {
    expect(parseInvite(posted({ name: "Mei Lin", email: " mei@example.test " }))).toEqual({ ok: true, invite: invited({ name: "Mei Lin", email: "mei@example.test" }) });
  });

  it("refuses an invite without a name", () => {
    expect(parseInvite(posted({ email: "mei@example.test" }))).toEqual({ ok: false, error: "nameRequired" });
    expect(parseInvite(posted({ name: "   " }))).toEqual({ ok: false, error: "nameRequired" });
  });

  it("takes a name of up to 80 characters, as the RSVP form does, and no longer", () => {
    expect(parseInvite(posted({ name: "a".repeat(80) }))).toEqual({ ok: true, invite: invited({ name: "a".repeat(80) }) });
    expect(parseInvite(posted({ name: ` ${"a".repeat(80)} ` }))).toEqual({ ok: true, invite: invited({ name: "a".repeat(80) }) });
    expect(parseInvite(posted({ name: "a".repeat(81) }))).toEqual({ ok: false, error: "nameTooLong" });
  });

  it("refuses an email that is not one", () => {
    expect(parseInvite(posted({ name: "Mei Lin", email: "mei" }))).toEqual({ ok: false, error: "emailInvalid" });
    expect(parseInvite(posted({ name: "Mei Lin", email: "mei@example" }))).toEqual({ ok: false, error: "emailInvalid" });
    expect(parseInvite(posted({ name: "Mei Lin", email: `${"m".repeat(250)}@example.test` }))).toEqual({ ok: false, error: "emailInvalid" });
  });

  it("takes a phone of the RSVP form's shape, trimmed and kept as typed, and none when blank", () => {
    expect(parseInvite(posted({ name: "Mei Lin", phone: " +65 9123-4567 " }))).toEqual({ ok: true, invite: invited({ name: "Mei Lin", phone: "+65 9123-4567" }) });
    expect(parseInvite(posted({ name: "Mei Lin", phone: "(02) 555.1234" }))).toEqual({ ok: true, invite: invited({ name: "Mei Lin", phone: "(02) 555.1234" }) });
    expect(parseInvite(posted({ name: "Mei Lin", phone: "   " }))).toEqual({ ok: true, invite: invited({ name: "Mei Lin" }) });
  });

  it("refuses a phone of any other shape", () => {
    expect(parseInvite(posted({ name: "Mei Lin", phone: "1234" }))).toEqual({ ok: false, error: "phoneInvalid" });
    expect(parseInvite(posted({ name: "Mei Lin", phone: "call after 6" }))).toEqual({ ok: false, error: "phoneInvalid" });
    expect(parseInvite(posted({ name: "Mei Lin", phone: "+65 9123 4567 8901 2345" }))).toEqual({ ok: false, error: "phoneInvalid" });
    expect(parseInvite(posted({ name: "Mei Lin", phone: "mei@example.test" }))).toEqual({ ok: false, error: "phoneInvalid" });
  });

  it("takes a letter, trimmed, its line breaks kept", () => {
    expect(parseInvite(posted({ name: "Mei Lin", letter: "  Dear Mei,\n\nSee you there.\n  " }))).toEqual({
      ok: true,
      invite: invited({ name: "Mei Lin", letter: "Dear Mei,\n\nSee you there." }),
    });
  });

  it("refuses a letter over 1000 characters", () => {
    expect(parseInvite(posted({ name: "Mei Lin", letter: "a".repeat(1001) }))).toEqual({ ok: false, error: "letterTooLong" });
  });
});

describe("parseLetter", () => {
  it("is a plain text of up to 1000 characters", () => {
    expect(MAX_LETTER).toBe(1000);
    expect(parseLetter("a".repeat(1000))).toEqual({ ok: true, letter: "a".repeat(1000) });
    expect(parseLetter(` ${"a".repeat(1000)}\n`)).toEqual({ ok: true, letter: "a".repeat(1000) });
    expect(parseLetter("a".repeat(1001))).toEqual({ ok: false, error: "letterTooLong" });
  });

  it("keeps Chinese text and its line breaks, counting each character once", () => {
    expect(parseLetter("亲爱的小美：\n\n好久不见！\n周六见。")).toEqual({ ok: true, letter: "亲爱的小美：\n\n好久不见！\n周六见。" });
    expect(parseLetter("字".repeat(1000))).toEqual({ ok: true, letter: "字".repeat(1000) });
    expect(parseLetter("字".repeat(1001))).toEqual({ ok: false, error: "letterTooLong" });
  });

  it("keeps a line break as one, as a browser posts it as two", () => {
    expect(parseLetter("Dear Mei,\r\n\r\nSee you.")).toEqual({ ok: true, letter: "Dear Mei,\n\nSee you." });
    const typed = `${"a".repeat(499)}\r\n${"a".repeat(500)}`;
    expect(parseLetter(typed)).toEqual({ ok: true, letter: `${"a".repeat(499)}\n${"a".repeat(500)}` });
  });

  it("is empty when blank", () => {
    expect(parseLetter("")).toEqual({ ok: true, letter: "" });
    expect(parseLetter(" \n\t ")).toEqual({ ok: true, letter: "" });
  });
});

describe("parseInviteLines", () => {
  it("reads one person per line, as name, email and phone, each with no letter", () => {
    expect(parseInviteLines("Mei Lin, mei@example.test, +65 9123 4567\nDev Patel, dev@example.test, 8123 4567\nAsha Menon,asha@example.test,(02) 555-1234")).toEqual({
      ok: true,
      invites: [
        invited({ name: "Mei Lin", email: "mei@example.test", phone: "+65 9123 4567" }),
        invited({ name: "Dev Patel", email: "dev@example.test", phone: "8123 4567" }),
        invited({ name: "Asha Menon", email: "asha@example.test", phone: "(02) 555-1234" }),
      ],
    });
  });

  it("takes a line with the email or the phone, or both, left blank or left out", () => {
    expect(parseInviteLines("Mei Lin\nDev Patel, , 8123 4567\nAsha Menon, asha@example.test\nRavi Kumar,,\n王小明, wang@example.test,")).toEqual({
      ok: true,
      invites: [
        invited({ name: "Mei Lin" }),
        invited({ name: "Dev Patel", phone: "8123 4567" }),
        invited({ name: "Asha Menon", email: "asha@example.test" }),
        invited({ name: "Ravi Kumar" }),
        invited({ name: "王小明", email: "wang@example.test" }),
      ],
    });
  });

  it("skips blank lines, and reads the lines a browser posts", () => {
    expect(parseInviteLines("\r\nMei Lin, mei@example.test\r\n   \r\nDev Patel\r\n")).toEqual({
      ok: true,
      invites: [invited({ name: "Mei Lin", email: "mei@example.test" }), invited({ name: "Dev Patel" })],
    });
  });

  it("names the first bad line, counting every line as the host sees it", () => {
    expect(parseInviteLines("Mei Lin, mei@example.test\nDev Patel, dev@example\nAsha Menon, asha")).toEqual({ ok: false, line: 2, error: "emailInvalid" });
    expect(parseInviteLines("Mei Lin\n\nDev Patel, , 12\n")).toEqual({ ok: false, line: 3, error: "phoneInvalid" });
    expect(parseInviteLines("Mei Lin\n, dev@example.test")).toEqual({ ok: false, line: 2, error: "nameRequired" });
    expect(parseInviteLines(`Mei Lin\nDev Patel\n${"a".repeat(81)}`)).toEqual({ ok: false, line: 3, error: "nameTooLong" });
  });

  it("takes anything after the second comma as the phone", () => {
    expect(parseInviteLines("Mei Lin, mei@example.test, 9123 4567, 8123 4567")).toEqual({ ok: false, line: 1, error: "phoneInvalid" });
  });

  it("refuses a list with nobody on it", () => {
    expect(parseInviteLines("")).toEqual({ ok: false, line: 1, error: "nameRequired" });
    expect(parseInviteLines("\n  \n")).toEqual({ ok: false, line: 1, error: "nameRequired" });
  });
});

describe("inviteState", () => {
  const opened = new Date("2026-10-12T10:00:00Z");

  it("is not opened until the guest opens the link", () => {
    expect(inviteState({ openedAt: null, rsvpId: null })).toBe("notOpened");
  });

  it("is opened once the guest has opened the link", () => {
    expect(inviteState({ openedAt: opened, rsvpId: null })).toBe("opened");
  });

  it("is replied once the guest has replied through it, whatever else", () => {
    expect(inviteState({ openedAt: opened, rsvpId: "0199d0a4-0000-7000-8000-000000000001" })).toBe("replied");
    expect(inviteState({ openedAt: null, rsvpId: "0199d0a4-0000-7000-8000-000000000001" })).toBe("replied");
  });
});

describe("canMailInvite and awaitsInvitation", () => {
  const SENT = new Date("2026-11-07T10:00:00Z");
  const invite = (fields: { email?: string; sentAt?: Date; mailStoppedAt?: Date }) => ({ email: null, sentAt: null, mailStoppedAt: null, ...fields });

  it("emails an invite with an email whose guest has not stopped mail, sent before or not", () => {
    expect(canMailInvite(invite({ email: "mei@example.test" }))).toBe(true);
    expect(canMailInvite(invite({ email: "mei@example.test", sentAt: SENT }))).toBe(true);
    expect(canMailInvite(invite({}))).toBe(false);
    expect(canMailInvite(invite({ email: "mei@example.test", sentAt: SENT, mailStoppedAt: SENT }))).toBe(false);
  });

  it("counts among those not yet sent only an invite that can be emailed and never was", () => {
    expect(awaitsInvitation(invite({ email: "mei@example.test" }))).toBe(true);
    expect(awaitsInvitation(invite({ email: "mei@example.test", sentAt: SENT }))).toBe(false);
    expect(awaitsInvitation(invite({}))).toBe(false);
    expect(awaitsInvitation(invite({ email: "mei@example.test", mailStoppedAt: SENT }))).toBe(false);
  });
});

describe("roomForInvite", () => {
  it("takes invites up to five hundred an event, and no more", () => {
    expect(MAX_INVITES).toBe(500);
    expect(roomForInvite(0)).toBe(true);
    expect(roomForInvite(499)).toBe(true);
    expect(roomForInvite(500)).toBe(false);
    expect(roomForInvite(501)).toBe(false);
  });

  it("takes several at once only when all of them fit", () => {
    expect(roomForInvite(0, 500)).toBe(true);
    expect(roomForInvite(497, 3)).toBe(true);
    expect(roomForInvite(498, 3)).toBe(false);
    expect(roomForInvite(0, 501)).toBe(false);
  });
});

describe("the token", () => {
  it("is 24 characters of the event link's alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const token = generateInviteToken();
      expect(token).toHaveLength(24);
      expect([...token].every((char) => SLUG_ALPHABET.includes(char))).toBe(true);
    }
  });

  it("is drawn afresh for every invite", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateInviteToken));
    expect(tokens.size).toBe(200);
  });

  it("draws on the whole alphabet", () => {
    const seen = new Set(Array.from({ length: 200 }, generateInviteToken).join(""));
    expect(seen.size).toBe(SLUG_ALPHABET.length);
  });
});
