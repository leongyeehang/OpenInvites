# 23: The Design drawer's thumbnail loads a small rendition

**What to build:** The thumbnail of the host's own picture in the Design drawer (84 by 112 CSS pixels) loads the 720-pixel poster rendition (`poster-720.webp`) instead of the 2048-pixel background (`background.webp`). On a phone, where the page itself shows the portrait cut, opening the drawer no longer downloads the full background.

**Blocked by:** none (left over from ticket 20, listed in ticket 21's step 10)

**Status:** done

- [x] `ThemeUpload` (`src/themes/resolve.ts`) gains `thumbnailSrc`, built in `src/uploads/uploads.ts` as `renditionUrl(id, "posterSmall")`, with a one-line comment on why that rendition (the smallest one that keeps the whole picture sharp at the thumbnail's size on a 3x screen).
- [x] The drawer's thumbnail (`src/app/e/[slug]/design-panel.tsx`, the `fillWith(upload.src)` span) uses `upload.thumbnailSrc`. Its framing is unchanged (`cover`, centred).
- [x] No new rendition, and no change to upload processing. Every upload since ticket 20 already has `poster-720.webp`, and v0.1.0 is released, so a new file would need a backfill.
- [x] Nothing else that uses `upload.src` changes (the page's backdrop, the preview card).
- [x] A browser test in `e2e/uploads.spec.ts`: after an upload, the open drawer's thumbnail shows `poster-720.webp`. At 390px (the phone project), the browser does not request `background.webp` at any point while the page is open with the drawer showing the thumbnail.

## Notes for the implementer

- TypeScript will point at every place that builds a `ThemeUpload` (test fixtures included). Give each one a `thumbnailSrc`.
- The thumbnail span is `aria-hidden` and has no role. Find it in the test however the existing upload tests find drawer elements. Do not add `data-testid` if the specs do not already use it.
- Commit subject in the repository's style, e.g. `Design drawer: the thumbnail of the host's picture is the 720 poster, not the 2048 background`.

## Comments

**2026-10-02, implementing agent (M1 leftovers, task 2).** Commit `9326214`. Boxes 1, 2, 3 and 5 are ticked. Box 4 is left open, and so is the status, for the reason under "Open box" below. Lint, type check, 375 unit tests, and the three browser specs pass.

- **`src/themes/resolve.ts`**: `ThemeUpload` gains `thumbnailSrc`, and the type's comment says it is the small copy the Design drawer shows.
- **`src/uploads/uploads.ts`**: `themeUpload()` builds it as `renditionUrl(id, "posterSmall")`, with a one-line comment on why that rendition: the smallest one that stays sharp in the 84 by 112 thumbnail on a 3x screen (252 by 336; the next one down, the poster copy, is a 192-pixel blur). No rendition and no upload processing changed.
- **`src/app/e/[slug]/design-panel.tsx`**: the `aria-hidden` thumbnail span uses `upload.thumbnailSrc`, with `fillWith` as before, so the framing is still `cover`, centred. The "Your picture" tile among the backgrounds uses it too (see below).
- **`src/themes/resolve.test.ts`**: the one `ThemeUpload` fixture gets a `thumbnailSrc`. It was the only other place that builds one.
- **`e2e/uploads.spec.ts`**: new, "the drawer shows the picture as the small poster, so a phone is not sent the whole background for it". After an upload, the open drawer's thumbnail has `background-image` of `poster-720.webp` (found as `span[aria-hidden][style*="/uploads/"]` inside the Design dialog, as the specs have no test ids). On the 390x844 project it also records every request the host's page makes from before the page loads, waits for the portrait cut and the thumbnail to be requested, settles, and expects `background.webp` was never requested. `createPublished`'s host is a 1280x720 desktop, so the test sets the host page to the project's viewport first.

**Open box (4): "Nothing else that uses `upload.src` changes."** The drawer has a second use of `upload.src` that the ticket does not name: the "Your picture" tile in the Background choices (`fillWith(upload.src)`, about 60 by 80 pixels). It is drawn whenever the drawer is open, so on a phone it requests `background.webp` all the same, and box 5 (never requested at 390px) cannot pass while it does. I changed it to `thumbnailSrc` as well, which is also the same picture with the same cover framing. The page's backdrop and the preview card are untouched, which is what the box's parenthesis names. The two boxes conflict on this one line, and I took box 5. If the tile should have stayed on the background, box 5 needs a different check, and the line to revert is the `style={fillWith(upload.thumbnailSrc)}` on the tile. Tick box 4 and set the status if the tile change is accepted.

Evidence:
- **RED**: before any change, `pnpm exec playwright test e2e/uploads.spec.ts --grep "small poster" --grep-invert operator` failed in both projects: `Expected: url("http://localhost:3000/uploads/<id>/poster-720.webp")`, `Received: url("http://localhost:3000/uploads/<id>/background.webp")`. With only the thumbnail span changed, desktop passed and mobile failed on `expect(requested).not.toContain(full)`, the request log ending `background-portrait.webp`, `poster-720.webp`, `background.webp`: that is the tile.
- **GREEN**: the same command, 2 passed (desktop and mobile), once the tile used `thumbnailSrc` too. Then all of `e2e/uploads.spec.ts` (15 passed, the setup included) on a fresh `next dev` at `--workers=2`, and `e2e/poster.spec.ts` with `e2e/design.spec.ts` (19 passed, 2 failed, below).
- **Load**: the first run of all three specs at the default 7 workers had 18 failures, and at `--workers=2` on the same long-running dev server the desktop half failed too, all in sign-up, publish, and opening the drawer, in lines this change does not touch. The machine has 4 GB, and `next dev` had grown to about 1.4 GB with the load average at 30 to 40. On a restarted dev server at `--workers=2`, `poster.spec.ts` and `design.spec.ts` had two failures (`design.spec.ts:132` desktop at "Saved", `poster.spec.ts:211` desktop at opening the drawer), and on another restarted server at `--workers=1` the same two tests passed in both projects (5 passed with the setup).

**2026-10-02, controller.** Box 4 is ticked, and the ticket is done. Box 4 is there to protect the page's backdrop and the preview card, and both are untouched. The drawer's "Your picture" tile among the Background choices was always in scope: without it, box 5 cannot hold. The task review (Opus) approved `9326214` with no blocking findings. Its minor notes go to the branch's final review.
