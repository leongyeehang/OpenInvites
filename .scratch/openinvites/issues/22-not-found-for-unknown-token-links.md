# 22: Not found for unknown edit and host invitation links

**What to build:** A browser that opens an edit link (`/r/<token>`) or a host invitation link (`/host-invitation/<token>`) that was never made gets the not-found page, drawn whole on the server in the visitor's language with status 404. Today it gets 404 with an empty body, because both are route handlers whose `notFound()` cannot draw a page.

**Blocked by:** none (left over from ticket 20, listed in ticket 21's step 10)

**Status:** done

- [x] `GET /r/<token>` for a token no RSVP has is answered by `src/proxy.ts` with the not-found page, the same way it answers an event link that never existed: a rewrite to `/_not-found` with status 404, only for document requests (`isDocumentRequest`).
- [x] `GET /host-invitation/<token>` for a token no host invitation has is answered the same way. An invitation that exists but is used, revoked, or expired still goes to sign-up as today: only a link that was never made is not found, which is the route handler's own condition (`findHostInvitation`).
- [x] A known token behaves exactly as before: the redirect, the cookie, and, for a host invitation, the sign-up rate limit the proxy already counts.
- [x] No new rate limit is added to `/r/`.
- [x] The route handlers keep their own `notFound()`, as the pages do, for requests the proxy lets through.
- [x] Browser tests: `e2e/rsvp.spec.ts` "an edit link nobody was given leads nowhere" asserts `expectNotFoundAsSent` (from `e2e/test.ts`) instead of the bare 404, and a new test does the same for a host invitation link that was never made. At least one of the two also checks a Chinese visitor (`accept-language: zh-TW` gives `lang: "zh-Hant"`, heading `找不到頁面`), as `e2e/events.spec.ts` does for event links.

## Notes for the implementer

- `notFoundHere()` in `src/proxy.ts` already does this for `/e/<slug>`, `/events/<id>` and `/instance`. Add the two cases there, using the lookups the route handlers use: `findEventForToken` (`src/rsvps/repository.ts`) and `findHostInvitation` (`src/instance/repository.ts`). Decode the path segment with the existing `decoded()`.
- Add `"/r/:path*"` to the proxy's `matcher`. `/host-invitation/:path*` is already in it.
- The proxy's comment block lists what it answers. Update it, in the file's own voice.
- Commit subject in the repository's style, e.g. `Not found: an edit link or a host invitation link that was never made is answered with the not-found page`.

## Comments

**2026-10-02, implementing agent (M1 leftovers, task 1).** Done, every box ticked. Commit `b4fc176`. Lint, type check, 375 unit tests, and the browser specs below pass.

- **`src/proxy.ts`**: `notFoundHere()` answers `/r/<token>` with `!findEventForToken(token)` and `/host-invitation/<token>` with `!findHostInvitation(token)`, each with the path segment through `decoded()`, so a link that was never made gets the rewrite to `/_not-found` with 404 for a document request (`isDocumentRequest`), as an event link that never existed does. `findHostInvitation` is the route handler's own condition, so an invitation that is used, revoked, or expired still goes to sign-up. `"/r/:path*"` is in the `matcher`. The `consume` branch is untouched, so `/r/` counts against no limit and `/host-invitation/` counts as signing up, as before. The route handlers and their `notFound()` are untouched. The comment block says what the proxy now answers.
- **`e2e/rsvp.spec.ts`**: "an edit link nobody was given leads nowhere" asserts `expectNotFoundAsSent`, for an English visitor and for `accept-language: zh-TW` (`lang: "zh-Hant"`, heading `找不到頁面`).
- **`e2e/registration.spec.ts`**: new, "a host invitation link nobody made is not found", beside the used and revoked invitation tests, asserts `expectNotFoundAsSent`. It lives there because that spec is where host invitations are made and opened, on `app-fresh`.

Evidence:
- **RED**: the edit link test failed on `next dev` before the change with `Expected substring: "<html lang=\"en\""`, `Received string: ""` (404, empty body), in both projects. The new host invitation test failed the same way on the `openinvites-app-fresh` image from 2026-09-26, built before this change.
- **GREEN**: `e2e/rsvp.spec.ts` (17 passed) and `e2e/events.spec.ts` (19 passed) on a fresh `next dev` with `--workers=2 --grep-invert operator`. `docker compose --profile test build app-fresh`, then all of `e2e/registration.spec.ts` (8 passed, including the used, revoked, and known-token tests and the new one) against it.
- **Load**: at the default 7 workers `next dev` timed out on hydration in sign-up and the RSVP confirmation (2 failures in the first rsvp and events run, then 4 and 12 in two reruns of `rsvp.spec.ts`, none in the lines this change touches, and the machine's load average was 12 to 17 from other work). On a restarted dev server at `--workers=2` the same specs passed whole, as above.
