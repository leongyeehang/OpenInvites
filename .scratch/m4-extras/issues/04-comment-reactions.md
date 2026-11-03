# 04: Emoji reactions on comments

**What to build:** Anyone who may comment can react to a comment with one of six emoji, and take it back; each comment shows the counts and who reacted.

**Blocked by:** 03 The poster-first guest page (the comments panel's new place)

**Status:** ready-for-agent

- [ ] Table `comment_reaction` (`id`, `comment_id` → comment ON DELETE CASCADE, `rsvp_id` or `host_id` (exactly one, check constraint), `emoji`, `created_at`), unique on (comment, reactor, emoji). Migration.
- [ ] `src/comments/reactions.ts` (pure): `REACTIONS = ["🎉","❤️","😂","😮","👍","🙏"]`, `toggle`, `groupReactions(rows, viewer)` → per emoji the count, the names, whether the viewer reacted.
- [ ] Server action `toggleReaction(commentId, emoji)`: who may react is who may comment (`src/comments/` rules: an RSVP the page shows comments to, not Pending or Declined; a host or co-host); refused otherwise; rate limited with the comment limit; revalidates the page.
- [ ] Under each comment: buttons for the emoji that have reactions (`aria-pressed`, accessible name "{emoji name}, {count}" plus ", you reacted"), and an add button opening the six as a small menu. Names of who reacted in a tooltip and, on tap-and-hold or a "Who reacted" button, a list. Emoji names are messages in all three languages.
- [ ] Deleting a comment deletes its reactions; deleting an RSVP deletes its reactions.
- [ ] Unit tests for `groupReactions` and the toggle; browser rows: a guest reacts, the count shows for another guest, pressing again removes it, a host reacts as the host, a guest without a reply sees counts but cannot react; keyboard and accessibility rows in each layout.

## Notes for the implementer

- Commit subject, e.g. `Comments: guests and hosts can react with an emoji`.
