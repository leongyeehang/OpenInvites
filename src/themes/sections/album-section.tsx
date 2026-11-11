import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { VideoCaps } from "@/album/video";
import type { AlbumVisibility } from "@/album/visibility";
import { Album, type Keeps, type ShownPhoto } from "./album";

export { ALBUM_HEADING } from "./album";

// What the album shows this viewer (M4 ticket 11, album/album.ts; M6 ticket 03,
// album/visibility.ts): before the start, the day it opens; to someone the album is locked to, how
// many photos it shows and what opens it, which depends on who the host lets see it and, for a
// guest whose reply awaits the host's approval, on that approval (M6 ticket 10); to a guest who
// may add but not see, their own photos and why; to the hosts and the guests who see it, the
// photos, and the way to add theirs, with what the host keeps of each (media part review).
type AlbumProps = { photos: ShownPhoto[]; maxMegabytes: number; video: VideoCaps; keeps: Keeps };

export type AlbumShown =
  | { view: "notYet"; opensOn: string }
  | { view: "locked"; count: number; visibility: AlbumVisibility; awaitingApproval: boolean }
  | ({ view: "own"; why: "going" | "hosts" } & AlbumProps)
  | ({ view: "open" } & AlbumProps);

const LOCKED = { replied: "locked", going: "lockedGoing", hosts: "lockedHosts" } as const;
const YOURS = { going: "yoursGoing", hosts: "yoursHosts" } as const;

export async function AlbumSection({ album, slug }: { album: AlbumShown; slug: string }) {
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
        <Album slug={slug} photos={album.photos} maxMegabytes={album.maxMegabytes} video={album.video} keeps={album.keeps} />
      </div>
    );
  }
  return <Album slug={slug} photos={album.photos} maxMegabytes={album.maxMegabytes} video={album.video} keeps={album.keeps} />;
}
