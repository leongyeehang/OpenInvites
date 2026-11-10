# 11: Translations, accessibility, docs, the full run

**What to build:** The milestone's Chinese strings reviewed together; keyboard, locale and reduced-motion rows for every new screen; the operator docs and the upgrade note complete; the release note; the glossary proposals collected for the maintainer; the full browser suite on the Docker test profile.

**Blocked by:** 01 to 10

**Status:** ready-for-agent

- [ ] Chinese: read every `zh-Hans` and `zh-Hant` string this milestone added (`Instance.limits`, `Instance.storage`, `Events.form.album`, `Events.album`, `Host.dashboard.albumReminders`, `EventPage.album`, `Mail.photos`, `Mail.albumReminder`, `Mail.albumCleared`, the errors) against the English and the glossary's words; fix what is wrong; list in Comments the strings you are least sure of, with the reason, for the maintainer to check (M6's ticket 10 is the model).
- [ ] Accessibility and keyboard: axe rows (`expectNoSeriousViolations`) for Site settings with the Storage card, its stray list and a confirm open; the Limits card's new fields; the Album settings group; the manage page with the reminder notice; the dashboard with the reminders block; the album with video, Processing and failed tiles; the viewer with the player and the quality control. Keyboard: the quality control is reachable and operable by keyboard; the reminder select and Empty the album confirm by keyboard; the stray list's Remove confirm by keyboard.
- [ ] Locale rows (`e2e/locales.spec.ts`): zh-Hant for the album's label and the Processing tile, the Limits card's new labels, the Storage card's headings, the reminder notice. Reduced motion (`e2e/reduced-motion.spec.ts`): the Processing tile and the player still.
- [ ] `docs/operator/configuration.md`, the full pass: the Limits bullet (`:57-68`) with every limit, its default and range, "Photos and videos per event", "Remind hosts about albums after"; a `### Storage` subsection: the card's figures, the processing switch, the videos line, Clear the album, the stray check, the overshoot of at most one batch when two albums fill the site together, the one-time measuring after the upgrade and that an old photo's size is what is stored; `## Uploaded pictures` becomes `## Uploaded pictures and videos`: the video files and what each is for, metadata dropped, `/tmp` needs about three times the largest video, the site runs one app container, the retired `MAX_UPLOAD_MB` row; `VIDEO_PROCESSING` and the worker (`deploy/compose.yaml`'s commented service, memory about 300 MB while a clip converts, ffmpeg 6 or later, how a missing ffmpeg shows); the Mail section's three emails (items waiting now naming videos, the album reminder, the operator's clearing); the `RATE_LIMIT_UPLOAD` row.
- [ ] `docs/operator/upgrade-backup.md`: `### Upgrading to 0.7` before `:38`, in 0.6's shape: what the release adds; the migrations `0046` to `0051` run at start; the image is larger (the ADR's figure) because it carries ffmpeg; the one-time measuring runs in the background after the first start and the Storage card says so until done; `MAX_UPLOAD_MB` is read once into Largest photo and then ignored, and a site that never set it starts at 40 MB where it had 10; existing events have no album reminder and keep every setting as events behaved before; no new environment variable is required, `VIDEO_PROCESSING` is optional; `compose.yaml` gains no service unless the operator adds the worker.
- [ ] README "What it does": the album takes videos, played at two qualities; storage and every limit on Site settings; albums emptied by hosts and reminders. `deploy/.env.example` checked for the two lines tickets 01 and 08 added.
- [ ] `.scratch/m7-album/release-note-0.7.0.md`, in the shape of `.scratch/m6-invited/release-note-0.6.0.md`: videos; limits on screens; storage; clearing up; the upgrade note's points; the ADR.
- [ ] A Comments entry "Glossary proposals for CONTEXT.md" copying the spec's six (Album widened, Video, Original quality and Lighter copy, Processing, Album reminder, Storage) with any wording the code settled; CONTEXT.md itself is not edited.
- [ ] The full browser suite: `docker compose --profile test up -d --build --wait`, then `CI=1 pnpm exec playwright test --workers=2` over every project; results per project in Comments, every failure or flake named with its spec and whether it is this branch's; `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Notes for the implementer

- Anything a ticket left as a follow-up in its Comments is listed here for the maintainer, not fixed silently.
- Commit subject, e.g. `M7: translations, accessibility and docs`.

## Comments
