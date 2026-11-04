import { AlignLeft, Clock, Images, MapPin, MessageCircle } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { ComponentType, ReactNode } from "react";
import type { CommentsShown } from "@/comments/visibility";
import type { EventWithHost } from "@/events/repository";
import { formatWhen, formatWhenBrief, isDated } from "@/events/time";
import { cn } from "@/lib/utils";
import { RichTextView } from "@/rich-text/rich-text-view";
import { Glass } from "./glass";
import { PosterHero } from "./poster-card";
import { AnnouncementsSection, type ShownAnnouncement } from "./sections/announcements-section";
import { ALBUM_HEADING } from "./sections/album-section";
import { COMMENTS_HEADING, CommentsSection } from "./sections/comments-section";

// The Poster layout, poster first (M4 spec, "The guest page"): the poster as wide as the page's
// column, the title on it or under it with its date, who is hosting, then one frosted list of
// When, Where and About, and Who's coming, the host's announcements and the comments as panels of
// their own. The reply buttons are a bar fixed to the foot of the screen (rsvp-flow.tsx), so a
// guest can answer wherever they are on the page. On a wider screen the page stays a phone's
// width, in the middle. It renders inside a ThemedPage, which carries the theme.
export async function PosterLayout({
  event,
  hosts,
  announcements,
  comments,
  commentForm,
  notice,
  rsvp,
  guestList,
  underWhen,
  underWhere,
  calendar,
  poll,
  album,
  edit,
}: {
  // A draft may have no date yet, which only its hosts see: then there is no When.
  event: EventWithHost;
  // Every host's display name, owner first, then co-hosts in the order they were added.
  hosts: string[];
  // The host's announcements, newest first, which every viewer reads.
  announcements: ShownAnnouncement[];
  // The comments as this viewer may see them (comments/visibility.ts), absent when the host has
  // turned them off; and the form that posts one, shown where they may.
  comments?: CommentsShown;
  commentForm?: ReactNode;
  notice?: ReactNode;
  rsvp?: ReactNode;
  guestList?: ReactNode;
  // What the guest's own device adds: their clock, their maps app, their calendar.
  underWhen?: ReactNode;
  underWhere?: ReactNode;
  calendar?: ReactNode;
  // While guests vote on the date (M4 ticket 09): what the poster says in place of a date, and what
  // the When row holds, the candidates and the way into the vote.
  poll?: { label: string; when: ReactNode };
  // The photo album (M4 ticket 11), as this viewer may see it.
  album?: ReactNode;
  // The editor (M4 spec, "The editor"): the title typed on the poster, at either size, and the
  // details list it edits, in place of the guest's; nothing else of the guest's page is shown.
  edit?: { title: { full: ReactNode; compact: ReactNode }; details: ReactNode; foot?: ReactNode };
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

      <div className={cn("mt-4 flex items-center gap-3 px-5 sm:px-6", entrance, "motion-safe:delay-100")}>
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-theme-accent text-xs font-semibold text-theme-on-accent">
          {initialsOf(event.hostName)}
        </span>
        <p className="text-sm text-theme-text-muted">{t("hostedBy", { hosts: format.list(hosts, { type: "conjunction" }) })}</p>
      </div>

      {/* The reply bar is fixed to the foot of the screen; it is here for a screen reader and the
          keyboard, after the invitation's opening and before its details. */}
      {rsvp}

      {edit ? (
        <div className="flex flex-col gap-3 px-4 pt-5">
          {edit.details}
          {edit.foot}
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 pt-5">
          <Glass data-slot="details" className={cn("divide-y divide-theme-glass-border overflow-hidden rounded-[1.75rem]", entrance, "motion-safe:delay-200")}>
            {isDated(event) ? (
              <DetailRow icon={Clock} label={t("when")}>
                <p className="text-base leading-snug font-medium">{formatWhen(event, locale)}</p>
                {underWhen}
                {calendar && <div className="mt-3">{calendar}</div>}
              </DetailRow>
            ) : (
              poll && (
                <DetailRow icon={Clock} label={t("when")} slot="poll">
                  {poll.when}
                </DetailRow>
              )
            )}
            {event.location && (
              <DetailRow icon={MapPin} label={t("where")}>
                <p className="text-base leading-snug font-medium break-words">{event.location}</p>
                {underWhere}
              </DetailRow>
            )}
            {event.descriptionRich.blocks.length > 0 && (
              <DetailRow icon={AlignLeft} label={t("about")} slot="description">
                <RichTextView doc={event.descriptionRich} className="leading-relaxed text-theme-text-muted" />
              </DetailRow>
            )}
          </Glass>

          {guestList && <Glass className={cn("rounded-[1.75rem] p-5", entrance, "motion-safe:delay-300")}>{guestList}</Glass>}

          {announcements.length > 0 && (
            <Glass data-slot="announcements" className={cn("rounded-[1.75rem] p-5", entrance, "motion-safe:delay-300")}>
              <SectionLabel>{t("announcements")}</SectionLabel>
              <AnnouncementsSection announcements={announcements} timeZone={event.timeZone} />
            </Glass>
          )}

          {comments && (
            <Glass data-slot="comments" className={cn("rounded-[1.75rem] p-5", entrance, "motion-safe:delay-400")}>
              <SectionLabel icon={MessageCircle} id={COMMENTS_HEADING}>
                {t("comments.title")}
              </SectionLabel>
              <CommentsSection comments={comments} form={commentForm} slug={event.slug} timeZone={event.timeZone} />
            </Glass>
          )}

          {album && (
            <Glass data-slot="album" className={cn("rounded-[1.75rem] p-5", entrance, "motion-safe:delay-400")}>
              <SectionLabel icon={Images} id={ALBUM_HEADING}>
                {t("album.title")}
              </SectionLabel>
              {album}
            </Glass>
          )}
        </div>
      )}
    </main>
  );
}

// One row of the details list: its icon in a small tile, its heading, and what it says.
function DetailRow({ icon: Icon, label, slot, children }: { icon: ComponentType<{ className?: string }>; label: string; slot?: string; children: ReactNode }) {
  return (
    <section data-slot={slot} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 p-4">
      <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-theme-glass-strong text-theme-accent-ink">
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0 pt-0.5">
        <h2 className={cn(CAPS, "mb-1 text-theme-text-faint")}>{label}</h2>
        {children}
      </div>
    </section>
  );
}

// Each piece rises into place on load. Under reduced motion none of these classes apply, so
// nothing moves.
const rise = "motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:fill-mode-both motion-safe:duration-700 motion-safe:ease-out";
const entrance = cn(rise, "motion-safe:fade-in");
// The invitation fades in from a trace (1%) rather than from nothing, which looks the same. A
// browser counts the largest thing it paints only where it is visible when painted, and a piece
// faded in from nothing is painted once, unseen, and then only faded: the invitation would never
// count, and the page's largest paint would wait for whatever is drawn after the scripts run
// (the countdown), as a slow phone's first view of the page. From 1% it counts at once.
const invitationEntrance = cn(rise, "motion-safe:fade-in-1");

// The small spaced capitals of the details' and the panels' headings.
const CAPS = "text-xs font-medium tracking-label uppercase";

// A heading with an `id` is where the focus is sent once something under it is deleted, so it can
// take the focus, though it is never a stop for Tab.
export function SectionLabel({ icon: Icon, id, children }: { icon?: ComponentType<{ className?: string }>; id?: string; children: ReactNode }) {
  return (
    <h2 id={id} tabIndex={id ? -1 : undefined} className={cn(CAPS, "mb-3 flex items-center gap-2 text-theme-text-faint outline-none")}>
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </h2>
  );
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}
