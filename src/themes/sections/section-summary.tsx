import { ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import type { ReadySection, SectionKind } from "@/sections";

// How much each kind of section holds, said beside its heading once it is collapsed.
const COUNTS: Partial<Record<SectionKind, `sections.count.${"guests" | "comments" | "album" | "announcements" | "schedule" | "links"}`>> = {
  guests: "sections.count.guests",
  comments: "sections.count.comments",
  album: "sections.count.album",
  announcements: "sections.count.announcements",
  schedule: "sections.count.schedule",
  links: "sections.count.links",
};

// The summary of a collapsed section (M8 ticket 27), the native disclosure's control, which every
// layout's collapsed frame opens with: the section's icon, its heading, how much it holds where it
// says, and the chevron, which turns once the disclosure is open (its `<details>` is the `group`).
// The heading keeps its id, so the focus after a deletion still lands on it; the `<details>` is
// never given `open`, so React leaves the guest's choice alone across a refresh.
export async function SectionSummary({ section, className }: { section: ReadySection; className?: string }) {
  const t = await getTranslations("EventPage");
  const { placed, icon: Icon } = section;
  const key = COUNTS[placed.kind];
  const count = key && placed.count !== null ? t(key, { count: placed.count }) : null;
  return (
    <summary className={cn("-mx-1 flex cursor-pointer list-none items-center gap-2 rounded-lg px-1 [&::-webkit-details-marker]:hidden", className)}>
      <Icon className="size-4 shrink-0" aria-hidden />
      {section.heading !== null && (
        <h2 id={section.headingId} tabIndex={section.headingId ? -1 : undefined} className="font-medium outline-none">
          {section.heading}
        </h2>
      )}
      {count !== null && (
        <>
          <span aria-hidden className="text-theme-text-faint">
            ·
          </span>
          <span data-slot="section-count" className="text-theme-text-faint">
            {count}
          </span>
        </>
      )}
      <ChevronDown className="ml-auto size-4 shrink-0 group-open:rotate-180" aria-hidden />
    </summary>
  );
}
