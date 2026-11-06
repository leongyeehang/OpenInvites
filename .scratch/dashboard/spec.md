# OpenInvites: the dashboard as a shelf of invitations

Written 2026-11-06, after the home page shipped, from the maintainer's answers in that session and the mockup (`mockup/dashboard-directions.html`, published at https://claude.ai/artifact/CB6ryS84kARkBrGKdHUiG7, round 1, direction A). Choices the maintainer made are marked **(maintainer, 2026-11-05)**. Where nobody decided, the choice is marked **(decided here)** and the maintainer may overrule it before the ticket that carries it starts.

The M1 to M4 specs and the home page spec stay binding for everything they cover. This spec only adds to them.

## Problem Statement

After M4, guests see posters and the editor is the invitation itself, but a host who signs in lands on the plainest page left in the app. `/dashboard` is a white page of text cards: a title, a badge, a date and a line of counts (`src/app/(host)/dashboard/page.tsx`). It never shows the posters every event already has, and it does not say which event is next or whether one needs the host (guests waiting for approval sit in the middle of a counts line). The header above every signed-in page is three plain buttons in a row. The maintainer: "the plain white isn't good looking".

The interface also says "instance" in about twenty English messages and thirty-four in each Chinese script ("This instance is invitation only", "Instance settings"). Hosts who were only invited do not know the word, and the maintainer asked why it is there at all. The idea stays (registration, limits, reports and the home page belong to the whole installation, not to one event), but the word is jargon outside the code and the self-hosting docs.

## Solution

**(maintainer, 2026-11-05)** Direction A of the mockup. The dashboard opens on the host's next event, large, with its replies and what needs them; the rest of the host's events follow as poster tiles in Coming up, Drafts and Past. Every signed-in page gets a new frame: a soft tinted ground in place of white, and a header with the site's name, a **New event** pill and the host's initials opening an account menu. The interface says "site" where it said "instance".

Scope **(maintainer, 2026-11-05)**: the dashboard and the frame shared by every signed-in page. Account, Site settings and an event's guests, invites, announcements, co-hosts and share pages get the new frame but keep their own content. The editor, which has its own full-screen frame, is not touched.

## User Stories

Numbering continues from the home page spec, which ended at 222.

### Hosts

223. As a host, I want to see my events as their posters, so that my dashboard looks like the invitations I made.
224. As a host, I want my next event shown first and large, with its replies, so that I know at a glance how it stands.
225. As a host, I want to see straight away when guests are waiting for my approval, so that I do not leave them waiting.
226. As a host, I want my drafts and past events kept apart from what is coming up, so that the list stays easy to scan.
227. As a host with no events yet, I want one clear way to make my first invitation.
228. As a host, I want New event within reach on every signed-in page.
229. As a host, I want my account and signing out in one menu under my initials, so that the header stays quiet.
230. As a host, I want messages about the site to say "this site", not a technical word I do not know.

### The operator

231. As an operator, I want Site settings in my account menu, so that it is there when I need it and out of the way otherwise.

## Implementation Decisions

### Architecture

The dashboard stays a server component and reads what it reads today (`listHostEvents`, `countRsvpsByEvent`, `instanceLimits`, `eventsOwnedAtLimit`, `operatorToWelcome`), plus each event's upload where its poster is one. A pure module, `src/dashboard/shelves.ts` **(decided here)**, holds the rules: which event is Next up, which shelf every other event goes on and in what order, the one chip a tile shows, and the one number under it. The page draws from its result and decides nothing itself.

Posters are drawn from the event's stored theme through the M4 pieces (`resolveTheme`, `Picture`, the title fonts in `title-fonts.ts`), not copied. A new `PosterTile` component **(decided here)** draws a poster at tile size with the event's title on it in the event's font: on the poster with its scrim for a gallery or colour poster, and for an upload as the event page does (`titlePlacement`). Next up uses the same component at a larger size.

### What the dashboard shows **(maintainer, 2026-11-05)**

- **Next up** is the first event in the upcoming order (`partitionByEnd`) that is published (not a draft, not cancelled). An event whose date is still being voted on sorts after every dated one, as it does today. It shows:
  - the poster with the title;
  - the date and time (`formatWhen`), or "Date poll open" for a voting event;
  - the replies as chips: going, maybe, can't go, waitlisted (only when there are any), and **N to approve** in the attention colour when guests are pending; with a capacity, "N of M places" in place of the headcount;
  - "Deleted on {day}" in the danger colour when the event is marked for its age (`deletionDate`);
  - three buttons: **Guests** (primary, `/events/{id}/guests`), **Edit** (`/events/{id}`), **Share** (`/events/{id}/share`). Tapping the poster opens the editor, as today's card does.

  On a phone it is one card, poster above. From `md` up the poster sits on the left and the reply numbers on the right as four large figures (going, maybe, can't go, to approve; to approve only when there are any).
- **Coming up** holds every other upcoming event that is not a draft, cancelled ones included, in the upcoming order. **Drafts** holds every draft, dated or not, in the upcoming order. **Past** holds the events that have ended, newest first, with their posters faded.
- **A tile** is the poster with the title on it, and at most one chip on the poster: **N to approve** (attention), else Cancelled, else Draft, else Co-host. Under it go the date (or "No date yet", or "Date poll open") and one number: places ("9 of 12 places") when the event has a capacity, else "N going". On Past the number is "N went", and "Deleted on {day}" takes its place when the event is marked.
- **Columns**: two tiles across below `md`, four from `md`. Past is a row that scrolls sideways below `md` (with scroll snapping, and every tile still reachable by Tab), and the four-across grid from `md`.
- **A shelf with nothing on it is not drawn.** Today's "Nothing coming up" and "Nothing has happened yet" lines go.
- **No events at all**: one large card on a gallery poster chosen as the home page chooses it (`pickPoster(posterPool(homePage))`), "Make your first invitation", a line of text and a New event button.
- **At the event limit** the New event pill in the header is not drawn, and the dashboard shows the existing limit message under its heading, worded for "this site".
- **The glow**: the dashboard's ground carries a blurred copy of the Next up poster at its top, fading into the ground. With no Next up it comes from the first tile on the page, and with no events from the empty state's poster. It is decorative (`aria-hidden`, no motion).
- **Unchanged**: the operator's welcome sheet opens over the dashboard as before, the dashboard's `h1` still takes the focus when it closes, and every number comes from the same queries as today.

### The frame of every signed-in page **(maintainer, 2026-11-05)**

- **The ground** is a soft tinted neutral in place of white, as tokens in `globals.css` used by the host layout. The white cards of the other host pages sit on it unchanged. Light only, as the host area is today.
- **The header**: on the left the site's name (`instanceDisplayName`), linking to `/dashboard`. On the right a dark **New event** pill (only "+" with an accessible name below 360 px), then a circle with the host's initials (`initialsOf`).
- **The account menu** opens from the initials, built on `DropdownMenu` from the `radix-ui` package the project already depends on, with no new dependency **(decided here)**: the host's display name and email, **Account** (`/account`), **Site settings** (`/instance`, operator only), **Sign out**. The trigger is named "Account menu" for a screen reader; arrow keys, Enter and Escape work as Radix gives them; Sign out stays a form posting the existing `signOut` action.
- **New event** is in the header on every host page, not only the dashboard, and is not drawn when the host is at the event limit.
- **The verification notice** becomes a soft banner under the header, same text and same Resend button.

### "Instance" becomes "site" in the interface **(maintainer, 2026-11-05)**

- Every English message that says "instance" says "this site" or "the site" instead: "This site is invitation only", "the most this site allows", "Ask whoever runs this site for a new one", "Name your site". "Instance settings" becomes **Site settings**, in the menu and as the settings page's title and back link.
- zh-Hans and zh-Hant say 本站 where they said 此实例 / 本实例 / 这个实例 (此實例 / 本實例 / 這個實例), and **站点设置 / 網站設定** for Site settings. The welcome sheet's title becomes 本站由你做主 in both scripts.
- The site's name stays where it already is (the header, the tab, the account emails, the home page). It is not added to the other messages **(maintainer, 2026-11-05)**: that would mean passing it through the sign-up, password and passkey code for little gain.
- The URL stays `/instance` **(decided here)**: renaming it would break bookmarks and the operator docs for nothing a visitor sees.
- `instance` stays in the code, the database, the message keys and the self-hosting docs. `CONTEXT.md`'s **Instance** entry gains: "In the interface, say 'site' or the site's name; 'instance' is for the code and the operator docs." This also settles the home page's open question about "site".

## Testing Decisions

The M1 to M4 testing decisions hold: two seams (the browser against the real app with Postgres and Mailpit, and pure rules called directly), and the definitive run is the Docker test profile with `CI=1`.

- **Unit tests** for `src/dashboard/shelves.ts`: Next up skips drafts and cancelled events and puts a voting event after dated ones; no Next up when nothing is published and upcoming; each shelf's membership and order; the tile's chip in its priority order; the tile's number (places, going, went, deleted on).
- **Browser tests**, in `e2e/dashboard.spec.ts` or the specs that cover the dashboard today:
  - with a published event, a draft and a past event, the published one is Next up, the draft is under Drafts, and the past one under Past; a pending reply shows "1 to approve" on Next up;
  - a cancelled upcoming event is not Next up and shows "Cancelled" on its tile;
  - a host with no events sees "Make your first invitation", and its button reaches `/events/new`;
  - at the event limit the New event pill is gone and the limit message shows;
  - the account menu by keyboard: open, reach Account, Escape closes it; the operator sees Site settings and another host does not; Sign out signs out;
  - at 390 px the page does not scroll sideways, and every Past tile is reachable by Tab.
- The accessibility, keyboard, locale and reduced-motion specs extend to the dashboard in its states (empty, with events) and to the open menu, at 390 px and at desktop width.
- Every spec that clicks "Instance settings", "Sign out" or the header's account link, or reads a message that said "instance", is updated in the ticket that changes it.
- `pnpm screenshots` gains `dashboard.webp` (phone, with example events), and the README shows it.

## Out of Scope

- Redesigning the content of Account, Site settings, and an event's guests, invites, announcements, co-hosts and share pages (their own spec, later).
- A dark mode for the host area.
- Search, filters or sorting on the dashboard, and a "Show all" limit on Past.
- Tracking what the host has already seen ("2 new comments since you last looked").
- Renaming `/instance`, the `instance` code, columns or message keys.
- Apple and Facebook sign-in, and M5.

## Further Notes

- Branch `dashboard` from `main` at 5e9b672.
- The mockup's laptop frame shows "24 people expected of 30 places" and "31 went"; the real counts come from `countRsvpsByEvent`, and "went" is the going count of an event that has ended.
- `v0.5.0` is not tagged yet. If it is tagged before this ships, its release note goes in a new `.scratch/dashboard/release-note-0.6.0.md`; otherwise a section in `.scratch/m4-extras/release-note-0.5.0.md`.
