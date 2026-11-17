# 26: Three browser tests that passed only on their second try at 0.8.0

**What to build:** Find out why each of three browser tests failed once and passed on its retry in the CI and Release runs of 0.8.0 (`5ec0282`, 2026-11-17 UTC), then fix the cause, in the app or in the test. A fourth from the same runs is done (see Comments). From the commit that filed this, a test that passes on its retry no longer fails the run (`playwright.config.ts`), so these no longer block a release; they are still reported in each run's annotations.

**Blocked by:** none

**Status:** ready-for-agent

- [ ] `e2e/keyboard.spec.ts` "a host approves one waiting photo and deletes another in the album's viewer by keyboard alone" [mobile]: after `tabTo` reached the tile "Photo 1 by Priya Nair, awaiting approval" and Enter was pressed, the dialog "Photo 1 of 2" was not there within 5 s.
- [ ] `e2e/conveniences.spec.ts` "a guest who has just replied is offered the calendar there and then" [desktop]: after Change my answer, Can’t go, Send RSVP, "We’ll miss you." was not visible within 5 s. The first reply in the same test showed "You’re going!" in time.
- [ ] `e2e/site-look.spec.ts` "a former co-host learns nothing of an event's look" [mobile]: a page under `/events/<id>/` asked for by the removed co-host came back 404 as Next.js's empty shell (`<html id="__next_error__">`, no `lang`) and not as the not-found page drawn whole. That shell is what a page's own `notFound()` sends when `src/proxy.ts` has let the request through, so `notFoundHere` answered "there" for a host the page then refused.
- [ ] For each: the cause with its evidence, and either a fix with a test that fails before it or a written ruling.

## Notes

- Use the `superpowers:systematic-debugging` loop. None of the three is reproduced yet: all four tests, twelve times each at both widths with `--workers=2` against the Compose `test` profile, 97 passed (17.7 min, 2026-11-16, a 2-core machine).
- CI's failure messages are read without signing in: `https://api.github.com/repos/<owner>/<repo>/actions/runs?head_sha=<sha>`, then `/actions/runs/<run>/jobs`, then `/check-runs/<job>/annotations`. Traces and the app's log need a signed-in maintainer (the run's "App logs" step and its `playwright-report` artifact).
- The site-look one is the only one of the three that may be the app and not a slow wait. Ruled out by reading: the removal is committed before the test's next request (`removeCoHostAction` awaits it, and the row leaves the owner's page only with the action's answer), and `findHostEvent`'s `cache()` does not span requests. Not ruled out: `getAuth().api.getSession` answering null in the proxy under load, which lets the request through to the page.
- M8's ticket logs name other tests that passed only on retry under `--workers=2` and alone every time (`capacity.spec.ts:191` "Target crashed", `comments.spec.ts:118`, `keyboard.spec.ts:314`); the pattern is load, two workers against one app.

## Comments

**2026-11-16.** The fourth, `e2e/keyboard.spec.ts` "a guest answers Going with a plus-one and a required question by keyboard alone, on the Broadsheet's ballot" ("nothing has the focus" at Tab 13, M8's "known one"), was the app. The confirmation's Remove my RSVP was disabled by the answer's own transition, which stays pending after the confirmation is drawn until the page behind it has been drawn again: a probe in the browser saw Remove disabled as the receipt took the focus, 4 times in 4, and enabled 20 to 240 ms later. A walk by keyboard begun in that window passed over it. Fixed by giving the removal a transition of its own (`use-rsvp-flow.ts`), with `e2e/rsvp.spec.ts` "a saved answer's confirmation offers Remove from the moment it is drawn" on each layout; the Poster's and the Broadsheet's failed before the fix, the Thread's passed (its buttons are drawn after the typing pause).
