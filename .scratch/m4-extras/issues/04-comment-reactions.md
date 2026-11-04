# 04: Emoji reactions on comments

**What to build:** Anyone who may comment can react to a comment with one of six emoji, and take it back; each comment shows the counts and who reacted.

**Blocked by:** 03 The poster-first guest page (the comments panel's new place)

**Status:** done

- [x] Table `comment_reaction` (`id`, `comment_id` → comment ON DELETE CASCADE, `rsvp_id` or `host_id` (exactly one, check constraint), `emoji`, `created_at`), unique on (comment, reactor, emoji). Migration.
- [x] `src/comments/reactions.ts` (pure): `REACTIONS = ["🎉","❤️","😂","😮","👍","🙏"]`, `toggle`, `groupReactions(rows, viewer)` → per emoji the count, the names, whether the viewer reacted.
- [x] Server action `toggleReaction(commentId, emoji)`: who may react is who may comment (`src/comments/` rules: an RSVP the page shows comments to, not Pending or Declined; a host or co-host); refused otherwise; rate limited with the comment limit; revalidates the page.
- [x] Under each comment: buttons for the emoji that have reactions (`aria-pressed`, accessible name "{emoji name}, {count}" plus ", you reacted"), and an add button opening the six as a small menu. Names of who reacted in a tooltip and, on tap-and-hold or a "Who reacted" button, a list. Emoji names are messages in all three languages.
- [x] Deleting a comment deletes its reactions; deleting an RSVP deletes its reactions.
- [x] Unit tests for `groupReactions` and the toggle; browser rows: a guest reacts, the count shows for another guest, pressing again removes it, a host reacts as the host, a guest without a reply sees counts but cannot react; keyboard and accessibility rows in each layout.

## Notes for the implementer

- Commit subject, e.g. `Comments: guests and hosts can react with an emoji`.

## Comments

**2026-11-03, implementing agent (Opus, in the maintainer's session).** Done.

- `drizzle/0037_comment_reactions.sql`: `comment_reaction` with exactly one of `rsvp_id` and `host_id` (check), cascading from the comment, the RSVP and the host's account; unique on (comment, RSVP, emoji) and on (comment, host, emoji), which also serve the reads by comment.
- `src/comments/reactions.ts` (pure): `REACTIONS`, `isReaction`, `toggle`, `groupReactions`, `reactionsByComment`; unit tests in `reactions.test.ts`.
- `toggleReactionAction` (`comments/actions.ts`): counted against the comment limit first, then refused unless the viewer may post a comment (`takesComments`, so a cancelled event, comments off, or a reply not approved take none); the toggle deletes the reactor's row or inserts one, `onConflictDoNothing` for a double press.
- `src/themes/sections/comment-reactions.tsx`, under every comment in all three layouts: a chip per emoji given (`aria-pressed`, named "{emoji name}, {n} reactions[, you reacted]", the names as its tooltip), an Add button opening the six in a small popover, and "Who reacted" listing the names. Optimistic, then the page drawn again. A viewer who may read but not react (a cancelled event) sees the counts as images with the same names. When the viewer's last of an emoji goes with its chip, the focus moves to Add.
- Messages `EventPage.comments.reactions.*` in en, zh-Hans and zh-Hant. The editor's page passes `EventPage.comments`, since the Poster layout it imports carries the reactions component.

Amended: "a guest without a reply sees counts but cannot react" cannot happen as written, since comments are locked to anyone who has not replied (only the count of comments shows). The browser row covers a viewer who reads but may not react, on a cancelled event.

Browser: `e2e/reactions.spec.ts`: two guests and the host react, see each other's counts and names, take theirs back; a removed reply takes its reactions; a cancelled event shows counts without buttons; per layout (Poster, Broadsheet, Thread), the six by keyboard and an axe check with the popover open and after. Against the test profile: reactions 9 passed; `comments`, `accessibility`, `thread`, `broadsheet`, `approval`, `editor` 99 passed.

**2026-11-04, follow-up.** In the full run of ticket 09 the desktop row "reactions by keyboard, and accessible, on the Poster" failed twice under load (axe found two pieces of text below 3:1), and passed alone. The check ran while the page was being drawn again after the reaction, its panels fading back in; it now waits for the network to settle first. The run of tickets 09–11 passed it (see ticket 11).

