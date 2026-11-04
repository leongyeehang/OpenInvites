import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Album, type ShownPhoto } from "./album";

export { ALBUM_HEADING } from "./album";

// What the album shows this viewer (M4 ticket 11, album/album.ts): before the start, the day it
// opens; to someone who may not use it, how many photos there are and that replying opens them; to
// the hosts and an approved guest, the photos, and the way to add theirs.
export type AlbumShown =
  | { view: "notYet"; opensOn: string }
  | { view: "locked"; count: number }
  | { view: "open"; photos: ShownPhoto[]; maxMegabytes: number };

export async function AlbumSection({ album, slug }: { album: AlbumShown; slug: string }) {
  const t = await getTranslations("EventPage.album");
  if (album.view === "notYet") return <p className="text-sm text-theme-text-muted">{t("opensOn", { date: album.opensOn })}</p>;
  if (album.view === "locked") {
    return (
      <>
        <p className="text-lg font-medium">{t("lockedCount", { count: album.count })}</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-theme-text-faint">
          <Lock className="size-3.5" aria-hidden /> {t("locked")}
        </p>
      </>
    );
  }
  return <Album slug={slug} photos={album.photos} maxMegabytes={album.maxMegabytes} />;
}
