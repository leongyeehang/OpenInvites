# 01: The poster model

**What to build:** Every theme has exactly one poster (gallery, emoji, colour or upload) in place of `backgroundId`, `uploadId` and `uploadMode`, and the page behind it is the poster blurred. Old themes read into the new shape. Nothing a host sees changes yet beyond what the model forces; the Design drawer keeps working on top of the new model until ticket 06 replaces it.

**Blocked by:** nothing

**Status:** done

- [x] `src/themes/theme.ts`: `Poster = { kind: "gallery"; id } | { kind: "colour"; id } | { kind: "upload" }` (amended: no upload id, and no emoji kind, see the comment); `Theme.poster` replaces `backgroundId`, `uploadId`, `uploadMode`. `Theme.template` stays `{ id; dirty }` until ticket 02 folds templates into the gallery (amended).
- [x] `parseTheme` reads every 0.4 shape (spec, "The poster replaces the background"): a curated gradient id → colour poster; a curated photo id (sunset-sea, bokeh, aurora, rose) → gallery poster with the same id; an upload in background or poster mode → upload poster; a template id → its poster. Unknown values fall back as today. The writer writes only the new shape.
- [x] The gallery and colour posters for now are the curated backgrounds themselves (`curatedPoster` in `theme.ts`: a scene is a gallery poster, a gradient a colour poster). The `posters.ts` registry with looks, and Peach, Lagoon, Lilac and Ink, move to ticket 02, which has the measuring script (amended).
- [x] `resolveTheme`: an upload poster is the poster card with its blurred copy behind, solved under the poster scrim, as poster mode was; a curated poster still paints as the page background until ticket 03 rebuilds the page (amended: solving every kind against a blurred copy belongs with the poster-first page). The colour poster's title default moves to ticket 03 with it.
- [x] `upload.origin` (`"host" | "emoji"`, enum `upload_origin`) and the emoji choice (`emoji_set text[]`, `emoji_background text`) on the upload row; migration 0035; a duplicate's copy keeps them.
- [x] The six templates set the poster from their background (`applyTemplate`); turning them into gallery-poster looks moves to ticket 02 (amended). The template ids stay parseable.
- [x] Unit tests: `parseTheme` for each 0.4 shape (ten fixtures in the shapes 0.4 wrote), the poster knob and `showNewUpload`, resolving each kind. The new colours' legibility sweep moves to ticket 02 with them.
- [x] Browser: the existing theme, poster, uploads, broadsheet and thread specs pass. (Run with ticket 02: two misses of ticket 01 fixed there, then the whole suite green; see ticket 02's comments.)

## Notes for the implementer

- Read `src/themes/` end to end first; `poster-card.tsx` and ticket 13's comment (`.scratch/openinvites/issues/13-poster-mode.md`) explain the blurred copy and its measurement.
- Commit subject, e.g. `Posters: every theme has a poster, and old themes read into one`.

## Comments

**2026-11-02, implementing agent (Opus, in the maintainer's session).** Done except the browser run. `pnpm lint`, `pnpm typecheck`, `pnpm build` clean; `pnpm test` 732 passed (73 files; `derived.test.ts` removed with `derived.ts`).

How it landed:
- **The poster.** `Theme.poster` is `{ kind: "gallery", id } | { kind: "colour", id } | { kind: "upload" }`. The upload's id is not in the theme: `upload.event_id` is unique, so an event has one picture at most and "upload" means it. That removes the 0.4 guard against a theme naming an old upload, and guests' themes no longer need the id stripped (`page.tsx` sends `event.theme` to everyone; only the host is handed a put-aside picture, as before). An emoji pattern is that same upload with `origin: "emoji"`, so it needs no kind of its own.
- **Reading 0.4 themes** (`parsePoster`): a new-shape poster is kept only as the kind its id really is; else `backgroundId` null → upload (0.4's meaning, guests' themes included), a derived id (`upload-blur`, `upload-wash`) → upload if the theme named one, else the default; a curated id → its gallery or colour poster; anything else → Golden hour. No data migration; the next save writes the new shape.
- **Changes** (`changes.ts`): one `poster` knob replaces `backgroundId`, `uploadId` and `uploadMode`. A new poster puts the accent back on auto. A stored upload is shown by `showNewUpload` (accent back on auto even when the picture it replaces was the poster, title placement kept, template dirty). `parseThemeChange` takes a curated poster only as its own kind (its id looked up, nothing else from the browser kept) and the upload only on an event that has one.
- **Resolve**: unchanged painting for curated posters (page background, glass card), poster mode for the upload. **Visible change:** a picture can no longer be the full-page background, and Soft blur and Colour wash are gone; the drawer loses "Use it as" and "From your picture", and "Your picture" in the Background gallery shows the picture as the poster. Five drawer strings removed from all three message files.
- Removed with them: `derived.ts`, the preview card's Soft blur path (`blurredForCard`), the Thread card's blurred-copy branch (unreachable now).
- `upload.origin`, `emoji_set`, `emoji_background`: migration `0035_poster_origin`; `attachUploadCopy` copies them.

Amended from the ticket (and in the spec): no `emoji` kind and no upload id in the poster; the poster registry with looks, the four new colours and templates-as-looks move to ticket 02, which has the measuring script; solving every kind against a blurred copy moves to ticket 03 with the poster-first page.

Left for later:
- The `background.webp` and `background-portrait.webp` renditions are still made and stored for every upload though no page shows them now. Ticket 03 (or a small follow-up) can stop making them and update `docs/operator/configuration.md` and `upgrade-backup.md`, which still describe them; `portraitCut` would go too.
- `docs/contributing/backgrounds.md` still describes the "From your picture" tiles; ticket 02 rewrites it as `posters.md`.

Evidence:
- Unit mutations (each applied, the file run, restored and its SHA-256 compared): 5 tried, 5 caught: a 0.4 Soft blur theme read as the default; a poster's kind not checked when parsed; a new upload keeping the old accent; a poster change's kind not checked; the upload shown while a curated poster is chosen.
- **No browser evidence.** Docker is not installed here, so the Compose test profile cannot start. Updated without a run: `uploads.spec.ts` (helpers find the poster rendition; the portrait-cut test and both derived-background tests removed; "nothing asks for the whole background" kept), `poster.spec.ts` (an upload is the poster at once; "switching back to the background" became "a curated poster puts the picture aside, and choosing it again brings it back"), `accessibility.spec.ts` (the picture's axe rows in poster mode), `reduced-motion.spec.ts`. `design.spec.ts` and `keyboard.spec.ts` needed no change. Run `poster uploads accessibility reduced-motion design keyboard broadsheet thread duplicate sharing` under `CI=1` before ticket 02 starts.
