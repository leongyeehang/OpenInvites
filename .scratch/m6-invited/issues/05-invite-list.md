# 05: Invites: a phone, a letter and a pasted list for each guest

**What to build:** The invite list becomes the list of invited people: each invite takes a phone and, when the host turns personal letters on for the event, a letter; several can be added at once from pasted lines. The migration also lays down the columns tickets 06 to 08 need.

**Blocked by:** nothing

**Status:** ready-for-agent

- [ ] Migration (next free number), one for tickets 05 to 08: `invite.phone text`; `invite.letter text not null default ''`; `invite.mail_token text unique`; `invite.mail_stopped_at timestamptz`; `invite.sent_at timestamptz`; `event.letters_enabled boolean not null default false`; `event.invite_only boolean not null default false`. Schema at `src/db/schema.ts:416–433` (invite) and the event table.
- [ ] `src/invites/invite.ts`: `InviteInput` += `phone: string | null`, `letter: string`; `MAX_LETTER = 1000`; errors `phoneInvalid`, `letterTooLong`; `parseInvite` checks the phone with `isPhone` (`src/rsvps/form.ts:92`), trims the letter and keeps its line breaks. New `parseInviteLines(text: string)` → `{ ok: true; invites: InviteInput[] }` or `{ ok: false; line: number; error }`: one person per line as `Name, email, phone`, blank fields allowed, the letter empty.
- [ ] `src/invites/repository.ts`: `Invite` picks up the columns; `createInvites(eventId, inputs[])` in one transaction under the event lock (as `createInvite`, `:12–22`), refused when `made + inputs.length > MAX_INVITES`; `updateInviteLetter(eventId, id, letter)`; `listInvites` selects `phone`, `letter`, `sentAt`, `mailStoppedAt`.
- [ ] `src/invites/actions.ts`: `createInviteAction` reads `phone` and `letter`; `createInvitesAction(eventId, _, formData)` for the pasted lines; `saveLetterAction(eventId, id, _, formData)`; `setLettersEnabledAction(eventId, on)` → `setLettersEnabled(eventId, on)` in `src/events/repository.ts`, a plain update that also moves `updatedAt`. All gated by `findHostEvent` + `can(role, "guests")` as today (`:25–26`), revalidating the invites page.
- [ ] `lettersEnabled` stays **off** `EventInput` and the Settings sheet: the sheet posts every setting on each change (`src/editor/settings-sheet.tsx:95–115`, `src/events/editor-actions.ts:187–210`) and would reset it. `createEvent`'s input (`src/events/repository.ts:46`) += `Partial<Pick<Event, "lettersEnabled" | "inviteOnly">>`; `src/events/duplicate.ts:32` copies both (invites themselves are not copied, as today).
- [ ] Invites page (`src/app/(host)/events/[id]/invites/`): `invite-form.tsx` gains a phone input with its hint, a letter textarea (shown when letters are on) and an "Add several" textarea with its own submit and the line format as its hint; `page.tsx` gains the letters switch at the top ("Personal letters: write a note to each guest, shown on their invitation.", posting `setLettersEnabledAction`), shows the phone on each row, and a `LetterField` client component per row (textarea + Save, `useActionState`, "Letter saved." as the status line) when letters are on.
- [ ] Guest prefill: `Invited` (`src/app/e/[slug]/use-rsvp-flow.ts:88`) += `phone`, passed under the same rule as the email (`page.tsx:295`): only when the event asks for a phone.
- [ ] Unit tests (`src/invites/invite.test.ts`): a phone of the RSVP form's shape kept, another refused; a letter trimmed, its line breaks kept, over 1000 characters refused; `parseInviteLines` reads name, email and phone per line, allows blank fields, and names the first bad line; `src/events/duplicate.test.ts`: a duplicate keeps letters and invite-only.
- [ ] Browser (`e2e/invites.spec.ts`): an invite made with a phone and a letter shows both on its row; pasting three lines makes three invites, and a bad second line makes none and says which; turning letters on reveals the field, a saved letter survives a reload; a guest opening the link has their phone filled in when the form asks for one.
- [ ] Messages `Invites.{phone,phoneHint,letter,letterHint,lettersEnabled,lettersEnabledHint,paste,pasteHint,pasteMake,madeMany,saveLetter,letterSaved}`, `Invites.errors.{phoneInvalid,letterTooLong,line,tooManyAtOnce}` in all three files.

## Notes for the implementer

- Keep the Invites page's form the plain one it is: the letters switch and the pasted list are two more controls, not a redesign.
- Commit subject, e.g. `Invites: a phone, a letter and a pasted list for each guest`.

## Comments
