"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
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
import { formatSize } from "@/lib/sizes";
import type { AlbumTotals } from "./album";
import { emptyAlbumAction } from "./host-actions";

// Emptying the album (M7 ticket 09): one confirmed step that names what goes, from the Settings
// sheet, the manage page's reminder and the dashboard's. The dialog closes once the album is empty.
export function EmptyAlbumDialog({ eventId, album, trigger }: { eventId: string; album: AlbumTotals; trigger?: ReactNode }) {
  const t = useTranslations("Events.album");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger ?? <Button variant="destructive">{t("empty")}</Button>}</AlertDialogTrigger>
      <AlertDialogContent>
        <form
          action={async () => {
            await emptyAlbumAction(eventId);
            setOpen(false);
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t("emptyTitle", { photos: album.photos, videos: album.videos, size: formatSize(album.bytes, locale) })}</AlertDialogTitle>
            <AlertDialogDescription>{t("emptyText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4">
            <AlertDialogCancel type="button">{t("cancel")}</AlertDialogCancel>
            <Button type="submit" variant="destructive">
              {t("emptyConfirm")}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
