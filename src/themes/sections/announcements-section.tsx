import { Megaphone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { Announcement } from "@/announcements/repository";
import { formatMoment } from "@/events/time";
import type { SectionDrawing } from "@/sections";
import { HostBubble } from "../thread-bubble";
import type { SectionPage } from "./drawings";

// One of the host's announcements as the event page shows it.
export type ShownAnnouncement = Pick<Announcement, "id" | "body" | "createdAt">;

// The host's announcements, newest first, as every layout shows them under "From the host"; the
// Thread's collapsed section oldest first, as its bubbles are (ticket 27's review). Each is dated
// in the event's zone, as everything on the page is, and keeps its line breaks and spaces;
// nothing else in it is formatted. The layout frames it and gives it its heading.
async function AnnouncementsSection({
  announcements,
  timeZone,
  oldestFirst = false,
}: {
  announcements: ShownAnnouncement[];
  timeZone: string;
  oldestFirst?: boolean;
}) {
  const locale = await getLocale();
  return (
    <ol className="flex flex-col gap-4">
      {(oldestFirst ? [...announcements].reverse() : announcements).map((each) => (
        <li key={each.id}>
          <p className="text-sm text-theme-text-faint">
            <time dateTime={each.createdAt.toISOString()}>{formatMoment(each.createdAt, timeZone, locale)}</time>
          </p>
          <p className="mt-1 leading-relaxed break-words whitespace-pre-wrap">{each.body}</p>
        </li>
      ))}
    </ol>
  );
}

// The announcements in the Thread (M8 ticket 27): one host's bubble each, in the order they were
// sent, as a conversation reads, each dated under the section's heading and carrying its key, so
// they move, and arrive, together.
async function ThreadAnnouncements({
  announcements,
  timeZone,
  heading,
  sectionKey,
  className,
}: AnnouncementsData & { heading: string | null; sectionKey: string; className: string }) {
  const [t, locale] = await Promise.all([getTranslations("EventPage"), getLocale()]);
  return [...announcements].reverse().map((each) => (
    <HostBubble key={each.id} data-slot="announcement" data-section={sectionKey} className={className}>
      <p className="flex items-center gap-1.5 text-xs text-theme-text-faint">
        <Megaphone className="size-3.5" aria-hidden />
        {heading ?? t("announcements")} · <time dateTime={each.createdAt.toISOString()}>{formatMoment(each.createdAt, timeZone, locale)}</time>
      </p>
      <p className="mt-1 whitespace-pre-wrap">{each.body}</p>
    </HostBubble>
  ));
}

type AnnouncementsData = { announcements: ShownAnnouncement[]; timeZone: string };

// The announcements as a section (M8 ticket 25): there once the host has sent one.
export const announcementsDrawing: SectionDrawing<AnnouncementsData, SectionPage> = {
  load: async ({ announcements, event }) => (announcements.length > 0 ? { announcements, timeZone: event.timeZone } : undefined),
  shown: ({ announcements }) => ({ count: announcements.length }),
  body: (data, layout) => <AnnouncementsSection {...data} oldestFirst={layout === "thread"} />,
  whole: {
    thread: (data, placed, className) => <ThreadAnnouncements {...data} heading={placed.heading} sectionKey={placed.key} className={className} />,
  },
};
