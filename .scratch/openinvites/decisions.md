# OpenInvites: decisions from the grilling session

Interview held 2026-09-19 and 2026-09-20 with `/grill-with-docs`. Vocabulary is in `CONTEXT.md`; hard-to-reverse choices are in `docs/adr/`. This file records the product decisions that belong in neither, as the primary input for `/to-spec`.

## Product

- Open source, self-hostable alternative to Partiful and Apple Invites. Research (2026-09-19) found no well-maintained open source equivalent; Cactoide and Gathio are closest but lack themes, plus-ones, questions, reminders, announcements.
- Target deployment: a public multi-host instance run by the maintainer, first on a cloud VM or their own machine. Home self-hosting must also be easy.
- First real event: the maintainer's birthday party. No fixed date, so M1 ships at full scope.
- Name: OpenInvites, working name until v1.0. GitHub org `openinvites` and npm name were free on 2026-09-20. The `.app` and `.com` domains are taken, `.org` appeared free. The repository is public from the first push (2026-09-21, `leongyeehang/OpenInvites`) so the name is held; the earlier plan to stay private until M1 was dropped. The `openinvites` organisation was still free that day and the repo can be transferred into it later.
- License: AGPL-3.0.
- Platform: responsive web, installable as a PWA. No native apps.
- Languages in M1: English (source), Simplified Chinese, Traditional Chinese. Interface follows the guest's browser language; a switcher overrides and remembers. Every string lives in translation files.

## Milestones

- **M1, the party**: host signup (email and password, Google, GitHub), create and edit events, themed event page, share link with rich preview card and QR code, guest RSVP with name, plus-ones, questions, edit link, guest list, add to calendar, map link, countdown, cancel event, reset link, host dashboard, delete account, three languages, Docker Compose deployment, registration toggle, email verification, rate limits, privacy and terms pages.
- **M2, the social layer**: co-hosts, comments, announcements, email reminders, manual "send reminder now", magic-link login, host email per RSVP, duplicate event, per-event view count, effects layer on themes, multiple-choice questions.
- **M3, control**: capacity and waitlist, guest approval, personal invite links, required email or phone with verification codes, vanity slugs, admin interface, operator limits, Turnstile captcha, retention and auto-deletion, report-event link.
- **M4, extras**: photo album, date polling, passkeys, Sign in with Apple, Facebook login, emoji reactions on comments.
- **M5, money**: ticketing and payments via Stripe. Not planned until real users ask.

## Hosts

- Login: email and password always available. Google and GitHub in M1, Apple and Facebook in M4, magic link in M2, passkeys in M4. Each social provider's button appears only when the operator has set its environment variables (Better Auth plugins).
- Hosts must verify their email before creating an event, when the instance has email configured.
- Password reset by email. Without email configured, the operator resets it with a command inside the container.
- A host has a display name, shown as "Hosted by" on the event page. No avatars in M1.
- Dashboard: upcoming and past events, account settings, delete account (removes all their events and guest data). M1.

## Events

- Fields: title, start date and time, optional end, all-day toggle, the event's own time zone (guests elsewhere see both), location as free text with a generated map link (Apple Maps on iPhone, Google Maps elsewhere), rich-text description, theme, questions.
- Rich text in M1: bold, italic, links, bullet list, emoji. No headings, numbered lists, or inline images. Headings and numbered lists only if hosts ask.
- Lifecycle: Draft (link does not work) to Published to Cancelled (page stays with a notice; emailed guests notified once M2 exists). Delete removes the event entirely.
- Theme knobs: layout (Poster in M1; Broadsheet and Thread proposed for M2, pending the maintainer's decision), background (curated gallery of images and gradients, or uploaded), title font (four curated), accent colour (auto-derived from the background, six overrides), text tone (auto, light, dark), RSVP button style (glass, solid accent, outline), effect (host's choice: none, confetti on RSVP, sparkles; effects M2). Uploaded image usable as background or as poster; in poster mode the host chooses title placement, on the poster or below it. Thread layout is fully scripted, no AI. Hosts start from a template, a shipped named combination of the knobs, and may change any knob. Templates are data files in the repo so contributors can add them. An uploaded image can be used as the full-page background or as the poster itself (natural aspect ratio, title and date beneath), pending prototype confirmation. Uploads are resized and re-encoded, operator-configurable size limit, originals discarded. (Decided 2026-09-21 during the prototype round.)
- Link: random ten-character slug (ADR-0004). "Reset link" in M1. QR code on the share screen in M1. Rich preview card (Open Graph image rendered from the theme) in M1. Event pages carry a noindex signal and there is no public directory. Vanity slugs in M3.
- Questions: free text, single choice, yes or no, each with a required flag. Multiple choice in M2. Answers visible to the host only.
- Guest conveniences in M1: add to calendar, offered on the confirmation screen and on the event page, as a downloadable .ics file (Apple Calendar, Outlook desktop) plus prefilled Google Calendar and Outlook web links, carrying title, time zone, location, and the event link; map link; countdown or "starts in N days".
- Per-event settings: plus-ones allowed 0 to 10 (default 1), require plus-one names, guest list visibility (always, after RSVP, hidden; default after RSVP), optional email field on the RSVP form. M2 adds reminders on/off, notify me on RSVP, comments on/off. M3 adds capacity, approval.
- View count per event, computed inside the instance, shown to the host. M2.

## Look and feel (prototype verdict, 2026-09-21)

Settled by four rounds of a throwaway prototype on branch `prototype/event-page` (commits f03be7f, ae6fa4c, c09128a, 4f9c2a8; see `PROTOTYPE.md` on that branch). The maintainer chose round one's A visuals (warm layered background, grain, frosted glass, large serif title) on B's layout (poster card, three RSVP buttons beneath, guests as an avatar pile that becomes chips).

- Layouts: Poster ships in M1. Broadsheet (editorial, single ballot form) and Thread (the page reads like a chat, fully scripted, no AI) ship in M2. The theme model carries the layout from day one.
- Theme knobs: layout; background (curated gallery of images and gradients, or upload); upload used as background or as poster, with title placement on or below the poster; title font (four curated, self-hosted); accent colour (auto-sampled from the background, six overrides); text tone (auto, light, dark); RSVP button style (glass, solid accent, outline); RSVP style, Poster layout only (inline stepper by default, or a frosted bottom sheet that grows through the steps; the template recommends one, the host may change it); effect (none, confetti on RSVP, sparkles, doodles with a tilted date sticker; effects are M2, all off under reduced motion).
- Templates: six ship in M1 as data files: Birthday, Vows, Supper club, Kids' party, Festival, Quiet. Each sets every knob. Any change flips the theme to "custom, started from <template>". Birthday reproduces round one's A, Festival reproduces B.
- Design drawer: "Upload your photo or poster" first, then Templates, Layout, Background at top level; the remaining knobs grouped under a collapsed "Details" section. The drawer adapts to the screen: a bottom sheet on phones, a side panel on desktop.
- Confirmation state offers "Change my answer" and "Remove my RSVP".
- Guest list is a locked reward: blurred until the guest replies (per-event setting still applies).
- Later idea (maintainer, 2026-09-21), to prototype before M2: backgrounds derived from the host's upload, offered in the background gallery as "from your image". Two non-AI variants: an ambient blur of the upload, and a gradient built from its dominant colours. Poster mode already shows a blurred copy behind the poster. AI-generated backgrounds are not planned; they would need an external provider and keys.

## Guests and RSVPs

- Guests never have accounts. In M1 a guest opens the link and types a name. They receive an edit link and a browser cookie to change or withdraw. Answering again replaces the earlier RSVP. Two guests with the same name are two guests.
- Statuses: Going, Maybe, Can't go. Maybe is counted separately from Going everywhere.
- Hosts can edit any guest's RSVP and can remove guests.
- Guest list shows name, status, and plus-one count.
- M3: host can require email or phone, proven by a code. Personal invite links tie an RSVP to a named guest. Capacity counts guests plus their plus-ones; Maybe does not count. Waitlist is ordered by arrival and promotes automatically, emailing the guest if they gave an address and updating the page either way. With approval on, Pending guests see the page but not the guest list or comments.

## Communication (M2 onwards)

- SMTP is the only email transport. Emails come from the instance's address. Guests cannot reply to reach the host.
- Reminders: fixed cadence with one per-event toggle. One week before to Maybe, one day before to Going. A host can also "send a reminder now", which is an announcement using a reminder template.
- Announcements always post to the event page and are additionally emailed to guests who gave an address. Filterable by status. Maximum ten per event.
- Comments: anyone who has RSVP'd, in any status. Host and co-hosts delete any comment; a guest deletes their own. Host emailed on new comment, per-event toggle. Reactions in M4.
- Co-hosts share management of an event. M2.

## Instance and operations

- Postgres only (ADR-0001). Uploads through one storage interface, local disk default, S3-compatible optional (ADR-0003).
- Docker: one Compose file with the app and Postgres, uploads in a named volume, migrations run automatically on start, a health endpoint, no TLS in the image (Caddy example shipped), images for amd64 and arm64, published to GitHub Container Registry and Docker Hub on tagged releases, semantic versioning, backups documented as a Postgres dump plus the uploads volume. All M1.
- Operator: the first account created on a fresh instance becomes the operator, and an environment variable can promote an account by email. M1 ships a minimal admin settings page (decided 2026-09-21, replacing the earlier "environment variables only" assumption) with the registration mode, Open or Invitation only (default Invitation only), and host invitations the operator creates, shares as single-use links or emails when SMTP is configured, and revokes. Other operator settings (contact address, limits) stay environment variables in M1. The fuller admin interface (limits, reports) stays in M3.
- No AI or external model API is integrated in M1 or planned for M2; if ever, it would be an optional operator-configured provider (decided 2026-09-21).
- Safety in M1: registration mode in admin settings, host email verification, rate limits on signup, RSVP, and event page requests, editable privacy policy and terms pages. Safety in M3: optional Cloudflare Turnstile, operator limits (guests per event, upload size, events per host), retention (default one year after the event ends, host warned by email, guest data deleted with the event), a report-event link that emails the operator.
- No telemetry (ADR-0005). One environment variable takes an operator's own analytics snippet. Umami is the suggested tool for the maintainer's instance.
- Host dashboard follows the system light or dark setting. The event page always shows its theme.

## Quality bar

WCAG 2.1 AA. Animations respect reduced-motion. Event page loads fast on a mid-range phone on mobile data. Automated browser tests for sign up, create event, RSVP, edit RSVP, and guest list. No interface strings in code.

## Contributor conventions (written before going public)

Developer Certificate of Origin sign-off, no CLA. CONTRIBUTING.md. Contributor Covenant code of conduct. English for the repo, issues, and comments.

## Process

1. Prototype the event page and RSVP flow on branch `prototype/event-page` using the `ui-ux-pro-max` skills. The look is settled by seeing it, not describing it.
2. `/to-spec` for M1, describing what the prototype showed.
3. `/to-tickets`, then `/implement` one ticket at a time.
