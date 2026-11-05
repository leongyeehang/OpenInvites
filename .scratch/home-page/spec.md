# OpenInvites: the home page as an invitation

Written 2026-11-04, after M4 shipped, from the maintainer's answers in that day's session and the clickable mockup (`mockup/home-page.html`, published at https://claude.ai/artifact/723Fy8XmJBLkDCuwkceZY4, round 2). Choices the maintainer made are marked **(maintainer, 2026-11-04)**. Where nobody decided, the choice is marked **(decided here)** and the maintainer may overrule it before the ticket that carries it starts.

The M1 to M4 specs stay binding for everything they cover. This spec only adds to them.

## Problem Statement

Every instance opens on the same page: "OpenInvites", "This instance is up.", a tagline and two buttons (`src/app/page.tsx`). It is the plainest page in the app and the first one an operator sees after `docker compose up`, so the product they just installed looks unfinished. Nothing on it can be changed: an operator cannot say whose site it is or what it is for. "Create an account" shows even when registration is Invitation only, where it leads to a refusal. A guest who lands on it by mistake is not told that guests need no account. A brand-new operator is not told that the first account becomes the operator, or what to set up next, unless they read `docs/operator/install.md`.

## Solution

**(maintainer, 2026-11-04)** The home page is laid out like an event page, so the instance is inviting the visitor in:

- the poster is a gallery poster, a different one each visit;
- the title is the instance's name, in that poster's font and placement;
- the welcome line stands where an event's description would;
- one card says how the site works, for a guest and for a host;
- the bar pinned to the foot holds the way in, as Going / Maybe / Can't go do on an event.

The operator sets the name and welcome line in a new Home page card in Instance settings. Its More options hold which posters the home page shows and whether it says who runs the site. A fresh instance shows a setup version of the page, and the first account gets a one-time welcome sheet. A signed-in host who opens `/` goes to their events.

## User Stories

Numbering continues from the M4 spec, which ended at 209.

### Visitors

210. As a visitor, I want the home page to look like the invitations this site makes, so that I can tell at a glance what it is for.
211. As a visitor, I want to see the site's own name and a line about it, so that I know whose site I am on.
212. As a guest who lands on the home page, I want to be told that guests only need the link they were sent, so that I do not try to make an account.
213. As a would-be host on an invitation-only site, I want to be told that hosts join with an invitation, and not be offered a sign-up that refuses me.
214. As a would-be host on an open site, I want Create an account to be the first thing in reach.
215. As a host who is already signed in, I want the home page to take me straight to my events.

### The operator

216. As an operator, I want to give my instance a name and a one-sentence welcome line, so that the site feels like mine.
217. As an operator, I want the name to appear in the browser tab, the host area's header and the account emails, so that everything the site sends matches it.
218. As an operator who sets nothing, I want the site to say "OpenInvites" with a sensible welcome line, so that the defaults look finished.
219. As an operator, I want to choose whether the home page rotates through every gallery poster, only the ones I pick, or always one, so that it can suit my club or family.
220. As an operator, I want to choose whether the home page shows "Run by" with my display name, off unless I turn it on, so that my name stays private by default.

### First run

221. As the person who has just installed OpenInvites, I want the home page to tell me to create the operator account first, and what comes after, so that I set up the site before anyone else signs up.
222. As a new operator, I want a one-time welcome after my account is ready, pointing me to the name, registration, and limits, so that I find Instance settings without reading the docs.

## Implementation Decisions

### Architecture

The home page becomes a server component that reads the instance settings once and draws one of three states. It reuses the M4 pieces rather than copying them: a gallery poster's files and look (`src/themes/posters.ts`), the title fonts (`title-fonts.ts`), the poster-first page's frame, glass panel and pinned bar. Where those pieces live inside the event page today, the ticket that needs one moves it to a shared place (for example `src/themes/sections/`) without changing what the event page draws.

### What the home page shows **(maintainer, 2026-11-04; details decided here, the mockup's)**

- **Who sees which state.** Signed in → redirect to `/dashboard`. No accounts yet (`hasAccounts()` false) → the fresh state. Otherwise → the invitation, with the bar set by the registration mode.
- **The poster** is chosen on each request from the operator's pool (below), at random, server-side. The page is dynamic already (it reads the session), so no cache work is needed. Its look sets the title's font and whether the title sits on the poster (with the scrim) or under it; its accent colours the primary button. The page behind is the poster blurred, as on an event page. Effects are not drawn on the home page.
- **The title** is the instance name, or "OpenInvites" when none is set. **The welcome line** is the operator's, or a translated default ("Event invitations, made here: one link that is the invite, the reply and the place guests come back to.").
- **"Run by"**, when the operator turns it on, is a line under the welcome line with the operator's initials and display name, in the style of an event's "Hosted by". With no operator (the account was deleted) it is not shown.
- **How this works**, one glass card with two rows: "Invited to something? Open the link you were sent. Guests never need an account." and "Hosting?" followed by "Sign in to make an invitation. New hosts join with an invitation from whoever runs this site." (Invitation only) or "Create an account to make your own invitation pages." (Open).
- **The bar.** Invitation only: Sign in. Open: Create an account (primary), Sign in. Fixed to the bottom on phones with the safe-area inset; on wider screens the page is phone-width and centred and the bar sits at the foot of its column, as on an event page.
- **The footer** is the themed `PageFooter` (Privacy, Terms, language switcher) with a new first item, "Powered by OpenInvites", linking to the project's repository. Only the home page shows that item **(decided here)**. It also gives every instance a source link, which ticket 21 raised for AGPL section 13.
- **The fresh state.** Title "Your OpenInvites is ready", whatever is stored. Text: "Create the first account to finish setting up. That account runs this site: you choose its name, who can join, and how long events are kept." The card is three numbered steps: Create the operator account, Name your instance, Invite your hosts. The bar has one button, Create the operator account, leading to `/sign-up`. The poster rotates through all twenty, since nothing is configured yet.
- `<title>` and the description: the instance name and welcome line on the home page; the instance name replaces "OpenInvites" wherever the root layout's metadata uses it today.

### Instance settings: the Home page card **(maintainer, 2026-11-04)**

- New columns on `instance_settings`, in two migrations (the last column comes with the welcome sheet's ticket):
  - `instance_name text` (null = not set), 1 to 40 characters after trimming;
  - `welcome_line text` (null = not set), 1 to 140 characters after trimming;
  - `home_posters text` with check `IN ('all', 'picked', 'one')`, default `'all'`;
  - `home_poster_ids text[]` default `'{}'`: the picked posters, or the one;
  - `show_operator boolean` default false;
  - `welcomed_operator_id uuid` (null), see the welcome sheet.
- A pure module, `src/instance/home.ts`, holds the rules: validating and normalising the two texts (trim, collapse whitespace, empty means null, no line breaks), validating the poster choice (every id a known gallery poster, at least one for `picked`, exactly one for `one`), choosing the pool, and naming the instance (`instanceName(settings) ?? "OpenInvites"`). Stored ids that are no longer in the gallery are skipped; an empty pool falls back to all.
- The card on `/instance`, first on the page: Name and Welcome line, then **More options**, collapsed: "Posters on the home page" (All gallery posters, a different one each visit / Only the ones I pick / Always the same poster), with the gallery's thumbnails to pick from when either of the last two is chosen; and "Show 'Run by' with my display name". One Save, a server action that refuses anyone but the operator, as the other cards' actions do. Errors are shown beside the field.
- The name and welcome line are the operator's own words and are not translated. Everything around them is a message in en, zh-Hans and zh-Hant.

### The instance name elsewhere **(maintainer, 2026-11-04)**

- The account emails (verify, reset password, host invitation, sign-in link) take the name through an `{instance}` placeholder in their subjects and bodies, in all three languages. Not a setting.
- The host area's header shows the name where it shows "OpenInvites" today.
- Not changed **(decided here)**: the calendar file's `PRODID`, the passkey relying-party name (set once at start, and changing it later would not matter to existing passkeys but would make them read differently), the legal placeholders, and event pages, which belong to their hosts.

### Registration follows its setting **(maintainer, 2026-11-04)**

Create an account appears only when registration is Open. Invitation only shows Sign in alone. Not a setting.

### The welcome sheet **(maintainer, 2026-11-04; details decided here)**

- Shown on `/dashboard` to the operator while `welcomed_operator_id` is not their id. "Name your instance" and "Not now" both set it to their id, so the sheet shows once per operator. A new operator taking over through `OPERATOR_EMAIL` sees it once too.
- The upgrade's migration sets `welcomed_operator_id` to the current operator, so an existing instance's operator is not greeted after upgrading.
- Content: a gallery poster as its picture, "This site is yours", "You're its operator, the one account that decides how it works.", then three rows linking into `/instance`: Name and welcome line (showing the name, or "Not set"), Who can sign up (the mode), Limits and retention (a summary). Buttons: Name your instance (to the Home page card), Not now.
- A sheet from the bottom on phones and a centred dialog on wider screens, built on Radix `Dialog` as the editor's `EditorSheet` (`src/editor/sheet.tsx`) is, in the dashboard's light look. It opens with the page, takes the focus to its heading, and treats Escape and a tap outside as Not now.

## Testing Decisions

The M1 to M4 testing decisions hold: two seams (the browser against the real app with Postgres and Mailpit, and pure rules called directly), and the definitive run is the Docker test profile with `CI=1`.

- **Unit tests** for `src/instance/home.ts`: text normalising and limits, the poster choice's validation, the pool (all, picked, one, unknown ids skipped, empty falls back), and the name fallback.
- **Browser tests:**
  - a fresh instance shows the setup state; the first sign-up sees the welcome sheet once, Not now dismisses it for good, and Name your instance opens the card;
  - with registration Invitation only the bar has Sign in alone; Open shows Create an account first;
  - the operator saves a name and welcome line, and the home page, the tab title, the host header and a verification email in Mailpit use them; clearing them restores "OpenInvites";
  - "Always the same poster" shows that poster on two visits; "Only the ones I pick" never shows another; "Run by" appears only when turned on;
  - a signed-in host opening `/` lands on `/dashboard`;
  - a non-operator posting the card's action is refused.
- The accessibility, keyboard, locale and reduced-motion specs extend to the home page in its three states, at 390 px and at desktop width, and to the welcome sheet.
- The browser tests that open `/` and expect today's text are updated in the ticket that replaces the page.

## Out of Scope

- The operator uploading their own home page poster (later, through the existing upload pipeline).
- Choosing the home page's font, accent or effect separately from the poster.
- A public list of events, or anything else that lists hosts or events on the home page.
- Translating the operator's name or welcome line.
- The instance name on event pages, in the calendar file or in the passkey prompt.
- Apple and Facebook sign-in, and M5.

## Further Notes

- Branch `home-page` from `main` at a7cfbbf.
- Glossary proposals for the maintainer's `CONTEXT.md` (the tickets do not edit it): **Instance name**, the name the operator gives the instance, shown on its home page and in account emails, "OpenInvites" when not set; **Welcome line**, the operator's one sentence under it.
- The mockup draws seven of the gallery posters and fakes the dashboard; the real page uses all twenty and the real dashboard.
