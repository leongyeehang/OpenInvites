# Task 18 report: Operator hardening (rate limits, legal pages, analytics)

**Status:** DONE_WITH_CONCERNS (concerns are design notes, listed at the end; nothing is unfinished)
**Commit:** `de58d67` Operator hardening: anyone going too fast is asked to try again shortly, and every page carries the operator's terms (one commit on `m1-remaining`, 63 files, +1151 / -48)

## What I implemented

### Rate limits: one module, one store, one client-address rule

- `src/rate-limit/client-address.ts` (pure). The client is the `X-Forwarded-For` entry that the outermost trusted proxy appended, counted from the right: `entries[max(0, len - TRUSTED_PROXY_HOPS)]`. Entries a client wrote to the left are never believed. With `TRUSTED_PROXY_HOPS=0`, a missing or empty header, or an entry that is not an IP address (`node:net` `isIP`), there is no address.
- `src/rate-limit/window.ts` (pure). A fixed window per client and limit, opened by the first request. A refused request is not counted and does not push the window back. `retryAfterMs` is the time until the window ends.
- `src/rate-limit/config.ts` (pure). `TRUSTED_PROXY_HOPS` (default 1) plus six limits, each one variable in the form `count/window` with a unit of s, m or h. A value it cannot read throws with the variable's name, and `instrumentation.ts` stops the app at start.
- `src/rate-limit/rate-limit.ts`. It defines the async `RateLimitStore` interface, so a shared store can replace it later, and its `MemoryStore` implementation, which sweeps finished windows once a minute. `consume(limit, headers)` is the single entry point. Requests without an address share one key (`*`). With hops 0 the log says so once at start (`checkRateLimitsAtStart`); otherwise the first such request logs a warning once.
- **One store for the proxy and the app.** `src/proxy.ts` is bundled separately but runs in the same Node process, so the store and its config hang off `globalThis[Symbol.for("openinvites.rateLimit")]`. I verified this against the production image: five GETs of `/host-invitation/<bogus>` (all 404, all counted against the sign-up limit), then `POST /api/auth/sign-up/email` from the same address got 429.

**What is counted, and where:**

| Limit (default) | Counted in | Covers |
| --- | --- | --- |
| `RATE_LIMIT_EVENT_PAGE` (120/1m) | `src/proxy.ts`, GET/HEAD only | Everything under `/e/`: page, `preview.png`, `calendar.ics`, for real, retired, and never-issued slugs alike |
| `RATE_LIMIT_SIGN_UP` (10/1h) | Better Auth `hooks.before` (`/sign-up/email`) and `src/proxy.ts` (`/host-invitation/<token>`) | Sign-up by form or by direct `/api/auth` call, and host invitation link opens (ticket 04's note) |
| `RATE_LIMIT_SIGN_IN` (10/15m) | Better Auth `hooks.before` (`/sign-in/email`) | Forms and direct HTTP |
| `RATE_LIMIT_PASSWORD_RESET` (10/1h) | Better Auth `hooks.before` (`/request-password-reset`, `/reset-password`) | Asking for the link, and setting the new password |
| `RATE_LIMIT_RSVP` (60/10m) | `saveRsvpAction`, before any lookup | Every RSVP submission; it also stops the action serving as an oracle for whether a slug exists |
| `RATE_LIMIT_UPLOAD` (20/10m) | `POST /api/events/[id]/upload`, after the Origin check and before the body is read | Uploads |

Server actions posted to `/e/<slug>` (the Design drawer, RSVPs) are not page requests. The proxy ignores non-GET/HEAD requests, so a host changing the design is never throttled.

**Better Auth: its limiter is off (the ruling's second option).** I set `rateLimit: { enabled: false }` and `advanced.ipAddress.disableIpTracking: true`, and do the counting in `hooks.before` (`createAuthMiddleware`, in `src/auth/auth.ts`). I read `node_modules/better-auth` to decide. Its `getIP` only supports `trustedProxies` as CIDR lists, which strip from the right, and cannot take a hop count. Its limiter runs only in the HTTP router's `onRequest`, so the forms, whose server actions call `auth.api.*` directly, were never limited at all. `dispatchAuthEndpoint` runs `hooks.before` for both direct API calls and HTTP requests, so the hook is the one place that sees both. With IP tracking off, Better Auth derives no client address anywhere, which keeps one source of truth; the only side effect is that new sessions record an empty `ip_address`, which nothing in the app shows. A throttled call throws `APIError("TOO_MANY_REQUESTS", { code: "TOO_MANY_REQUESTS" }, { "Retry-After": ... })`. Over HTTP that becomes a 429 JSON response with `Retry-After` (checked in production); in a form, `authErrorMessage` turns it into the translated sentence.

**`e2e/hosts.ts` workaround revisited.** The per-page random `X-Forwarded-For` in `verifyEmail` is gone. `e2e/test.ts` replaces it: an `extraHTTPHeaders` fixture gives every test a random private address, as a single entry, which is what Caddy appends with hops 1. Playwright applies the test's combined context options to every `browser.newContext()` and request context the test creates, so every page, request, and extra context a test uses carries its one address. Every spec, and `operator.setup.ts`, now imports `test`/`expect` from `./test`; that is a one-line change per file.

**Friendly message: "You’re going too fast. Try again shortly."**
- Page requests: the proxy calls `NextResponse.rewrite('/too-fast', { status: 429, headers: { Retry-After } })`. The response is a real page (`src/app/too-fast/page.tsx`, heading "You’re going too fast", text "Try again shortly.", noindex, root layout and footer). Verified in production: `HTTP/1.1 429`, `retry-after: 60`, `Cache-Control: private, no-cache, no-store`. The ruling asked for 429 on a real page, and a Server Component cannot set 429, which is why the proxy is used here.
- Forms, inline where their other errors appear: RSVP (`Rsvp.errors.tooFast` in the flow's `role=alert`; the guest keeps their place, and their saved RSVP stands); sign-up, sign-in, forgot and reset password (`Auth.errors.TOO_MANY_REQUESTS` through `FormOutcome`); upload (`DesignDrawer.uploadProblems.tooFast` in the drawer's alert, on a 429).

### Legal pages

- `src/legal/source.ts` (pure): `PRIVACY_POLICY_MARKDOWN` or `PRIVACY_POLICY_FILE`, and `TERMS_MARKDOWN` or `TERMS_FILE`. Neither set gives the placeholder. Both set throws, so the app stops at start. Whitespace-only counts as unset.
- `src/legal/documents.ts` reads a mounted file on every request, so an edit shows without a restart. `checkLegalPagesAtStart` reads each named file once at start, so a wrong path stops the app instead of breaking the page later.
- `src/legal/markdown.ts`: markdown-it 15 with `html: false`. The justification is in the commit body. It is MIT licensed, maintained (15.0.2 was released this month), ships its own types, and adds six small dependencies. marked has no option to disable raw HTML, so it would need a sanitiser; micromark and react-markdown pull in many more packages. Raw HTML is escaped, and javascript:, vbscript:, and data: links are dropped (markdown-it's `validateLink`).
- `src/legal/placeholders.ts`: English Markdown. Each placeholder states in bold that the operator has not published the page, names the variables that replace it, and lists what such a page usually covers on an instance. That list is factual for this codebase: what hosts and guests leave behind, the four cookies, and that network addresses are held only in memory by the limits.
- `src/legal/legal-page.tsx` plus `src/app/privacy/page.tsx` and `src/app/terms/page.tsx`. Each shows the title (translated), the operator's HTML with prose styles, and "Questions? Contact the operator of this instance at <mailto>", or says the operator has given no contact address.
- **Footer** (`src/components/page-footer.tsx`): the root layout renders the plain footer ("Privacy policy · Terms of use") under every page. A themed event page (`ThemedPage`) carries its own footer in the theme: a veil pill in `text-theme-text-muted`, the same treatment as the RSVP flow's "not taking RSVPs" note, which is the page's established way to keep bare text legible. The plain footer is hidden there by a new `themed` custom variant (`body:has(.event-page)`), following the existing `designing` and `rsvp-sheet-open` variants, so exactly one footer is ever visible. I checked this visually at 390px and desktop.
- The operator contact on the "contact the operator" reset screen already existed (ticket 02). I added a browser test for it on `app-no-mail`, which now sets `OPERATOR_CONTACT_EMAIL`.

### Analytics

- `ANALYTICS_SNIPPET` (`src/instance/env.ts`). When it is unset, the root layout renders no `<head>` of its own and no script. When it is set, the layout renders `<head suppressHydrationWarning dangerouslySetInnerHTML={{ __html: analyticsHead(snippet) }} />`. I tested this empirically first. The server writes the snippet first in the head, followed by Next's hoisted tags. The script runs once. There is no hydration warning with `suppressHydrationWarning` (there was one without it). Client navigation keeps it without re-running it, and titles and styles still update.
- **Discovered in production:** any route that calls `notFound()` (an unknown `/e/<slug>`, `/instance` for anyone but the operator, a mistyped host id) is sent as Next's error-recovery document (`<html id="__next_error__">`), and React builds that document in the browser. The cause is that React cannot catch `notFound()` in a page during server rendering. This happens in dev and production, on `app` with no snippet too, and predates this ticket. The snippet reaches the head through `innerHTML` there, and scripts added that way never run.
  - **Fix** (`src/components/analytics.ts` and `analytics-fallback.tsx`): the head starts with a one-line marker script (`window.openinvitesHeadRead=true`). A client component, rendered only when a snippet is set, checks on mount whether the marker ran. If it did not, it replaces each of the snippet's scripts with a parser-equivalent copy (same attributes and text, `async=false` unless the original had `async`), so each runs once.
  - **Mutation-checked in dev:** without the fallback, `/e/nosuchlink` gave `[undefined, undefined]` for the inline and external test scripts. With it, both were 1 on every page and there were no duplicate script nodes.

### Malformed host event ids

`findHostEvent` now returns undefined for an id that is not a UUID (`isUuid`), so `/events/<x>`, `/events/<x>/share`, and `/events/<x>/guests` give the not-found page with 404 instead of 500. There is a browser test, with RED evidence below.

## Test results and TDD evidence

### Pure rules, test first (Vitest)

Each rule got a placeholder that let the test file load, then a RED run, then the implementation and a GREEN run. Mutation checks followed.

**Client address.** Command: `pnpm exec vitest run src/rate-limit/client-address.test.ts`

RED (placeholder returning undefined):
```
     × takes the address the one reverse proxy appended
     × ignores whatever a client wrote in front of it
     × counts from the right, one entry per trusted proxy, to the one the outermost appended
     × takes the leftmost entry when there are fewer than the trusted proxies, as every one was written by them
     × reads IPv6 addresses and spaces around entries
     × finds no address when no proxy is trusted, whatever the header says
     × finds no address when the header is missing or empty
     × finds no address when the entry a proxy should have written is not one
AssertionError: expected undefined to be '203.0.113.7' // Object.is equality
      Tests  8 failed (8)
```
GREEN:
```
 Test Files  1 passed (1)
      Tests  8 passed (8)
```
Mutation: trusting the leftmost entry (`entries[0]`), the classic spoofable mistake, fails 4 of the tests ("ignores whatever a client wrote in front of it", and others). After restoring, all 8 pass.

**Limiter window.** Command: `pnpm exec vitest run src/rate-limit/window.test.ts`

RED:
```
     × lets requests through up to the limit, the first one opening the window
     × refuses the one after the limit, saying how long until the window is over
     × does not count a refused request, nor let it push the window back
     × opens a fresh window once the old one is over, with the whole limit again
     × allows exactly the limit, not one more, however the requests are spread
     × says a window can be forgotten from the moment it ends
TypeError: Cannot read properties of undefined (reading 'window')
      Tests  6 failed (6)
```
GREEN:
```
 Test Files  1 passed (1)
      Tests  6 passed (6)
```
Mutations: an off-by-one at the limit (`>` for `>=`) fails 4 tests; a window that never ends (`current ?? new`) fails 1. After restoring, all 6 pass.

**Legal-source selection.** Command: `pnpm exec vitest run src/legal/source.test.ts`

RED:
```
     × falls back to the shipped placeholder when the operator has given nothing
     × takes the operator's Markdown from the environment
     × takes the path of a file the operator mounted
     × reads each page's own pair of settings
     × refuses both a file and contents for one page, naming them, rather than guess which the operator meant
AssertionError: expected undefined to deeply equal { from: 'placeholder' }
      Tests  5 failed (5)
```
GREEN:
```
      Tests  5 passed (5)
```
Mutation: disabling the both-set refusal fails 1 test. After restoring, all 5 pass.

**Also test first:**
- Limit settings (`src/rate-limit/config.test.ts`): RED 6 of 6 failed, GREEN 6 passed.
- Markdown rendering (`src/legal/markdown.test.ts`): RED 2 failed. The third passed vacuously against the empty stub, because it only asserts that no link appears; the mutation below shows it bites. GREEN 3 passed. Mutations: `html: true` fails "shows markup the operator typed as text"; `validateLink = () => true` fails "makes no link out of a script address".

**Malformed id (browser, red then green).** Command: `pnpm exec playwright test e2e/events.spec.ts -g "mistypes"` against `next dev`.
- With the guard commented out: `Error: /events/not-an-event … Expected: 404, Received: 500`.
- Restored: `3 passed` (operator setup plus both widths).

**Final checks:** `pnpm lint` clean; `pnpm typecheck` clean (after `rm -f tsconfig.tsbuildinfo`); `pnpm test` gives `Test Files 40 passed (40)`, `Tests 309 passed (309)`, 28 of them new. The Vite native-config-loader warning at the top of `pnpm test` predates this ticket.

### Definitive browser run (Compose test profile)

`fuser -k 3000/tcp`, then `docker compose --profile test up -d --build --wait && pnpm exec playwright test`, run on the working tree that is exactly commit `de58d67`:
```
  198 passed (3.0m)
```
That is 177 existing plus 21 new test runs: 11 scenarios, most at both widths. An earlier full run before the final rename also gave 198 passed, and the run before the analytics fallback gave 195 passed with 2 failed, which is how the not-found analytics gap was found. The build output shows every route as ƒ (dynamic) plus `ƒ Proxy (Middleware)`, so no page is prerendered with build-time environment.

New scenarios:
- `e2e/rate-limits.spec.ts` (both widths):
  - 40 guesses at unknown slugs return 404; the 41st gets the 429 page with its heading, text, title, and a numeric `Retry-After`. `preview.png` and `calendar.ics` also return 429. A spoofed `X-Forwarded-For: 203.0.113.9, <mine>` is still 429. Another address gets 404.
  - A burst of RSVPs: the 6th shows the message in the sheet, the guest's typed name stays, and after a reload the earlier RSVP stands.
  - The 6th sign-in attempt shows the message in the form.
  - The 4th upload returns 429 and the drawer shows the message.
- `e2e/legal-and-analytics.spec.ts` (both widths):
  - On `app`: the placeholders name their variables and show the contact mailto. No page has a head script that did not come from the app. The footer is on host pages and on sign-in, and on an event page there is exactly one, whose link colour equals the "Hosted by" colour.
  - On `app-social`: the operator's privacy text from the environment (h2, bold at 600, and `<b>` shown literally) and terms from a mounted `e2e/legal/terms.md`. The snippet is in the head on five pages, including a real event page and a not-found page, and it ran exactly once on each.
- `e2e/registration-without-mail.spec.ts`: the no-mail reset screen shows "Contact the operator at help@no-mail… to reset your password." with a mailto link, and both legal pages show the contact.
- `e2e/events.spec.ts`: malformed ids return 404 with the not-found page.

**Test-profile limits** (`compose.yaml` `app` and `.env.development`): event page 40/1m, RSVP 5/1m, upload 3/1m, sign-up, sign-in and password reset 5/1m each. To check the headroom I measured with a temporary log (since removed): the heaviest existing test used 20 of its 40 event-page requests, uploads peak at 2 per test, and RSVPs at 3 per test.

**App logs after the run:** "The destination stream closed early" appeared 7 times, which predates this ticket (ticket 12 noted it). There were Better Auth "User not found" warnings from sign-in attempts with unknown emails. No request arrived without a client address.

## Files changed

- **New:**
  - Rate limits: `src/proxy.ts`, `src/rate-limit/{client-address,window,config,rate-limit}.ts` with tests for the first three
  - Legal pages: `src/legal/{source,markdown,placeholders,documents}.ts` with tests for source and markdown, `src/legal/legal-page.tsx`
  - Pages: `src/app/{privacy,terms,too-fast}/page.tsx`
  - Components: `src/components/{page-footer.tsx,analytics.ts,analytics-fallback.tsx}`
  - Tests: `e2e/test.ts`, `e2e/rate-limits.spec.ts`, `e2e/legal-and-analytics.spec.ts`, `e2e/legal/terms.md`
- **Modified:**
  - App code: `src/auth/auth.ts`, `src/rsvps/{actions,guest}.ts`, `src/app/api/events/[id]/upload/route.ts`, `src/app/e/[slug]/{page,design-panel}.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/events/repository.ts`, `src/instance/env.ts`, `src/instrumentation.ts`, `messages/en.json`
  - Dependencies and configuration: `package.json` and `pnpm-lock.yaml` (markdown-it), `compose.yaml`, `.env.development`, `README.md` (Compose profiles row, Layout)
  - Browser tests: `e2e/hosts.ts`, and every `e2e/*.spec.ts` plus `operator.setup.ts` (import from `./test`), with `events.spec.ts` and `registration-without-mail.spec.ts` gaining new tests
- **Not staged, as required:** `CONTEXT.md`, `.scratch/openinvites/decisions.md`, `.scratch/`, `.claude/`, `.superpowers/`. The ticket file is updated: status done, all six boxes ticked, and a dated comment.

## New environment variables (also in the ticket comment for ticket 19)

| Variable | Default | Meaning |
| --- | --- | --- |
| `TRUSTED_PROXY_HOPS` | 1 | Reverse proxies in front of the app. 0 counts all clients together (logged at start). 2 is for a CDN plus Caddy, where Caddy needs `trusted_proxies` so it appends instead of overwriting. |
| `RATE_LIMIT_EVENT_PAGE` | 120/1m | Everything under `/e/` |
| `RATE_LIMIT_RSVP` | 60/10m | RSVP submissions |
| `RATE_LIMIT_UPLOAD` | 20/10m | Uploads |
| `RATE_LIMIT_SIGN_UP` | 10/1h | Sign-ups and host invitation link opens |
| `RATE_LIMIT_SIGN_IN` | 10/15m | Email sign-in |
| `RATE_LIMIT_PASSWORD_RESET` | 10/1h | Reset link requests and new passwords set from one |
| `PRIVACY_POLICY_FILE` / `PRIVACY_POLICY_MARKDOWN` | placeholder | One or the other; both is an error at start; a file is re-read per request |
| `TERMS_FILE` / `TERMS_MARKDOWN` | placeholder | Same |
| `ANALYTICS_SNIPPET` | unset | HTML for every page's head, as given |

`OPERATOR_CONTACT_EMAIL` is existing; it is now also shown on both legal pages.

## Self-review and concerns

1. **The proxy and the app share one store through `globalThis`.** This relies on the proxy running in the app's own Node process, which is true for the standalone server the image runs; I verified it in production. Next's docs warn against relying on globals in proxies because some platforms run them elsewhere. This project ships only the container, so it holds, but it is an assumption worth knowing.
2. **Analytics fallback.** On pages Next builds in the browser, the operator's scripts run from copies made in the browser instead of straight from the parsed HTML. It is small and mutation-checked, but it goes beyond the ruling's literal "inserted as given" for those pages. Without it, analytics silently never ran on any not-found page raised by a route. The head also gains our one-line marker script whenever a snippet is set; when no snippet is set, nothing is added.
3. **IPv6 clients are keyed by full address,** so a client with its own /64 can rotate addresses. Keying IPv6 by /64 would be a small change in `client-address.ts`. I did not make it, because the rulings key on the address; flagging it for a decision.
4. **Not limited:** social sign-in, OAuth callbacks, verification links, and the signed-in account forms (change email, resend verification, change password, delete account). Better Auth's old limiter covered some of these for direct `/api/auth` requests only, never for the forms. Change-email sends mail to an arbitrary address; adding it is one line in `LIMITED` if wanted.
5. **Defaults are generous on purpose** for shared addresses (office NAT, carrier NAT), for example 60 RSVPs per 10 minutes. The maintainer may prefer tighter defaults. A fixed window can let up to twice a limit through across a window boundary.
6. **The app port must not be reachable except through the proxy.** Otherwise a client can write the entry the app believes. This is for ticket 19's Compose file and documentation.
7. **Suggestions I did not make myself:** `decisions.md` may want an entry for the client-address rule and the default limits, and "rate limit" is not a glossary term (it did not seem to need one). I did not touch either file.
8. **Dev loop noise:** under `next dev` with seven workers, some existing guest-list and rsvp tests timed out on their 5 s waits for "Published" or "Saved." in one run. None of those snapshots showed throttling, and all of them pass against the production image. The memory notes describe this dev-server slowness.

---

# Fix round 1 (review findings 1 to 3)

**Status:** DONE. Three new commits; nothing was amended.
- `f4f15de` Rate limits: an IPv6 client is its /64, and the counts never outgrow a fixed size
- `7ec2344` Rate limits: every request under an event link counts, and so does taking an RSVP back
- `3298535` Rate limits: mail to any address is limited, and so is every check of a password

Each commit was checked on its own before committing. I exported the index with `git checkout-index` into a scratch directory, then ran `next typegen` and `tsc --noEmit` on it. For commit A I also ran the unit tests (319 passed); for commit B, eslint on the files it touched. The final state is the full run below.

## Finding 1: requests under `/e/` other than GET and HEAD

What I checked in Next.js 16.3.5's own code, before changing anything:
- **Plain POST (no `Next-Action`).** A URL-encoded or JSON POST is not an action, so the page is drawn and reveals whether the slug exists. A multipart POST that names no action makes Next throw "Failed to find Server Action", a 500 for any slug, before any page is drawn (`action-handler.js`, E975 path).
- **Bogus `Next-Action`.** `handleUnrecognizedFetchAction` answers with a static 404 "Server action not found." and draws nothing. A URL-encoded fetch action gets `type: 'not-found'`, which is the generic not-found loader tree; the event page is never run.
- **Genuine action.** It runs. If it revalidates, refreshes, or writes a cookie, the answer draws the posted page again, whatever that address's slug is. `MutableRequestCookiesAdapter` marks any cookie write as a revalidation. An action that is not bundled with `/e/[slug]` (for example the language switcher's `setLocale`) is forwarded to a route that has it (`selectWorkerForForwarding`), and a forwarded action never draws the page (`skipPageRendering ||= actionWasForwarded`). A client that sets `x-action-forwarded` itself also skips the drawing.
  - I verified this by hand against the dev server. I took `setLocale`'s ID from the home page (`$ACTION_ID_…`), built the body with React's own `encodeReply`, and posted it to `/e/<real>` and `/e/<guess>`. Both answered `x-action-revalidated: 1` with an empty tree (`"f":""`), so nothing was revealed.
  - So the only actions that redraw an event page are its own: `saveRsvpAction`, `removeRsvpAction`, and the host's `changeThemeAction` and `describeUploadAction`.

The fix:
- **`src/proxy.ts`** now counts every request under `/e/` (and `/host-invitation/`), whatever its method, except `POST` with a `Next-Action` header. That exception follows the ruling.
- **`src/app/e/[slug]/page.tsx`: `redrawAllowed(slug)`.** This is a React `cache`, so the page and its metadata count once. When the request carries `next-action` and the viewer is not the event's host, it consumes the event page limit. Past the limit, both the metadata and the page are drawn as `<TooFast />` whatever the slug. This closes redraws by the page's own actions: RSVP redraws, and a signed-in host probing other slugs through their own drawer actions. The host's own drawer on their own event is exempt, so designing is never throttled.
- **`src/components/too-fast.tsx`** holds the shared content, now also used by `/too-fast`.
- **`removeRsvpAction`** consumes the RSVP limit before any lookup and returns `{ error: "tooFast" }`. `rsvp-flow.tsx` shows the refusal as an alert in the confirmation, and clears it on "Change my answer" and "Edit details".

## Finding 2: mail and password checks

- **`RATE_LIMIT_MAIL`** (default 10/1h; `config.ts`, test first). In `auth.ts`, `limitsByEndpoint(mail)` now maps each endpoint to a list of limits, and `consumeAll` stops at the first refusal:
  - `/sign-up/email`: sign-up, plus mail when the instance has mail
  - `/sign-in/email`, `/sign-in/social`, `/change-password`, `/verify-password`, `/delete-user`: sign-in
  - `/request-password-reset`: password reset and mail (the password reset count is kept, as ruled)
  - `/reset-password`: password reset
  - `/send-verification-email`, `/change-email`: mail
- **Host invitation email.** `createHostInvitationAction` consumes the mail limit before creating the invitation when it is to be emailed, and shows `Instance.invitations.tooFast` inline in the form.
- **Social sign-in.** A refused Google or GitHub click redirects to `/sign-in?socialError=1&error=TOO_MANY_REQUESTS`, and the sign-in page shows `Auth.signIn.TOO_MANY_REQUESTS`. `/sign-in/social` was covered by Better Auth's "/sign-in*" rule, 3 per 10 s.
- **Better Auth's endpoint list, checked against its old limiter.** The old limiter was a global 100 per 10 s on every path, plus special rules for `/sign-in*`, `/sign-up*`, `/change-password*`, `/change-email*`, `/request-password-reset`, `/send-verification-email` and `/forget-password*`. Everything now covered is listed above. Not covered, with the reasons (also written above `limitsByEndpoint` in `auth.ts`):
  - `/verify-email` and `/reset-password/:token`: single-use tokens nobody can guess, opened in a browser, where a refusal would be a raw JSON error.
  - `/callback/:id`: needs the state its counted sign-in started.
  - `/get-session`, `/ok`, `/error`: give nothing away.
  - `/update-user`, `/sign-out`, `/list-sessions`, `/revoke-session(s)`, `/revoke-other-sessions`, `/link-social`, `/unlink-account`, `/list-accounts`, `/account-info`, `/get-access-token`, `/refresh-token`, `/update-session`, `/delete-user/callback`: need a signed-in host, and neither check a password nor send mail. `/delete-user/callback` is not enabled.
- **Test profile.** `app` and `.env.development` set `RATE_LIMIT_MAIL=5/1m`; `app-social` sets `RATE_LIMIT_SIGN_IN=5/1m` for the social test.

## Finding 3: IPv6 keys and the store cap

- **`client-key.ts`** (renamed from `client-address.ts`; `clientKey(forwardedFor, hops)`). After choosing the entry, an IPv4-mapped address (`::ffff:a.b.c.d`, or its hex spelling `::ffff:cb00:7107`) becomes its IPv4 address. Any other IPv6 address is keyed as `<first four hextets>::/64`, however it is written: compression, case, leading zeros, a zone, or an IPv4 tail.
- **`WindowTable`** (`window.ts`) holds one table per limit, in the order the windows opened:
  - A count within a window is updated in place. A finished window is forgotten before its client's next one is appended at the back.
  - With one rule per table, the windows that are over are always at the front, so each request forgets just those. That costs nothing when none are over; nothing walks the whole table.
  - Past `MAX_CLIENTS_PER_LIMIT` (20,000, a commented constant) the oldest windows are forgotten first. A window measured at about 213 bytes on the heap, so the cap is about 4 MB per limit and about 30 MB across all seven at worst.
  - The store interface is now `hit(limit, client, rule, now)`.

## Tests and evidence

**Unit, test first.**

Client key: `pnpm exec vitest run src/rate-limit/client-key.test.ts`. The RED run used the existing function under its new name; the 9 existing cases passed and the 4 new behaviours failed:
```
     × keys every address in one /64 alike, however it is written
     × keys different /64s apart
     × drops a zone after the address
     × turns an IPv4 address mapped into IPv6 back into that IPv4 address
AssertionError: expected '2001:db8:1:2::1' to be '2001:db8:1:2::/64'
      Tests  4 failed | 9 passed (13)
```
GREEN: `Tests  13 passed (13)`. Mutations: keying on all 8 hextets fails 3 tests; skipping the mapped check fails 1.

Window table: `pnpm exec vitest run src/rate-limit/window.test.ts`. RED, against a placeholder class:
```
     × counts each client apart
     × forgets the windows that are over as requests arrive, oldest first
     × puts a window that opens again behind the others, so it is not forgotten early
     × holds no more clients than it may, forgetting the oldest windows first
     × does not grow or reorder on a refused request
      Tests  5 failed | 6 passed (11)
```
GREEN: `Tests  11 passed (11)`. Mutations: no sweep fails 2 tests; no cap fails 2.

Mail limit: `pnpm exec vitest run src/rate-limit/config.test.ts`. RED: `Tests  3 failed | 3 passed (6)`. GREEN: `Tests  6 passed (6)`.

**Browser.** New tests; all pass at both widths:
- `rate-limits.spec.ts`:
  - forty posts (URL-encoded and JSON) to unknown slugs return 404; the next post returns 429, and so does the next visit.
  - a guest whose address is at its event-page limit sends an RSVP from the open page, and the redraw is the "too fast" page, not the invitation.
  - after the RSVP limit is reached, "Remove my RSVP" is refused in the confirmation (extends the RSVP burst test).
  - sign up a stranger's address, then, signed out, POST `/api/auth/send-verification-email` six times: `[200, 200, 200, 200, 429, 429]`. The inbox holds exactly 5 emails (the sign-up's own plus 4). The host's "Resend email" shows the message.
- `social-login.spec.ts` (on `app-social`, with `accounts.google.com` stood in for): the 6th "Continue with Google" lands on `/sign-in?socialError=1&error=TOO_MANY_REQUESTS` with the message.
- `instance-settings.spec.ts`: the 6th emailed host invitation is refused in the form.

**Browser mutation checks** (dev loop, desktop project):
- Proxy counting only GET/HEAD: the POST test fails.
- `redrawAllowed` always true: the redraw test fails.
- `/send-verification-email` without the mail limit: the mail test fails.

All three pass again once the code is restored.

**Commands and final output, on the committed state (`3298535`):**
```
$ rm -f tsconfig.tsbuildinfo && pnpm lint && pnpm typecheck && pnpm test
✓ Types generated successfully
 Test Files  40 passed (40)
      Tests  319 passed (319)
$ fuser -k 3000/tcp; docker compose --profile test up -d --build --wait && pnpm exec playwright test
  208 passed (3.4m)
```
That is 198 before plus 10 new runs. An identical run just before committing also gave 208 passed. In the app logs, the only errors are the "destination stream closed early" ones that predate this ticket; the Better Auth warnings come from the sign-in attempts with unknown emails.

## Concerns after fix round 1

- **An action still runs before its redraw is refused.** A guest over the event-page limit who sends an RSVP has it saved, then sees "too fast" instead of the page, because the action runs before the redraw is counted. This is rare, and it is only ever about page redraws.
- **Multipart POSTs that name no action** get a 500 from Next.js ("Failed to find Server Action") for any slug. They reveal nothing and are counted like any other request, but each one leaves an error line in the log.
- **Dev loop only:** after a hot reload, `next dev` keeps the old store class on `globalThis`. A change to the store needs a dev-server restart; production always starts fresh.
- The earlier concerns still stand: the store is shared with the proxy through `globalThis`; the analytics fallback runs copies of the snippet's scripts on pages Next.js builds in the browser; the defaults are generous; and the app port must stay behind Caddy.
