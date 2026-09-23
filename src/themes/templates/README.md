# Templates

A template is a named, ready-made theme that ships with OpenInvites. A host starts from one in the Design drawer and may change any part of it; the theme then reads "Custom, started from" the template. Each template is one data file in this directory. Adding one needs no application code.

## The shape

Every file exports one `Template` (the type is in `template.ts`):

```ts
import type { Template } from "./template";

export const birthday: Template = {
  id: "birthday",
  name: "Birthday",
  blurb: "Golden hour, a large serif title and frosted glass buttons.",
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
| `id` | Stored on every event that starts from the template. Lowercase, and never renamed once shipped: an event whose template id is gone reads as plain "Custom". |
| `name` | What the drawer calls the template. |
| `blurb` | One line about the theme, shown when the host points at the template. |
| `theme.layout` | `"poster"`, `"broadsheet"` or `"thread"`. Only Poster is offered today; a template made for another layout applies with Poster until that layout ships. |
| `theme.backgroundId` | The `id` of a curated background in `../backgrounds.ts`. |
| `theme.titlePlacement` | `"on"` or `"below"`: where the title goes when the host's upload is the poster. |
| `theme.font` | `"serif"`, `"grotesque"`, `"display"` or `"rounded"` (the faces are in `../fonts.ts`). |
| `theme.accentOverride` | `null` to take the background's own accent, or one of the six swatches in `../swatches.ts`. |
| `theme.textTone` | `"auto"`, `"light"` or `"dark"`. Leave it on `"auto"` unless the template is about the tone. |
| `theme.buttonStyle` | `"glass"`, `"solid"` or `"outline"`. |
| `theme.rsvpStyle` | `"inline"` or `"sheet"`: how guests answer in the Poster layout. |
| `theme.effect` | `"none"`, `"confetti"`, `"sparkles"` or `"doodles"`. Stored now, drawn from M2. |

A template sets every knob. What it never sets is the host's own: their upload and whether it is used as the background or as the poster. Applying a template keeps the upload in the host's gallery and shows the template's background instead.

## Adding a template

1. Copy a file here, give it a new `id`, `name` and `blurb`, and choose its knobs.
2. Import it in `index.ts` and put it in `TEMPLATES` where it should appear in the drawer.
3. Run `pnpm test`. The template tests check that every knob is set to a value the drawer can show, and the legibility tests check that every background reads in both text tones with every accent, so any template made of those knobs reads too.

Look at it in both text tones and with each button style before sending it: the tests prove it is readable, not that it is lovely.
