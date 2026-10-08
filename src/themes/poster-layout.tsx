import { Clock, Lock, MapPin, MessageCircle } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { Announcement } from "@/announcements/repository";
import { deleteCommentAction } from "@/comments/actions";
import type { CommentsShown } from "@/comments/visibility";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { EventWithHost } from "@/events/repository";
import { formatDateSticker, formatMoment, formatWhen } from "@/events/time";
import { cn } from "@/lib/utils";
import { RichTextView } from "@/rich-text/rich-text-view";
import { Glass } from "./glass";
import { PosterCard } from "./poster-card";

// The Poster layout (PROTOTYPE.md, the verdict): a frosted poster card with the title in the
// theme's font (or the host's own poster), the RSVP buttons beneath it, then the details in
// glass tiles. It renders inside a ThemedPage, which carries the theme.
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
}: {
  event: EventWithHost;
  // Every host's display name, owner first, then co-hosts in the order they were added.
  hosts: string[];
  // The host's announcements, newest first, which every viewer reads.
  announcements: Pick<Announcement, "id" | "body" | "createdAt">[];
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
}) {
  const [t, locale, format] = await Promise.all([getTranslations("EventPage"), getLocale(), getFormatter()]);
  const sticker = formatDateSticker(event, locale);

  return (
    <main className="mx-auto max-w-xl px-4 pt-6 pb-16 sm:pt-10">
      {notice && <div className="mb-4">{notice}</div>}

      <PosterCard
        title={event.title}
        eyebrow={<p className={cn(label, "text-theme-text-muted")}>{t("eyebrow")}</p>}
        sticker={<DateSticker {...sticker} />}
        host={
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-theme-accent text-xs font-semibold text-theme-on-accent">
              {initialsOf(event.hostName)}
            </span>
            <p className="text-sm text-theme-text-muted">{t("hostedBy", { hosts: format.list(hosts, { type: "conjunction" }) })}</p>
          </div>
        }
        className={cn(invitationEntrance, "motion-safe:delay-0")}
      />

      {rsvp && <div className={cn("mt-3", entrance, "motion-safe:delay-100")}>{rsvp}</div>}

      <div className={cn("mt-5 grid gap-3", event.location && "sm:grid-cols-2")}>
        <Glass className={cn("p-5", entrance, "motion-safe:delay-200")}>
          <SectionLabel icon={Clock}>{t("when")}</SectionLabel>
          <p className="text-lg leading-tight font-medium">{formatWhen(event, locale)}</p>
          {underWhen}
        </Glass>
        {event.location && (
          <Glass className={cn("p-5", entrance, "motion-safe:delay-300")}>
            <SectionLabel icon={MapPin}>{t("where")}</SectionLabel>
            <p className="text-lg leading-tight font-medium">{event.location}</p>
            {underWhere}
          </Glass>
        )}
      </div>

      {event.descriptionRich.blocks.length > 0 && (
        <Glass data-slot="description" className={cn("mt-3 p-5", entrance, "motion-safe:delay-300")}>
          <SectionLabel>{t("about")}</SectionLabel>
          <RichTextView doc={event.descriptionRich} className="leading-relaxed text-theme-text-muted" />
        </Glass>
      )}

      {/* Each dated in the event's zone, as everything on the page is, and with its line breaks;
          nothing else in it is formatted. */}
      {announcements.length > 0 && (
        <Glass data-slot="announcements" className={cn("mt-3 p-5", entrance, "motion-safe:delay-300")}>
          <SectionLabel>{t("announcements")}</SectionLabel>
          <ol className="flex flex-col gap-4">
            {announcements.map((each) => (
              <li key={each.id}>
                <p className="text-sm text-theme-text-faint">
                  <time dateTime={each.createdAt.toISOString()}>{formatMoment(each.createdAt, event.timeZone, locale)}</time>
                </p>
                <p className="mt-1 leading-relaxed break-words whitespace-pre-wrap">{each.body}</p>
              </li>
            ))}
          </ol>
        </Glass>
      )}

      {calendar && <Glass className={cn("mt-3 p-5", entrance, "motion-safe:delay-400")}>{calendar}</Glass>}

      {guestList && <Glass className={cn("mt-3 p-5", entrance, "motion-safe:delay-500")}>{guestList}</Glass>}

      {/* Shown as written, with their line breaks and spaces, and dated as everything on the page
          is. A guest who has not replied is told only how many there are. */}
      {comments && (
        <Glass data-slot="comments" className={cn("mt-3 p-5", entrance, "motion-safe:delay-500")}>
          <SectionLabel icon={MessageCircle}>{t("comments.title")}</SectionLabel>
          {comments.view === "locked" ? (
            <>
              <p className="text-lg font-medium">{t("comments.count", { count: comments.count })}</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-theme-text-faint">
                <Lock className="size-3.5" aria-hidden /> {t("comments.locked")}
              </p>
            </>
          ) : (
            <div className="flex flex-col gap-5">
              {comments.comments.length === 0 ? (
                <p className="text-sm text-theme-text-muted">{t("comments.count", { count: 0 })}</p>
              ) : (
                <ol className="flex flex-col gap-4">
                  {comments.comments.map((each) => (
                    <li key={each.id}>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="font-medium">{each.name}</p>
                        {each.byHost && (
                          <span className="rounded-full bg-theme-accent px-2 py-0.5 text-xs font-medium text-theme-on-accent">{t("comments.host")}</span>
                        )}
                        <p className="text-sm text-theme-text-faint">
                          <time dateTime={each.createdAt.toISOString()}>{formatMoment(each.createdAt, event.timeZone, locale)}</time>
                        </p>
                        {/* Taking one down cannot be undone, so it is confirmed. */}
                        {each.deletable && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                type="button"
                                className="ml-auto cursor-pointer text-sm text-theme-text-muted underline underline-offset-2 hover:opacity-80"
                              >
                                {t("comments.delete")}
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <form action={deleteCommentAction.bind(null, event.slug, each.id)}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t("comments.deleteTitle")}</AlertDialogTitle>
                                  <AlertDialogDescription>{t("comments.deleteText")}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="pt-4">
                                  <AlertDialogCancel type="button">{t("comments.keep")}</AlertDialogCancel>
                                  <Button type="submit" variant="destructive">
                                    {t("comments.deleteConfirm")}
                                  </Button>
                                </AlertDialogFooter>
                              </form>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                      <p className="mt-1 leading-relaxed break-words whitespace-pre-wrap">{each.body}</p>
                    </li>
                  ))}
                </ol>
              )}
              {comments.canPost && commentForm}
            </div>
          )}
        </Glass>
      )}
    </main>
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

// The small spaced capitals used for the eyebrow, the tile headings, and the sticker.
const label = "text-xs font-medium tracking-label uppercase";

export function SectionLabel({ icon: Icon, children }: { icon?: React.ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <h2 className={cn(label, "mb-3 flex items-center gap-2 text-theme-text-faint")}>
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </h2>
  );
}

// The date at a glance, top right of the poster card, or beside the title below a host's poster
// (a title set on the poster goes without it). The When tile carries the full date for
// assistive technology, so this one is decorative.
function DateSticker({ weekday, day, month }: { weekday: string; day: string; month: string }) {
  return (
    <Glass strong aria-hidden className="flex min-w-14 flex-col items-center rounded-2xl px-3 py-2 text-center">
      <span className={cn(label, "text-theme-text-faint")}>{weekday}</span>
      <span className="text-2xl leading-none font-semibold">{day}</span>
      <span className={cn(label, "text-theme-text-muted")}>{month}</span>
    </Glass>
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
