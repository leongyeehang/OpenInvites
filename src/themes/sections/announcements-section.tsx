import { getLocale } from "next-intl/server";
import type { Announcement } from "@/announcements/repository";
import { formatMoment } from "@/events/time";
import type { SectionDrawing } from "@/sections";
import type { SectionPage } from "./drawings";

// One of the host's announcements as the event page shows it.
export type ShownAnnouncement = Pick<Announcement, "id" | "body" | "createdAt">;

// The host's announcements, newest first, as every layout shows them under "From the host". Each
// is dated in the event's zone, as everything on the page is, and keeps its line breaks and
// spaces; nothing else in it is formatted. The layout frames it and gives it its heading.
export async function AnnouncementsSection({ announcements, timeZone }: { announcements: ShownAnnouncement[]; timeZone: string }) {
  const locale = await getLocale();
  return (
    <ol className="flex flex-col gap-4">
      {announcements.map((each) => (
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

// The announcements as a section (M8 ticket 25): there once the host has sent one.
export const announcementsDrawing: SectionDrawing<{ announcements: ShownAnnouncement[]; timeZone: string }, SectionPage> = {
  load: async ({ announcements, event }) => (announcements.length > 0 ? { announcements, timeZone: event.timeZone } : undefined),
  shown: ({ announcements }) => ({ count: announcements.length }),
  body: (data) => <AnnouncementsSection {...data} />,
};
