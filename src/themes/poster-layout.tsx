import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Fragment, type ReactNode } from "react";
import type { EventWithHost } from "@/events/repository";
import { formatWhenBrief, isDated } from "@/events/time";
import { cn } from "@/lib/utils";
import type { ReadySection } from "@/sections";
import { Glass } from "./glass";
import { PosterHero } from "./poster-card";
import { entrance, HostLine, invitationEntrance, SectionLabel } from "./poster-parts";

// The Poster layout, poster first (M4 spec, "The guest page"): the poster as wide as the page's
// column, the title on it or under it with its date, who is hosting, then the page's sections in
// the host's order (M8 ticket 25; src/sections), each a frosted panel of its own, the details one
// list of When, Where and About; never arranged, the letter, the details, the schedule, Who's
// coming, the announcements, the comments and the album, as before. The reply buttons are a bar
// fixed to the foot of the screen (rsvp-flow.tsx), so a guest can answer wherever they are on the
// page. On a wider screen the page stays a phone's width, in the middle. It renders inside a
// ThemedPage, which carries the theme.

// Each section rises a little after the one before, by its place in the full order, so the
// delays are what they were before the page could be arranged. Written out whole, as Tailwind
// reads class names from the source.
const DELAYS = [
  "motion-safe:delay-200",
  "motion-safe:delay-200",
  "motion-safe:delay-300",
  "motion-safe:delay-300",
  "motion-safe:delay-300",
  "motion-safe:delay-400",
  "motion-safe:delay-400",
];

export async function PosterLayout({
  event,
  hosts,
  notice,
  rsvp,
  poll,
  sections,
  edit,
}: {
  // A draft may have no date yet, which only its hosts see: then there is no When.
  event: EventWithHost;
  // Every host's display name, owner first, then co-hosts in the order they were added.
  hosts: string[];
  notice?: ReactNode;
  rsvp?: ReactNode;
  // While guests vote on the date (M4 ticket 09): what the poster says in place of a date.
  poll?: { label: string };
  // The page's sections, placed and made ready (themes/sections/drawings.ts; in the editor,
  // editor/section-previews.tsx).
  sections: ReadySection[];
  // The editor (M4 spec, "The editor"): the title typed on the poster, at either size, and what
  // it says under the sections.
  edit?: { title: { full: ReactNode; compact: ReactNode }; foot?: ReactNode };
}) {
  const [t, locale, format] = await Promise.all([getTranslations("EventPage"), getLocale(), getFormatter()]);

  return (
    // Above an editor's design sheet on a phone, a live copy, half its size: moved, never laid out
    // again, and simply there under reduced motion.
    <main className="mx-auto w-full max-w-[28rem] origin-top pb-8 transition-transform duration-300 ease-out motion-reduce:transition-none design-sheet:max-lg:translate-y-14 design-sheet:max-lg:scale-50 editor-sheet-open:lg:translate-x-[min(0px,calc(50vw-40rem))]">
      {notice && <div className="px-4 pt-4">{notice}</div>}

      <PosterHero
        title={event.title}
        when={isDated(event) ? formatWhenBrief(event, locale) : poll?.label}
        editable={edit?.title}
        className={cn(invitationEntrance, "motion-safe:delay-0")}
      />

      <HostLine name={event.hostName} className={cn(entrance, "motion-safe:delay-100")}>
        {t("hostedBy", { hosts: format.list(hosts, { type: "conjunction" }) })}
      </HostLine>

      {/* The reply bar is fixed to the foot of the screen; it is here for a screen reader and the
          keyboard, after the invitation's opening and before its details. */}
      {rsvp}

      <div className="flex flex-col gap-3 px-4 pt-5">
        {sections.map((section) => {
          const { placed } = section;
          const rise = cn(entrance, DELAYS[Math.min(placed.index, DELAYS.length - 1)]);
          // A section that frames itself carries its own data-section.
          if (section.whole) return <Fragment key={placed.key}>{section.whole(rise)}</Fragment>;
          return (
            <Glass key={placed.key} data-slot={placed.kind} data-section={placed.key} className={cn("rounded-[1.75rem] p-5", rise)}>
              {section.heading !== null && (
                <SectionLabel icon={section.icon} id={section.headingId}>
                  {section.heading}
                </SectionLabel>
              )}
              {section.body}
            </Glass>
          );
        })}
        {edit?.foot}
      </div>
    </main>
  );
}
