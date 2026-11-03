# 01: The poster model

**What to build:** Every theme has exactly one poster (gallery, emoji, colour or upload) in place of `backgroundId`, `uploadId` and `uploadMode`, and the page behind it is the poster blurred. Old themes read into the new shape. Nothing a host sees changes yet beyond what the model forces; the Design drawer keeps working on top of the new model until ticket 06 replaces it.

**Blocked by:** nothing

**Status:** ready-for-agent

- [ ] `src/themes/theme.ts`: `Poster = { kind: "gallery"; id } | { kind: "emoji"; uploadId } | { kind: "colour"; id } | { kind: "upload"; uploadId }`; `Theme.poster` replaces `backgroundId`, `uploadId`, `uploadMode`; `Theme.template` becomes `{ posterId; dirty } | null`.
- [ ] `parseTheme` reads every 0.4 shape (spec, "The poster replaces the background"): a curated gradient id → colour poster; a curated photo id (sunset-sea, bokeh, aurora, rose) → gallery poster with the same id; an upload in background or poster mode → upload poster; a template id → its poster. Unknown values fall back as today. The writer writes only the new shape.
- [ ] `src/themes/posters.ts` (the gallery's registry, filled by ticket 02): for now the four photo backgrounds as gallery posters with their measurements, and the look each brings. `src/themes/colours.ts` (or the existing backgrounds module renamed): the five curated gradients plus Peach, Lagoon, Lilac and Ink, each measured like the gradients are today.
- [ ] `resolveTheme` and `legibility.ts` solve every surface against the poster's blurred copy, in every kind, as poster mode does today (`toneTokens(..., "poster")`). A colour poster defaults the title to On the poster.
- [ ] `upload.origin` (`"host" | "emoji"`) and the emoji choice (`emoji_set text[]`, `emoji_bg text`) on the upload row; migration.
- [ ] The six templates become six gallery-poster looks on the existing backgrounds; `applyTemplate` becomes `applyPosterLook`. The template ids stay parseable.
- [ ] Unit tests: `parseTheme` for each 0.4 shape (a fixture per shape from a real 0.4 row), the look and the dirty flag, the colour posters' legibility over the 125-colour sweep `legibility.test.ts` already runs.
- [ ] Browser: the existing theme, poster, uploads, broadsheet and thread specs pass unchanged in what they assert a guest sees.

## Notes for the implementer

- Read `src/themes/` end to end first; `poster-card.tsx` and ticket 13's comment (`.scratch/openinvites/issues/13-poster-mode.md`) explain the blurred copy and its measurement.
- Commit subject, e.g. `Posters: every theme has a poster, and old themes read into one`.
