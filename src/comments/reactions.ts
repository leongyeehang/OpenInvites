// Reactions to comments (M4 ticket 04): anyone who may comment may react to a comment with one of
// six emoji, and take it back. Each comment shows, for every emoji someone gave, how many gave it,
// who, and whether the viewer did.
export const REACTIONS = ["🎉", "❤️", "😂", "😮", "👍", "🙏"] as const;

export type Reaction = (typeof REACTIONS)[number];

// The key of each emoji's name among the messages (EventPage.comments.reactions.names).
export const REACTION_NAMES: Record<Reaction, "party" | "heart" | "laugh" | "wow" | "thumbsUp" | "thanks"> = {
  "🎉": "party",
  "❤️": "heart",
  "😂": "laugh",
  "😮": "wow",
  "👍": "thumbsUp",
  "🙏": "thanks",
};

export function isReaction(value: unknown): value is Reaction {
  return typeof value === "string" && (REACTIONS as readonly string[]).includes(value);
}

// Who reacted: exactly one of an RSVP and a host, as with a comment's author.
export type Reactor = { rsvpId: string; hostId?: undefined } | { hostId: string; rsvpId?: undefined };

// One reaction as stored, with the name it is shown under (the RSVP's name, the host's display name).
export type ReactionRow = { commentId: string; emoji: string; rsvpId: string | null; hostId: string | null; name: string };

// One emoji's reactions to one comment, as the page shows them.
export type ReactionGroup = { emoji: Reaction; count: number; names: string[]; mine: boolean };

function isBy(row: { rsvpId: string | null; hostId: string | null }, reactor: Reactor | undefined): boolean {
  if (!reactor) return false;
  return reactor.rsvpId !== undefined ? row.rsvpId === reactor.rsvpId : row.hostId === reactor.hostId;
}

// What pressing an emoji does: a reactor who has given it takes it back, one who has not gives it.
export function toggle(rows: { emoji: string; rsvpId: string | null; hostId: string | null }[], reactor: Reactor, emoji: Reaction): "add" | "remove" {
  return rows.some((row) => row.emoji === emoji && isBy(row, reactor)) ? "remove" : "add";
}

// One comment's reactions, grouped by emoji in the order of REACTIONS, only those someone gave, each
// with its count, the names in the order they reacted, and whether the viewer is among them. An
// emoji no longer offered is left out.
export function groupReactions(rows: ReactionRow[], viewer: Reactor | undefined): ReactionGroup[] {
  return REACTIONS.flatMap((emoji) => {
    const given = rows.filter((row) => row.emoji === emoji);
    if (given.length === 0) return [];
    return [{ emoji, count: given.length, names: given.map((row) => row.name), mine: given.some((row) => isBy(row, viewer)) }];
  });
}

// Every comment's reactions, by the comment's id.
export function reactionsByComment(rows: ReactionRow[], viewer: Reactor | undefined): Map<string, ReactionGroup[]> {
  const byComment = new Map<string, ReactionRow[]>();
  for (const row of rows) byComment.set(row.commentId, [...(byComment.get(row.commentId) ?? []), row]);
  return new Map([...byComment].map(([commentId, each]) => [commentId, groupReactions(each, viewer)]));
}
