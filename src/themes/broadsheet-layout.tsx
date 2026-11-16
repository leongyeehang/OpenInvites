import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Fragment, type ReactNode } from "react";
import type { EventWithHost } from "@/events/repository";
import { formatWhen, type Dated } from "@/events/time";
import { cn } from "@/lib/utils";
import type { ReadySection } from "@/sections";
import { BackgroundDescription } from "./background-description";
import { BroadsheetSection } from "./broadsheet-section";
import { BroadsheetTitle } from "./broadsheet-title";
import { SectionSummary } from "./sections/section-summary";

// The Broadsheet layout (spec, "Broadsheet", from the prototype's layout-broadsheet.tsx): an
// editorial page at most 64rem wide. A masthead rule, one very large title (or the host's poster)
// and a facts grid, then the page's sections in the host's order (M8 ticket 27; src/sections),
// each under its rule; never arranged, the host's letter to the guest, the description in
// columns, the host's schedule, the host's announcements, the guest list typeset, the comments and
// the album, as before; beside one ballot that stays in view on a wide screen. On a phone the
// ballot comes straight after the facts. It renders inside
// a ThemedPage, which carries the theme and paints the backdrop; the layout paints none of its own.
//
// Its text is set on the page rather than on glass, so it sits on the veil, the tint that keeps
// bare text readable on the backdrop at its most extreme (legibility.ts, SURFACES.page), behind
// the same blur the glass has, which is how the backdrop's extremes are measured. On most
// backdrops the veil is clear. The labels are small capitals in the mono face and the rules are
// the text colour at reduced strength; anything in the accent is filled with it, since the accent
// as text is solved for glass, not for the page.
export async function BroadsheetLayout({
  event,
  hosts,
  notice,
  rsvp,
  underWhen,
  countdown,
  underWhere,
  headcount,
  sections,
}: {
  // Dated: an undated draft is shown its host in the Poster layout (app/e/[slug]/page.tsx).
  event: Dated<EventWithHost>;
  // Every host's display name, owner first, then co-hosts in the order they were added.
  hosts: string[];
  notice?: ReactNode;
  // The ballot: the RSVP flow as the Broadsheet presents it.
  rsvp?: ReactNode;
  // What the guest's own device adds: their clock, the countdown on it, their maps app.
  underWhen?: ReactNode;
  countdown?: ReactNode;
  underWhere?: ReactNode;
  // The Host fact's headcount, given only where the guest list is open to this viewer.
  headcount?: number;
  // The page's sections, placed and made ready (themes/sections/drawings.ts).
  sections: ReadySection[];
}) {
  const [t, locale, format] = await Promise.all([getTranslations("EventPage"), getLocale(), getFormatter()]);
  const hostedBy = format.list(hosts, { type: "conjunction" });

  return (
    <main className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      {notice && <div className="mb-4">{notice}</div>}

      {/* Tracks that never grow to fit a long word or link (the edit link on the receipt), which
          would push the page wider than a phone or squeeze the text beside the ballot. */}
      <div className="grid grid-cols-1 gap-y-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-x-10 lg:gap-y-0">
        <header className={cn(PAPER, "rounded-4xl lg:col-start-1 lg:rounded-b-none lg:pb-0", invitationEntrance)}>
          <div className="label-mono flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-theme-text/80 pb-2">
            <span>{t("broadsheet.invitation")}</span>
            <span className="text-theme-text-muted">{t("hostedBy", { hosts: hostedBy })}</span>
          </div>
          <BroadsheetTitle title={event.title} />
          <BackgroundDescription />

          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 lg:grid-cols-2">
            <Fact label={t("when")}>
              <span className="block">{formatWhen(event, locale)}</span>
              {underWhen}
            </Fact>
            {event.location && (
              <Fact label={t("where")}>
                <span className="block break-words">{event.location}</span>
                {underWhere}
              </Fact>
            )}
            <Fact label={t("broadsheet.host", { count: hosts.length })}>
              <span className="block">{hostedBy}</span>
              {headcount !== undefined && <span className="mt-1 block text-sm text-theme-text-muted">{t("headcount", { count: headcount })}</span>}
            </Fact>
            {countdown && <Fact label={t("broadsheet.countdown")}>{countdown}</Fact>}
          </dl>
        </header>

        {rsvp && <div className={cn("lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start", entrance, "motion-safe:delay-150")}>{rsvp}</div>}

        <div className={cn(PAPER, "flex flex-col gap-12 rounded-4xl lg:col-start-1 lg:rounded-t-none lg:pt-12", entrance, "motion-safe:delay-200")}>
          {sections.map((section) => {
            const { placed } = section;
            // Collapsed (M8 ticket 28), a native disclosure under the section's rule, its summary
            // the heading in the labels' small capitals and how much it holds.
            if (placed.collapsed) {
              return (
                <details key={placed.key} data-slot={placed.kind} data-section={placed.key} className="group border-t border-theme-text/80 pt-5">
                  <SectionSummary section={section} className="label-mono text-theme-text-muted" />
                  <div className="mt-4">{section.body}</div>
                </details>
              );
            }
            // The paper comes in as one, so a section has no entrance of its own; one that frames
            // itself carries its own data-section.
            if (section.whole) return <Fragment key={placed.key}>{section.whole("")}</Fragment>;
            return (
              <BroadsheetSection key={placed.key} label={section.heading} headingId={section.headingId} data-slot={placed.kind} data-section={placed.key}>
                {section.body}
              </BroadsheetSection>
            );
          })}
        </div>
      </div>
    </main>
  );
}

// The page's text sits on the veil, behind the glass's blur (see above).
const PAPER = "bg-theme-veil p-5 backdrop-blur-xl sm:p-8";

// Each piece rises into place on load, as on the Poster. Under reduced motion none of these
// classes apply, so nothing moves. The masthead and title fade in from a trace rather than from
// nothing, so the browser counts them as the page's largest paint at once (poster-parts.tsx).
const rise = "motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:fill-mode-both motion-safe:duration-700 motion-safe:ease-out";
const entrance = cn(rise, "motion-safe:fade-in");
const invitationEntrance = cn(rise, "motion-safe:fade-in-1");

// One of the facts under the title, under a strong rule.
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-t border-theme-text/80 pt-3">
      <dt className="label-mono text-theme-text-muted">{label}</dt>
      <dd className="mt-2 text-lg leading-snug font-medium">{children}</dd>
    </div>
  );
}
