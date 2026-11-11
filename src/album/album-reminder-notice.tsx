"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatSize } from "@/lib/sizes";
import { cn } from "@/lib/utils";
import type { AlbumTotals } from "./album";
import { EmptyAlbumDialog } from "./empty-album-dialog";
import { keepAlbumAction } from "./host-actions";

// The reminder as the hosts meet it (M7 ticket 09): on the manage page, among its notices, and on
// the dashboard, one per reminded event: what the album holds, Empty the album (confirmed) and
// Keep it, which answers the reminder by choosing never.
export function AlbumReminderNotice({ eventId, album, title, className }: { eventId: string; album: AlbumTotals; title?: string; className?: string }) {
  const t = useTranslations("Events.album");
  const locale = useLocale();
  const [keeping, startKeeping] = useTransition();
  return (
    <div data-slot="album-reminder" className={cn("flex flex-col gap-2 text-sm", className)}>
      {title && <p className="font-medium">{title}</p>}
      <p>{t("noticeText", { photos: album.photos, videos: album.videos, size: formatSize(album.bytes, locale) })}</p>
      <div className="flex flex-wrap gap-2">
        <EmptyAlbumDialog
          eventId={eventId}
          album={album}
          trigger={
            <Button size="sm" variant="destructive">
              {t("empty")}
            </Button>
          }
        />
        <Button size="sm" variant="outline" disabled={keeping} onClick={() => startKeeping(() => keepAlbumAction(eventId))}>
          {t("keep")}
        </Button>
      </div>
    </div>
  );
}
