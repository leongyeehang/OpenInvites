"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { ALBUM_REMINDER_CHOICES, type AlbumTotals } from "@/album/album";
import { EmptyAlbumDialog } from "@/album/empty-album-dialog";
import { setAlbumReminderAction } from "@/album/host-actions";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useEditor } from "./status";

// The album's own controls in the Settings sheet (M7 ticket 09), after its form, which posts every
// field on every change: when to be reminded about the album, saved on its own through the editor's
// save status, and Empty the album, confirmed, while the album holds anything. The parent keys this
// on the days, so a choice made elsewhere (Keep it) shows here after the page refreshes.
export function AlbumBlock({ eventId, album, reminderDays }: { eventId: string; album: AlbumTotals; reminderDays: number | null }) {
  const t = useTranslations("Events.album");
  const { save } = useEditor();
  const id = useId();
  const choose = (value: string) => {
    const days = value === "never" ? null : Number(value);
    void save(async () => {
      await setAlbumReminderAction(eventId, days);
      return { saved: true };
    });
  };
  return (
    <FieldGroup className="mt-6">
      <Field>
        <FieldLabel htmlFor={`${id}-remind`}>{t("remind")}</FieldLabel>
        <NativeSelect id={`${id}-remind`} defaultValue={reminderDays === null ? "never" : String(reminderDays)} aria-describedby={`${id}-remind-hint`} onChange={(event) => choose(event.target.value)}>
          {ALBUM_REMINDER_CHOICES.map((days) => (
            <NativeSelectOption key={days} value={String(days)}>
              {t("days", { count: days })}
            </NativeSelectOption>
          ))}
          <NativeSelectOption value="never">{t("never")}</NativeSelectOption>
        </NativeSelect>
        <FieldDescription id={`${id}-remind-hint`}>{t("remindHint")}</FieldDescription>
      </Field>
      {album.photos + album.videos > 0 && (
        <div>
          <EmptyAlbumDialog eventId={eventId} album={album} />
        </div>
      )}
    </FieldGroup>
  );
}
