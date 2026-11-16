# Sections

A **section** is one part of an event page below the poster, which the host places: the Details,
the Schedule, Who's coming, the Announcements, the Comments, the Album, the Countdown, the personal
letter, and the host's own Notes and Links. The poster, the title, who is hosting and the reply
buttons are not sections; they stay where each layout puts them.

A host arranges the page in the editor's **Arrange** sheet: they put the sections in order, switch
off the ones guests do not need, rename and collapse them, choose how the album, the comments and
Who's coming are drawn, and add Notes and Links. An event never arranged is drawn as every layout
drew it before 0.8.

## The arrangement

What the host chose is the event's **arrangement**, one JSON value in `event.sections` (migration
`0064`), read and changed only through the pure rules in
[`src/sections/arrangement.ts`](../../src/sections/arrangement.ts):

- `Section` is the union of every kind with what it carries: `collapsed` and `heading` for all;
  `on` where the arrangement holds the section's switch; `style` where the host may choose one; an
  `id` and a `body` for a Note, an `id` and `links` for Links.
- An empty value is `null`, "never arranged", and `defaultOrder(layout)` stands in for it: each
  layout's sections as before, in `POSTER_ORDER` (the Poster and the Thread) or `BROADSHEET_ORDER`.
- `parseArrangement` reads what is stored, dropping what it does not understand, so a value written
  by a later version, or edited by hand, never breaks a page.
- `applyArrangementChange` applies one `ArrangementChange` (move, toggle, collapse, style, rename,
  audience, add, edit, remove). The Arrange sheet applies it at once, for the live copy, and the
  server applies the same change under the event's row lock (`changeEventArrangement` in
  `src/events/repository.ts`, through `arrangeAction`), so two hosts arranging at once lose nothing.
- `placedSections` gives the sections a page draws, in order, from the arrangement and from what
  each kind's drawing says this viewer is shown.

`@/sections` is the module's one public entry ([ADR-0008](../adr/0008-features-are-modules.md)) and
is client-safe: nothing in it reaches the database.

## The registry, in two halves

Every kind of section is registered twice, so that the Arrange sheet, a client component, never
bundles what the server loads:

1. **`REGISTRY`** in [`src/sections/registry.ts`](../../src/sections/registry.ts) says what the
   Arrange sheet offers for the kind: where its On switch lives (`switch`: none, a column, or the
   arrangement's own), whether it may be collapsed and renamed, its display `styles` (the first is
   what the page always drew), its icon, its default heading in each layout (an `EventPage` message,
   `SectionHeading`), whether the Poster draws it across both columns, and the site's feature it
   belongs to, if any.
2. **A `SectionDrawing`** in [`src/themes/sections/`](../../src/themes/sections/), one file per kind,
   registered in `BY_KIND` in [`drawings.ts`](../../src/themes/sections/drawings.ts). It says what the
   kind `load`s for the page (nothing when the viewer gets none of it), what of it is `shown` (the
   count beside a collapsed heading, and whether it is locked to this viewer), and its `body` per
   layout, or its `whole` where a layout frames it itself. `DRAWN_KINDS` is read from `BY_KIND`, and
   `loadSections` loads every kind in it that is on, at once; `readySections` makes the placed ones
   ready for the layouts. `BY_KIND` must name every `SectionKind` (`satisfies`), so a kind in the
   registry that nothing draws does not compile.

Each layout (`PosterLayout`, `BroadsheetLayout`, `ThreadLayout`) draws the ready list in order, in
its own frame: a panel of glass, a ruled column, a bubble. A collapsed section is a native
`<details>` in every layout, with `SectionSummary` (`src/themes/sections/section-summary.tsx`).

The editor's invitation draws the same order as placeholders (`previewSections` in
[`src/editor/section-previews.tsx`](../../src/editor/section-previews.tsx), with the pure
`previewedSections` in [`src/editor/previewed.ts`](../../src/editor/previewed.ts) saying which), each
a button that opens Arrange at its row.

## Adding a kind

A later module brings a section of its own like this:

- **Its key.** A member of the `Section` union, with what it carries; a case in `builtIn` (its
  default: on or off, its first style); and a place in `POSTER_ORDER` and `BROADSHEET_ORDER`, so
  that `defaultOrder` places it on every page never arranged (at the end, unless it was already
  drawn somewhere, so no existing page moves). `parseArrangement` reads a built-in kind through
  `builtIn` and its `REGISTRY` entry, and puts a kind missing from a stored arrangement in after the
  section before it in the Poster's order, so pages arranged before the kind existed gain it too.
- **Its entry** in `REGISTRY`, with its default heading per layout as an `EventPage` message added
  to `SectionHeading` (`EventPage.sections.<kind>` for a new one).
- **Its drawing**, in a file of its own in `src/themes/sections/` (or exported from the module's
  entry, if it is a module), registered in `BY_KIND`. Its `load` asks the module's own entry, never
  its internals, and returns nothing for a viewer who gets none of it.
- **Its messages**, in `messages/en.json`, `zh-Hans.json` and `zh-Hant.json`: the row's name
  (`Editor.arrange.kinds.<kind>`), the editor's placeholder line (`Editor.arrange.preview.<kind>`),
  a hint under the row if its switch needs one, its default heading, and a collapsed count
  (`EventPage.sections.count.<kind>`) if it has one.
- **Its preview** in `previewedSections`, on when a guest's page would draw it.
- **Tests**: unit cases in `arrangement.test.ts` and `registry.test.ts`, and a row in
  `e2e/sections.spec.ts` that a guest sees it in every layout, in the host's order.

## Why some switches are columns

A switch that changes what the server accepts is a column of the event, not part of the
arrangement: the Letter (`letters_enabled`), Who's coming (`guest_list_visibility`, where off is
"Only the hosts"), the Comments (`comments_enabled`) and the Album (`album_enabled`). Actions read
these columns to refuse a comment, an upload or a guest list nobody may see, and they are read
everywhere else too (the guest list, mail, the album's routes). Keeping each in one place means
one truth: Arrange writes the column in the same transaction as the arrangement (`switchesAfter`),
and the server never has to read the arrangement to decide whether to accept a post. A section
that only changes what is drawn (the Schedule, the Announcements, the Countdown, a Note, Links)
keeps its switch in the arrangement. Where the site has a feature off (`REGISTRY[kind].feature`),
Arrange does not offer the section, and `arrangeAction` refuses a change to it.

## The limits

`SECTION_LIMITS`: a page holds at most 10 Notes and Links together; a heading is at most 40
characters, a Note at most 2,000, Links at most 6 links, each label at most 40 characters and each
address at most 2,000. Headings and labels are counted by character (code point), so forty Chinese
characters or forty emoji are forty, and the sheet's fields cut what is typed the same way
(`clipCharacters`), never by the input's `maxLength`. A link must be `http:` or `https:`, without
a name or password in it; an address typed without a scheme is saved with `https://`
(`safeLinkUrl`). Every guest link opens in a new tab with no referrer.
