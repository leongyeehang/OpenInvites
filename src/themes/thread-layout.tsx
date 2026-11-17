import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Fragment, type ReactNode } from "react";
import type { EventWithHost } from "@/events/repository";
import { formatWhen, type Dated } from "@/events/time";
import { cn } from "@/lib/utils";
import type { ReadySection } from "@/sections";
import { Glass } from "./glass";
import { initialsOf } from "./poster-parts";
import { SectionSummary } from "./sections/section-summary";
import { arriving, BubbleLabel, HOST_BUBBLE, HostBubble } from "./thread-bubble";
import { ThreadCard } from "./thread-card";

// The Thread layout (spec, "Thread", from the prototype's layout-thread.tsx): the invitation as a
// chat with the host, in one column at most 28rem wide at every width. A header names the hosts.
// Then the host's bubbles: the invitation as a card, then the page's sections in the host's order
// (M8 ticket 27; src/sections), each drawn as the Thread draws it; never arranged, the letter, the
// details (the description, when and where), the schedule, who's coming, each announcement and
// the comments, folded away, as before. Then `rsvp`, the conversation the guest has with the host
// (the RSVP flow as Thread presents it) and the composer they answer in, which stays at the foot
// of the screen. It renders inside a ThemedPage, which carries the theme and paints the backdrop;
// the layout paints none of its own, so the effects show between the bubbles.
//
// Every word sits on a surface legibility.ts solves: the header and the composer are glass, the
// host's bubbles strong glass (thread-bubble.tsx), the line that says when the invitation was sent
// the veil. A wide section (the schedule, the comments, the album) is the lighter glass, as the
// Poster's panels are, because what is in it in strong glass (the comment box, the item that is
// now) is solved on glass.
export async function ThreadLayout({
  event,
  hosts,
  notice,
  rsvp,
  replies,
  sections,
}: {
  // Dated: an undated draft is shown its host in the Poster layout (app/e/[slug]/page.tsx).
  event: Dated<EventWithHost>;
  // Every host's display name, owner first, then co-hosts in the order they were added.
  hosts: string[];
  notice?: ReactNode;
  // The conversation and the composer: the RSVP flow as the Thread presents it.
  rsvp?: ReactNode;
  // How many have replied, a number the guest list's visibility gives away only with the list.
  replies?: number;
  // The page's sections, placed and made ready (themes/sections/drawings.ts).
  sections: ReadySection[];
}) {
  const [t, locale, format] = await Promise.all([getTranslations("EventPage"), getLocale(), getFormatter()]);
  const sent = format.dateTime(event.publishedAt ?? event.createdAt, { timeZone: event.timeZone, day: "numeric", month: "short" });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
      <header className="sticky top-0 z-20 pt-3 pb-2">
        <Glass className="flex items-center gap-3 rounded-full py-2 pr-5 pl-2">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-theme-accent text-sm font-semibold text-theme-on-accent">
            {initialsOf(event.hostName)}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-semibold">{format.list(hosts, { type: "conjunction" })}</p>
            <p className="truncate text-xs text-theme-text-muted">{replies === undefined ? t("thread.invitation") : t("thread.replies", { count: replies })}</p>
          </div>
        </Glass>
      </header>
      {notice && <div className="mt-1">{notice}</div>}

      {/* Set on the page itself, so on the veil that keeps bare text readable. */}
      <p className="mx-auto my-3 w-fit rounded-full bg-theme-veil px-3 py-1 text-xs font-medium text-theme-text-faint backdrop-blur-xl">
        {t("thread.sent", { date: sent })}
      </p>

      {/* Each bubble a child of the column, so a section's bubbles sit in a row. The card arrives
          first, then each section by its place among those drawn, its bubbles together. */}
      <div className="flex flex-col gap-2">
        <ThreadCard title={event.title} invited={t("thread.invited")} when={formatWhen(event, locale)} className={arriving(0)} />
        {sections.map((section, place) => (
          <Fragment key={section.placed.key}>{threadSection(section, arriving(place + 1))}</Fragment>
        ))}
      </div>
      {rsvp}
    </main>
  );
}

// One section as the Thread draws it. Collapsed, it is a native disclosure in the wide bubble,
// its summary the heading and how much it holds; a section that frames itself draws its own
// bubbles; a wide one is the lighter bubble, a region named by its heading; the rest a host's
// bubble under a small heading.
function threadSection(section: ReadySection, className: string): ReactNode {
  const { placed } = section;
  const wide = cn(HOST_BUBBLE, "w-[85%] bg-theme-glass", className);
  if (placed.collapsed) {
    return (
      <details data-slot={placed.kind} data-section={placed.key} className={cn(wide, "group")}>
        <SectionSummary section={section} />
        <div className="mt-4">{section.body}</div>
      </details>
    );
  }
  if (section.whole) return section.whole(className);
  // A wide section is a region, named by its heading, which needs an id to be named by.
  const headingId = section.headingId ?? (section.wide ? `${placed.key}-heading` : undefined);
  const label = section.heading !== null && (
    <BubbleLabel icon={section.icon} id={headingId}>
      {section.heading}
    </BubbleLabel>
  );
  if (section.wide) {
    return (
      <section data-slot={placed.kind} data-section={placed.key} aria-labelledby={section.heading !== null ? headingId : undefined} className={wide}>
        {label}
        {section.body}
      </section>
    );
  }
  return (
    <HostBubble data-slot={placed.kind} data-section={placed.key} className={className}>
      {label}
      {section.body}
    </HostBubble>
  );
}
