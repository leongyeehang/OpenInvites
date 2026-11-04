import { describe, expect, it } from "vitest";
import { groupReactions, isReaction, reactionsByComment, REACTIONS, toggle, type ReactionRow } from "./reactions";

const row = (emoji: string, by: { rsvpId?: string; hostId?: string }, name: string, commentId = "c1"): ReactionRow => ({
  commentId,
  emoji,
  rsvpId: by.rsvpId ?? null,
  hostId: by.hostId ?? null,
  name,
});

describe("isReaction", () => {
  it("takes the six emoji and nothing else", () => {
    for (const emoji of REACTIONS) expect(isReaction(emoji)).toBe(true);
    expect(isReaction("🔥")).toBe(false);
    expect(isReaction("❤")).toBe(false);
    expect(isReaction(undefined)).toBe(false);
  });
});

describe("toggle", () => {
  const rows = [row("🎉", { rsvpId: "r1" }, "Priya"), row("❤️", { hostId: "h1" }, "Ada")];

  it("adds an emoji the reactor has not given", () => {
    expect(toggle(rows, { rsvpId: "r1" }, "❤️")).toBe("add");
    expect(toggle(rows, { rsvpId: "r2" }, "🎉")).toBe("add");
  });

  it("takes back one the reactor has given", () => {
    expect(toggle(rows, { rsvpId: "r1" }, "🎉")).toBe("remove");
    expect(toggle(rows, { hostId: "h1" }, "❤️")).toBe("remove");
  });

  it("never mistakes a host for a guest with the same id", () => {
    expect(toggle([row("🎉", { rsvpId: "same" }, "Priya")], { hostId: "same" }, "🎉")).toBe("add");
  });
});

describe("groupReactions", () => {
  it("groups by emoji in the order offered, with counts, names in order and the viewer's own", () => {
    const rows = [
      row("👍", { rsvpId: "r1" }, "Priya"),
      row("🎉", { rsvpId: "r2" }, "Tom"),
      row("🎉", { hostId: "h1" }, "Ada"),
      row("👍", { rsvpId: "r3" }, "Mei"),
    ];
    expect(groupReactions(rows, { rsvpId: "r2" })).toEqual([
      { emoji: "🎉", count: 2, names: ["Tom", "Ada"], mine: true },
      { emoji: "👍", count: 2, names: ["Priya", "Mei"], mine: false },
    ]);
  });

  it("marks none as the viewer's for a viewer who cannot react", () => {
    expect(groupReactions([row("❤️", { hostId: "h1" }, "Ada")], undefined)).toEqual([{ emoji: "❤️", count: 1, names: ["Ada"], mine: false }]);
  });

  it("leaves out an emoji no longer offered, and shows nothing for no reactions", () => {
    expect(groupReactions([row("🔥", { rsvpId: "r1" }, "Priya")], undefined)).toEqual([]);
    expect(groupReactions([], { rsvpId: "r1" })).toEqual([]);
  });
});

describe("reactionsByComment", () => {
  it("keeps each comment's reactions apart", () => {
    const grouped = reactionsByComment([row("🎉", { rsvpId: "r1" }, "Priya", "c1"), row("🙏", { rsvpId: "r1" }, "Priya", "c2")], { rsvpId: "r1" });
    expect(grouped.get("c1")).toEqual([{ emoji: "🎉", count: 1, names: ["Priya"], mine: true }]);
    expect(grouped.get("c2")).toEqual([{ emoji: "🙏", count: 1, names: ["Priya"], mine: true }]);
    expect(grouped.get("c3")).toBeUndefined();
  });
});
