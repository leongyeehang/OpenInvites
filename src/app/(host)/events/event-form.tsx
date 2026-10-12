"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormOutcome } from "@/components/form-outcome";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { CAPACITY_MAX, CAPACITY_MIN, MAX_PLUS_ONES } from "@/events/form";
import type { QuestionDraft } from "@/questions/question";
import { EMPTY_RICH_TEXT } from "@/rich-text/rich-text";
import { CONTACT_FIELDS, type ContactField } from "@/rsvps/form";
import { GUEST_LIST_VISIBILITIES } from "@/rsvps/visibility";
import { DescriptionEditor } from "./description-editor";
import { QuestionsEditor } from "./questions-editor";
import type { Event } from "@/events/repository";
import { toWallTime } from "@/events/time";
import type { FormState } from "@/lib/form-state";

// The visibility values as the form words them for a host.
const GUEST_LIST_LABELS = {
  always: "guestListAlways",
  afterReply: "guestListAfterReply",
  hidden: "guestListHidden",
} as const;

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  event?: Event;
  // Whether the instance has mail, without which no code can prove a guest's email.
  mail: boolean;
  // How many replies the operator lets an event take, which the capacity's hint names.
  maxReplies: number;
  timeZones: string[];
  submitLabel: string;
  questions: QuestionDraft[];
  answerCounts: Record<string, number>;
};

// One form for creating and editing. Times are typed in the event's zone; the action converts them.
export function EventForm({ action, event, mail, maxReplies, timeZones, submitLabel, questions, answerCounts }: Props) {
  const t = useTranslations("Events.form");
  const [state, formAction, pending] = useActionState(action, undefined);
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  // Guests can be reminded only if they can give an email, so the reminder setting says so while
  // the form does not ask for one.
  const [emailField, setEmailField] = useState<ContactField>(event?.emailField ?? "none");
  // A code can only prove an email the form asks for, so the check waits, unticked, while it asks
  // for none, and comes back as the host left it once it asks again.
  const [verifyEmail, setVerifyEmail] = useState(event?.verifyEmail ?? false);
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
        <DescriptionEditor doc={event?.descriptionRich ?? EMPTY_RICH_TEXT} />
        <Field>
          <FieldLabel htmlFor="plus-ones-allowed">{t("plusOnesAllowed")}</FieldLabel>
          <NativeSelect id="plus-ones-allowed" name="plusOnesAllowed" defaultValue={String(event?.plusOnesAllowed ?? 1)}>
            {Array.from({ length: MAX_PLUS_ONES + 1 }, (_, allowed) => (
              <NativeSelectOption key={allowed} value={String(allowed)}>
                {allowed === 0 ? t("plusOnesNone") : allowed}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>{t("plusOnesAllowedHint")}</FieldDescription>
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="require-plus-one-names" name="requirePlusOneNames" defaultChecked={event?.requirePlusOneNames} />
          <FieldLabel htmlFor="require-plus-one-names">{t("requirePlusOneNames")}</FieldLabel>
        </Field>
        {/* How many may come (spec, "Capacity and the waitlist"). Empty is no limit. */}
        <FieldSet className="gap-3">
          <FieldLegend variant="label">{t("guests.title")}</FieldLegend>
          <Field>
            <FieldLabel htmlFor="capacity">{t("guests.capacity")}</FieldLabel>
            <Input
              id="capacity"
              name="capacity"
              type="number"
              inputMode="numeric"
              min={CAPACITY_MIN}
              max={CAPACITY_MAX}
              step={1}
              defaultValue={event?.capacity ?? ""}
              aria-describedby="capacity-hint"
              className="max-w-40"
            />
            <FieldDescription id="capacity-hint">{t("guests.capacityHint", { max: maxReplies })}</FieldDescription>
          </Field>
        </FieldSet>
        {/* How the RSVP form asks guests to be reached (spec, "Contact details"). */}
        <FieldSet className="gap-3">
          <FieldLegend variant="label">{t("contact.title")}</FieldLegend>
          <Field>
            <FieldLabel htmlFor="email-field">{t("contact.email")}</FieldLabel>
            <NativeSelect
              id="email-field"
              name="emailField"
              value={emailField}
              onChange={(picked) => setEmailField(picked.target.value as ContactField)}
            >
              {CONTACT_FIELDS.map((field) => (
                <NativeSelectOption key={field} value={field}>
                  {t(`contact.${field}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {mail ? (
            <Field orientation="horizontal" data-disabled={emailField === "none"}>
              <Checkbox
                id="verify-email"
                name="verifyEmail"
                checked={verifyEmail && emailField !== "none"}
                disabled={emailField === "none"}
                onCheckedChange={(checked) => setVerifyEmail(checked === true)}
                aria-describedby="verify-email-hint"
              />
              <FieldContent>
                <FieldLabel htmlFor="verify-email">{t("contact.verifyEmail")}</FieldLabel>
                <FieldDescription id="verify-email-hint">{t("contact.verifyEmailHint")}</FieldDescription>
              </FieldContent>
            </Field>
          ) : (
            // Without mail the check is not offered, and one the host turned on is kept for when
            // mail arrives (spec, "Contact details").
            event?.verifyEmail && <input type="hidden" name="verifyEmail" value="on" />
          )}
          <Field>
            <FieldLabel htmlFor="phone-field">{t("contact.phone")}</FieldLabel>
            <NativeSelect id="phone-field" name="phoneField" defaultValue={event?.phoneField ?? "none"}>
              {CONTACT_FIELDS.map((field) => (
                <NativeSelectOption key={field} value={field}>
                  {t(`contact.${field}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        </FieldSet>
        <QuestionsEditor questions={questions} answerCounts={answerCounts} />
        <Field>
          <FieldLabel htmlFor="guest-list-visibility">{t("guestListVisibility")}</FieldLabel>
          <NativeSelect
            id="guest-list-visibility"
            name="guestListVisibility"
            defaultValue={event?.guestListVisibility ?? "afterReply"}
          >
            {GUEST_LIST_VISIBILITIES.map((visibility) => (
              <NativeSelectOption key={visibility} value={visibility}>
                {t(GUEST_LIST_LABELS[visibility])}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>{t("guestListVisibilityHint")}</FieldDescription>
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="notify-on-rsvp" name="notifyOnRsvp" defaultChecked={event?.notifyOnRsvp ?? true} />
          <FieldLabel htmlFor="notify-on-rsvp">{t("notifyOnRsvp")}</FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <Checkbox
            id="reminders-enabled"
            name="remindersEnabled"
            defaultChecked={event?.remindersEnabled ?? true}
            aria-describedby={emailField === "none" ? "reminders-hint" : undefined}
          />
          <FieldContent>
            <FieldLabel htmlFor="reminders-enabled">{t("remindersEnabled")}</FieldLabel>
            {emailField === "none" && <FieldDescription id="reminders-hint">{t("askEmailHint")}</FieldDescription>}
          </FieldContent>
        </Field>
        <Field orientation="horizontal">
          <Checkbox
            id="comments-enabled"
            name="commentsEnabled"
            defaultChecked={event?.commentsEnabled ?? true}
            aria-describedby="comments-hint"
          />
          <FieldContent>
            <FieldLabel htmlFor="comments-enabled">{t("commentsEnabled")}</FieldLabel>
            <FieldDescription id="comments-hint">{t("commentsEnabledHint")}</FieldDescription>
          </FieldContent>
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="notify-on-comment" name="notifyOnComment" defaultChecked={event?.notifyOnComment ?? true} />
          <FieldLabel htmlFor="notify-on-comment">{t("notifyOnComment")}</FieldLabel>
        </Field>
        <FormOutcome state={state} />
        <Button type="submit" disabled={pending} className="self-start">
          {submitLabel}
        </Button>
      </FieldGroup>
    </form>
  );
}
