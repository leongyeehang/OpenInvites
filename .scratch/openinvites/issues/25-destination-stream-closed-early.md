# 25: "The destination stream closed early" in the app log

**What to build:** Find out why React logs "The destination stream closed early" during the browser suite. Tickets 12, 18 and 20 saw it 1 to 11 times per full run, from the events, rsvp, questions, guest-list and cancel-delete specs. Then fix it, or rule that it is harmless and say why.

**Blocked by:** none

**Status:** done (ruled benign; not silenced)

- [x] A reproduction: the smallest spec, request, or sequence that makes the message appear, run against the production image (Compose `test` profile).
- [x] The cause, traced to the code path. One candidate to rule in or out first: a client that disconnects mid-stream (a test closing its page while a server component is still streaming, or a redirect after a server action) is normal and harmless. A server-side stream ended by our code is not.
- [x] Either a fix with a test that fails before it, or a written ruling that the message is benign, with the evidence. If it is benign and can be silenced without hiding real errors, say how. Do not silence it as a guess.
- [x] The finding is recorded under this ticket's `## Comments`.

## Notes

- Use the `mattpocock-skills:diagnosing-bugs` loop.
- The app log is `docker compose --profile test logs app` after a run.

## Comments

**2026-10-07, implementing agent.** Ruled benign, and not silenced. The message is React reporting that a browser went away while the answer to an RSC request (a `<Link>` prefetch or a client-side navigation) was still being rendered. Next.js 16.3.5 logs that as an error in production. Nothing in our code ends the stream. No code changed.

- **Browser reproduction**: `e2e/rsvp.spec.ts` "a draft takes no RSVPs", alone, `--repeat-each=10 --workers=1` against the `test` profile's `app`: the message 6 and 7 times in two runs of 20. The test ends on the draft's page, which shows the host a link to `/events/<id>`, so the router prefetches that page. Playwright closes the page when the test ends. In the run that logged the browser's requests, both occurrences came 9 ms after the page closed, with that prefetch open (started 7 and 41 ms before the close). In every run, each occurrence fell within 0.1 s of a test's end. The five specs together (71 tests) gave 2, each at the end of a test. That matches the 1 to 11 per full run that tickets 12, 18 and 20 saw.
- **Smallest reproduction**: one request, no browser. A signed-in `GET /events/<id>?_rsc=…` with `RSC: 1` and `Next-Router-State-Tree: ["",{},null,"metadata-only"]` (URL-encoded, as the router sends it), with the connection closed as soon as the response headers arrive: the message 10 times in 10. Read in full: 0. Each element is needed:
  - Without the session cookie, the page redirects to sign-in and nothing renders: 0.
  - Without the state tree, cut at the headers: 0. The same full render cut after its first chunk: 10 of 10.
  - The `Next-Router-Prefetch` and `Next-Url` headers do not matter.
  - The same cut on `/events/<id>/guests`, `/share`, `/dashboard`, `/account` and `/events/new`: 0. With the `metadata-only` tree, the answer is the page's metadata only. Theirs is fixed text and is written within a millisecond of the headers. The event page's `generateMetadata` reads the session and the event from the database, so its `<title>` is still pending about 2.5 ms later.
- **Code path**: all inside Next.js and React.
  - Next.js 16.3.5 renders a dynamic RSC answer in `generateDynamicFlightRenderResult`, with `signal: undefined` in production; only the dev server passes the response's signal, and only for a hot-reload refresh (`app-render.js`; `signal:void 0` in `app-page-turbo.runtime.prod.js`).
  - When the response closes, `pipeNodeReadableToNodeResponse` (`pipe-readable.js`) destroys the `PassThrough` that Flight is piping into.
  - React's `renderToPipeableStream` treats that stream's `close` as a cancel, with `Error("The destination stream closed early.")`. If any task is still pending, it reports that error to `onError`; if none is, it finishes quietly.
  - Next.js's `createReactServerErrorHandler` drops only `AbortError` and `ResponseAborted`, so it logs `⨯ Error: The destination stream closed early.` with `digest: '1164837159'`.
  - Our proxy runs before the render, and the page and its metadata only read. None of it touches the response.
- **Causal check**: in the running container only, the production runtime was patched to give that render an abort signal from the response's `close`, with the reason named `ResponseAborted` as Next.js's own is. The smallest reproduction then gave 0 of 30, and the full-render cut 0 of 10. The draft test gave 0 in 20, and the five specs 0 (71 passed). A full read was unchanged (200, same bytes). The image was then rebuilt from clean source, and the smallest reproduction gave 10 of 10 again.
- **Why it is benign**: the client has left, and React stops rendering an answer nobody will receive, which is what should happen. Nobody sees anything, and a GET render changes nothing. Real hosts will cause it too, rarely: a tab closed, or a full page load started, in the few milliseconds while a prefetch or navigation to a page that is still rendering is in flight. Operators may see the line now and then.
- **How it could be silenced without hiding real errors**: by passing the response's abort signal to that render in production, as the causal check did. Next.js closes that stream only when the response closed before it finished, so the signal hides exactly the cases that log this message now, and no others. Done upstream, that is a one-line change in Next.js. A quick search found no Next.js issue for it. Done here, it would be a `pnpm patch` of Next.js's minified runtime, redone on every Next.js upgrade. Not done. Filtering `console.error` for this message in `register()` is not recommended: it is global, and a socket closed by the server's own timeout would be hidden the same way.

Evidence, run against the `test` profile's `app` built from `bdcee82` (with a temporary probe while diagnosing, removed since):
- The probe: an `onRequestError` in `src/instrumentation.ts` that logged the method, path, router headers and route for this message only. All 7 occurrences in one draft loop were `GET /events/<id>?_rsc=…`, route `/events/[id]`, source `react-server-components-payload`.
- The smallest reproduction is a Node script that sends the request and destroys the socket at the response headers, after the first chunk, or after a fixed delay. It counts the message in `docker compose --profile test logs app --since <start>`.
- Delay sweep on the `metadata-only` prefetch: 0 of 10 at 2 and 5 ms, 3, 4 and 8 of 10 at 10, 15 and 20 ms, and 1 of 10 at 30 ms (8 had finished first).
- Not a cause: our code ending the stream (0 in every full read), and Next.js cutting the `metadata-only` render short on the server (the same 0, and the full render shows the message too).
- Environment, not this ticket: WSL's interop with Windows was down during this work (`UtilAcceptVsock: accept4 failed 110`), so Docker's credential helper, `docker-credential-desktop.exe`, failed and `docker compose build` stopped at `# syntax=docker/dockerfile:1`. The images were built with `DOCKER_CONFIG` pointing at a temporary directory whose `config.json` has no `credsStore`. The images it pulls are public. `~/.docker/config.json` is unchanged.
