"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveScheduleAction } from "@/events/editor-actions";
import { MAX_ITEMS, MAX_NOTE, MAX_PLACE, MAX_TITLE, SCHEDULE_REFRESH, type ScheduleItemInput, type ScheduleRefresh } from "@/schedule/schedule";
import type { EditableDetails } from "./details";
import { Footer, useSaving } from "./saving";
import { EditorSheet } from "./sheet";

// The schedule's sheet (M6 ticket 01), opened from the details list's Schedule row: the day's items
// as rows the host adds, fills and removes, saved as a whole with Done, in day-and-time order, and
// at its foot how guests' open pages pick up a change. A refusal names the row and keeps the sheet
// open. On the keyboard, a new row takes the focus at its first field, and removing the last row
// gives it to "Add an item" rather than losing it (M6 ticket 10); removing another leaves it on the
// same button, which then removes the row that took its place.
export function ScheduleSheet({ open, onOpenChange, details }: { open: boolean; onOpenChange: (open: boolean) => void; details: EditableDetails }) {
  const t = useTranslations("Editor");
  return (
    <EditorSheet open={open} onOpenChange={onOpenChange} title={t("schedule")} tall>
      <ScheduleForm details={details} onOpenChange={onOpenChange} />
    </EditorSheet>
  );
}

// The sheet's form, made afresh each time the sheet opens, so it starts from the schedule as saved.
function ScheduleForm({ details, onOpenChange }: { details: EditableDetails; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("Editor.scheduleSheet");
  const editor = useTranslations("Editor");
  const id = useId();
  const saving = useSaving(onOpenChange);
  const [rows, setRows] = useState<ScheduleItemInput[]>(() =>
    details.schedule.items.map(({ day, startTime, endTime, title, place, note }) => ({ day, startTime, endTime: endTime ?? "", title, place, note })),
  );
  const [refresh, setRefresh] = useState<ScheduleRefresh>(details.schedule.refresh);
  const change = (index: number, field: keyof ScheduleItemInput, value: string) => setRows((all) => all.map((row, at) => (at === index ? { ...row, [field]: value } : row)));
  // A new item starts on the event's day, which most schedules keep to; an undated event has none.
  const eventDay = details.start.slice(0, 10);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void saving.run(() => saveScheduleAction(details.eventId, { items: rows, refresh }));
      }}
    >
      <FieldGroup>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
        {rows.length > 0 && (
          <ol className="flex flex-col gap-4">
            {rows.map((row, index) => {
              const n = index + 1;
              const field = (name: string) => `${id}-${index}-${name}`;
              return (
                <li key={index} className="flex flex-col gap-2 rounded-2xl border p-3">
                  <div className="flex items-end gap-2">
                    <Field className="flex-1">
                      <FieldLabel htmlFor={field("day")} className="text-xs">
                        {t("day", { n })}
                      </FieldLabel>
                      <Input id={field("day")} type="date" value={row.day} onChange={(event) => change(index, "day", event.target.value)} />
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("removeItem", { n })}
                      onClick={(event) => {
                        const removing = event.currentTarget;
                        flushSync(() => setRows((all) => all.filter((_, at) => at !== index)));
                        if (!removing.isConnected) document.getElementById(`${id}-add`)?.focus();
                      }}
                    >
                      <X aria-hidden />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field>
                      <FieldLabel htmlFor={field("start")} className="text-xs">
                        {t("start", { n })}
                      </FieldLabel>
                      <Input id={field("start")} type="time" value={row.startTime} onChange={(event) => change(index, "startTime", event.target.value)} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={field("end")} className="text-xs">
                        {t("end", { n })}
                      </FieldLabel>
                      <Input id={field("end")} type="time" value={row.endTime} onChange={(event) => change(index, "endTime", event.target.value)} />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor={field("title")} className="text-xs">
                      {t("title", { n })}
                    </FieldLabel>
                    <Input id={field("title")} value={row.title} maxLength={MAX_TITLE} onChange={(event) => change(index, "title", event.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={field("place")} className="text-xs">
                      {t("place", { n })}
                    </FieldLabel>
                    <Input id={field("place")} value={row.place} maxLength={MAX_PLACE} onChange={(event) => change(index, "place", event.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={field("note")} className="text-xs">
                      {t("note", { n })}
                    </FieldLabel>
                    <Textarea id={field("note")} rows={2} value={row.note} maxLength={MAX_NOTE} onChange={(event) => change(index, "note", event.target.value)} />
                  </Field>
                </li>
              );
            })}
          </ol>
        )}
        {rows.length < MAX_ITEMS && (
          <Button
            id={`${id}-add`}
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => {
              flushSync(() => setRows((all) => [...all, { day: eventDay, startTime: "", endTime: "", title: "", place: "", note: "" }]));
              document.getElementById(`${id}-${rows.length}-day`)?.focus();
            }}
          >
            <Plus aria-hidden />
            {t("addItem")}
          </Button>
        )}
        <FieldSet className="gap-3">
          <FieldLegend variant="label">{t("freshLegend")}</FieldLegend>
          {SCHEDULE_REFRESH.map((each) => (
            <Field key={each} orientation="horizontal">
              <input
                type="radio"
                id={`${id}-fresh-${each}`}
                name="scheduleRefresh"
                value={each}
                checked={refresh === each}
                onChange={() => setRefresh(each)}
                aria-describedby={each === "reload" ? `${id}-fresh-hint` : undefined}
                className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              <FieldContent>
                <FieldLabel htmlFor={`${id}-fresh-${each}`}>{t(each === "minute" ? "freshMinute" : "freshReload")}</FieldLabel>
                {each === "reload" && <FieldDescription id={`${id}-fresh-hint`}>{t("freshReloadHint")}</FieldDescription>}
              </FieldContent>
            </Field>
          ))}
        </FieldSet>
        <Footer pending={saving.pending} error={saving.error} label={editor("done")} />
      </FieldGroup>
    </form>
  );
}
