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
import { CAPS, entrance, HostLine, IconTile, invitationEntrance, SectionLabel } from "./poster-parts";
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

      <HostLine name={event.hostName} className={cn(entrance, "motion-safe:delay-100")}>
        {t("hostedBy", { hosts: format.list(hosts, { type: "conjunction" }) })}
      </HostLine>

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
      <IconTile>
        <Icon className="size-4.5" />
      </IconTile>
      <div className="min-w-0 pt-0.5">
        <h2 className={cn(CAPS, "mb-1 text-theme-text-faint")}>{label}</h2>
        {children}
      </div>
    </section>
  );
}
