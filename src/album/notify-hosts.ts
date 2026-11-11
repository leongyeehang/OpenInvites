import { eq, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { after } from "next/server";
import { getDb } from "@/db/client";
import { event, photo, rsvp, user } from "@/db/schema";
import { eventHosts } from "@/events/hosts";
import type { Event } from "@/events/repository";
import { eventUrl } from "@/events/slug";
import { baseUrl } from "@/instance/env";
import { formatSize } from "@/lib/sizes";
import { translatorFor } from "@/locale/messages";
import { isMailConfigured } from "@/mail/config";
import { queueMail } from "@/mail/outbox";
import { kickMailWorker } from "@/mail/worker";
import type { AlbumTotals } from "./album";

// Emails every host of the event once about items that wait for their approval, when the event
// has it on and the site has mail (spec, "The album: who sees it, and approval"): who added them,
// how many photos and videos, and the event link, where the hosts approve them. Only a guest's
// items wait, so no host is told of their own. The mail is in the event's language, as the hosts'
// other emails are. Neither sender throws: the items are already added, and a failure here must
// not tell the guest otherwise, so it is logged instead.

export type ItemsPosted = { name: string; photos: number; videos: number };

type AlbumEvent = Pick<Event, "id" | "slug" | "customSlug" | "title" | "notifyOnPhoto" | "locale">;

async function queueItemsMail(found: AlbumEvent, posted: ItemsPosted, write: (key: "subject" | "body", values: Record<string, string | number>) => string): Promise<void> {
  const values = { name: posted.name, photos: posted.photos, videos: posted.videos, title: found.title, url: eventUrl(found) };
  const subject = write("subject", values);
  const text = write("body", values);
  const hosts = await eventHosts(found.id);
  await queueMail(hosts.map((host) => ({ eventId: found.id, to: host.email, subject, text })));
}

// From a request (the finish of a batch of photos, M7 ticket 06): the last finish of a batch
// sends one email for the batch, as one post did (M6 ticket 04).
export async function notifyHostsOfItems(found: AlbumEvent, posted: ItemsPosted): Promise<void> {
  if (!found.notifyOnPhoto || !isMailConfigured()) return;
  try {
    const t = await getTranslations({ locale: found.locale, namespace: "Mail.photos" });
    await queueItemsMail(found, posted, (key, values) => t(key, values));
    after(kickMailWorker);
  } catch (error) {
    console.error(`Mail: could not queue the hosts' email about items added to event ${found.id}:`, error);
  }
}

// From the queue (no request to translate in, so translatorFor; no after(), so the worker is
// kicked and not awaited): a video that reached pending once processed.
export async function notifyHostsOfVideo(photoId: string): Promise<void> {
  if (!isMailConfigured()) return;
  try {
    const [row] = await getDb()
      .select({
        id: event.id,
        slug: event.slug,
        customSlug: event.customSlug,
        title: event.title,
        notifyOnPhoto: event.notifyOnPhoto,
        locale: event.locale,
        name: sql<string>`coalesce(${rsvp.name}, ${user.name}, '')`,
      })
      .from(photo)
      .innerJoin(event, eq(event.id, photo.eventId))
      .leftJoin(rsvp, eq(rsvp.id, photo.rsvpId))
      .leftJoin(user, eq(user.id, photo.hostId))
      .where(eq(photo.id, photoId));
    if (!row || !row.notifyOnPhoto) return;
    const t = await translatorFor(row.locale);
    await queueItemsMail(row, { name: row.name, photos: 0, videos: 1 }, (key, values) => t(`Mail.photos.${key}`, values));
    void kickMailWorker();
  } catch (error) {
    console.error(`Mail: could not queue the hosts' email about video ${photoId}:`, error);
  }
}

// The site's operator cleared the album (M7 ticket 10): every host is told what went, with the
// manage page, in the event's language. From a request; never throws, since the album is already
// empty and the operator's page must say so.
export async function notifyHostsOfClearedAlbum(found: Pick<Event, "id" | "title" | "locale">, went: AlbumTotals): Promise<void> {
  if (!isMailConfigured()) return;
  try {
    const t = await getTranslations({ locale: found.locale, namespace: "Mail.albumCleared" });
    const values = { title: found.title, photos: went.photos, videos: went.videos, size: formatSize(went.bytes, found.locale), url: `${baseUrl()}/events/${found.id}` };
    const subject = t("subject", values);
    const text = t("body", values);
    const hosts = await eventHosts(found.id);
    await queueMail(hosts.map((host) => ({ eventId: found.id, to: host.email, subject, text })));
    after(kickMailWorker);
  } catch (error) {
    console.error(`Mail: could not queue the hosts' email about the cleared album of event ${found.id}:`, error);
  }
}

