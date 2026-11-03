# 02: The gallery posters

**What to build:** About twenty ready-made posters, drawn as SVG, sorted by occasion, each carrying the look it suits (title font, accent, effect, title placement, button style).

**Blocked by:** 01 The poster model

**Status:** ready-for-agent

- [ ] Twenty or so SVG files in `public/posters/`, named after their content (`public-files.test.ts`), 4:5, under 60 KB each, no text in them, no external references, grain as an SVG filter. Occasions: Birthday, Dinner, Wedding, Kids, Night out, Outdoors, Holiday, plus a few general ones. The mockup's canvas drawings (candles, balloons, candlelight, picnic, botanical, rings, playtime, rainbow, disco, sunset drive, sunshine, seaside, string lights) are the starting set, redrawn and polished.
- [ ] Colour posters Peach, Lagoon, Lilac and Ink beside the five curated gradients, each measured as the gradients are (`pnpm measure:backgrounds`), with names in all three languages and the legibility sweep (moved here from ticket 01).
- [ ] Templates become gallery-poster looks: the six template ids map to their posters, picking a gallery poster applies its look, and the Design drawer's Templates row goes (moved here from ticket 01).
- [ ] Each in `posters.ts` with id, occasion, file, measured `lightest`/`darkest` (the measuring `process.ts` does for uploads, run once by a script in `scripts/` and stored), accent, and look.
- [ ] Message keys for each name and occasion in all three languages (`Posters.names.*`, `Posters.occasions.*`).
- [ ] The preview card (`src/sharing/`) renders a gallery poster: Satori cannot read SVG backgrounds reliably, so the script also writes a JPEG of each at 1200×1500 for the card.
- [ ] `docs/contributing/templates.md` becomes `posters.md`: how to draw, measure and add one.
- [ ] Unit tests: every registry entry has its file, its messages, a measured pair, and a look whose font, effect and placement are valid knobs; legibility holds over each poster's measured pair in both tones.
- [ ] Visual check at 390 px and desktop of every poster with its own look, title below and on.

## Notes for the implementer

- The licence is the project's (AGPL-3.0); say so in `public/posters/README.md`.
- Commit subject, e.g. `Posters: twenty gallery posters for the common occasions`.
