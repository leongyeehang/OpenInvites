# 17: Rich text description

**What to build:** A host writes the description with bold, italic, links, bullet lists, and emoji on a phone as easily as a laptop, and guests see it rendered safely inside the theme.

**Blocked by:** 06 Theme and the Poster layout

**Status:** done

- [x] An editor with a minimal toolbar: bold, italic, link, bullet list; emoji through the device keyboard; no headings, numbered lists, or images.
- [x] The description is stored as sanitised HTML restricted to paragraphs, line breaks, bold, italic, links with http, https, or mailto targets, and bullet lists; sanitised on save and again on render; links open in a new tab with safe relation attributes.
- [x] A plain-text rendering exists for the calendar file and the preview card.
- [x] The Poster layout styles the description within the theme's text tone.
- [x] Browser tests: formatting survives save and reload; a hostile paste with scripts and iframes renders with nothing but allowed content. Unit tests: the sanitiser's allowlist and the plain-text rendering.

## Comments

**2026-09-22, implementing agent.** Done. Lint, type check, 127 unit tests, and 116 browser tests pass against the production image on the Compose `test` profile.

How it landed:

- `src/rich-text/`: `rich-text.ts` (the document model, `parseRichText`, `richTextToPlain`, `safeHref`), `html.ts` (the one place the application writes markup, for seeding the editor), `read-dom.ts` (what the browser left in the editable area, read back into the model), `rich-text-view.tsx` (the invitation's rendering).
- The editor is the browser's own editable area with a four-button toolbar, seeded once and never re-rendered so the cursor stays put, with the document travelling in a hidden field beside it.
- `description_rich` is a jsonb column beside the existing plain-text `description`, which is now derived from the document for the calendar file and, later, the preview card (migration `0008`, backfilled by `0009`).

Decisions and things to know:

- **The description is stored as a validated document, not as sanitised HTML**, which is a deliberate deviation from the spec's wording. The guarantee is stronger rather than weaker: the allowlist *is* the type, so markup the application did not write cannot exist, and there is no HTML parser to get wrong and no sanitiser dependency to keep up with. It also matches what the prototype rendered from. What is lost is portability — a description is now this application's JSON — and the plain-text rendering covers every consumer that wanted words.
- Links are checked on save **and again on render**, in both renderers, because the spec asks for both and because a row that arrived some other way should still not be able to send a guest anywhere odd. `safeHref` gates on the WHATWG URL parser's `protocol`, which is the same parser a browser applies to the attribute.
- Paste arrives as plain words. Anything else would run in the host's own session before the model ever saw it, and would be stripped on save regardless, so it was never formatting a host could keep.
- The browser's editing commands are `document.execCommand`, which is deprecated and still the only thing every phone and laptop implements. It is safe here because nothing it produces is trusted: the DOM is read back through the model on every keystroke.
- A description the server cannot read is refused with a message rather than treated as empty. Review caught that swallowing the parse error would have quietly erased a host's words; a browser test covers it now.
- Migration `0009` backfills every existing description into a paragraph per line. Review caught that without it, opening an older event's form would show an empty editor and saving would wipe the description. Verified against a hand-made legacy row before committing.

Left for later tickets or noted:

- The mark-to-element mapping exists in three places (the model, the HTML writer, the React view). A fourth mark would mean four edits. Worth folding together if marks are ever added.
- **For ticket 20 (accessibility):** the toolbar buttons carry no `aria-pressed`, and the editable area is labelled by `aria-label` rather than a `for`/`id` pair, so its visible label is not clickable.
- **For ticket 14 (sharing):** the preview card wants the plain-text rendering, which `event.description` now holds.
