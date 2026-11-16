import { ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import type { ReadySection, SectionKind } from "@/sections";

// How much each kind of section holds, said beside its heading once it is collapsed: every kind,
// so that one added without saying does not compile (the part review's finding 5); null where it
// says nothing (a Note), or is never collapsed.
const COUNTS = {
  letter: null,
  details: null,
  schedule: "sections.count.schedule",
  guests: "sections.count.guests",
  announcements: "sections.count.announcements",
  comments: "sections.count.comments",
  album: "sections.count.album",
  countdown: null,
  note: null,
  links: "sections.count.links",
} as const satisfies Record<SectionKind, `sections.count.${string}` | null>;

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
      {/* It turns as it opens only where the guest's device allows motion. */}
      <ChevronDown className="ml-auto size-4 shrink-0 group-open:rotate-180 motion-safe:transition-transform motion-safe:duration-200" aria-hidden />
    </summary>
  );
}
