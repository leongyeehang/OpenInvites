import { RichTextView } from "@/rich-text/rich-text-view";
import type { RichText } from "@/rich-text/rich-text";
import type { SectionDrawing } from "@/sections";
import type { Layout } from "@/themes/theme";
import type { SectionPage } from "./drawings";

// A Note's words in each layout, set as the description is: the Poster's details, the
// Broadsheet's paper, the Thread's bubbles.
const NOTE: Record<Layout, string | undefined> = { poster: "leading-relaxed", broadsheet: "text-[17px] leading-relaxed", thread: undefined };

// A Note (M8 spec, "Sections"; ticket 29): what the host wrote, in the About editor's rich text, its
// links checked again as the description's are. `linked` is false in the editor, which draws it
// under the button that opens its sheet.
export function NoteSection({ body, layout, linked = true }: { body: RichText; layout: Layout; linked?: boolean }) {
  return <RichTextView doc={body} className={NOTE[layout]} linked={linked} />;
}

// A Note as a section: it loads nothing, since all it draws is in the arrangement, and each layout
// frames it as its own, headed by the host's heading or "Note".
export const noteDrawing: SectionDrawing<null, SectionPage> = {
  load: async () => null,
  shown: () => ({ count: null }),
  body: (_, layout, placed) => (placed.section.kind === "note" ? <NoteSection body={placed.section.body} layout={layout} /> : null),
};
