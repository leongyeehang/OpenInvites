import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { albumState, mayApprovePhoto, mayCaption, mayDeletePhoto, seesProcessing, type AlbumViewer } from "@/album/album";
import { albumOrderFor, formatTaken, keepDetailsOf, keptNotice, shownDetails } from "@/album/details";
import { ffmpegStatus } from "@/album/ffmpeg";
import { motionUrl, photoUrl } from "@/album/files";
import { countPhotos, listPhotos } from "@/album/repository";
import { copyName, effectiveVideoCaps, shownFailure, videoSizes, videoUrl, type VideoCaps } from "@/album/video";
import { albumViewer } from "@/album/viewer";
import { albumView, photoScope, type AlbumVisibility } from "@/album/visibility";
import type { EventWithHost } from "@/events/repository";
import { formatDay } from "@/events/time";
import { featureOn, siteFeatures } from "@/features";
import { instanceLimits } from "@/instance/repository";
import type { SectionDrawing } from "@/sections";
import { albumVotingFor } from "@/voting";
import { Album, ALBUM_HEADING, type AlbumSlot, type AlbumStyle, type Keeps, type ShownPhoto } from "./album";
import type { SectionPage } from "./drawings";

export { ALBUM_HEADING } from "./album";

// What the album shows this viewer (M4 ticket 11, album/album.ts; M6 ticket 03,
// album/visibility.ts): before the start, the day it opens; to someone the album is locked to, how
// many photos it shows and what opens it, which depends on who the host lets see it and, for a
// guest whose reply awaits the host's approval, on that approval (M6 ticket 10); to a guest who
// may add but not see, their own photos and why; to the hosts and the guests who see it, the
// photos, and the way to add theirs, with what the host keeps of each (media part review); and to
// those who see every item, what the album vote draws in it while there is one (M8 ticket 12).
type AlbumProps = { photos: ShownPhoto[]; maxMegabytes: number; video: VideoCaps; keeps: Keeps };

export type AlbumShown =
  | { view: "notYet"; opensOn: string }
  | { view: "locked"; count: number; visibility: AlbumVisibility; awaitingApproval: boolean }
  | ({ view: "own"; why: "going" | "hosts" } & AlbumProps)
  | ({ view: "open"; slot?: AlbumSlot } & AlbumProps);

const LOCKED = { replied: "locked", going: "lockedGoing", hosts: "lockedHosts" } as const;
const YOURS = { going: "yoursGoing", hosts: "yoursHosts" } as const;

// In the host's style (M8 ticket 30); locked, or before it opens, there is nothing to draw in one.
export async function AlbumSection({ album, slug, style }: { album: AlbumShown; slug: string; style: AlbumStyle }) {
  const t = await getTranslations("EventPage.album");
  if (album.view === "notYet") return <p className="text-sm text-theme-text-muted">{t("opensOn", { date: album.opensOn })}</p>;
  if (album.view === "locked") {
    return (
      <>
        <p className="text-lg font-medium">{t("lockedCount", { count: album.count })}</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-theme-text-faint">
          <Lock className="size-3.5" aria-hidden />{" "}
          {album.awaitingApproval ? t("lockedPending", { visibility: album.visibility }) : t(LOCKED[album.visibility])}
        </p>
      </>
    );
  }
  if (album.view === "own") {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="font-medium">{t("yours")}</h3>
          <p className="mt-0.5 text-sm text-theme-text-muted">{t(YOURS[album.why])}</p>
        </div>
        <Album slug={slug} photos={album.photos} maxMegabytes={album.maxMegabytes} video={album.video} keeps={album.keeps} style={style} />
      </div>
    );
  }
  return <Album slug={slug} photos={album.photos} maxMegabytes={album.maxMegabytes} video={album.video} keeps={album.keeps} slot={album.slot} style={style} />;
}

// What the album shows this viewer (album/album.ts, album/visibility.ts), or nothing where there is
// no album, which every event is while the operator has the Album switched off (M8 ticket 01),
// and an event whose host has switched it off (ticket 25).
// Locked, it says how many photos it shows, which counts approved photos only; otherwise the
// photos this viewer may see, each marked when it waits for approval, and approvable by a host.
// An open item's technical line and the details the host keeps (M8 ticket 07) are written here, a
// detail whose switch is off left out, so no page carries it; each item's caption, and whether this
// viewer may change it (M8 ticket 09). Who added each item is left out where this viewer may not
// see it (M8 ticket 11): the album vote decides, per item, before anything is sent, and the
// camera that took it goes with the name (ticket 12). While there is a vote, the open album carries
// what the vote draws in it (ticket 12).
export async function albumFor(event: EventWithHost, viewer: AlbumViewer, locale: string, now: Date): Promise<AlbumShown | undefined> {
  const switches = await siteFeatures();
  const state = albumState(event, now, featureOn(switches, "album"));
  if (state === "none" || !event.startsAt) return undefined;
  if (state === "notYet") return { view: "notYet", opensOn: formatDay(event.startsAt, event.timeZone, locale) };
  const view = albumView(event, viewer);
  if (view === "locked" || viewer.kind === "visitor") {
    const awaitingApproval = viewer.kind === "guest" && viewer.approval === "pending";
    return { view: "locked", count: await countPhotos(event.id, "approved"), visibility: event.albumVisibility, awaitingApproval };
  }
  const listed = await listPhotos(event.id, photoScope(view, viewer), albumOrderFor(event));
  // Each with its thumbnail and who added it, for the vote's Winners strip (M8 ticket 16), which
  // passes a name on only where this viewer is shown it.
  const items = listed.map(({ id, kind, status, rsvpId, hostId, name }) => ({
    id,
    kind,
    status,
    rsvpId,
    hostId,
    name,
    thumb: kind === "photo" ? photoUrl(id, "thumb") : status === "processing" || status === "failed" ? null : videoUrl(id, "thumb"),
  }));
  const voting = await albumVotingFor({ event, viewer, view, items, now });
  const photos: ShownPhoto[] = listed.map((each) => {
    const named = voting.showsName(each);
    // Its caption (M8 ticket 09) is the uploader's words, not a detail of the file: no switch of
    // the host's hides it.
    const base = {
      id: each.id,
      name: named ? each.name : null,
      deletable: mayDeletePhoto(viewer, each),
      pending: each.status === "pending",
      approvable: each.status === "pending" && mayApprovePhoto(viewer),
      caption: each.caption,
      captionEditable: mayCaption(viewer, each),
    };
    const taken = event.albumKeepTakenAt ? each.takenAt : null;
    const details = { details: shownDetails(each, event, named), takenAt: taken && formatTaken(taken, event.timeZone, locale), takenAtIso: taken && taken.toISOString() };
    // A live photo carries its motion (M8 ticket 08), and one whose motion is being made says so
    // to its uploader and the hosts alone, whose pages refresh until it is made (media part review).
    if (each.kind === "photo") {
      const live = { motion: each.live ? motionUrl(each.id) : null, motionPending: each.motionPending && seesProcessing(viewer, each) };
      return { ...base, ...details, ...live, kind: "photo", thumb: photoUrl(each.id, "thumb"), large: photoUrl(each.id, "large"), width: each.width ?? 0, height: each.height ?? 0 };
    }
    // A video (M7 ticket 07): processing or failed shows as such, a failure by the reason the tile
    // names and never the processor's text; ready shows its files.
    if (each.status === "processing" || each.status === "failed") return { ...base, kind: "video", state: each.status, failure: shownFailure(each.failure) };
    // Every size it plays at, the original first, each with its file (M8 ticket 06), and whether
    // the original is HDR, for its badge.
    const sizes = videoSizes(each).map((size) => ({ ...size, src: videoUrl(each.id, size.name === "original" ? "original" : copyName(size.name)) }));
    return {
      ...base,
      ...details,
      kind: "video",
      state: "ready",
      thumb: videoUrl(each.id, "thumb"),
      poster: videoUrl(each.id, "poster"),
      original: videoUrl(each.id, "original"),
      sizes,
      hdr: each.details.hdr !== undefined,
      codec: each.codec ?? "",
      durationMs: each.durationMs ?? 0,
      width: each.width ?? 0,
      height: each.height ?? 0,
    };
  });
  // Largest photo on Site settings (M7 ticket 01), for the album's hint and its refusals, and the
  // video caps the browser checks a clip against before sending it (ticket 07), which take no
  // video while the operator has Videos switched off (M8 ticket 01).
  const limits = await instanceLimits();
  const maxMegabytes = limits.maxPhotoMb;
  const video = effectiveVideoCaps(event, {
    maxVideoMb: limits.maxVideoMb,
    maxVideoMinutes: limits.maxVideoMinutes,
    videosAvailable: ffmpegStatus().available,
    videosOn: featureOn(switches, "videos"),
  });
  // What the host keeps of each item added, said where it is added (media part review).
  const keeps = keptNotice(keepDetailsOf(event));
  // A guest who may add but not see is shown their own, and why: the album is for those Going, or
  // the hosts keep it.
  if (view === "own") return { view: "own", why: event.albumVisibility === "going" ? "going" : "hosts", photos, maxMegabytes, video, keeps };
  return { view: "open", photos, maxMegabytes, video, keeps, ...(voting.slot && { slot: voting.slot }) };
}

// The album as a section (M8 ticket 25), which works out its own viewer (album/viewer.ts), so that
// nothing outside src/album newly reads the album's internals. The count beside a collapsed
// heading is how many items it shows this viewer, or, locked, how many it holds. It is drawn in the
// host's style, the same in every layout (ticket 30).
export const albumDrawing: SectionDrawing<{ album: AlbumShown; slug: string }, SectionPage> = {
  load: async ({ event, locale, now }) => {
    const album = await albumFor(event, await albumViewer(event.id), locale, now);
    return album && { album, slug: event.slug };
  },
  shown: ({ album }) => ({ count: album.view === "notYet" ? null : album.view === "locked" ? album.count : album.photos.length, locked: album.view === "locked" }),
  headingId: ALBUM_HEADING,
  body: (data, _layout, placed) => <AlbumSection {...data} style={placed.section.kind === "album" ? placed.section.style : "grid"} />,
};
