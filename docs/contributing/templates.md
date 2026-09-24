# Templates

A template is a named, ready-made theme that ships with OpenInvites. A host starts from one in the Design drawer and may change any part of it; the theme then reads "Custom, started from" the template. Each template is one data file in [`src/themes/templates/`](../../src/themes/templates/). Adding one needs no application code.

## The shape

Every file exports one `Template` (the type is in [`template.ts`](../../src/themes/templates/template.ts)):

```ts
import type { Template } from "./template";

export const birthday: Template = {
  id: "birthday",
  theme: {
    layout: "poster",
    backgroundId: "golden",
    titlePlacement: "below",
    font: "serif",
    accentOverride: null,
    textTone: "auto",
    buttonStyle: "glass",
    rsvpStyle: "sheet",
    effect: "sparkles",
  },
};
```

| Field | What it is |
| --- | --- |
| `id` | Stored on every event that starts from the template. Lowercase, and never renamed once shipped: an event whose template id is gone reads as plain "Custom". It is also the key of the template's two messages (below). |
| `theme.layout` | `"poster"`, `"broadsheet"` or `"thread"`. Only Poster is offered today; a template made for another layout applies with Poster until that layout ships. |
| `theme.backgroundId` | The `id` of a curated background in [`src/themes/backgrounds.ts`](../../src/themes/backgrounds.ts) ([backgrounds.md](backgrounds.md)). |
| `theme.titlePlacement` | `"on"` or `"below"`: where the title goes when the host's upload is the poster. |
| `theme.font` | `"serif"`, `"grotesque"`, `"display"` or `"rounded"` (the faces are in [`src/themes/fonts.ts`](../../src/themes/fonts.ts)). |
| `theme.accentOverride` | `null` to take the background's own accent, or one of the six swatches in [`src/themes/swatches.ts`](../../src/themes/swatches.ts). |
| `theme.textTone` | `"auto"`, `"light"` or `"dark"`. Leave it on `"auto"` unless the template is about the tone. |
| `theme.buttonStyle` | `"glass"`, `"solid"` or `"outline"`. |
| `theme.rsvpStyle` | `"inline"` or `"sheet"`: how guests answer in the Poster layout. |
| `theme.effect` | `"none"`, `"confetti"`, `"sparkles"` or `"doodles"`. Stored now, drawn from M2. |

A template sets every knob. What it never sets is the host's own: their upload and whether it is used as the background or as the poster. Applying a template keeps the upload in the host's gallery and shows the template's background instead.

## Its name and blurb, in every language

What the drawer calls a template, and the line about its look shown when the host points at it, are shown in the host's language, so they live in the translation files like every other string, keyed by the template's `id`. Every file in `messages/` (`en.json`, `zh-Hans.json`, `zh-Hant.json`, and any language added later) needs both, under `DesignDrawer`:

```json
"templateNames": { "birthday": "Birthday" },
"templateBlurbs": { "birthday": "Golden hour, a large serif title and frosted glass buttons." }
```

If you cannot write one of the languages, say so in the pull request and ask for help: the translation tests fail until every language has both ([translations.md](translations.md)).

## Adding a template

1. Add its name and blurb to every file in `messages/`, as above. Its `id` is then a `TemplateId`, which the data file's type requires.
2. Copy a file in `src/themes/templates/`, give it the new `id`, and choose its knobs.
3. Import it in [`index.ts`](../../src/themes/templates/index.ts) and put it in `TEMPLATES` where it should appear in the drawer.
4. Add its `id`, in the same place, to the list the first test in [`templates.test.ts`](../../src/themes/templates/templates.test.ts) expects (and count it in the test's name).
5. Run `pnpm typecheck` and `pnpm test`. These must pass:
   - **The template tests** (`src/themes/templates/templates.test.ts`): every knob is set to a value the drawer can show, the background exists, and English names exactly the templates that ship, each with a blurb.
   - **The translation tests** (`src/locale/translations.test.ts`): every language has every message English has, with the same placeholders.
   - **The legibility tests** (`src/themes/legibility.test.ts`, "every combination the drawer offers"): every curated background reads at WCAG AA in both text tones with every accent, on every surface the Poster layout stacks, and so with every button style. A template is made of those knobs, so it reads too; nothing about it is tested alone.

Look at it in both text tones and with each button style before sending it (`pnpm dev`, then a published event's Design drawer): the tests prove it is readable, not that it is lovely.
