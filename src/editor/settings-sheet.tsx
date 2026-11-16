"use client";

import { ImageIcon, Palette, Rows3, SlidersHorizontal, Sparkles, Type } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { QuestionsEditor } from "@/app/(host)/events/questions-editor";
import type { AlbumTotals } from "@/album/album";
import { ALBUM_ORDERS } from "@/album/details";
import { EVENT_SIZES } from "@/album/video";
import { ALBUM_VISIBILITIES } from "@/album/visibility";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { saveSettingsAction } from "@/events/editor-actions";
import { CAPACITY_MAX, CAPACITY_MIN, MAX_PLUS_ONES, type EventSettings } from "@/events/form";
import { VIDEO_MB, VIDEO_MINUTES } from "@/instance/limits";
import { cn } from "@/lib/utils";
import type { QuestionDraft } from "@/questions/question";
import { CONTACT_FIELDS, type ContactField } from "@/rsvps/form";
import { AlbumBlock } from "./album-block";
import { EditorSheet } from "./sheet";
import { useEditor } from "./status";

// A change is saved this long after the host's last one, so typing a capacity sends it once.
const DEBOUNCE = 600;

// The editor's toolbar (M4 spec, "The toolbar"), fixed to the foot of the screen: Poster, Title,
// Theme, Effect and Arrange (M8 ticket 25), each a design sheet over a live copy of the
// invitation, and Settings. Each button says whether its sheet is open, and has the focus back
// when it closes.
const TOOLS = [
  { sheet: "poster", icon: ImageIcon },
  { sheet: "title", icon: Type },
  { sheet: "theme", icon: Palette },
  { sheet: "effect", icon: Sparkles },
  { sheet: "arrange", icon: Rows3 },
  { sheet: "settings", icon: SlidersHorizontal },
] as const;

export function EditorToolbar({ sheets }: { sheets: ReactNode }) {
  const t = useTranslations("Editor");
  const design = useTranslations("Design");
  const { sheet, openSheet } = useEditor();
  return (
    <>
      <nav
        // Where a sheet whose opener has gone gives the focus back (sheet.tsx).
        data-slot="editor-toolbar"
        aria-label={t("toolbar")}
        className="dark fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-40 mx-auto grid max-w-[26rem] grid-cols-6 gap-1 rounded-[1.6rem] border bg-popover/90 p-1.5 text-popover-foreground shadow-xl backdrop-blur-xl transition-transform duration-300 ease-out motion-reduce:transition-none editor-sheet-open:lg:translate-x-[min(0px,calc(50vw-40rem))]"
      >
        {TOOLS.map(({ sheet: name, icon: Icon }) => (
          <button
            key={name}
            type="button"
            onClick={() => openSheet(name)}
            aria-expanded={sheet === name}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-medium hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
              sheet === name && "bg-accent",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {name === "settings" ? t("settings") : design(`sheets.${name}`)}
          </button>
        ))}
      </nav>
      {sheets}
    </>
  );
}

// Everything a guest does not see (M4 spec, "Settings sheet"), with 0.4's defaults, so a host can
// publish without opening it. Each change is saved as it is made, the whole sheet at once, through
// the rules the 0.4 form followed (events/form.ts); a refusal says why at the top of the sheet.
// Who sees the guest list and whether the event takes comments are not here: they are switched in
// Arrange with their sections (M8 ticket 26), and this sheet, which posts every field, never posts
// either.
export function SettingsSheet({
  eventId,
  settings,
  mail,
  maxReplies,
  siteVideo,
  features,
  album,
  reminderDays,
  voting,
  questions,
  answerCounts,
}: {
  eventId: string;
  settings: EventSettings;
  // What the album holds, and when the host asked to be reminded about it (M7 ticket 09): the
  // block after the form, which is not posted with it.
  album: AlbumTotals;
  reminderDays: number | null;
  // Whether the instance has mail, without which no code can prove a guest's email.
  mail: boolean;
  // How many replies the operator lets an event take, which the capacity's hint names.
  maxReplies: number;
  // The site's video caps, which the event's caps hint names, and whether the site can process
  // videos at all (M7 ticket 05).
  siteVideo: { maxMinutes: number; maxMb: number; available: boolean };
  // What the operator has switched on (M8 ticket 01): with the album off its group and the block
  // after the form are left out, and with videos off the video controls. Saving then keeps what
  // the event had for them (events/form.ts, keptSettings).
  features: { album: boolean; videos: boolean };
  // The album vote's block (M8 ticket 10; voting/voting-settings.tsx), drawn below the album's and,
  // like it, outside the form; the module leaves it empty while Voting is off for the site.
  voting?: ReactNode;
  questions: QuestionDraft[];
  answerCounts: Record<string, number>;
}) {
  const t = useTranslations("Events.form");
  const editor = useTranslations("Editor");
  const { sheet, openSheet, save } = useEditor();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // What the last save was refused for, and the control it is about, if it names one.
  const [error, setError] = useState<{ message: string; field?: "capacity" | "questions" }>();
  const [emailField, setEmailField] = useState<ContactField>(settings.emailField);
  const [verifyEmail, setVerifyEmail] = useState(settings.verifyEmail);
  const id = useId();

  const send = () => {
    clearTimeout(timer.current);
    const element = form.current;
    if (!element) return;
    const data = new FormData(element);
    // A question just added, with nothing asked yet, waits until it asks something: sending it
    // would only be refused.
    try {
      const questions = JSON.parse(String(data.get("questions") ?? "[]")) as { prompt?: string }[];
      data.set("questions", JSON.stringify(questions.filter((question) => question.prompt?.trim())));
    } catch {
      // Sent as it is, and refused as it would be.
    }
    void save(async () => {
      const result = await saveSettingsAction(eventId, data);
      setError(result.saved ? undefined : { message: result.error, field: result.field });
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
        {error && !error.field && (
          <p role="alert" className="mb-4 rounded-xl bg-destructive/15 px-3 py-2 text-sm text-destructive">
            {error.message}
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
                aria-describedby={error?.field === "capacity" ? `${id}-capacity-error ${id}-capacity-hint` : `${id}-capacity-hint`}
                aria-invalid={error?.field === "capacity" || undefined}
                className="max-w-40"
              />
              {error?.field === "capacity" && (
                <p id={`${id}-capacity-error`} role="alert" className="text-sm text-destructive">
                  {error.message}
                </p>
              )}
              <FieldDescription id={`${id}-capacity-hint`}>{t("guests.capacityHint", { max: maxReplies })}</FieldDescription>
            </Field>
            <Field orientation="horizontal">
              <Checkbox id={`${id}-approval`} name="approvalRequired" defaultChecked={settings.approvalRequired} aria-describedby={`${id}-approval-hint`} />
              <FieldContent>
                <FieldLabel htmlFor={`${id}-approval`}>{t("guests.approval")}</FieldLabel>
                <FieldDescription id={`${id}-approval-hint`}>{t("guests.approvalHint")}</FieldDescription>
              </FieldContent>
            </Field>
            {/* Invite-only (M6 spec, "The setting"), with the way to the list it opens the invitation to. */}
            <Field orientation="horizontal">
              <Checkbox id={`${id}-invite-only`} name="inviteOnly" defaultChecked={settings.inviteOnly} aria-describedby={`${id}-invite-only-hint`} />
              <FieldContent>
                <FieldLabel htmlFor={`${id}-invite-only`}>{t("guests.inviteOnly")}</FieldLabel>
                <FieldDescription id={`${id}-invite-only-hint`}>{t("guests.inviteOnlyHint")}</FieldDescription>
                <Link href={`/events/${eventId}/invites`} className="self-start text-sm underline underline-offset-4 hover:opacity-80">
                  {t("guests.manageInvites")}
                </Link>
              </FieldContent>
            </Field>
          </FieldSet>

          <div className="space-y-3">
            <QuestionsEditor questions={questions} answerCounts={answerCounts} />
            {error?.field === "questions" && (
              <p role="alert" className="text-sm text-destructive">
                {error.message}
              </p>
            )}
          </div>

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

          {features.album && (
            <FieldSet className="gap-3">
              <FieldLegend variant="label">{t("album.title")}</FieldLegend>
              <Field>
                <FieldLabel htmlFor={`${id}-album`}>{t("album.visibility")}</FieldLabel>
                <NativeSelect id={`${id}-album`} name="albumVisibility" defaultValue={settings.albumVisibility} aria-describedby={`${id}-album-hint`}>
                  {ALBUM_VISIBILITIES.map((visibility) => (
                    <NativeSelectOption key={visibility} value={visibility}>
                      {t(`album.${visibility}`)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription id={`${id}-album-hint`}>{t("album.visibilityHint")}</FieldDescription>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id={`${id}-album-approval`}
                  name="albumApprovalRequired"
                  defaultChecked={settings.albumApprovalRequired}
                  aria-describedby={`${id}-album-approval-hint`}
                />
                <FieldContent>
                  <FieldLabel htmlFor={`${id}-album-approval`}>{t("album.approval")}</FieldLabel>
                  <FieldDescription id={`${id}-album-approval-hint`}>{t("album.approvalHint")}</FieldDescription>
                </FieldContent>
              </Field>
              <Field orientation="horizontal">
                <Checkbox id={`${id}-photo-mail`} name="notifyOnPhoto" defaultChecked={settings.notifyOnPhoto} />
                <FieldLabel htmlFor={`${id}-photo-mail`}>{t("album.notify")}</FieldLabel>
              </Field>
              {/* Videos (M7 ticket 05). The controls stay enabled without ffmpeg: this form posts every
                  field on every change, and a disabled box would be saved as off. */}
              {features.videos && (
                <>
                  <Field orientation="horizontal">
                    <Checkbox id={`${id}-videos`} name="albumVideosAllowed" defaultChecked={settings.albumVideosAllowed} aria-describedby={`${id}-videos-hint`} />
                    <FieldContent>
                      <FieldLabel htmlFor={`${id}-videos`}>{t("album.videos")}</FieldLabel>
                      <FieldDescription id={`${id}-videos-hint`}>{siteVideo.available ? t("album.videosHint") : t("album.videosUnavailable")}</FieldDescription>
                    </FieldContent>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${id}-video-minutes`}>{t("album.maxVideoMinutes")}</FieldLabel>
                    <Input
                      id={`${id}-video-minutes`}
                      name="albumMaxVideoMinutes"
                      type="number"
                      inputMode="numeric"
                      min={VIDEO_MINUTES.min}
                      max={VIDEO_MINUTES.max}
                      step={1}
                      defaultValue={settings.albumMaxVideoMinutes ?? ""}
                      placeholder={String(siteVideo.maxMinutes)}
                      aria-describedby={`${id}-video-caps-hint`}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${id}-video-mb`}>{t("album.maxVideoMb")}</FieldLabel>
                    <Input
                      id={`${id}-video-mb`}
                      name="albumMaxVideoMb"
                      type="number"
                      inputMode="numeric"
                      min={VIDEO_MB.min}
                      max={VIDEO_MB.max}
                      step={1}
                      defaultValue={settings.albumMaxVideoMb ?? ""}
                      placeholder={String(siteVideo.maxMb)}
                      aria-describedby={`${id}-video-caps-hint`}
                    />
                    <FieldDescription id={`${id}-video-caps-hint`}>{t("album.videoCapsHint", { minutes: siteVideo.maxMinutes, mb: siteVideo.maxMb })}</FieldDescription>
                  </Field>
                  {/* The sizes a video gets (M8 ticket 02): any of the two, or neither. */}
                  <FieldSet className="gap-3" aria-describedby={`${id}-video-sizes-hint`}>
                    <FieldLegend variant="label">{t("album.sizes")}</FieldLegend>
                    {EVENT_SIZES.map((size) => (
                      <Field key={size} orientation="horizontal">
                        <Checkbox id={`${id}-video-size-${size}`} name="albumCopySizes" value={size} defaultChecked={settings.albumCopySizes.includes(size)} />
                        <FieldLabel htmlFor={`${id}-video-size-${size}`}>{t(size === "1080p" ? "album.size1080" : "album.size720")}</FieldLabel>
                      </Field>
                    ))}
                    <FieldDescription id={`${id}-video-sizes-hint`}>{t("album.sizesHint")}</FieldDescription>
                  </FieldSet>
                </>
              )}
              {/* The details kept of each item, and the album's order (M8 ticket 07). The order is
                  never disabled, since a disabled control is not posted; "When taken" applies only
                  while the time is kept. */}
              <Field orientation="horizontal">
                <Checkbox id={`${id}-keep-taken`} name="albumKeepTakenAt" defaultChecked={settings.albumKeepTakenAt} aria-describedby={`${id}-keep-taken-hint`} />
                <FieldContent>
                  <FieldLabel htmlFor={`${id}-keep-taken`}>{t("album.keepTakenAt")}</FieldLabel>
                  <FieldDescription id={`${id}-keep-taken-hint`}>{t("album.keepTakenAtHint")}</FieldDescription>
                </FieldContent>
              </Field>
              <Field orientation="horizontal">
                <Checkbox id={`${id}-keep-camera`} name="albumKeepCamera" defaultChecked={settings.albumKeepCamera} aria-describedby={`${id}-keep-camera-hint`} />
                <FieldContent>
                  <FieldLabel htmlFor={`${id}-keep-camera`}>{t("album.keepCamera")}</FieldLabel>
                  <FieldDescription id={`${id}-keep-camera-hint`}>{t("album.keepCameraHint")}</FieldDescription>
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-album-order`}>{t("album.order")}</FieldLabel>
                <NativeSelect id={`${id}-album-order`} name="albumOrder" defaultValue={settings.albumOrder} aria-describedby={`${id}-album-order-hint`}>
                  {ALBUM_ORDERS.map((order) => (
                    <NativeSelectOption key={order} value={order}>
                      {t(order === "added" ? "album.orderAdded" : "album.orderTaken")}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription id={`${id}-album-order-hint`}>{t("album.orderHint")}</FieldDescription>
              </Field>
            </FieldSet>
          )}

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
              <Checkbox id={`${id}-comment-mail`} name="notifyOnComment" defaultChecked={settings.notifyOnComment} />
              <FieldLabel htmlFor={`${id}-comment-mail`}>{t("notifyOnComment")}</FieldLabel>
            </Field>
          </FieldSet>
        </FieldGroup>
      </form>
      {features.album && <AlbumBlock key={String(reminderDays)} eventId={eventId} album={album} reminderDays={reminderDays} />}
      {voting}
    </EditorSheet>
  );
}
