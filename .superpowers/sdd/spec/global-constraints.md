# Global constraints binding every OpenInvites M1 ticket (for reviewers)

Copied from `.scratch/openinvites/spec.md` and the repo's own rules.

- Architecture: "The codebase is organised around a few deep modules with small interfaces: Events, RSVPs, Themes, Questions, Calendar, Storage, Mail, Auth, Uploads, Sharing (preview card and QR), Locale, RateLimit. Route handlers and server actions are thin; rules live in the modules."
- "The public event page is rendered on the server with the theme expressed as CSS variables, so that first paint on a phone carries the finished look without a client round trip."
- Theme shape (binding):
  ```ts
  type Theme = {
    layout: "poster" | "broadsheet" | "thread";   // M1 stores it, only "poster" is offered
    backgroundId: string | null;                   // a curated background, or null when using an upload
    uploadId: string | null;                       // the host's own image
    uploadMode: "background" | "poster";
    titlePlacement: "on" | "below";                // poster mode only
    font: "serif" | "grotesque" | "display" | "rounded";
    accentOverride: string | null;                 // null means derive from the background
    textTone: "auto" | "light" | "dark";
    buttonStyle: "glass" | "solid" | "outline";
    rsvpStyle: "inline" | "sheet";                 // poster layout only
    effect: "none" | "confetti" | "sparkles" | "doodles"; // stored in M1, rendered from M2
    template: { id: string; dirty: boolean } | null;
  };
  ```
- "Accent resolution: the override if set, else the upload's sampled accent if an upload is in use, else the curated background's accent. Text tone resolution: the override if set, else light on dark backgrounds and dark on light ones, from the background's stored luminance. Both are computed on the server when the page renders."
- "The effect field is stored so templates can carry it, but M1 renders no effects and does not show the effect knob."
- Uploads go through one storage interface (local disk default, S3-compatible optional, ADR-0003); application code never touches either directly.
- Rate limits are always on, keyed by client address, in memory behind an interface a shared store could replace later.
- Nothing is ever sent to the project (ADR-0005). No AI or external model API anywhere.
- All interface strings live in translation files (`messages/en.json`; Chinese files fall back to English per key until ticket 20). Dates, times, and numbers use the locale's formatting. Host-written content is shown as written.
- Vocabulary: `CONTEXT.md` terms in code, copy and tests; never its _Avoid_ words (e.g. "host invitation", never "invite"; "theme"/"template"/"layout" as defined there).
- Testing (binding): "A good test observes what a host, guest, or operator can observe, and nothing else. It never asserts on database rows, component internals, or function call order." Two seams only: browser tests (Playwright against the real app, real Postgres, fake mail, at 390px and desktop) and pure rules called directly (Vitest). "No tests at other seams."
- Motion must stop entirely under reduced motion.
- Repo rules: commits never include `CONTEXT.md`, `.scratch/openinvites/decisions.md`, `.claude/`, or `.superpowers/`; nothing is pushed or published.
