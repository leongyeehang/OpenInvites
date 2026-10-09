import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { CommentsShown } from "@/comments/visibility";
import type { EventWithHost } from "@/events/repository";
import { formatWhen } from "@/events/time";
import { cn } from "@/lib/utils";
import { RichTextView } from "@/rich-text/rich-text-view";
import { BackgroundDescription } from "./background-description";
import { BroadsheetGuestList, type BroadsheetGuests } from "./broadsheet-guest-list";
import { BroadsheetTitle } from "./broadsheet-title";
import { AnnouncementsSection, type ShownAnnouncement } from "./sections/announcements-section";
import { COMMENTS_HEADING, CommentsSection } from "./sections/comments-section";

// The Broadsheet layout (spec, "Broadsheet", from the prototype's layout-broadsheet.tsx): an
// editorial page at most 64rem wide. A masthead rule, one very large title (or the host's
// poster), a facts grid, the description in columns, the host's announcements, the guest list
// typeset, and the comments, beside one ballot that stays in view on a wide screen. On a phone
// the ballot comes straight after the facts. It renders inside a ThemedPage, which carries the
// theme and paints the backdrop; the layout paints none of its own.
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
  announcements,
  comments,
  commentForm,
  notice,
  rsvp,
  guests,
  underWhen,
  countdown,
  underWhere,
}: {
  event: EventWithHost;
  // Every host's display name, owner first, then co-hosts in the order they were added.
  hosts: string[];
  // The host's announcements, newest first, which every viewer reads.
  announcements: ShownAnnouncement[];
  // The comments as this viewer may see them, absent when the host has turned them off; and the
  // form that posts one, shown where they may.
  comments?: CommentsShown;
  commentForm?: ReactNode;
  notice?: ReactNode;
  // The ballot: the RSVP flow as the Broadsheet presents it.
  rsvp?: ReactNode;
  // The guest list and its counts as this viewer may see them, absent when the host hides it.
  guests?: BroadsheetGuests;
  // What the guest's own device adds: their clock, the countdown on it, their maps app.
  underWhen?: ReactNode;
  countdown?: ReactNode;
  underWhere?: ReactNode;
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
              {guests?.view === "open" && <span className="mt-1 block text-sm text-theme-text-muted">{t("headcount", { count: guests.counts.headcount })}</span>}
            </Fact>
            {countdown && <Fact label={t("broadsheet.countdown")}>{countdown}</Fact>}
          </dl>
        </header>

        {rsvp && <div className={cn("lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start", entrance, "motion-safe:delay-150")}>{rsvp}</div>}

        <div className={cn(PAPER, "flex flex-col gap-12 rounded-4xl lg:col-start-1 lg:rounded-t-none lg:pt-12", entrance, "motion-safe:delay-200")}>
          {event.descriptionRich.blocks.length > 0 && (
            <Section label={t("broadsheet.details")} slot="description">
              <RichTextView doc={event.descriptionRich} className="text-[17px] leading-relaxed sm:columns-2 sm:gap-8 [&>*]:break-inside-avoid" />
            </Section>
          )}

          {announcements.length > 0 && (
            <Section label={t("announcements")} slot="announcements">
              <AnnouncementsSection announcements={announcements} timeZone={event.timeZone} />
            </Section>
          )}

          {guests && (
            <Section label={t("guests")} slot="guests">
              <BroadsheetGuestList {...guests} />
            </Section>
          )}

          {comments && (
            <Section label={t("comments.title")} slot="comments" headingId={COMMENTS_HEADING}>
              <CommentsSection comments={comments} form={commentForm} slug={event.slug} timeZone={event.timeZone} />
            </Section>
          )}
        </div>
      </div>
    </main>
  );
}

// The page's text sits on the veil, behind the glass's blur (see above).
const PAPER = "bg-theme-veil p-5 backdrop-blur-xl sm:p-8";

// Each piece rises into place on load, as on the Poster. Under reduced motion none of these
// classes apply, so nothing moves. The masthead and title fade in from a trace rather than from
// nothing, so the browser counts them as the page's largest paint at once (poster-layout.tsx).
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

// A part of the page under a rule and its label. A label with an id is where the focus is sent
// once something under it is deleted, so it can take the focus, though it is never a stop for Tab.
function Section({ label, slot, headingId, children }: { label: string; slot: string; headingId?: string; children: ReactNode }) {
  return (
    <section data-slot={slot} className="border-t border-theme-text/80 pt-5">
      <h2 id={headingId} tabIndex={headingId ? -1 : undefined} className="label-mono mb-4 text-theme-text-muted outline-none">
        {label}
      </h2>
      {children}
    </section>
  );
}
