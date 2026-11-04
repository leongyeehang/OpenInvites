"use client";

import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { QuestionsEditor } from "@/app/(host)/events/questions-editor";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { saveSettingsAction } from "@/events/editor-actions";
import { CAPACITY_MAX, CAPACITY_MIN, MAX_PLUS_ONES, type EventSettings } from "@/events/form";
import { cn } from "@/lib/utils";
import type { QuestionDraft } from "@/questions/question";
import { CONTACT_FIELDS, type ContactField } from "@/rsvps/form";
import { GUEST_LIST_VISIBILITIES } from "@/rsvps/visibility";
import { EditorSheet } from "./sheet";
import { useEditor } from "./status";
import { PILL } from "./top-bar";

const GUEST_LIST_LABELS = { always: "guestListAlways", afterReply: "guestListAfterReply", hidden: "guestListHidden" } as const;

// A change is saved this long after the host's last one, so typing a capacity sends it once.
const DEBOUNCE = 600;

// The editor's toolbar (M4 spec, "The toolbar"), fixed to the foot of the screen: the Design
// drawer's button until ticket 06 brings its sheets, and Settings.
export function EditorToolbar({ design, settings }: { design: ReactNode; settings: ReactNode }) {
  const t = useTranslations("Editor");
  const { sheet, openSheet } = useEditor();
  return (
    <>
      <nav
        aria-label={t("toolbar")}
        className="fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-40 flex justify-center gap-2 px-3 designing:hidden"
      >
        {design}
        <button type="button" onClick={() => openSheet("settings")} aria-expanded={sheet === "settings"} className={cn(PILL, "h-11")}>
          <SlidersHorizontal className="size-4" aria-hidden />
          {t("settings")}
        </button>
      </nav>
      {settings}
    </>
  );
}

// Everything a guest does not see (M4 spec, "Settings sheet"), with 0.4's defaults, so a host can
// publish without opening it. Each change is saved as it is made, the whole sheet at once, through
// the rules the 0.4 form followed (events/form.ts); a refusal says why at the top of the sheet.
export function SettingsSheet({
  eventId,
  settings,
  mail,
  maxReplies,
  questions,
  answerCounts,
}: {
  eventId: string;
  settings: EventSettings;
  // Whether the instance has mail, without which no code can prove a guest's email.
  mail: boolean;
  // How many replies the operator lets an event take, which the capacity's hint names.
  maxReplies: number;
  questions: QuestionDraft[];
  answerCounts: Record<string, number>;
}) {
  const t = useTranslations("Events.form");
  const editor = useTranslations("Editor");
  const { sheet, openSheet, save } = useEditor();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [error, setError] = useState<string>();
  const [emailField, setEmailField] = useState<ContactField>(settings.emailField);
  const [verifyEmail, setVerifyEmail] = useState(settings.verifyEmail);
  const id = useId();

  const send = () => {
    clearTimeout(timer.current);
    const element = form.current;
    if (!element) return;
    const data = new FormData(element);
    void save(async () => {
      const result = await saveSettingsAction(eventId, data);
      setError(result.saved ? undefined : result.error);
      return result;
    });
  };
  const soon = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(send, DEBOUNCE);
  };
  // Closing the sheet sends what is waiting.
  useEffect(() => {
    if (sheet !== "settings" && timer.current) send();
    // Only on closing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  return (
    <EditorSheet open={sheet === "settings"} onOpenChange={(open) => openSheet(open ? "settings" : null)} title={editor("settings")} description={editor("settingsIntro")} tall>
      <form ref={form} onChange={soon} onInput={soon} onClick={soon} onSubmit={(event) => event.preventDefault()}>
        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-destructive/15 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <FieldGroup>
          <FieldSet className="gap-3">
            <FieldLegend variant="label">{t("guests.title")}</FieldLegend>
            <Field>
              <FieldLabel htmlFor={`${id}-plus-ones`}>{t("plusOnesAllowed")}</FieldLabel>
              <NativeSelect id={`${id}-plus-ones`} name="plusOnesAllowed" defaultValue={String(settings.plusOnesAllowed)}>
                {Array.from({ length: MAX_PLUS_ONES + 1 }, (_, allowed) => (
                  <NativeSelectOption key={allowed} value={String(allowed)}>
                    {allowed === 0 ? t("plusOnesNone") : allowed}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>{t("plusOnesAllowedHint")}</FieldDescription>
            </Field>
            <Field orientation="horizontal">
              <Checkbox id={`${id}-names`} name="requirePlusOneNames" defaultChecked={settings.requirePlusOneNames} />
              <FieldLabel htmlFor={`${id}-names`}>{t("requirePlusOneNames")}</FieldLabel>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-capacity`}>{t("guests.capacity")}</FieldLabel>
              <Input
                id={`${id}-capacity`}
                name="capacity"
                type="number"
                inputMode="numeric"
                min={CAPACITY_MIN}
                max={CAPACITY_MAX}
                step={1}
                defaultValue={settings.capacity ?? ""}
                aria-describedby={`${id}-capacity-hint`}
                className="max-w-40"
              />
              <FieldDescription id={`${id}-capacity-hint`}>{t("guests.capacityHint", { max: maxReplies })}</FieldDescription>
            </Field>
            <Field orientation="horizontal">
              <Checkbox id={`${id}-approval`} name="approvalRequired" defaultChecked={settings.approvalRequired} aria-describedby={`${id}-approval-hint`} />
              <FieldContent>
                <FieldLabel htmlFor={`${id}-approval`}>{t("guests.approval")}</FieldLabel>
                <FieldDescription id={`${id}-approval-hint`}>{t("guests.approvalHint")}</FieldDescription>
              </FieldContent>
            </Field>
          </FieldSet>

          <QuestionsEditor questions={questions} answerCounts={answerCounts} />

          <FieldSet className="gap-3">
            <FieldLegend variant="label">{t("contact.title")}</FieldLegend>
            <Field>
              <FieldLabel htmlFor={`${id}-email`}>{t("contact.email")}</FieldLabel>
              <NativeSelect id={`${id}-email`} name="emailField" value={emailField} onChange={(picked) => setEmailField(picked.target.value as ContactField)}>
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
                  id={`${id}-verify`}
                  name="verifyEmail"
                  checked={verifyEmail && emailField !== "none"}
                  disabled={emailField === "none"}
                  onCheckedChange={(checked) => setVerifyEmail(checked === true)}
                  aria-describedby={`${id}-verify-hint`}
                />
                <FieldContent>
                  <FieldLabel htmlFor={`${id}-verify`}>{t("contact.verifyEmail")}</FieldLabel>
                  <FieldDescription id={`${id}-verify-hint`}>{t("contact.verifyEmailHint")}</FieldDescription>
                </FieldContent>
              </Field>
            ) : (
              // Without mail the check is not offered, and one the host turned on is kept for when
              // mail arrives (spec, "Contact details").
              settings.verifyEmail && <input type="hidden" name="verifyEmail" value="on" />
            )}
            <Field>
              <FieldLabel htmlFor={`${id}-phone`}>{t("contact.phone")}</FieldLabel>
              <NativeSelect id={`${id}-phone`} name="phoneField" defaultValue={settings.phoneField}>
                {CONTACT_FIELDS.map((field) => (
                  <NativeSelectOption key={field} value={field}>
                    {t(`contact.${field}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </FieldSet>

          <Field>
            <FieldLabel htmlFor={`${id}-guest-list`}>{t("guestListVisibility")}</FieldLabel>
            <NativeSelect id={`${id}-guest-list`} name="guestListVisibility" defaultValue={settings.guestListVisibility}>
              {GUEST_LIST_VISIBILITIES.map((visibility) => (
                <NativeSelectOption key={visibility} value={visibility}>
                  {t(GUEST_LIST_LABELS[visibility])}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>{t("guestListVisibilityHint")}</FieldDescription>
          </Field>

          <FieldSet className="gap-3">
            <FieldLegend variant="label">{editor("emailsAndComments")}</FieldLegend>
            <Field orientation="horizontal">
              <Checkbox id={`${id}-notify`} name="notifyOnRsvp" defaultChecked={settings.notifyOnRsvp} />
              <FieldLabel htmlFor={`${id}-notify`}>{t("notifyOnRsvp")}</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id={`${id}-reminders`}
                name="remindersEnabled"
                defaultChecked={settings.remindersEnabled}
                aria-describedby={emailField === "none" ? `${id}-reminders-hint` : undefined}
              />
              <FieldContent>
                <FieldLabel htmlFor={`${id}-reminders`}>{t("remindersEnabled")}</FieldLabel>
                {emailField === "none" && <FieldDescription id={`${id}-reminders-hint`}>{t("askEmailHint")}</FieldDescription>}
              </FieldContent>
            </Field>
            <Field orientation="horizontal">
              <Checkbox id={`${id}-comments`} name="commentsEnabled" defaultChecked={settings.commentsEnabled} aria-describedby={`${id}-comments-hint`} />
              <FieldContent>
                <FieldLabel htmlFor={`${id}-comments`}>{t("commentsEnabled")}</FieldLabel>
                <FieldDescription id={`${id}-comments-hint`}>{t("commentsEnabledHint")}</FieldDescription>
              </FieldContent>
            </Field>
            <Field orientation="horizontal">
              <Checkbox id={`${id}-comment-mail`} name="notifyOnComment" defaultChecked={settings.notifyOnComment} />
              <FieldLabel htmlFor={`${id}-comment-mail`}>{t("notifyOnComment")}</FieldLabel>
            </Field>
          </FieldSet>
        </FieldGroup>
      </form>
    </EditorSheet>
  );
}
