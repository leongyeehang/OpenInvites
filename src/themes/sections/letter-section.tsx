import { getTranslations } from "next-intl/server";
import type { Letter } from "@/invites/invite";
import { cn } from "@/lib/utils";
import type { SectionDrawing } from "@/sections";
import type { Layout } from "@/themes/theme";
import type { SectionPage } from "./drawings";

// The host's letter to the guest the page is open for (M6 ticket 09, invites/invite.ts letterFor):
// plain text, set as text and never read as markdown or HTML, with the line breaks the host typed
// and the blank lines between its paragraphs. Each layout frames it as its own and heads it
// "For {name}".
export function LetterSection({ body, className }: { body: string; className?: string }) {
  return <p className={cn("break-words whitespace-pre-line", className)}>{body}</p>;
}

// The letter's text in each layout: set like the Poster's details, the Broadsheet's description,
// and the Thread's other bubbles.
const LETTER: Record<Layout, string | undefined> = { poster: "text-base leading-relaxed", broadsheet: "text-[17px] leading-relaxed", thread: undefined };

// The letter as a section (M8 ticket 25): there only for a viewer whose device stands for an
// invite with a letter, while the event has letters on, which the page has worked out; headed by
// whom it is for.
export const letterDrawing: SectionDrawing<Letter & { heading: string }, SectionPage> = {
  load: async ({ letter }) => letter && { ...letter, heading: (await getTranslations("EventPage"))("letter.for", { name: letter.name }) },
  shown: () => ({ count: null }),
  heading: (letter) => letter.heading,
  body: (letter, layout) => <LetterSection body={letter.body} className={LETTER[layout]} />,
};
