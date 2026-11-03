# OpenInvites M4: extras, and the invitation as its own editor

Written 2026-11-02 from `.scratch/openinvites/decisions.md`, `CONTEXT.md`, what M1 to M3 built, and the maintainer's answers on 2026-11-02 to the round-1 mockup (`mockup/poster-editor.html`, published at https://claude.ai/artifact/Um1JiTSzjzqWaHtPspgvQc). Where the decisions log already decided something, this spec repeats it and does not reopen it. Choices the maintainer made on 2026-11-02 are marked **(maintainer, 2026-11-02)**. Where nobody has decided, the choice is marked **(decided here)** and the maintainer may overrule it before the ticket that carries it starts.

The M1, M2 and M3 specs stay binding for everything they cover. This spec only adds to them, except where it says it replaces something.

## Problem Statement

The features of 0.4 are there but the host's experience of making an invitation is not. A new event starts as a long form of about twenty-five fields, with no invitation on screen. The look is designed in a second place, a drawer on the event page, which scrolls through upload, six templates, three layouts, nine backgrounds and a Details section. Most invitations end up as the same frosted card on a gradient. Hosts who know Apple Invites and Partiful expect to start from a picture, type the title onto the invitation, and pick a few looks from big swatches. Guests expect the picture first.

The decisions log's M4 list (photo album, date polling, passkeys, Sign in with Apple, Facebook login, emoji reactions on comments) is also still to do.

## Solution

**(maintainer, 2026-11-02)** M4 does two things side by side:

1. **The invitation is the editor.** A new event opens as a blank invitation. The host taps the title, date, place and description on the invitation itself, and it saves as they go. Four toolbar buttons (Poster, Title, Theme, Effect) open sheets of large swatches that change the invitation live. Everything a guest does not see moves into one Settings sheet. The guest page becomes poster-first: the poster full width, the title on it or under it, the details as one list, and the reply buttons pinned to the bottom on phones.
2. **The extras.** Emoji reactions on comments, date polling, a photo album, and passkeys.

**(maintainer, 2026-11-02)** Sign in with Apple and Facebook login are put aside. They are out of M4.

The round-1 mockup is the reference for the look. Its notes column lists what changes and what stays.

## User Stories

Numbering continues from the M3 spec, which ended at 174.

### Host: making the invitation

175. As a host, I want "New event" to open a blank invitation rather than a form, so that I make the invitation by looking at it.
176. As a host, I want to type the title directly on the invitation, so that I see it in its font and place as I write it.
177. As a host, I want to tap the date, the place or the description on the invitation to fill it in, so that I never hunt for a field.
178. As a host, I want every change saved as I make it, so that I can close the page at any point and lose nothing.
179. As a host, I want to be told what is missing when I try to publish (a title and a date), so that publishing never fails silently.
180. As a host, I want to preview the invitation exactly as a guest sees it, and come back to editing in one tap.

### Host: the poster

181. As a host, I want every invitation to have a poster, chosen from a gallery, an emoji pattern, a colour, or my own picture, so that every invitation starts from a picture.
182. As a host, I want a gallery of ready-made posters sorted by occasion, so that I have something good without a photo of my own.
183. As a host, I want picking a gallery poster to also pick a title font, accent and effect that suit it, so that one tap gives a finished look.
184. As a host, I want to make a poster from up to three emoji on a colour, so that I can make something playful in seconds.
185. As a host, I want a plain or gradient colour as the poster, with the title on it, so that a text-only invitation looks deliberate.
186. As a host, I want to upload my own photo or flyer as the poster and describe it for screen readers, as in 0.4.
187. As a host, I want to see a small live copy of the invitation while I choose a poster, font, theme or effect, so that I judge each choice as I make it.

### Host: the look and the settings

188. As a host, I want Title to choose the title's font and whether it sits on or under the poster.
189. As a host, I want Theme to choose the accent colour, a light or dark page, the button style, and the layout (Poster, Broadsheet or Thread), so that the 0.4 layouts stay available.
190. As a host, I want Effect to choose none, sparkles, confetti or doodles, as in 0.4.
191. As a host, I want capacity, approval, questions, contact details, guest list visibility, reminders, comments and the host emails in one Settings sheet with the 0.4 defaults, so that I can publish without opening it.
192. As a host, I want co-hosts, personal invite links, the custom link, announcements, sharing and the guest list one tap away from the editor.
193. As a host on a desktop, I want the invitation shown at phone width in the middle of the screen, with the sheets opening beside it, so that I design what most guests will see.

### Guest: the poster-first page

194. As a guest, I want the poster to fill the top of the page, with the title and date beside it, so that the invitation looks like an invitation.
195. As a guest on a phone, I want Going, Maybe and Can't go pinned to the bottom of the screen, so that I can reply wherever I am on the page.
196. As a guest, I want the date, place and description as one list, with Add to calendar, Open in Maps and the countdown where they belong.

### Comments: reactions

197. As a guest who has replied, I want to react to a comment with an emoji from a short set, and take it back, so that I can answer without writing.
198. As a host, I want to react to comments too, shown as the host.
199. As anyone who can read the comments, I want to see how many people reacted with each emoji, and who, so that reactions mean something.

### Date polling

200. As a host who has not fixed a date, I want to offer two to six candidate dates and let guests vote, so that I can pick the date most people can make.
201. As a guest, I want to vote Yes, If need be or No on each candidate date with my name, and change my votes later, so that the host knows what works for me.
202. As a host, I want to see the votes per date, and pick the date with one tap, which then becomes the event's date, so that the poll ends cleanly.
203. As a guest who voted and gave an email, I want to be emailed when the host picks the date, with a link to reply, so that I do not miss it.

### Photo album

204. As a guest who has replied, I want to add photos to the event's album from the day the event starts, so that everyone's photos are in one place.
205. As a guest, I want to see the album on the event page and open each photo large, so that I can look back at the party.
206. As a host, I want to delete any photo, and a guest to delete their own, so that the album stays what we want in it.
207. As an operator, I want a limit on photos per event, so that one event cannot fill my disk.

### Passkeys

208. As a host, I want to add a passkey to my account and sign in with it instead of a password, so that signing in is quick and safe.
209. As a host, I want to see and remove my passkeys in account settings, so that a lost device stops working.

## Implementation Decisions

### Architecture

Mostly the screens change, not the server. The theme engine, `legibility.ts` and its contrast guarantees, uploads and their processing (`process.ts`, `RENDITIONS`), the effects, the RSVP flow and its steps, and every M3 rule stay as they are. The new poster model sits inside the stored theme; the event row changes only in that a draft may have no date (below).

### The poster replaces the background **(decided here, from the maintainer's 2026-11-02 answers)**

- Every theme has exactly one **poster**: `{ kind: "gallery", id }`, `{ kind: "colour", id }` or `{ kind: "upload" }`. An event has at most one upload (the row is unique per event), so the theme names none; an emoji pattern is an upload whose `origin` is `"emoji"` (as built in ticket 01). The page behind the details is always the poster, blurred, as poster mode does today. `backgroundId`, `uploadId` and `uploadMode` leave the theme; `parseTheme` reads an old theme into a poster (a curated gradient becomes a colour poster, a curated photo becomes a gallery poster, an upload in either mode becomes an upload poster), so no stored theme needs a data migration. The writer writes the new shape only.
- **Gallery posters** are curated entries like `backgrounds.ts`'s, in a new `src/themes/posters.ts`: an id, an occasion, an SVG file under `public/posters/` named after its content, the measured `lightest`/`darkest` and accent, and the look it brings (font, effect, title placement, button style). **(maintainer, 2026-11-02)** About twenty at launch, drawn as code (SVG) in the style of the mockup's stand-ins, polished; commissioned art can be added later. The four photo backgrounds of 0.4 become gallery posters.
- **Templates fold into the gallery (maintainer, 2026-11-02).** Picking a gallery poster applies its look, as applying a template does today; the theme's `template` field becomes `{ posterId, dirty }`. The six template ids stay readable so stored themes still parse. `docs/contributing/templates.md` becomes "Adding a gallery poster".
- **Emoji posters** are drawn in the host's browser (a canvas, as in the mockup: up to three emoji tiled on one of seven colours) and saved through the existing upload pipeline as an ordinary upload with `origin: "emoji"`, keeping the emoji and colour (`emoji_set`, `emoji_background`) so the sheet can show the choice again. A new emoji pattern replaces a photo, and a photo replaces a pattern. This keeps the server free of emoji fonts and reuses the measuring. The preview card shows it as it shows any upload.
- **Colour posters** are the curated gradients (Golden hour, Dusk, Forest, Midnight, Slate) plus three new ones (Peach, Lagoon, Lilac) and Ink. A colour poster puts the title on the poster.
- Glossary: **Poster** widens to "the picture at the top of every invitation: a gallery poster, an emoji pattern, a colour, or the host's upload". **Background** becomes "the poster, blurred, behind the rest of the page". **Template** is retired in favour of "gallery poster". These are proposals for the maintainer's `CONTEXT.md`; the tickets do not edit it.

### The guest page **(decided here, the mockup's)**

- The Poster layout becomes poster-first: the poster full width at the top, fading into its blurred copy when the title is below it, or with the title and date on a scrim at its foot. The host line, then one frosted list of When, Where and About, then Who's coming, Photos (once there is an album), Announcements and Comments as separate panels. On screens narrower than `md`, Going, Maybe and Can't go are a bar fixed to the bottom (safe-area inset included); the RSVP sheet opens from it. On wider screens the page is phone-width (`max-w-[28rem]`), centred, and the bar sits at the foot of the page's column.
- The RSVP style knob (inline or sheet) is retired for the Poster layout: replies always open in a sheet from the bar. It stays readable; Broadsheet and Thread never used it.
- **(maintainer, 2026-11-02)** Broadsheet and Thread stay as layouts under Theme. They take the poster where they took the background: the blurred poster behind the page, and Broadsheet shows the poster image beside the title as it shows an upload poster today.
- The date sticker goes; the date sits under the title.

### The editor **(decided here, the mockup's)**

- **Where it lives.** `/events/new` creates a draft at once and redirects to `/events/[id]`, which becomes the editor: the invitation as the guest sees it, editable in place. The old form component is deleted. The manage page's cards (link and state, views, duplicate, danger zone) move into the editor's top bar and a "More" menu: Guests, Share, Hosts, Invites, Announcements, Duplicate, Cancel or Delete.
- **A draft with no date (decided here).** `event.starts_at` becomes nullable, with a check constraint `state = 'draft' OR starts_at IS NOT NULL`. A draft's title may be empty (`''`). Publishing refuses without both, saying which is missing. Everything that reads `starts_at` (dashboard sorting, reminders, retention, calendar, preview card, duplicate) treats a null date as "no date yet"; only drafts and polling events (below) have one.
- **Editing in place.** The title is a `contenteditable="plaintext-only"` heading with the role and name of a text box while editing, a placeholder "Untitled event", Enter to finish. When, Where and About are buttons in the details list that open small sheets (the date sheet has the date, all-day, start, optional end, time zone; Where has the place and an optional address or link; About is the rich-text editor of 0.4). Saves are server actions per field, debounced 600 ms for text, immediate for choices, with "Saving…" and "Saved" in the top bar and a retry line on failure, as the Design drawer does today.
- **The toolbar.** Poster, Title, Theme, Effect, Settings, fixed at the bottom on phones. The first four open a half-height sheet and shrink the invitation to a live copy above it (`scale(.56)`), as the mockup does; Settings opens a tall sheet. Escape closes a sheet and returns focus to its button.
- **Theme sheet:** accent (Auto plus the six swatches), page Dark or Light (the text tone knob, Auto kept as the default and shown as "Auto"), button style, and Layout. Text tone's three values stay.
- **Settings sheet:** the groups of the mockup, the controls and defaults of the 0.4 form, the same server-side validation (`events/form.ts`). Questions open the 0.4 questions editor inside the sheet.
- **Desktop (maintainer, 2026-11-02).** The invitation stays phone-width in the centre; the toolbar floats under it; sheets open as a side panel to the right instead of from the bottom, and the live copy is not shrunk.

### Comment reactions **(decided here)**

- A fixed set of six: 🎉 ❤️ 😂 😮 👍 🙏. Anyone who may comment (a guest with an RSVP the event shows comments to, a host or co-host) may react. One row per (comment, reactor, emoji); pressing again removes it. Table `comment_reaction` (`comment_id`, `rsvp_id` or `host_id`, `emoji`, unique on the three).
- Each comment shows the emoji that have reactions, with counts, as toggle buttons (`aria-pressed`, an accessible name such as "Party popper, 4, you reacted"), and a seventh button that opens the set. The names of who reacted are in each button's tooltip and in a list a tap opens on phones.
- No emails. Reactions are rate limited with comments' limit.

### Date polling **(decided here)**

- In the date sheet, "Not sure yet? Let guests vote" turns the event's date into a poll of two to six candidates (each a date with an optional start time, in the event's time zone). An event with a poll has no `starts_at` and may be published.
- On a polling event, the When row reads "Date to be decided" and opens the poll; guests vote Yes, If need be or No on every candidate with their name (and an email, optional, for the outcome). A guest's votes are kept with a cookie and an edit link as an RSVP is; voting does not make an RSVP. The RSVP bar reads "Vote on a date" until the date is picked.
- The host sees each candidate with its Yes and If-need-be counts and the voters' names, and picks one with "Pick this date". Picking sets `starts_at` (and the end, if given), closes the poll for good, emails voters who gave an address "The date is set" with the event link, and the page asks for RSVPs as usual. Voters' names prefill the RSVP form on their device.
- Tables `date_option` and `date_vote`. Votes are deleted with the event, and are rate limited with RSVPs' limit. Reminders and retention ignore an event until it has a date.

### Photo album **(decided here)**

- The album opens on the event's start (its date in the event's time zone for an all-day event) and stays until retention deletes the event. Before then the page says "The album opens on {date}". A cancelled event has no album.
- Anyone with an RSVP in any status except Pending or Declined, and the hosts, may add photos and see them. With the guest list hidden, the album is still shown to those who may add. Up to ten at a time, through the upload pipeline with its renditions and the operator's `MAX_UPLOAD_MB`; EXIF location is already stripped by re-encoding.
- A new operator limit `maxPhotosPerEvent`, default 300, on the instance settings page beside M3's limits.
- A grid of thumbnails, opening a full-screen viewer (keyboard arrows, swipe, Escape, the uploader's name, Download of the large rendition). A host deletes any photo; a guest deletes their own. No comments or reactions on photos, no zip download.

### Passkeys **(decided here)**

- Better Auth's passkey plugin. Account settings gains a Passkeys card: add one (named by the browser's suggestion, renamable), see each with its last use, remove it. The sign-in page gains "Sign in with a passkey" (and conditional UI autofill on the email field where the browser supports it).
- The relying party id is the host of `BASE_URL`; passkeys need HTTPS, so on an instance served over plain HTTP other than `localhost` the card and button are not shown and the operator docs say why.
- A passkey never replaces the email and password; an account keeps its password.

### Repository

- New: `src/themes/posters.ts`, `public/posters/*.svg`, `src/app/(host)/events/[id]/editor/*` (or the equivalent under the event route), `src/comments/reactions.ts`, `src/polls/*`, `src/album/*`. Migrations for the nullable date, `upload.origin`, `comment_reaction`, `date_option`, `date_vote`, `photo`, the passkey plugin's table, and `instance_settings.max_photos_per_event`.
- Deleted: `src/app/(host)/events/event-form.tsx`, `src/app/e/[slug]/design-drawer.tsx` and `design-panel.tsx` (once nothing imports them), the `templates/` directory's knob files (their look moves to `posters.ts`).

## Testing Decisions

The M1 to M3 testing decisions hold: two seams, the browser against the real app with a real Postgres and a fake mail server, and pure rules called directly. The definitive run is the Docker test profile with `CI=1`.

- **Pure rules with unit tests:** `parseTheme` reading every 0.4 theme shape into a poster; applying a gallery poster's look and the dirty flag; the publish check (title, date or poll); the date polling tallies and who may vote; whether the album is open and who may add; reaction toggling and grouping; the photos limit; the emoji poster's choice round trip.
- **Browser tests per ticket:** a host makes an event from New event to Published without a form, typing the title in place; each poster source changes the poster; picking a gallery poster changes the font and effect; the Settings sheet's controls save and are honoured by the RSVP flow; the poster-first page at 390 px with the bar pinned and at desktop width; Broadsheet and Thread with each poster kind; a reaction added, counted, removed; a poll voted on by two guests, a date picked, the email in Mailpit, the RSVP form prefilled; photos added after the start and refused before it, deleted by the host; a passkey added and used to sign in, through Playwright's virtual authenticator (CDP `WebAuthn.addVirtualAuthenticator`).
- Every existing spec that drives `/events/new`'s form or the Design drawer (`e2e/events.ts` helpers first) moves to the editor in the ticket that removes them. The accessibility, keyboard, locale and reduced-motion specs extend to the editor, the sheets and the new guest page in every layout.

## Out of Scope

- Sign in with Apple and Facebook login **(maintainer, 2026-11-02)**.
- M5: ticketing and payments.
- AI-generated posters or backgrounds (decisions log); posters from GIPHY, Unsplash or any outside service (ADR-0005).
- Animated (GIF or video) posters; text placed freely on a poster; stickers.
- Comments or reactions on photos; zip download of the album; reactions emailed.
- Ranked-choice or time-range polls; polls on anything but the date.

## Further Notes

- Branch `m4-extras` from `main` at 23e38dd.
- Ticket order follows dependencies and keeps the redesign and the features interleaved, as the maintainer asked: the poster model and gallery first, the guest page, reactions, the editor and its sheets, passkeys, date polling, desktop, the album, then the final pass.
- The tracker stays in `.scratch/` until after M4 (maintainer, 2026-09-30), so M4 is the last milestone tracked here.
- The mockup draws its gallery posters on a canvas as stand-ins. Ticket 02 makes the real ones as SVG files; the mockup's drawings are a starting point, not the deliverable.
