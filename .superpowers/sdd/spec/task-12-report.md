# Task 12 report: Uploads, storage and processing

**Status:** DONE_WITH_CONCERNS (the concerns are small; see the end)
**Commit:** `01184a2` Uploads: a host puts their own photo behind the invitation, and guests get it without its location

## What I implemented

- **One storage interface, two implementations (ADR-0003).** `src/storage/storage.ts` defines `Storage` (`put`, `get`, `delete` on flat keys) and `getStorage()`. `getStorage()` picks `disk.ts` (the default: one directory, `/app/uploads` in the image) or `s3.ts` from `config.ts` (a pure `storageConfigFromEnv`, unit-tested like `mail/config.ts`). Nothing else touches the directory or the bucket. The disk implementation refuses any key that is not a flat file name.
- **S3 client:** `@bradenmacdonald/s3-lite-client` 1.0.0 (MIT, zero dependencies, about 8 kB gzipped, on GitHub since 2021, commits in August 2026). It covers put, get, delete and path-style requests (its default). `@aws-sdk/client-s3` would have brought 56 dependencies for three calls. `aws4fetch` has had no commit since December 2024. The justification is in the commit body.
- **Upload transport: a route handler.** I read `node_modules/next/dist/docs/.../serverActions.md`: server actions are capped at 1 MB by default, and the cap is `experimental.serverActions.bodySizeLimit` in `next.config.ts`. That value is fixed when the app is built, but the operator's `MAX_UPLOAD_MB` is read when it starts. So `POST /api/events/[id]/upload` takes the picture's bytes as the body and reads it up to the limit and no further. It answers 413 on `Content-Length` before reading, checks the Origin against `BASE_URL` (as Next.js does for server actions), then the session, then that the event is the host's. The drawer checks the size first and shows the message without sending the file.
- **Validation (pure, `src/uploads/validate.ts`):** the type comes from the file's own first bytes: JPEG, PNG, WebP, AVIF (ISO brands `avif`/`avis`, major or compatible). SVG, GIF, HEIC, PDF, video and anything else never reach libvips. Size is checked against the limit, and the pixel count is read from the header with a 50 MP cap (a 48 MP phone photo is under it). The decoder also enforces `limitInputPixels: MAX_PIXELS`. The alt text is trimmed and limited to 300 characters.
- **Processing (`process.ts`, sharp):** EXIF orientation is applied, transparency is flattened onto white, and the picture is converted to sRGB. It is re-encoded with no EXIF, XMP, IPTC or ICC, into `background.webp` (at most 2048 px on the long side, never enlarged, q80) and `card.jpg` (1200x630 cover, q82). I checked Satori in `next/og`: it accepts PNG, APNG, JPEG, GIF and SVG, and neither WebP nor AVIF, so the card rendition is a JPEG. The original is never stored.
- **Sampling (pure, `sample.ts`):**
  - **Luminance:** measured exactly as `backgrounds.ts` defines it.
  - **Accent:** the dominant hue band. Hue is counted in 24 bands of 15 degrees, each pixel weighted by chroma squared, and pixels with chroma under 0.12 are skipped. The strongest band plus its two neighbours is averaged. The result is lifted to HSL lightness 0.70–0.85 on a dark picture, or deepened to 0.30–0.45 on a light one, which is where the curated accents sit. A picture with no colour gets its own grey, adjusted the same way.
  - **Backdrop:** `measureBackdrop` takes the picture blurred as the glass sees it and returns the brightest pixel (by WCAG luminance) under the light tone's 25% black scrim, and the darkest under the dark tone's 25% white scrim. `process.ts` produces that raster by scaling the picture as it would cover a 1920x1080 screen. That is the largest of the five measured viewports, and it dominates the other four in both dimensions, so there the blur covers the fewest image pixels. It then works at a quarter of that size, where the 24px CSS blur (a standard deviation) becomes 6px. The fade at the page's foot can only make things easier (it darkens under light text and lightens under dark), so it is left out, conservatively.
- **Upload record:** table `upload` (migration `0011_uploads`), unique on `event_id` with a cascade. Columns: `alt_text`, `luminance`, `accent`, `lightest`, `darkest`. The id comes from Postgres (`select uuidv7()`, ADR-0004) before the files are written. The row is written only after the files exist. Replacing happens in one transaction under the event's `FOR UPDATE` lock: the old row goes, the new row comes in, and the theme is updated with `applyChange(theme, { knob: "uploadId", value })`. That moves `updatedAt`, so the preview card redraws. The old files are removed after commit. On failure, or if the event has vanished, the new files are removed.
- **Theme plumbing:**
  - A new `KnobChange` `{ knob: "uploadId", value }` sets `backgroundId: null`, `uploadId`, `uploadMode: "background"` and `accentOverride: null`, and marks the template dirty. `parseThemeChange(raw, upload)` accepts only the event's own upload id; `changeThemeAction` looks it up with `findHostUploadId`.
  - `resolveTheme(theme, upload)` now takes a `ThemeUpload` (`id`, `src`, accent, luminance, extremes, alt text). The upload is in use only when `backgroundId === null` and `uploadId === upload.id`. It builds a photo `Background` from the upload, so the accent, the text tone and `legibility.ts` all use the measurements. `ResolvedTheme.upload` says which upload is in use. `UNMEASURED` became unused and was removed.
- **Drawer (`design-panel.tsx`):**
  - With no picture yet: the Upload button, a file input restricted to the four types, so Safari sends an iPhone photo as JPEG.
  - With a picture: its thumbnail, a "Use it as" group with Background, and Poster disabled with "Coming soon" (the same `Choice` + `Badge` pattern as Broadsheet and Thread), a Replace control, and a "Describe your picture" field that saves on blur, Enter or Escape through `describeUploadAction`.
  - Refusals appear as an alert under the control, otherwise a hint gives the formats and limit. The status line shows "Uploading…". A "Your picture" tile comes last in the Background gallery.
- **Page:** the upload is painted the way a curated scene is (cover, tone scrim, foot fade). The alternative text is a `role="img"` element labelled with it, at the end of the poster card (`src/themes/background-description.tsx`), so a screen-reader user hears it once, with the invitation. Nothing is rendered when it is empty.
- **Privacy finding, fixed.** My first browser run exposed a leak. Guests were sent the upload's data in the RSC payload even after the host had switched to a curated background, so a guest could find a picture the host had set aside. The page now sends the upload to guests only while it is shown (the host still gets it for the drawer), and a browser test asserts that the guest's HTML does not mention it.
- **Serving:** `GET /uploads/<uuid>/<file>` reads through the storage interface for either backend, and answers `Cache-Control: public, max-age=31536000, immutable` and `nosniff`. Unknown names, non-UUID ids, and replaced or deleted pictures get a 404.
- **Preview card:** when the theme shows the upload, `/e/<slug>/preview.png` reads `card.jpg` through storage and draws it as a data URL under a gradient of the tone's base colour.
- **Every event-deletion path.**
  - I found two: `deleteEvent` (the host's Delete), and account deletion, where the database cascades from the `user` row.
  - Both now go through `removeEvents` in `events/repository.ts`, which locks the events, deletes their upload rows and the events in one transaction, and then removes the files.
  - Account deletion uses Better Auth's `user.deleteUser.beforeDelete`, which I confirmed in its source runs after the password check, to call `deleteHostEvents`.
  - A file that fails to delete is logged, not rethrown, so it cannot undo the host's delete.
- **S3 smoke test:** `src/storage/s3.smoke.ts` puts 300 kB, reads it back, deletes it, and deletes it again (fine). It also checks that a wrong secret is refused, which proves the server verifies signatures, so the round trip proves ours are right. It runs via `vitest.s3.config.ts` / `pnpm test:s3` and is not in `pnpm test`, so it prints no skips.
  - The server is Versity Gateway `versity/versitygw:v1.8.0`: Apache-2.0, 31 MB image, monthly releases, checks SigV4. It runs as the Compose `s3` profile with a healthcheck, and its bucket is a directory made at start.
  - Rejected: MinIO community (maintenance mode), Adobe S3Mock (does not verify signatures), Garage (AGPL), LocalStack (now needs an auth token). RustFS (Apache-2.0) was the runner-up, but it had just reached 1.0 and its image is 110 MB.
  - Wired into `.github/workflows/ci.yml` after the unit tests; the teardown now covers `--profile test --profile s3`.
- **Image/Compose:** the Dockerfile makes `/app/uploads` owned by `node`. The test profile mounts a named `uploads` volume there, which also proves a fresh volume starts writable. `.gitignore` and `.dockerignore` gain `uploads`. Inside the built image I checked that the standalone output carries `sharp@0.35.4` with `@img/sharp-linuxmusl-x64` and libvips 8.18.6.

## Tests

### TDD evidence for the pure rules

**Validation.** RED: `pnpm exec vitest run src/uploads/validate.test.ts`, with the test written first and no module yet:
```
 FAIL  src/uploads/validate.test.ts [ src/uploads/validate.test.ts ]
Error: Cannot find module './validate' imported from /home/leong/rsvp/src/uploads/validate.test.ts
 Test Files  1 failed (1)
      Tests  no tests
```
GREEN, same command after `validate.ts`:
```
 Test Files  1 passed (1)
      Tests  11 passed (11)
```
Two mutations were each caught: scanning no compatible brands broke "is read from the file's own first bytes", and `>=` for the size limit broke "is nothing for a picture within the limit".

**Sampling.** RED 1: `pnpm exec vitest run src/uploads/sample.test.ts` with no module (`Cannot find module './sample'`). RED 2 was against a stub returning `luminance: 0, accent: "#000000"` and black extremes:
```
 ❯ src/uploads/sample.test.ts (11 tests | 9 failed)
     × is the mean brightness of its pixels, as the curated backgrounds are measured
     × puts a pale photo over the line for dark text and a night scene under it
     × is its dominant colour, not a muddy average of every colour in it
     × favours a vivid colour over a dull one that covers more of the picture
     × looks past white, grey and black to find the colour there is
     × is lifted on a dark picture and deepened on a light one, so it stands out as the curated accents do
     × is white and black under their scrims on a picture with both
     × is the picture's own colour under each tone's scrim when it is all one colour
     × is the brightest and darkest pixel as the eye sees them, not the brightest channel
AssertionError: expected +0 to be close to 1, ...
      Tests  9 failed | 2 passed (11)
```
GREEN, same command after `sample.ts`:
```
 Test Files  1 passed (1)
      Tests  11 passed (11)
```
The first GREEN attempt failed one assertion, because lightness 0.4509 came back for a target of 0.45: channels are whole numbers. I added a `ROUNDING = 1/255` allowance to the test and left the rule unchanged.

Four mutations were each caught:
- weight = 1 instead of chroma squared broke "favours a vivid colour";
- ranking by max channel broke "as the eye sees them";
- always using the dark range broke "lifted … and deepened";
- the mean colour instead of the dominant band broke "not a muddy average". That check needed a saturation assertion I added, because the mean kept the sky's hue.

**Also test-first:**
- `storage/config.test.ts`: RED on the missing module, GREEN with 5 tests.
- The `uploadId` knob in `changes.test.ts`: RED with 2 failed of 23, GREEN with 23.
- The upload shapes in `resolve.test.ts`: RED with 3 failed, including `expected 'rgb(58 48 72 / 0.73)' to be 'rgb(255 255 255 / 0.1)'`, which is the smoked frost the measurement removes. GREEN with 15.
- `process.test.ts`, 7 tests: metadata and GPS gone with orientation applied, rendition sizes, transparency, sampling wired, the blur softening a small spot but not a wide area, a fake JPEG and an SVG refused, and a 68-byte PNG claiming 100,000² refused before decoding. Mutations caught: `.keepMetadata()`, removing `.blur`, removing `.autoOrient()`.
- `legibility.test.ts`: the per-surface AA check is extracted into one helper, and a new sweep, "an upload … reads at AA … however bright or dark", covers both tones over black-to-white pictures with the curated accents and five arbitrary ones.

### Suite results

- `pnpm lint`: clean.
- `pnpm typecheck`: clean.
- `pnpm test`: **31 files, 225 tests passed** (185 before this ticket). The only output besides passes is the pre-existing `configLoader: 'native'` note from ticket 11.

### Local S3 smoke-test run

`docker compose --profile s3 up -d --wait && pnpm test:s3 --reporter=verbose`:
```
 RUN  v5.0.1 /home/leong/rsvp

 ✓ src/storage/s3.smoke.ts > S3-compatible storage > stores a picture, reads it back, and deletes it 609ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  22:08:04
   Duration  808ms (tests 93%, transform 4%, import 2%)
```
The same config prints the `configLoader` note that `pnpm test` does. I also ran `e2e/uploads.spec.ts` with the whole app on S3 (dev server with `STORAGE_BACKEND=s3` pointed at the container): **10 passed**. What was left in the bucket was exactly the objects from the two tests that keep their events; replace, event delete and account delete left nothing.

### Definitive browser run (Compose test profile, production image)

I stopped the dev server (`fuser -k 3000/tcp`), ran `docker compose --profile test up -d --build --wait`, then `pnpm exec playwright test`:
```
  152 passed (2.3m)
```
That is 76 scenarios at 390px and 1280px (142 before this ticket, plus the 5 new upload scenarios at both widths). I ran it twice: once after the build, and again after two test-only edits (a 15 s timeout on the account-deletion step and an assertion that the fixture carries metadata). Both runs were 152 passed. I confirmed that no source file changed after the image's build context was taken.

The new browser tests in `e2e/uploads.spec.ts`:
1. **A light photo turns the text dark by itself, and guests get the picture without its location.** The fixture is a JPEG with a camera tag and GPS. The test checks the tone flip for host and guest, the Background choice checked and Poster disabled with "Coming soon", and the downloaded `background.webp`: 200, `image/webp`, immutable, no EXIF or XMP, no camera string. It also checks that the unfurl card's top corner is the pale photo.
2. **The host describes the picture, and can go back to it.** A guest's page has exactly one `img` named by the description, inside the poster card. Choosing Dusk removes the background and the description, and the guest HTML no longer contains the upload's URL. The "Your picture" tile brings both back.
3. **A picture over the size limit, or a file that is not a picture, is refused with a clear message.** An 11 MB file gets "That picture is larger than 10 MB, the largest that can be uploaded here. Choose a smaller one." (reworded in fix round 1; it first said "the most this site takes"). A text file named `.jpg` gets the server's content check message. The page is unchanged.
4. **Replacing removes the old picture's files, and deleting the event removes the new one's.** The old rendition URL 404s after the replace, the new one after the delete.
5. **Deleting an account removes the pictures on its events.** The rendition URL 404s.

`e2e/design.spec.ts`'s order test now expects the Upload control to be enabled.

### Server guards, checked directly (scratch probe, not committed)

These bypass the drawer's size check:
```
too large (11 MB body): 413 {"problem":"tooLarge"}
claims 100000x100000: 422 {"problem":"tooManyPixels"}
text as jpeg: 415 {"problem":"unsupported"}
svg: 415 {"problem":"unsupported"}
other origin: 403
no origin: 403
signed out: 401
not an id: 404 {"problem":"notFound"}
someone else's event: 404 {"problem":"notFound"}
rendition, bad name: 404
rendition, bad id: 404
```

### Other checks

- Dev-mode console through the whole upload flow shows no React warnings or errors. The only line is Chrome's "Failed to load resource: 415", logged by the browser itself for the deliberate refusal.
- The uploads spec alone adds no errors to the app log.
- **Visual check** at 390px and 1280px with a daylight and a night scene:
  - The drawer's picture section, the gallery tile (tenth in the 5-column grid) and the page read well.
  - A dark photo keeps the light frost.
  - Both preview cards draw the photo behind legible text.
- **Processing cost:** a 48 MP JPEG took 0.57 s and about 93 MB extra RSS; a 50 MP PNG peaked at about 180 MB extra. Backgrounds come out at about 0.2–0.5 MB.

## Files changed

- **New:**
  - `src/storage/{storage,config,config.test,disk,s3,s3.smoke}.ts`
  - `src/uploads/{validate,validate.test,sample,sample.test,process,process.test,renditions,files,repository,uploads,actions}.ts`
  - `src/app/api/events/[id]/upload/route.ts`, `src/app/uploads/[id]/[file]/route.ts`
  - `src/themes/background-description.tsx`, `src/lib/uuid.ts`
  - `drizzle/0011_uploads.sql`, `drizzle/meta/0011_snapshot.json`
  - `e2e/uploads.spec.ts`, `vitest.s3.config.ts`
- **Modified:**
  - `src/db/schema.ts`, `src/events/repository.ts`, `src/auth/auth.ts`, `src/auth/actions.ts` (comment), `src/instance/env.ts`, `src/instrumentation.ts`
  - `src/themes/{resolve,resolve.test,changes,changes.test,legibility,legibility.test,actions,themed-page,poster-layout}.ts(x)`, `src/sharing/preview-card.tsx`
  - `src/app/e/[slug]/{page,design-drawer,design-panel}.tsx`, `src/app/e/[slug]/preview.png/route.tsx`
  - `messages/en.json` (English only), `e2e/design.spec.ts`, `drizzle/meta/_journal.json`
  - `package.json` (`sharp`, `@bradenmacdonald/s3-lite-client`, `test:s3`), `pnpm-lock.yaml`
  - `Dockerfile`, `compose.yaml`, `.github/workflows/ci.yml`, `.gitignore`, `.dockerignore`
- **Not staged:** `CONTEXT.md` and `decisions.md` (the maintainer's edits, untouched). The ticket file was edited but is untracked on purpose.

## New environment variables (also listed in the ticket comment for ticket 19)

| Variable | Default | Meaning |
| --- | --- | --- |
| `STORAGE_BACKEND` | `local` | `local` or `s3`; anything else stops the app at start |
| `UPLOADS_DIR` | `uploads` (under the working directory, so `/app/uploads` in the image) | local storage's directory; mount the uploads volume there |
| `S3_ENDPOINT` | (required for s3) | e.g. `https://s3.eu-central-1.amazonaws.com` |
| `S3_REGION` | `us-east-1` | |
| `S3_BUCKET` | (required for s3) | can stay private; the app serves the files |
| `S3_ACCESS_KEY_ID` | (required for s3) | |
| `S3_SECRET_ACCESS_KEY` | (required for s3) | |
| `MAX_UPLOAD_MB` | `10` | megabytes (MiB), decimals allowed; a non-positive or non-number value stops the app at start |

All are checked in `instrumentation.ts` at start, like the mail settings.

## Self-review

- **Spec and rulings:** every checkbox is covered, and each ruling is followed.
  - sharp, with a justified S3 client.
  - The upload is a route handler, with the reason given.
  - Type is judged from content; the pixel limit is in the rule and in the decoder.
  - Orientation is applied, then metadata stripped, with unit and browser proof.
  - Settings are environment variables read like `env.ts`.
  - Serving goes through the app, cached immutable per rendition.
  - One upload per event, and replacing it removes the files.
  - Every delete path removes the files, observed by browser tests.
  - Poster is visibly disabled.
  - The S3 smoke test uses a maintained, permissive server, lives outside `pnpm test`, and is wired into CI.
  - The alt text is heard once, in the poster card.
- **Tests stay at the two seams.**
  - `process.test.ts` calls `processUpload` directly: bytes in, renditions and samples out, with no database, filesystem or network. I treat it as a pure rule.
  - The single storage-seam test is the sanctioned S3 smoke test.
  - Browser tests observe only what a host or guest can: the tone, the page's background URL, downloaded bytes, status codes, accessible names. They never read rows.
- **Glossary:** "Background" is used as `CONTEXT.md` defines it. My first version claimed that none of the Avoid words appear, but the size message said "this site", which the glossary avoids for Instance; fix round 1 below corrects it. The UI says "Your picture" and "Describe your picture". `CONTEXT.md` has no entry for an upload or a picture. The maintainer might want one ("Upload: the host's own image, used as the background or the poster"). I did not edit `CONTEXT.md`.
- **Removed as a consequence:** `UNMEASURED` and `SampledUpload` became unused and are gone. The curated-tile caption became `TileName`, and `fill` now calls `fillWith`, both so the upload tile can reuse them. Those are the only touches to neighbouring code.

## Concerns

1. **The CI step has not run in GitHub Actions**, because nothing is pushed. It ran locally with the same commands.
2. **Account deletion ordering.** The host's events and files go in Better Auth's `beforeDelete`. If Better Auth then fails to delete the user, the host keeps an account with no events. Doing both in one transaction would mean taking account deletion away from Better Auth.
3. **Immutable caching.** Someone who already loaded a picture may keep it in their browser cache after it is replaced or deleted. The server stops serving it at once.
4. **Pre-existing log noise, not from this ticket.** The full browser run's app log shows React's "The destination stream closed early" (the events, rsvp, questions, guest-list and cancel-delete specs add these; the uploads spec alone adds none). It also shows a 500 for `/events/x`, where ticket 17's description test's `<img src=x>` resolves in the host editor. I did not compare against the previous commit's image.
5. **The theme-change race.** A change choosing the upload that races a concurrent replacement could leave the theme naming the old id. The page then shows the default background until the host picks again; nothing breaks.
6. **Notes for later tickets are in the ticket comment:**
   - **Ticket 13:** the background rendition keeps natural proportions and can serve as the poster for uploads made before 13, whose originals are gone. The Poster control is the disabled `Choice` in the drawer. Poster mode needs its own backdrop extremes. The alt text should move onto the poster `<img>`.
   - **Ticket 18:** rate-limit the upload endpoint, and weigh the memory figures above.
   - **Ticket 19:** the uploads volume and backup, a check that the arm64 image carries `@img/sharp-linuxmusl-arm64`, and path-style S3.
   - **Ticket 20:** the new `DesignDrawer` strings.

## Fix round 1 (review finding: an Avoid word in the copy)

**Commit:** `e2ca9da` Uploads: the size message says what can be uploaded, without calling the instance a site

**What changed.** `messages/en.json`, `DesignDrawer.uploadProblems.tooLarge`, now reads "That picture is larger than {max, number} MB, the largest that can be uploaded here. Choose a smaller one." It used to say "the most this site takes", and CONTEXT.md lists "site" under _Avoid_ for **Instance**. The assertion in `e2e/uploads.spec.ts` (the size-limit test) matches the new text. Nothing else changed. The ticket comment never quoted the old wording (it cites `uploadProblems.*`), so it needed no update. Above, this report's test description and self-review are corrected.

**Commands and output.**

`rm -f tsconfig.tsbuildinfo && pnpm lint && pnpm typecheck`:
```
> openinvites@0.1.0 lint /home/leong/rsvp
> eslint

> openinvites@0.1.0 typecheck /home/leong/rsvp
> NEXT_TELEMETRY_DISABLED=1 next typegen && tsc --noEmit

Generating route types...
✓ Types generated successfully
```
Both exited 0.

The covering browser test, against `next dev` on port 3000: `pnpm exec playwright test e2e/uploads.spec.ts`. The dev server was stopped afterwards with `fuser -k 3000/tcp`.
```
Running 10 tests using 7 workers

  ✓   1 [mobile] › e2e/uploads.spec.ts:139:5 › a picture over the size limit, or a file that is not a picture, is refused with a clear message (21.1s)
  ✓   4 [mobile] › e2e/uploads.spec.ts:58:5 › a light photo turns the text dark by itself, and guests get the picture without its location (33.1s)
  ✓   5 [desktop] › e2e/uploads.spec.ts:58:5 › a light photo turns the text dark by itself, and guests get the picture without its location (33.1s)
  ✓   3 [mobile] › e2e/uploads.spec.ts:184:5 › deleting an account removes the pictures on its events (33.8s)
  ✓   2 [mobile] › e2e/uploads.spec.ts:161:5 › replacing a picture removes the old one's files, and deleting the event removes the new one's (38.1s)
  ✓   7 [mobile] › e2e/uploads.spec.ts:102:5 › the host describes the picture for screen readers, and can go back to it after another background (39.9s)
  ✓   6 [desktop] › e2e/uploads.spec.ts:102:5 › the host describes the picture for screen readers, and can go back to it after another background (40.1s)
  ✓   8 [desktop] › e2e/uploads.spec.ts:139:5 › a picture over the size limit, or a file that is not a picture, is refused with a clear message (21.5s)
  ✓   9 [desktop] › e2e/uploads.spec.ts:184:5 › deleting an account removes the pictures on its events (14.9s)
  ✓  10 [desktop] › e2e/uploads.spec.ts:161:5 › replacing a picture removes the old one's files, and deleting the event removes the new one's (14.3s)

  10 passed (49.9s)
```

**The Avoid-word grep.** I took every term under _Avoid_ in CONTEXT.md and matched each as a whole word, ignoring case. The search covered every string this ticket added to `messages/en.json`, all of `e2e/uploads.spec.ts`, and the lines this ticket added to its unit tests (`validate`, `sample`, `process`, `storage/config`, `s3.smoke`, `changes`, `resolve`, `legibility`) and to `e2e/design.spec.ts`. After the fix, `grep -rn "this site" messages/en.json e2e src` finds nothing.

"site" was the only use of an Avoid word in its avoided sense, and it is gone. Every other hit is a different sense of the word, and I left them as they are:
- **server:** used only in test comments, for the S3 server or the application processing a file, never meaning the instance. The spec itself says "the server samples the image".
- **theme, template:** the glossary's own terms, used as it defines them. It avoids them only for the shipped set and for a layout.
- **limit:** the upload's size limit and the description's length. It is avoided only for **Capacity**, and the ticket itself says "over the size limit".
- **Design:** the drawer's existing name ("Design" button and dialog, ticket 10), used in locators.
- **invitation:** one test comment, "with the invitation". The glossary avoids it for the event, not the event page, which it defines as "the invitation".
- **party:** "Ada’s garden party", a title a host writes, used as fixture data.

The fix round was scoped to the one finding, so I left those alone.

