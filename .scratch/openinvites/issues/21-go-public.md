# 21: Go public

**What to build:** The repository becomes public with everything a stranger needs to run OpenInvites and contribute to it, and the project's tracker moves to GitHub Issues.

**Blocked by:** 19 Deployment package, 20 Translations, accessibility, and performance pass

**Status:** ready-for-human

- [ ] The maintainer confirms the name OpenInvites or chooses another before anything is published; the repository, image names, and documentation match the final name.
- [ ] The repository contains the AGPL-3.0 licence, a README with screenshots, what it is, a quick start, and links to the operator docs, a CONTRIBUTING guide with the Developer Certificate of Origin sign-off convention, the Contributor Covenant code of conduct, and issue templates for bugs and feature requests.
- [x] Templates, curated backgrounds, and translations are documented as data files so contributions to them need no application code.
- [ ] The repository is switched to public and a first release is tagged, publishing images to both registries.
- [ ] The setup skill is re-run to switch the issue tracker to GitHub Issues; any remaining open tickets are recreated there.
- [ ] A person who has never seen the project clones it and has it running locally within ten minutes using only the README.

## Comments

**2026-09-24, implementing agent.** The in-repo parts are done. Everything outward-facing is the maintainer's, listed in order below with its commands. Lint, type check and 370 unit tests pass, and so does the full browser suite (256 tests, at 390px and desktop) against the production image rebuilt from these commits on the Compose `test` profile. The last amend touched only the measuring script and a guide, and neither goes into the image. Commits: `bf43f22` (the licence) and `030a81b` (everything else). Nothing was pushed, tagged or published. Status is `ready-for-human`. Only the data-files box is ticked. The second box has everything it lists, but the code of conduct's enforcement contact is still a placeholder that only the maintainer can fill in, so it stays open until then.

**The repository is already public.** It has been since the first push on 2026-09-21, and it has never had a LICENSE file: until `bf43f22` reaches GitHub, the public code grants nobody any rights. The licence commit should reach GitHub soon (step 5). It does not depend on the rest of the list.

How it landed:

- **Licence (`bf43f22`).** `LICENSE` is the GNU AGPL v3 exactly as gnu.org publishes it (661 lines, SHA-256 `0d96a4ff…abcb0`, "GNU AFFERO GENERAL PUBLIC LICENSE / Version 3, 19 November 2007" through "END OF TERMS AND CONDITIONS" and "How to Apply"). `AGPL-3.0-or-later` is now in `package.json` (`license`), the Dockerfile's `org.opencontainers.image.licenses` label, the label `release.yml` sets, README's Licence section and CONTRIBUTING's DCO section. The rebuilt image carries the label.
- **README.** It is short now: what OpenInvites is, five screenshots, four lines on what it does, the quick start, links to the three operator guides, CONTRIBUTING, the code of conduct and the licence. The clone URL is HTTPS now; the old SSH one fails for anyone without a GitHub key. Everything the README used to hold for developers (tests, `pnpm perf`, Compose profiles, layout, the development password reset) moved to CONTRIBUTING.md. It no longer calls OpenInvites a working name, and the milestone sentence ticket 20 pointed at is gone.
- **Screenshots** (`docs/screenshots/`, WebP): `event-birthday.webp` 41 kB and `event-festival.webp` 43 kB (phone, 390x844 at 2x), `rsvp-sheet.webp` 40 kB (phone), `design-drawer.webp` 45 kB and `guest-list.webp` 18 kB (desktop, 1280x800). Taken with `pnpm screenshots` (`scripts/screenshots.ts`, kept, documented in CONTRIBUTING), which drives the running app through the product: host "Mei Lin" and six made-up guests (Arjun Mehta, Sofia Reyes, Tomás Ortega, Priya Nair, Kenji Sato, Lena Fischer), and "Hana Kim" bringing "Leo" in the sheet.
- **CONTRIBUTING.md.** It covers setup (pointing to the README), every check and how to run it (lint, types, unit tests, the S3 smoke test, the browser tests in the fast loop and the definitive one, installing Playwright's browser, `pnpm perf`), how tests are written (the two seams), the data-file guides, issues and pull requests, the style of commits (two real subjects as examples), and the DCO: `git commit -s`, fixing a missing sign-off, a link to developercertificate.org, and the DCO 1.1 text fetched from there. It also has the layout and the Compose profiles.
- **CODE_OF_CONDUCT.md.** The Contributor Covenant 2.1 as fetched from contributor-covenant.org. The only change is `[INSERT CONTACT METHOD]`, now `[MAINTAINER: add a contact address or method before publishing]`.
- **Issue forms** (`.github/ISSUE_TEMPLATE/`). `bug_report.yml` asks for what happened, steps, version or image tag, deployment (the Compose file in `deploy/`, development, other), and browser and device. `feature_request.yml` has two fields. `config.yml` turns off blank issues and links security reports to the repository's private advisory form and operator questions to `docs/operator/`.
- **Data files, one guide each in `docs/contributing/`.**
  - `templates.md` is the guide that was `src/themes/templates/README.md`, moved with `git mv`, its links fixed and the two code comments pointing at it updated. It adds the test list a new template must pass (template, translation, and legibility "every combination the drawer offers") and says that `templates.test.ts`'s first test lists the templates by id, so a new one is added there.
  - `backgrounds.md` covers the shape, the name in every language, a scene's content-hashed file name (with the `sha256sum` command), and measuring. `backgrounds.test.ts` counts the nine, so a new one needs the count changed; the guide says so.
  - `translations.md` covers the files, ICU placeholders and plurals, and adding a language: a file, `locales` and `matchLocale` in `resolve-locale.ts`, and its name under `Locales` in every file. It also says what `translations.test.ts` checks.
- **`pnpm measure:backgrounds`** (`scripts/measure-backgrounds.ts`, with `playwright.scripts.config.ts`). It measures `luminance`, `lightest` and `darkest` as `backgrounds.ts` defines them, driving the real page. A host publishes an event and picks the background, accent and text tone in the Design drawer, and the page a guest is sent is photographed with everything but the backdrop hidden:
  - lightest and darkest: under a full-screen pane with the glass's 24px backdrop blur, at the five viewports, with the blobs held at rest and at the far end of their drift through the Web Animations API, each photographed only once the screen has stopped changing;
  - luminance: the background alone at 390x844.

  It prints what it measured and what is stored, and calls them the same when they are within one channel step and 0.01 of luminance. One background takes one to three minutes, and all nine took 17 minutes. `-g <id>` measures one. It works against `pnpm dev` and against the production image: run from the fresh clone against its dev server, Slate read the same as against the image. The run against the production image:

  ```
  golden     measured luminance: 0.3, lightest: "#ffab5f", darkest: "#3b1c55"
             stored   luminance: 0.3, lightest: "#ffab5f", darkest: "#3c1c55"   the same, to within rounding
  rose       measured luminance: 0.24, lightest: "#773758", darkest: "#564252"
             stored   luminance: 0.23, lightest: "#773758", darkest: "#564252"  the same, to within rounding
  ```

  The final run over all nine said "the same, to within rounding" for every one:
  - the four scenes and Slate match the stored extremes exactly;
  - the four other gradients differ by one step in one channel of one extreme (Golden hour's darkest, and Dusk's, Forest's and Midnight's lightest);
  - every luminance is within 0.01 of what is stored (Forest 0.30 against 0.29, Sunset sea 0.46/0.45, Aurora 0.15/0.14, Rose garden 0.24/0.23, Slate 0.11/0.10).

  That run also found a bug in the tool, now fixed: in floating point, 0.3 − 0.29 is a hair over 0.01, so Forest and Sunset sea read "different". The tool now compares in whole hundredths, and a rerun of those two reads the same. No stored value was changed.
- **Neither tool goes into the image.** `.dockerignore` leaves both out: they import `e2e/`, which the image build already leaves out, and `next build` type-checks every `.ts` file. The rebuilt image's `scripts/` holds only `reset-password.mjs`.

The ten-minute rehearsal, from a fresh `git clone /home/leong/rsvp` of `m1-remaining` and the README alone:

| Step | Time |
| --- | --- |
| Clone (local; the repository is 8.7 MB) | 0.4 s |
| `pnpm install`, with an empty pnpm store so everything downloads | 20 s |
| `pnpm dev` until Next.js is ready (containers created and healthy, then Ready) | 11 s. The Postgres and Mailpit images were already on this machine; a stranger downloads them (433 MB and 51 MB unpacked) the first time. |
| Home page, first compile | 3.4 s |
| Create an account (form, submit, dashboard) | 3.5 s |
| Mailpit: open "Verify your email for OpenInvites", click the link | 4.2 s |
| New event, Save draft | 4.4 s |
| Publish | 1.2 s |
| Open the event page and its Design drawer | 3.6 s |

About 52 s of machine time, plus the image downloads and a person's reading and typing, which the rehearsal cannot measure. My estimate is five minutes on ordinary broadband, but that is a guess. A real stranger's run is still the maintainer's to arrange, which is why the last box is open.

What the rehearsal changed in the README:
- It now says the boxed pnpm notice about ignored build scripts (`@parcel/watcher`, `@swc/core`, `esbuild`) can be ignored. Unit tests, lint, type check, `next dev` and the measuring tool all ran in the fresh clone without those scripts.
- It says the images download the first time.
- Step 3 names the manage page's button, **Open the event page**.

Two other fixes were in place before the rehearsal: the HTTPS clone URL, and "corepack enable (you may need sudo), or `npm install --global pnpm@10`".

The rehearsal ran under `COMPOSE_PROJECT_NAME=oi-rehearsal`. `compose.yaml` names its project `openinvites`, so without that the clone's `pnpm dev` would have reused this checkout's database, and `down -v` would have deleted it. It was torn down with `down -v`, and this checkout's `test` profile is running again as I found it, rebuilt from the new commits.

Decisions and things to know:

- **Measuring method, two clarifications** (the comment in `backgrounds.ts` now says both):
  - The darkest point is looked for with each accent a host may pick, because no single accent makes the darkest blob. On all nine shipped backgrounds this changes nothing: the White accent and each background's own give the same darkest. It matters for a future light background.
  - Luminance was taken on a 390x844 phone. That is the only viewport where every stored value matches (to within 0.01); a scene's average changes with the crop, and Sunset sea is 0.46 on a phone and 0.70 at 1280x800.
- **The tool opens the development instance's registration to everyone**, as the browser tests' operator does, since it signs up hosts. The guide says so.
- **My commits carry no `Signed-off-by`.** The DCO sign-off certifies the work personally, which only the maintainer can do. The 46 earlier commits have none either. Either start the convention with the next commit, or sign these off before pushing (step 4).
- **The security link needs a setting.** CONTRIBUTING's security line and `config.yml`'s link go to GitHub's private vulnerability reporting, which works only once it is turned on (step 3).
- **The issue forms' labels need creating.** They apply `bug` or `enhancement` plus `needs-triage`, and GitHub applies only labels that exist, so `needs-triage` needs creating (step 10).
- **Found, not fixed (app code, outside this ticket): the Design drawer's whole panel scrolls sideways.** The templates `<fieldset>` (`Choices` in `src/app/e/[slug]/design-panel.tsx`) keeps the browser default `min-inline-size: min-content`, so it grows to 564px to fit all six templates. The row's own `overflow-x-auto` never scrolls, and the panel's scroller scrolls sideways instead: measured on this image, 604px of content in a 378px panel at desktop and 390px on a phone. Swiping the template row on a phone moves the whole drawer, and Quiet is reachable only that way. The likely fix is `min-w-0` on the fieldset. The drawer screenshot is taken on a freshly opened drawer, as a host first sees it.
- **The AGPL and a Source link.** AGPL section 13 asks anyone running a modified version for others to offer them its source; many AGPL web apps carry a "Source" link in the footer for that. OpenInvites has none. This is not required for the unmodified project; noted for the maintainer's judgement.

Outward-facing steps for the maintainer, in order:

1. **Confirm the name.** If it stays OpenInvites, nothing changes. If it changes, `git grep -il openinvites` lists every place, among them what ticket 19 named (`deploy/compose.yaml`, `deploy/.env.example`, the Dockerfile's `source` label, `docs/operator/`, `docs/releasing.md`), plus `package.json`'s `name`, both Compose project names, `release.yml`'s title label, `messages/*.json` (`Home.title`, mail subjects), README, CONTRIBUTING, and `.github/ISSUE_TEMPLATE/config.yml`'s URLs.
2. **Confirm `AGPL-3.0-or-later` against `-only`.** For "only": `sed -i 's/AGPL-3.0-or-later/AGPL-3.0-only/' package.json Dockerfile .github/workflows/release.yml README.md CONTRIBUTING.md`, and reword README's "version 3 or (at your option) any later version" to "version 3 only". `LICENSE` is the same text either way.
3. **Fill in the code of conduct's contact**: `grep -n "MAINTAINER:" CODE_OF_CONDUCT.md`, replace the placeholder with an address or method, and commit. Also turn on private vulnerability reporting (Settings → Code security, or `gh api -X PUT repos/leongyeehang/OpenInvites/private-vulnerability-reporting`), or else remove the security line from CONTRIBUTING.md and the link from `config.yml`.
4. **Commit or drop your own `CONTEXT.md` and `.scratch/openinvites/decisions.md` edits**: `git add CONTEXT.md .scratch/openinvites/decisions.md && git commit -s`, or `git restore CONTEXT.md .scratch/openinvites/decisions.md`. If you want this ticket's commits signed off: `git rebase --signoff bf43f22~1` on `m1-remaining`, before pushing.
5. **Merge `m1-remaining` into `main` and push.** Local `main` is an ancestor of `m1-remaining` (33 commits behind it), and `origin/main` was last seen at `2c1f263`, so this is a fast-forward:
   ```sh
   git fetch origin
   git switch main
   git merge --ff-only m1-remaining
   git push origin main
   ```
6. **Check CI is green on GitHub**: `gh run list --branch main --limit 3`, then `gh run watch` (lint, types, unit tests, the S3 smoke test, the browser suite).
7. **Set the release secrets and variables** that `docs/releasing.md` names: `gh secret set DOCKERHUB_USERNAME` and `gh secret set DOCKERHUB_TOKEN` (a Read & Write access token), and optionally `gh variable set DOCKERHUB_NAMESPACE --body <namespace>` (default: the GitHub owner, `leongyeehang`) and `gh variable set IMAGE_NAME --body openinvites` (the default).
8. **Tag `v0.1.0`** (`package.json` says `0.1.0`) **and watch the release**:
   ```sh
   git tag -a v0.1.0 -m "OpenInvites 0.1.0"
   git push origin v0.1.0
   gh run watch   # the Release workflow: checks, then publish (amd64 and arm64 under QEMU), then the smoke test on amd64 and arm64
   ```
   Then make the GHCR package public and check it is linked to the repository (the repository's Packages → Package settings), and write the release notes (`gh release create v0.1.0 --title "OpenInvites 0.1.0" --notes-file <notes>`, or on GitHub).
9. **Run the published-image smoke test on a clean machine, and once on arm64 hardware** (ticket 19's open box): `git clone https://github.com/leongyeehang/OpenInvites.git && cd OpenInvites && deploy/smoke-test.sh ghcr.io/leongyeehang/openinvites:0.1.0` on each, for example a fresh cloud VM and a Raspberry Pi 4 or 5 on a 64-bit OS. Also check `docker pull leongyeehang/openinvites:0.1.0` works from Docker Hub.
10. **Switch the tracker to GitHub Issues** by re-running the setup skill that wrote `docs/agents/`, choosing GitHub Issues. It rewrites `docs/agents/issue-tracker.md` and `triage-labels.md`. Make sure the labels exist (`gh label create needs-triage`, and the rest of `triage-labels.md`'s vocabulary if the skill does not). Recreate the open items (`gh issue create --title … --body …`):
    - Ticket 03: sign in against real Google and GitHub, and the account-linking scenario, verified by hand with the steps in `docs/operator/configuration.md`.
    - Ticket 19: the published-image smoke test on a clean machine and on arm64 hardware (step 9), unless it passes before the switch.
    - Ticket 20: the maintainer's reading of both Chinese files (ticket 20 lists the strings it was least sure of).
    - Ticket 21: a stranger's ten-minute run from the README (step 11).
    - Bug found here: the Design drawer scrolls sideways (above).
    - Still open in earlier tickets' notes: the preview card crops a portrait poster to its middle band (ticket 13, left per a ruling); the edit link (`/r/<token>`) and a host invitation link answer an unknown token with an empty 404 body, not the not-found page (ticket 20); the drawer's thumbnail of the host's picture loads the 2048-pixel background (ticket 20); React's "The destination stream closed early" in the app log (tickets 12, 18, 20); the app does not check `AUTH_SECRET` at start (ticket 19).
11. **Have a stranger do the ten-minute run** from the README alone, on their own machine, and time it.

Left for later tickets or noted:

- `docs/agents/issue-tracker.md` still describes the local-markdown tracker until step 10. The ticket files under `.scratch/openinvites/issues/` and `spec.md` are untracked, so the public repository never had them. README no longer mentions them.
- Ticket 03's comments point to a README section on Google and GitHub sign-in. Those steps are in `docs/operator/configuration.md` (since ticket 19), which the new README links.

**2026-09-26, implementing agent, final fix wave (branch review).** The Design drawer bug found here is fixed (commit `654fe80`). The templates' fieldset now has `min-w-0`, so the row scrolls on its own and the panel stays still. A browser test at 390px and desktop width checks that the row is the only thing in the open drawer, Details expanded, that scrolls sideways, and that scrolling it brings Quiet into view. `docs/screenshots/design-drawer.webp` was taken again with `pnpm screenshots` against the Compose `test` profile: 45,790 bytes, 1280x800, as before. The other four screenshots it retook were put back unchanged. On a freshly opened drawer the picture looks as it did, since the bug showed only once the panel was scrolled; the item "Bug found here: the Design drawer scrolls sideways" in step 10 can be dropped.

Also in this wave, for step 8: the Release workflow now pushes only `0.1.0` before the smoke test. It moves `0.1` and `latest` (and `1.2`, `1` on later releases) only once both smoke tests have passed (`2df2fe2`, `docs/releasing.md`), so `gh run watch` shows a fourth job, "Point the moving tags at the image". CI's browser suite now fails a run with a flaky test (`fbcbb65`).

**2026-09-30, controller.** Steps 5 to 8 of the list above are done, apart from Docker Hub:
- `main` is pushed, and CI is green on GitHub (run 36391836547, after the migration-lock fix `a9ea008`).
- `v0.1.0` is tagged, and its release run 36682306971 passed every stage: checks, the build for amd64 and arm64, the smoke tests on both machines, and the tag moves.
- The package on ghcr.io is public: anonymous pulls of `0.1.0`, `0.1` and `latest` work.

The maintainer chose GitHub Container Registry only for now. `23fbfa6` makes Docker Hub wait for its two secrets, so the "both registries" box stays open until they are set and a release goes out.

The maintainer's other decisions:
- The licence stays `AGPL-3.0-or-later`.
- The Code of Conduct keeps its placeholder: the maintainer's email is not to be published yet.
- `CONTEXT.md` and `decisions.md` stay uncommitted.
- The tracker stays in `.scratch/` until after M4, then moves to GitHub Issues.

No GitHub Release page (release notes) was created for `v0.1.0`; only the tag exists.

