import { describe, expect, it } from "vitest";
import { MAX_BODY } from "@/announcements/announcement";
import { translatorFor } from "@/locale/messages";
import { votingDraftText, winnersDraftText, type WinnersLine } from "./draft-text";

// The announcements the album vote writes for the host (M8 tickets 14 and 16), as text: what they
// say, and that a draft longer than an announcement may be is shortened to fit, so that Send never
// refuses it (review fix, ticket 14).

const URL = "https://invites.example.test/e/Ab12Cd34";
// Eight awards of 40 characters each, the most an event may have, each of the longest name.
const AWARDS = Array.from({ length: 8 }, (_, at) => `Award ${at + 1} `.padEnd(40, "x"));
const LONG_TITLE = "Ada’s garden party ".repeat(90).trim();

describe("votingDraftText", () => {
  it("names every award and the closing time when it fits", async () => {
    const t = await translatorFor("en");
    const text = votingDraftText(t, "en", { title: "Ada’s garden party", awards: ["Favourite", "Best photo"], closes: "Nov 20, 6:00 PM", url: URL });
    expect(text).toBe(
      `Voting is open in the album for Ada’s garden party. You have one vote in each award: Favourite and Best photo. Voting closes Nov 20, 6:00 PM.\n\nOpen the album to vote:\n${URL}`,
    );
  });

  it("with eight 40-character awards and a long title, leaves out names from the end and says how many, to fit", async () => {
    const t = await translatorFor("en");
    const all = votingDraftText(t, "en", { title: "Ada’s garden party", awards: AWARDS, closes: null, url: URL });
    for (const name of AWARDS) expect(all).toContain(name);
    expect(all).not.toContain("more");

    const text = votingDraftText(t, "en", { title: LONG_TITLE, awards: AWARDS, closes: null, url: URL });
    expect(text.length).toBeLessThanOrEqual(MAX_BODY);
    expect(text).toContain(LONG_TITLE);
    expect(text).toContain(AWARDS[0]);
    expect(text).not.toContain(AWARDS[7]);
    const shown = AWARDS.filter((name) => text.includes(name)).length;
    expect(text).toContain(`, and ${8 - shown} more.\n\nOpen the album to vote:\n${URL}`);
    expect(text.endsWith(URL)).toBe(true);
  });

  it("says how many more in each Chinese script too", async () => {
    for (const [locale, more] of [
      ["zh-Hans", "另外"],
      ["zh-Hant", "另外"],
    ] as const) {
      const text = votingDraftText(await translatorFor(locale), locale, { title: LONG_TITLE, awards: AWARDS, closes: null, url: URL });
      expect(text.length).toBeLessThanOrEqual(MAX_BODY);
      expect(text).toContain(more);
      expect(text.endsWith(URL)).toBe(true);
    }
  });
});

describe("winnersDraftText", () => {
  const priya = { kind: "photo", name: "Priya Nair" } as const;

  it("names each award's first place by kind and uploader, its votes, each when shared, and an award nobody voted in", async () => {
    const t = await translatorFor("en");
    const lines: WinnersLine[] = [
      { award: "Favourite", winners: [priya], votes: 2 },
      { award: "Best video", winners: [], votes: 0 },
      { award: "Funniest", winners: [{ kind: "video", name: null }, priya], votes: 1 },
    ];
    expect(winnersDraftText(t, "en", { title: "Ada’s garden party", lines, url: URL })).toBe(
      [
        "The votes are in for Ada’s garden party.",
        "",
        "Favourite: a photo by Priya Nair, 2 votes.",
        "Best video: nobody voted.",
        "Funniest: a video and a photo by Priya Nair, 1 vote each.",
        "",
        "See every count in the album:",
        URL,
      ].join("\n"),
    );
  });

  it("with eight 40-character awards and a long title, leaves out award lines from the end, to fit", async () => {
    const t = await translatorFor("en");
    const name = "Priya ".padEnd(80, "n");
    const lines: WinnersLine[] = AWARDS.map((award) => ({ award, winners: [{ kind: "photo", name }, { kind: "video", name }], votes: 12 }));
    // Long, though shorter than the other: each line here is six times an award's name.
    const title = "Ada’s garden party ".repeat(45).trim();
    const text = winnersDraftText(t, "en", { title, lines, url: URL });
    expect(text.length).toBeLessThanOrEqual(MAX_BODY);
    expect(text).toContain(title);
    expect(text).toContain(`${AWARDS[0]}: a photo by ${name} and a video by ${name}, 12 votes each.`);
    expect(text).not.toContain(AWARDS[7]);
    expect(text.endsWith(`See every count in the album:\n${URL}`)).toBe(true);
  });
});
