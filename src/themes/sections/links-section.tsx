import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { linksToDraw, type SectionDrawing, type SectionLink } from "@/sections";
import type { Layout } from "@/themes/theme";
import { BUBBLE_CHIP } from "../thread-bubble";
import type { SectionPage } from "./drawings";

// How a link looks in each layout: a large glass button in the Poster, a line of type under a rule
// in the Broadsheet, a chip in the host's bubble in the Thread.
const LIST: Record<Layout, string> = {
  poster: "flex flex-col gap-2",
  broadsheet: "divide-y divide-theme-text/20 border-y border-theme-text/20",
  thread: "flex flex-wrap gap-2",
};
const LINK: Record<Layout, string> = {
  poster:
    "flex min-h-14 items-center gap-3 rounded-2xl border border-theme-glass-border bg-theme-glass-strong px-4 py-2.5 transition-colors hover:bg-theme-glass motion-reduce:transition-none",
  broadsheet: "flex items-baseline justify-between gap-4 py-3 hover:underline hover:underline-offset-4",
  thread: cn(BUBBLE_CHIP, "items-center rounded-2xl py-1.5"),
};
const LABEL: Record<Layout, string> = {
  poster: "font-medium",
  broadsheet: "text-[17px] font-medium",
  thread: "font-medium",
};
const HOST: Record<Layout, string> = {
  poster: "text-sm text-theme-text-muted",
  broadsheet: "label-mono shrink-0 text-theme-text-muted",
  thread: "text-xs font-normal text-theme-text-muted",
};

// A Links section's links (M8 spec, "Links"; ticket 29): each a link out, opened in a new tab
// without a referrer, the label over the site it goes to, which is all a guest is told of it:
// nothing is fetched for it, no icon and no preview, and it goes straight there, never through
// the site (ADR-0005). `nofollow`, since a host's link is not the site's word for it. Each address
// is checked again here (`linksToDraw`). `linked` is false in the editor, which draws them under
// the button that opens their sheet, as they will look.
export async function LinksSection({ links, layout, linked = true }: { links: SectionLink[]; layout: Layout; linked?: boolean }) {
  const t = await getTranslations("EventPage");
  return (
    <ul className={LIST[layout]}>
      {linksToDraw(links).map((link, index) => {
        // A link the host gave no label is named by its site already, which is not said twice.
        const host = link.label !== link.host && <span className={HOST[layout]}>{link.host}</span>;
        const content = (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={cn(LABEL[layout], "break-words")}>{link.label}</span>
              {layout !== "broadsheet" && host}
            </span>
            {layout === "broadsheet" && host}
            {layout === "poster" && <ArrowUpRight aria-hidden className="size-4.5 shrink-0 text-theme-text-faint" />}
            {linked && <span className="sr-only"> {t("sections.newTab")}</span>}
          </>
        );
        return (
          <li key={index}>
            {linked ? (
              <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer" className={LINK[layout]}>
                {content}
              </a>
            ) : (
              <span className={LINK[layout]}>{content}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// Links as a section: it loads nothing, since all it draws is in the arrangement, and is placed
// only with a link a guest may follow (placedSections), which a collapsed one counts.
export const linksDrawing: SectionDrawing<null, SectionPage> = {
  load: async () => null,
  shown: () => ({ count: null }),
  body: (_, layout, placed) => (placed.section.kind === "links" ? <LinksSection links={placed.section.links} layout={layout} /> : null),
};
