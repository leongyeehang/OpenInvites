"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormOutcome } from "@/components/form-outcome";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Event } from "@/events/repository";
import { toWallTime } from "@/events/time";
import type { FormState } from "@/lib/form-state";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  event?: Event;
  timeZones: string[];
  submitLabel: string;
};

// One form for creating and editing. Times are typed in the event's zone; the action converts them.
export function EventForm({ action, event, timeZones, submitLabel }: Props) {
  const t = useTranslations("Events.form");
  const [state, formAction, pending] = useActionState(action, undefined);
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const timeZoneSelect = useRef<HTMLSelectElement>(null);

  // A new event defaults to the host's device zone, which only the browser knows, so the
  // server renders UTC and the browser corrects the select once it is on screen. Browsers may
  // name a zone differently from the server's list (Asia/Kolkata for Asia/Calcutta); the
  // server accepts either, so the device's name is added when it is missing.
  useEffect(() => {
    const select = timeZoneSelect.current;
    if (event || !select) return;
    const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZones.includes(deviceZone)) select.add(new Option(deviceZone, deviceZone));
    select.value = deviceZone;
  }, [event, timeZones]);

  const wall = (instant: Date | null | undefined) =>
    instant && event ? toWallTime(instant, event.timeZone, { dateOnly: allDay }) : "";
  const inputType = allDay ? "date" : "datetime-local";

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="title">{t("title")}</FieldLabel>
          <Input id="title" name="title" defaultValue={event?.title} required />
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="all-day" name="allDay" checked={allDay} onCheckedChange={(checked) => setAllDay(checked === true)} />
          <FieldLabel htmlFor="all-day">{t("allDay")}</FieldLabel>
        </Field>
        <Field>
          <FieldLabel htmlFor="start">{t("start")}</FieldLabel>
          <Input key={`start-${inputType}`} id="start" name="start" type={inputType} defaultValue={wall(event?.startsAt)} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="end">{t("end")}</FieldLabel>
          <Input key={`end-${inputType}`} id="end" name="end" type={inputType} defaultValue={wall(event?.endsAt)} />
          <FieldDescription>{t("endHint")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="time-zone">{t("timeZone")}</FieldLabel>
          <NativeSelect id="time-zone" name="timeZone" ref={timeZoneSelect} defaultValue={event?.timeZone ?? "UTC"}>
            {timeZones.map((zone) => (
              <NativeSelectOption key={zone} value={zone}>
                {zone}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>{t("timeZoneHint")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="location">{t("location")}</FieldLabel>
          <Input id="location" name="location" defaultValue={event?.location} />
          <FieldDescription>{t("locationHint")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="description">{t("description")}</FieldLabel>
          <Textarea id="description" name="description" defaultValue={event?.description} rows={6} />
          <FieldDescription>{t("descriptionHint")}</FieldDescription>
        </Field>
        <FormOutcome state={state} />
        <Button type="submit" disabled={pending} className="self-start">
          {submitLabel}
        </Button>
      </FieldGroup>
    </form>
  );
}
