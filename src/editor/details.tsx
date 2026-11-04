"use client";

import { AlignLeft, ChevronRight, Clock, MapPin, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import { DescriptionEditor } from "@/app/(host)/events/description-editor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { saveDescriptionAction, saveLocationAction, saveWhenAction } from "@/events/editor-actions";
import { cn } from "@/lib/utils";
import type { RichText } from "@/rich-text/rich-text";
import { Glass } from "@/themes/glass";
import { EditorSheet } from "./sheet";
import { useEditor } from "./status";

// What the details list shows and what its sheets start from, worked out on the server: the date
// as the guest reads it and as the date sheet's fields hold it, in the event's zone.
export type EditableDetails = {
  eventId: string;
  when: string | null;
  start: string;
  end: string;
  allDay: boolean;
  timeZone: string;
  // A draft's zone until the host dates it is the device's they made it on; the date sheet offers
  // the device's own zone while the event has no date.
  dated: boolean;
  location: string;
  // How many days after it ends the instance keeps an event, said beneath the dates (spec,
  // "Retention"); null when it keeps events for ever.
  retentionDays: number | null;
  description: string;
  descriptionRich: RichText;
};

// The details list of the invitation in the editor (M4 spec, "The editor"): When, Where and About,
// each a button showing what is set, or what to add, that opens a small sheet to set it. Each sheet
// saves as it closes with Done.
export function EditorDetails({ details, timeZones }: { details: EditableDetails; timeZones: string[] }) {
  const t = useTranslations("Editor");
  const { sheet, openSheet } = useEditor();
  return (
    <>
      <Glass data-slot="details" className="divide-y divide-theme-glass-border overflow-hidden rounded-[1.75rem]">
        <Row icon={Clock} label={t("when")} value={details.when} placeholder={t("setDate")} onOpen={() => openSheet("when")} />
        <Row icon={MapPin} label={t("where")} value={details.location || null} placeholder={t("addPlace")} onOpen={() => openSheet("where")} />
        <Row icon={AlignLeft} label={t("about")} value={details.description || null} placeholder={t("sayWhat")} onOpen={() => openSheet("about")} clamp />
      </Glass>
      <WhenSheet open={sheet === "when"} onOpenChange={(open) => openSheet(open ? "when" : null)} details={details} timeZones={timeZones} />
      <WhereSheet open={sheet === "where"} onOpenChange={(open) => openSheet(open ? "where" : null)} details={details} />
      <AboutSheet open={sheet === "about"} onOpenChange={(open) => openSheet(open ? "about" : null)} details={details} />
    </>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  placeholder,
  onOpen,
  clamp = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  placeholder: string;
  onOpen: () => void;
  clamp?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label}: ${value ?? placeholder}`}
      className="grid w-full cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-3 p-4 text-left transition-colors hover:bg-theme-glass-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-theme-focus-ring motion-reduce:transition-none"
    >
      <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-theme-glass-strong text-theme-accent-ink">
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="mb-1 block text-xs font-medium tracking-label text-theme-text-faint uppercase">{label}</span>
        {value ? (
          <span className={cn("block text-base leading-snug font-medium break-words", clamp && "line-clamp-3 font-normal text-theme-text-muted")}>{value}</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-base text-theme-text-muted">
            <Plus className="size-4" aria-hidden />
            {placeholder}
          </span>
        )}
      </span>
      <ChevronRight aria-hidden className="mt-2 size-4 text-theme-text-faint" />
    </button>
  );
}

// A sheet's Done: saves, closes once it has, and says why beside it when it has not.
function useSaving(onOpenChange: (open: boolean) => void) {
  const { save } = useEditor();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const run = async (task: Parameters<typeof save>[0]) => {
    setPending(true);
    setError(undefined);
    let failed: string | undefined;
    const saved = await save(async () => {
      const result = await task();
      if (!result.saved) failed = result.error;
      return result;
    });
    setPending(false);
    if (saved) onOpenChange(false);
    else setError(failed);
  };
  return { error, pending, run, clear: () => setError(undefined) };
}

function Footer({ pending, error, label }: { pending: boolean; error?: string; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {label}
      </Button>
    </div>
  );
}

function WhenSheet({ open, onOpenChange, details, timeZones }: { open: boolean; onOpenChange: (open: boolean) => void; details: EditableDetails; timeZones: string[] }) {
  const t = useTranslations("Editor");
  const form = useTranslations("Events.form");
  const id = useId();
  const [allDay, setAllDay] = useState(details.allDay);
  const zone = useRef<HTMLSelectElement>(null);
  const saving = useSaving(onOpenChange);
  const inputType = allDay ? "date" : "datetime-local";
  const asType = (wall: string) => (allDay ? wall.slice(0, 10) : wall);

  // An undated draft's sheet starts on the zone of the device it is opened on, which only the
  // browser knows. A name the server's list lacks (Asia/Kolkata) is added; the server takes either.
  useEffect(() => {
    if (!open || details.dated) return;
    const select = zone.current;
    if (!select) return;
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (![...select.options].some((option) => option.value === device)) select.add(new Option(device, device));
    select.value = device;
  }, [open, details.dated]);

  return (
    <EditorSheet open={open} onOpenChange={onOpenChange} title={t("when")}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const text = (name: string) => String(data.get(name) ?? "");
          void saving.run(() =>
            saveWhenAction(details.eventId, { allDay, start: text("start"), end: text("end"), timeZone: text("timeZone") }),
          );
        }}
      >
        <FieldGroup>
          <Field orientation="horizontal">
            <Checkbox id={`${id}-all-day`} checked={allDay} onCheckedChange={(checked) => setAllDay(checked === true)} />
            <FieldLabel htmlFor={`${id}-all-day`}>{form("allDay")}</FieldLabel>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-start`}>{form("start")}</FieldLabel>
            <Input key={`start-${inputType}`} id={`${id}-start`} name="start" type={inputType} defaultValue={asType(details.start)} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-end`}>{form("end")}</FieldLabel>
            <Input key={`end-${inputType}`} id={`${id}-end`} name="end" type={inputType} defaultValue={asType(details.end)} />
            <FieldDescription>{form("endHint")}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-zone`}>{form("timeZone")}</FieldLabel>
            <NativeSelect id={`${id}-zone`} name="timeZone" ref={zone} defaultValue={details.timeZone}>
              {timeZones.map((each) => (
                <NativeSelectOption key={each} value={each}>
                  {each}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>{form("timeZoneHint")}</FieldDescription>
          </Field>
          {details.retentionDays !== null && <p className="text-sm text-muted-foreground">{form("retention", { days: details.retentionDays })}</p>}
          <Footer pending={saving.pending} error={saving.error} label={t("done")} />
        </FieldGroup>
      </form>
    </EditorSheet>
  );
}

function WhereSheet({ open, onOpenChange, details }: { open: boolean; onOpenChange: (open: boolean) => void; details: EditableDetails }) {
  const t = useTranslations("Editor");
  const form = useTranslations("Events.form");
  const id = useId();
  const saving = useSaving(onOpenChange);
  return (
    <EditorSheet open={open} onOpenChange={onOpenChange} title={t("where")}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const location = String(new FormData(event.currentTarget).get("location") ?? "");
          void saving.run(() => saveLocationAction(details.eventId, location));
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-location`}>{form("location")}</FieldLabel>
            <Input id={`${id}-location`} name="location" defaultValue={details.location} />
            <FieldDescription>{form("locationHint")}</FieldDescription>
          </Field>
          <Footer pending={saving.pending} error={saving.error} label={t("done")} />
        </FieldGroup>
      </form>
    </EditorSheet>
  );
}

function AboutSheet({ open, onOpenChange, details }: { open: boolean; onOpenChange: (open: boolean) => void; details: EditableDetails }) {
  const t = useTranslations("Editor");
  const saving = useSaving(onOpenChange);
  return (
    <EditorSheet open={open} onOpenChange={onOpenChange} title={t("about")} tall>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const posted = String(new FormData(event.currentTarget).get("description") ?? "");
          void saving.run(() => saveDescriptionAction(details.eventId, posted));
        }}
      >
        <FieldGroup>
          <DescriptionEditor doc={details.descriptionRich} />
          <Footer pending={saving.pending} error={saving.error} label={t("done")} />
        </FieldGroup>
      </form>
    </EditorSheet>
  );
}

