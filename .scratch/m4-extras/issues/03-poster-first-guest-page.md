# 03: The poster-first guest page

**What to build:** The Poster layout as the mockup's guest view: the poster full width, the title on it or below it, the details as one list, the reply buttons pinned to the bottom on phones, and the page phone-width on desktop. Broadsheet and Thread take the poster where they took the background.

**Blocked by:** 01 The poster model

**Status:** ready-for-agent

- [ ] `poster-layout.tsx` and `poster-card.tsx` rebuilt to the mockup (spec, "The guest page"): poster full bleed, fading into its blurred copy when the title is below; on the poster, title and date on the scrim; the host line; one frosted list of When (countdown, Add to calendar), Where (Open in Maps), About; then Who's coming, Announcements, Comments as panels. The date sticker goes.
- [ ] Under `md`: Going, Maybe, Can't go in a bar fixed to the bottom (safe-area inset), the RSVP sheet opening from it; after a reply the bar reads the reply with Change. At `md` and up: a centred column `max-w-[28rem]`, the bar at the column's foot, sticky.
- [ ] The RSVP style knob is ignored by the Poster layout (always the sheet); still parsed.
- [ ] Broadsheet and Thread: the blurred poster behind the page in every poster kind; Broadsheet shows the poster beside its title as it shows an upload poster today.
- [ ] Every guest-facing behaviour of 0.4 holds: steps, questions, email codes, waitlist, approval, personal invites, the locked guest list, comments, announcements, cancelled and draft notices, effects, reduced motion.
- [ ] Browser: the existing rsvp, poster, broadsheet, thread, capacity, approval, invites, email-code, comments, effects specs updated where they find things by layout; new rows for the pinned bar at 390 px (visible at the top and the foot of a long page, the sheet opens from it, focus returns to it) and the desktop column. Accessibility and keyboard rows for the bar. The pixel contrast audit of ticket 13 rerun over the new surfaces.

## Notes for the implementer

- Commit subject, e.g. `Guest page: the poster comes first and the reply buttons stay in reach`.
