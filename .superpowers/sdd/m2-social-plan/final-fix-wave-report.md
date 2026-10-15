# Final fix wave report

**Status:** DONE_WITH_CONCERNS (all eleven items done and checked; the concerns are readings I chose, flagged for the re-review)

Branch `m2-social`, from `ad115d9`. Eight new commits; no existing commit amended.

| Item(s) | Commit | Subject |
| --- | --- | --- |
| 1 | `8d70c00` | Effects: an event from before 0.3 shows no effect until its host picks one |
| 2, 5 | `bf688e2` | Event settings: the email switches and the guest list's "hidden" say they are every host's |
| 3, 7 | `e02570f` | Thread: the done bubble shows the guest's edit link, and a copy that fails shows it whole |
| 4 | `24024ec` | Docs: the operator is told what mail lets a host send, and why open registration matters |
| 6 | `95edf6f` | Comments: deleting a comment counts against the comment limit |
| 8, 9 | `2f944a2` | Tidy: the view count's column, migration and message read as the rest do |
| 10 | `7407ca2` | Privacy: the placeholder policy covers what 0.3 does with guests' details |
| 11 | `d09e6c2` | Focus: removing a co-host, revoking a co-host link or removing a guest keeps the focus on the page |

## Per item

1. **Effects on existing events (`8d70c00`).** `drizzle/0022_existing_events_keep_no_effect.sql`, made with `drizzle-kit generate --custom --name=existing_events_keep_no_effect` (journal tag `0022_existing_events_keep_no_effect`; drizzle-kit 0.31 also wrote `meta/0022_snapshot.json`, identical to 0021's apart from ids and key order, kept). One `UPDATE "event"` with `jsonb_set`: `effect` becomes `"none"`, and where `theme->'template'` is an object, `template.dirty` becomes `true`; a comment says why (story 141). **Reading I chose:** the `WHERE "theme" ->> 'effect' IS DISTINCT FROM 'none'` leaves rows already at no effect untouched, because a clean Quiet or Supper club theme (both have effect `none`) still matches its template and marking it dirty would make the drawer say "Custom, started from Quiet" falsely. Every row ends at effect none either way. `src/db/schema.ts` unchanged by this item. The 0.3 note in `docs/operator/upgrade-backup.md`: the intro now says nothing on an existing event's page changes until its host chooses, and the effects bullet says existing events show no effect until the host picks one under **Effect** in the Design drawer's **Details** (or chooses the template again), that their theme reads "Custom, started from" the template, and that Quiet and Supper club events are left as they were.
2. **"Email me" on shared switches (`bf688e2`, with 5).** `Events.form.notifyOnRsvp` / `notifyOnComment` now "Email the hosts when a guest replies" / "...comments" (zh-Hans 有宾客回复/留言时给主办人发邮件, zh-Hant 有賓客回覆/留言時寄電子郵件給主辦人). `Mail.rsvpReply.body.*` (all three) and `Mail.comment.body` footers: "To stop these emails, untick "Email the hosts when a guest replies" in the event's settings. That stops them for every host of the event." (Chinese: ...取消勾选"有宾客回复时给主办人发邮件"。取消后，这个活动的所有主办人都不会再收到这类邮件。 / 取消勾選「有賓客回覆時寄電子郵件給主辦人」。取消後，這個活動的所有主辦人都不會再收到這類郵件。). Specs: `notifications.spec.ts` uses the new label and now also asserts the reply email's footer; `comments.spec.ts`'s footer assertion updated. `events.spec.ts` asserts neither label (checked by grep), so it is unchanged. The 0.3 note names the new switch labels and says they act for every host at once.
3. **Thread edit link (`e02570f`, with 7).** New `src/app/e/[slug]/use-copy-link.ts`: `useCopyLink(link, shownRef)` returns `{ copy, copied, failed }`. `copy` runs `navigator.clipboard.writeText` inside a promise chain, so a missing clipboard (TypeError) and a rejected write both land in one handler, which sets `failed` and selects the shown link. On `failed`, each presentation drops `truncate` for `break-all`, so the whole link is on screen, selected. The ref is passed in rather than returned because the React compiler lint treats every field of an object holding a ref as a ref ("Cannot access refs during render"). The Thread's done bubble shows the link as a mono line between the host's words and the chips; the Poster (`rsvp-flow.tsx`) and the Broadsheet (`broadsheet-receipt.tsx`) use the same hook. `thread.spec.ts` asserts the link text is visible in the done bubble and that the clipboard holds exactly the text shown.
4. **Mail abuse warning (`24024ec`).** `docs/operator/configuration.md`: one sentence under Registration (Open on an instance with mail lets anyone who signs up have it email addresses of their choosing, linking to Mail), and a paragraph in Mail: a host can reply to their own event with any addresses and then post announcements to them, bounded only by `RATE_LIMIT_RSVP` and `RATE_LIMIT_MAIL` per client address; Invitation only (the default) keeps it to people the operator admitted; opening registration on a mail instance lets anyone do it; operator limits on guests per event and events per host, planned for a later release, are meant to close it. I wrote "a later release", not "M3", because the operator docs never use milestone names. Same point as a paragraph after the 0.3 note's list in `upgrade-backup.md`.
5. **Guest list "hidden" wording (`bf688e2`).** `guestListHidden` "Only the hosts" (只有主办人 / 只有主辦人, matching the fix-round-1 rendering), `guestListVisibilityHint` "The hosts always see the whole list." (主办人始终能看到完整名单。 / 主辦人永遠都能看到完整名單。). No spec asserts either (the specs pick the option by value).
6. **Comment delete throttled (`95edf6f`).** `deleteCommentAction` now calls `consume("comment", ...)` before any lookup and returns `{ error: "tooFast" }` (otherwise `{}`), as `removeRsvpAction` does. A small client form, `src/themes/sections/delete-comment-form.tsx` (`useActionState`), replaces the plain `<form>` in the dialog and shows `EventPage.comments.errors.tooFast` with `role="alert"` above the dialog's buttons (the sentence is passed in from the server component, so no client messages are needed). The comment-limit test now also tries a delete past the limit: the dialog says "You're going too fast. Try again shortly." and the comment is still there after a reload. I also updated what the limit counts in `configuration.md`'s table, `.env.example` and the `rate-limit/config.ts` comment, so they say the limit covers deleting too.
7. **`onClick={advance}` (`e02570f`).** Now `onClick={() => advance()}`. Before, the click event was treated as a draft change and merged into the draft (`flow.change(event)`).
8. **Tidy (`2f944a2`, with 9).** `views` moved above the reminders comment block in `schema.ts` (`drizzle-kit generate` then reports "No schema changes, nothing to migrate"). `git mv drizzle/0021_optimal_boom_boom.sql drizzle/0021_event_views.sql` plus the journal tag. The content and `when` are unchanged, and Drizzle's migrator compares `created_at` with `folderMillis` (checked in `pg-core/dialect.js`), so a database that already ran it does not run it again; on the dev database it did not. `drizzle-kit check` clean. Comment at the `recordView` call site: "This is the one place a page render writes." `Events.manage.opened` in English is now `{count, plural, =1 {once} other {# times}}` (`events.spec.ts`'s "Opened 0 times" still passes). The Chinese files are unchanged and were already `other`-only.
9. **`.env.example` (`2f944a2`).** The `RATE_LIMIT_MAIL` comment now lists account emails (verification, password reset, an email change), sign-in links, emailed host invitations, and each announcement that emails guests.
10. **Privacy placeholder (`7407ca2`).** `src/legal/placeholders.ts` is English-only by design (its comment: "in English, like the operator documentation"; `legal-page.tsx` puts the translated `Legal.notPublished` above it), so there was nothing to translate. Added: guests' comments among what is kept; a new bullet on what a guest's email is used for (cancellation notice, announcements, reminders), the stop link in every message, and queued mail holding an address for up to about an hour and a half until it is sent or dropped; and in "Who else sees it", co-hosts seeing every RSVP and answer, comments shown to the hosts and to guests who have replied, and the hosts seeing how many times the page was opened, not by whom.
11. **Focus (`d09e6c2`).** Hosts page: the h1 is now `id="hosts-heading" tabIndex={-1}` and the remove-co-host dialog is `DeleteDialogContent focusAfter={HEADING}`. Guest list: the h1 is now `id="guest-list-heading" tabIndex={-1}` and `RemoveGuest` uses `DeleteDialogContent focusAfter="guest-list-heading"`. **Revoke has no dialog** (it is a direct form button), so `DeleteDialogContent` could not be wired there. A new client `RevokeLinkForm` (`hosts/revoke-link-form.tsx`) runs the bound action and then focuses `links-heading`, which now has `tabIndex={-1}`. Specs: `co-hosts.spec.ts` asserts focus on the "Hosts" h1 after removing and on "Co-host links" after revoking; `guest-list.spec.ts` asserts focus on the "Guest list" h1 after removing.

## Migration check on the dev database

Compose dev profile up. Before applying, `drizzle.__drizzle_migrations` ended at `created_at 1791425114341` (0021). I picked six sample rows:

```
 id                                   | created    | title          | effect   | template
 01a0c2f3-b34b-7deb-9b1c-a318e3249962 | 2026-09-21 | Quiet          |          |                      ({} theme)
 01a0c331-9a4d-726f-871c-b7871d142b14 | 2026-09-21 | Ada's birthday | sparkles | {"id": "birthday", "dirty": false}
 01a0cd7f-d805-731c-9190-f921a8100064 | 2026-09-23 | Ada's birthday | doodles  | {"id": "festival", "dirty": false}
 01a0cd7f-d814-79cd-a27b-73f50ed21559 | 2026-09-23 | Ada's birthday | none     | {"id": "supper", "dirty": false}
 01a0ce3a-fa12-76ee-b4a7-b0624ab7b08d | 2026-09-23 | Mei & Arjun    | none     | {"id": "quiet", "dirty": false}
 01a0dd1b-f61e-72d0-a4de-6b6f44789991 | 2026-09-26 | (zh title)     | confetti | {"id": "kids", "dirty": false}
```

I applied pending migrations with `drizzle-orm/postgres-js/migrator` (node one-liner, `.env.development`); the newest row became `24|1791454379392`. After:

```
 01a0c2f3-... | Quiet          | none | (no template key: {"effect":"none"})
 01a0c331-... | Ada's birthday | none | {"id": "birthday", "dirty": true}
 01a0cd7f-d805 | Ada's birthday | none | {"id": "festival", "dirty": true}
 01a0cd7f-d814 | Ada's birthday | none | {"id": "supper", "dirty": false}   (left: already none)
 01a0ce3a-... | Mei & Arjun    | none | {"id": "quiet", "dirty": false}    (left: already none)
 01a0dd1b-... | (zh title)     | none | {"id": "kids", "dirty": true}
```

Every one of the ~10,600 rows now has effect `none`, and every other key of the theme JSON is kept. One full theme after the migration: `{"font": "serif", "effect": "none", "layout": "poster", "template": {"id": "birthday", "dirty": true}, "textTone": "auto", ... "backgroundId": "golden" ...}`. On the production build, the pre-M2 published event `/e/GmX5T4TRzY` (created 2026-09-21) is served with no `data-effect` markup, while the newest clean Birthday event is served with `data-effect="sparkles"`. Events the browser runs created after the migration: 34 `sparkles|birthday|false` (new events still take their template's effect), plus the knob-changed ones the specs make. `e2e/effects.spec.ts` (a new event sparkles) passed. I did not open the drawer as the old event's host (no known password); the "Custom, started from Birthday" readout follows from `themeReadout` (`custom: theme.template.dirty`).

## Tests

All browser runs used the **production-build loop**: `pnpm build`; `public`, `.next/static` and `drizzle` copied into `.next/standalone`; `node --env-file=.env.development .next/standalone/server.js` on :3000; Compose dev profile (Postgres, Mailpit); `--workers=2`. No run failed, so no `--workers=1` rerun was needed.

- `pnpm lint`: clean. `pnpm typecheck` (after `rm -f tsconfig.tsbuildinfo`): clean. `pnpm test`: `Test Files 64 passed (64)`, `Tests 526 passed (526)`. The only other output is the pre-existing Vite `configLoader: 'native'` notice about `vitest.config.ts`. `pnpm exec drizzle-kit check`: "Everything's fine".
- `pnpm exec playwright test e2e/thread.spec.ts e2e/comments.spec.ts e2e/notifications.spec.ts --workers=2`: **27 passed (2.0m)**.
- `pnpm exec playwright test e2e/events.spec.ts e2e/co-hosts.spec.ts e2e/guest-list.spec.ts --workers=2`: **53 passed (1.8m)**.
- `pnpm exec playwright test e2e/design.spec.ts e2e/effects.spec.ts e2e/legal-and-analytics.spec.ts --grep-invert "operator has written their own" --workers=2`: **25 passed (1.2m)**.
- Copy-failure check, temporary spec deleted afterwards and never staged (`e2e/zz-copy-fallback.spec.ts`): Poster, Broadsheet and Thread, with `writeText` rejecting (NotAllowedError) and with `navigator.clipboard` undefined, at both widths. After the chip is pressed, the selection equals the shown link, the link element is not cut short (`scrollWidth <= clientWidth`), the Poster's chip does not say "Copied", and the Thread page is no wider than the screen. **13 passed (37.4s)**.
- Mutation build, all in one: the delete throttle removed, the remove-co-host and remove-guest dialogs reverted to `AlertDialogContent`, `RevokeLinkForm`'s focus line removed, and the Thread's link line removed. `-g "too fast|removes a co-host|revoked co-host link|removes a guest|the edit link copied"` on mobile gave **5 failed** as intended: three "toBeFocused ... Received: inactive", the dialog alert "element(s) not found", and the Thread link "element(s) not found". After restoring (`git checkout --` on the five files; `src` matched HEAD) and rebuilding, the same selection at both widths gave **11 passed (48.0s)**.
- Server logs: only the known pre-existing `The destination stream closed early.`.
- Not run: `legal-and-analytics.spec.ts`'s "operator has written their own" block, which needs the Compose test profile's `app-social` image built from this tree. It covers the operator's own pages, not the placeholder.

Workspace: port 3000 freed with `fuser -k`. The copied `public`, `.next/static` and `drizzle` were removed from `.next/standalone`. The dev profile was stopped (`stop`, never `down -v`). The dev database keeps migration 0022 applied. `.next` holds a build of the final tree.

## Concerns

1. **0022 leaves rows already at effect none untouched** (not marked dirty), a deliberate narrowing of "on every existing event row", so a clean Quiet or Supper club theme is not falsely called custom. Every row still ends at no effect. If the controller wants every row marked dirty regardless, drop the `WHERE`.
2. **A theme stored as `{}` becomes `{"effect":"none"}`** and still reads as Birthday, unchanged (parseTheme's default template). No released database has such rows: v0.1.0 already wrote a full theme on create. The dev database had 66, from 2026-09-21 to 09-23.
3. **Revoke has no dialog**, so item 11's "wire the three dialogs" became two dialogs plus a small client form for revoke.
4. **Guest list focus goes to the page's h1, not the status group's heading.** Removing the last guest replaces every group with "Nobody has replied yet.", so a group heading would not always be there to take the focus.
5. **Deletes now share the 30-per-10-minutes comment allowance**, so a host cleaning up a spam wave from one address can delete 30 comments in ten minutes, fewer if they also post.
6. **`Events.form.questionsHint` "Their answers are yours alone."** is also wrong once there are co-hosts. It is not on the list, so I left it.
7. **The Chinese I was least sure of:** the footers' second sentence, 取消后，这个活动的所有主办人都不会再收到这类邮件。 / 取消後，這個活動的所有主辦人都不會再收到這類郵件。, and the switch labels 有宾客回复时给主办人发邮件 / 有賓客回覆時寄電子郵件給主辦人.
