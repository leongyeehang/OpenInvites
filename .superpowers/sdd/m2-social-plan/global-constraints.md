# Global constraints binding every OpenInvites M2 ticket (for reviewers)

Copied from `.scratch/m2-social/spec.md`, `.scratch/openinvites/spec.md` and the repo's own rules.

- Architecture (M1 spec): "The codebase is organised around a few deep modules with small interfaces … Route handlers and server actions are thin; rules live in the modules." M2 adds Mail's outbox and worker, Announcements, Comments, and Hosts (co-host membership and permissions).
- "No new runtime dependency. Effects are CSS animations and the Web Animations API, not Motion." No AI or external API. Nothing leaves the instance (ADR-0005).
- Mail (M2 spec, "Mail outbox and worker"): "Every email about an event, to a guest or to a host, is written to a `mail_outbox` row … and sent by a worker inside the app process. Better Auth's own emails … stay as they are: sent inline." The worker "runs every minute, and also runs at once when an action has just queued mail"; claims with `SELECT … FOR UPDATE SKIP LOCKED`; retries "after 1, 5, 15 and 60 minutes; after the fifth failure it is dropped and the failure is logged with the recipient's address redacted to its domain"; a sent row is deleted; deleting an event deletes its unsent mail. "Without SMTP there is no worker and nothing is queued."
- Guest mail (M2 spec): only guests with an email, only with mail configured; every guest email ends with why they got it and the stop link `/m/<mail token>`; the stop page's button posts, "A GET never changes anything"; guest mail is in `rsvp.locale`; host mail about an event is in `event.locale`.
- Defaults (M2 spec, story 141): `notifyOnRsvp`, `notifyOnComment`, `remindersEnabled`, `commentsEnabled` default on for new events and are set off on existing rows by their migrations.
- Co-hosts: "a co-host can do everything the owner can on the event … except delete the event and manage co-hosts. The rule is one pure function, `can(role, action)`"; "A co-host link admits nobody to the instance."
- Comments: visible to "hosts and guests who have replied"; a guest who has not replied sees "N comments" and "Reply to join the conversation"; "a guest deletes their own comment; a host deletes any"; cancelled events take no new ones.
- Layouts: "The RSVP flow's rules … are one implementation shared by every layout"; `rsvpStyle` is a Poster knob; themes already saved keep their layout. Every layout works at 390 pixels and desktop and passes the accessibility checks the event page already has.
- Effects: "Under reduced motion nothing moves: confetti does not fall, sparkles and shapes do not render, the sticker sits still." The preview card never shows effects.
- Theme shape (binding, M1 spec):
  ```ts
  type Theme = {
    layout: "poster" | "broadsheet" | "thread";
    backgroundId: string | null;
    uploadId: string | null;
    uploadMode: "background" | "poster";
    titlePlacement: "on" | "below";
    font: "serif" | "grotesque" | "display" | "rounded";
    accentOverride: string | null;
    textTone: "auto" | "light" | "dark";
    buttonStyle: "glass" | "solid" | "outline";
    rsvpStyle: "inline" | "sheet";
    effect: "none" | "confetti" | "sparkles" | "doodles";
    template: { id: string; dirty: boolean } | null;
  };
  ```
- Uploads go through one storage interface (ADR-0003); application code never touches disk or S3 directly.
- Rate limits are always on, keyed by client address, listed in `src/rate-limit/config.ts` and documented in `docs/operator/configuration.md`.
- All interface strings live in translation files, and every key added to `messages/en.json` is also added, translated, to `messages/zh-Hans.json` and `messages/zh-Hant.json` in the same change, keeping every ICU placeholder (`translations.test.ts` enforces it; `pnpm test` must be green). Dates, times, numbers and lists use the locale's formatting. Host-written content is shown as written.
- Vocabulary: `CONTEXT.md` terms in code, copy and tests; never its _Avoid_ words (e.g. "co-host" not "collaborator"; "announcement" not "blast"; "comment" not "post"; "edit link" not "magic link" for a guest's link).
- Testing (binding): "A good test observes what a host, guest, or operator can observe, and nothing else. It never asserts on database rows, component internals, or function call order." Two seams only: browser tests (Playwright against the real app, real Postgres, Mailpit, at 390px and desktop) and pure rules called directly (Vitest). "No tests at other seams." Test output pristine.
- Repo rules: commits never include `CONTEXT.md`, `.scratch/`, `.claude/`, or `.superpowers/`; nothing is pushed or published; commit trailer `Co-Authored-By: Claude <Model> 5.5 <noreply@anthropic.com>`.
