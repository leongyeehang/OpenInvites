import { ChevronDown, Clock, Lock, MapPin, Megaphone, MessageCircle, Users } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Fragment, type ReactNode } from "react";
import type { CommentsShown } from "@/comments/visibility";
import type { EventWithHost } from "@/events/repository";
import { formatMoment, formatWhen } from "@/events/time";
import { cn } from "@/lib/utils";
import { RichTextView } from "@/rich-text/rich-text-view";
import type { RsvpCounts } from "@/rsvps/counts";
import type { PublicGuest } from "@/rsvps/repository";
import { Glass } from "./glass";
import { initialsOf } from "./poster-layout";
import { CommentsSection } from "./sections/comments-section";
import type { ShownAnnouncement } from "./sections/announcements-section";
import { arriving, BubbleLabel, HOST_BUBBLE, HostBubble } from "./thread-bubble";
import { ThreadCard } from "./thread-card";

// The guest list as the event page may show it to this viewer (rsvps/visibility.ts): the names,
// or, under "after you reply", only a promise of them. Hidden, there is none, nor any count.
export type ThreadGuests = { view: "open" | "locked"; guests: PublicGuest[]; counts: RsvpCounts; you?: string };

// The Thread layout (spec, "Thread", from the prototype's layout-thread.tsx): the invitation as a
// chat with the host, in one column at most 28rem wide at every width. A header names the hosts.
// Then the host's bubbles, in order: the invitation as a card, the description, when, where,
// who's coming, each announcement, the comments; then `rsvp`, the conversation the guest has
// with the host (the RSVP flow as Thread presents it) and the composer they answer in, which stays
// at the foot of the screen. It renders inside a ThemedPage, which carries the theme and paints
// the backdrop; the layout paints none of its own, so the effects show between the bubbles.
//
// Every word sits on a surface legibility.ts solves: the header and the composer are glass, the
// host's bubbles strong glass (thread-bubble.tsx), the line that says when the invitation was sent
// the veil. The comments bubble is glass, as the Poster's comments tile is, because the comment
// box in it is strong glass, which is solved on glass.
export async function ThreadLayout({
  event,
  hosts,
  announcements,
  comments,
  commentForm,
  notice,
  rsvp,
  guests,
  underWhen,
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
  // The conversation and the composer: the RSVP flow as the Thread presents it.
  rsvp?: ReactNode;
  // The guest list and its counts as this viewer may see them, absent when the host hides it.
  guests?: ThreadGuests;
  // What the guest's own device adds: their clock and the countdown on it, their maps app.
  underWhen?: ReactNode;
  underWhere?: ReactNode;
}) {
  const [t, locale, format] = await Promise.all([getTranslations("EventPage"), getLocale(), getFormatter()]);
  const sent = format.dateTime(event.publishedAt ?? event.createdAt, { timeZone: event.timeZone, day: "numeric", month: "short" });
  // How many have replied is a number the guest list's visibility gives away only with the list.
  const replies = guests?.view === "open" ? guests.counts.going + guests.counts.maybe + guests.counts.cant : undefined;

  // The host's bubbles in order, each given the classes that bring it in.
  const bubbles: ((className: string) => ReactNode)[] = [
    (className) => <ThreadCard title={event.title} invited={t("thread.invited")} when={formatWhen(event, locale)} className={className} />,
  ];
  if (event.descriptionRich.blocks.length > 0) {
    bubbles.push((className) => (
      <HostBubble data-slot="description" className={className}>
        <RichTextView doc={event.descriptionRich} />
      </HostBubble>
    ));
  }
  bubbles.push((className) => (
    <HostBubble className={className}>
      <BubbleLabel icon={Clock}>{t("when")}</BubbleLabel>
      <p className="font-medium">{formatWhen(event, locale)}</p>
      {underWhen}
    </HostBubble>
  ));
  if (event.location) {
    bubbles.push((className) => (
      <HostBubble className={className}>
        <BubbleLabel icon={MapPin}>{t("where")}</BubbleLabel>
        <p className="font-medium">{event.location}</p>
        {underWhere}
      </HostBubble>
    ));
  }
  if (guests) bubbles.push((className) => <WhoIsComing {...guests} className={className} />);
  // In the order they were sent, as a conversation reads.
  for (const each of [...announcements].reverse()) {
    bubbles.push((className) => (
      <HostBubble data-slot="announcement" className={className}>
        <p className="flex items-center gap-1.5 text-xs text-theme-text-faint">
          <Megaphone className="size-3.5" aria-hidden />
          {t("announcements")} · <time dateTime={each.createdAt.toISOString()}>{formatMoment(each.createdAt, event.timeZone, locale)}</time>
        </p>
        <p className="mt-1 whitespace-pre-wrap">{each.body}</p>
      </HostBubble>
    ));
  }
  if (comments) {
    const section = <CommentsSection comments={comments} form={commentForm} slug={event.slug} timeZone={event.timeZone} />;
    bubbles.push((className) =>
      // Only how many there are, to a guest who has not replied: nothing to open.
      comments.view === "locked" ? (
        <div data-slot="comments" className={cn(HOST_BUBBLE, "bg-theme-glass", className)}>
          {section}
        </div>
      ) : (
        <details data-slot="comments" className={cn(HOST_BUBBLE, "group w-[85%] bg-theme-glass", className)}>
          <summary className="-mx-1 flex cursor-pointer list-none items-center gap-2 rounded-lg px-1 font-medium [&::-webkit-details-marker]:hidden">
            <MessageCircle className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{t("comments.count", { count: comments.comments.length })}</span>
            <ChevronDown className="size-4 shrink-0 group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-4">{section}</div>
        </details>
      ),
    );
  }

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

      <div className="flex flex-col gap-2">
        {bubbles.map((bubble, index) => (
          <Fragment key={index}>{bubble(arriving(index))}</Fragment>
        ))}
      </div>
      {rsvp}
    </main>
  );
}

// Who's coming, as a host's bubble: everyone who has replied, with what they said, the viewer's
// own line marked; or, before the guest has replied under "after you reply", a blurred pile and
// the promise of the names, of which nothing reaches the browser.
async function WhoIsComing({ view, guests, counts, you, className }: ThreadGuests & { className: string }) {
  const t = await getTranslations("EventPage");
  return (
    <HostBubble data-slot="guests" className={className}>
      <BubbleLabel icon={Users}>{t("thread.guests")}</BubbleLabel>
      {view === "locked" ? (
        <div className="flex items-center gap-3">
          <div aria-hidden className="flex -space-x-1.5 blur-[3px]">
            {[0, 1, 2, 3].map((index) => (
              <span key={index} className="size-6 rounded-full bg-current/25 ring-2 ring-theme-glass-border" />
            ))}
          </div>
          <p className="inline-flex items-center gap-1 text-sm text-theme-text-faint">
            <Lock className="size-3.5" aria-hidden /> {t("thread.locked")}
          </p>
        </div>
      ) : guests.length === 0 ? (
        <p>{t("nobodyYet")}</p>
      ) : (
        <>
          <p className="font-medium">
            {t("headcount", { count: counts.headcount })}
            {counts.maybe > 0 && <span className="font-normal text-theme-text-faint"> · {t("alsoMaybe", { count: counts.maybe })}</span>}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {guests.map((guest) => (
              <li key={guest.id} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-medium",
                    guest.id === you ? "bg-theme-accent text-theme-on-accent" : "ring-1 ring-current/30",
                  )}
                >
                  {initialsOf(guest.name)}
                </span>
                <span className="min-w-0 flex-1">
                  {guest.name}
                  {guest.id === you && <span className="text-theme-text-faint"> {t("thread.you")}</span>}
                  {guest.plusOnes > 0 && <span className="text-theme-text-faint"> +{guest.plusOnes}</span>}
                </span>
                <span className="shrink-0 text-sm text-theme-text-faint">{t(`status.${guest.status}`)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </HostBubble>
  );
}
