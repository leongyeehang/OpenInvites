"use client";

import { Check, ChevronDown, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { FormOutcome } from "@/components/form-outcome";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FeatureSwitches } from "@/features";
import { createHostInvitationAction, setFeaturesAction, setHomePageAction, setInstanceLimitsAction, setRegistrationModeAction, setVideoProcessingAction } from "@/instance/actions";
import { DEFAULT_HOME_PAGE, DEFAULT_INSTANCE_NAME, HOME_POSTER_MODES, type HomePage } from "@/instance/home";
import { DEFAULT_LIMITS, LIMIT_MAX, LIMIT_MIN, PHOTO_MB, REMINDER_DAYS, STORAGE_GB, VIDEO_MB, VIDEO_MINUTES, type Limits } from "@/instance/limits";
import { REGISTRATION_MODES, type RegistrationMode } from "@/instance/registration";
import { GALLERY_POSTERS, OCCASIONS, type GalleryPosterId } from "@/themes/posters";
import { DEFAULT_RETENTION_DAYS, RETENTION_MAX_DAYS, RETENTION_MIN_DAYS } from "@/retention/plan";

// The name, the welcome line and, under More options, the posters and who runs the site. The fields
// are kept in state, so that a refused save leaves what was typed where it was.
export function HomePageForm({ home }: { home: HomePage }) {
  const t = useTranslations("Instance.homePage");
  const [state, action, pending] = useActionState(setHomePageAction, undefined);
  const [name, setName] = useState(home.instanceName ?? "");
  const [line, setLine] = useState(home.welcomeLine ?? "");
  const [posters, setPosters] = useState(home.posters);
  const [ids, setIds] = useState<GalleryPosterId[]>(home.posterIds);
  const [showOperator, setShowOperator] = useState(home.showOperator);
  // Closed unless the stored settings differ from the defaults, so that what was changed is seen.
  const [open, setOpen] = useState(home.posters !== DEFAULT_HOME_PAGE.posters || home.showOperator !== DEFAULT_HOME_PAGE.showOperator);
  const error = (field: string) => (state?.field === field ? state.error : undefined);
  // The posters' error sits inside More options: a refused save opens it, so that it is seen.
  // Adjusted while drawing, as React advises for a change that follows from the action's new result.
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.field === "posters") setOpen(true);
  }
  // Arriving by "Name your instance" on the operator's welcome sheet (dashboard/operator-welcome.tsx)
  // is arriving to type the name.
  useEffect(() => {
    if (window.location.hash === "#home-page") document.getElementById("instance-name")?.focus();
  }, []);

  const choosePosters = (mode: HomePage["posters"]) => {
    setPosters(mode);
    // One poster at a time for `one`: of several that were picked, the first stays.
    if (mode === "one") setIds((current) => current.slice(0, 1));
  };
  const toggle = (id: GalleryPosterId, on: boolean) => setIds((current) => (on ? [...current, id] : current.filter((each) => each !== id)));

  return (
    <form action={action}>
      <FieldGroup>
        <Field data-invalid={error("instanceName") ? true : undefined}>
          <FieldLabel htmlFor="instance-name">{t("name")}</FieldLabel>
          <Input
            id="instance-name"
            name="instanceName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={DEFAULT_INSTANCE_NAME}
            autoComplete="off"
            aria-invalid={error("instanceName") ? true : undefined}
          />
          <FieldDescription>{t("nameHint", { name: DEFAULT_INSTANCE_NAME })}</FieldDescription>
          {error("instanceName") && <FieldError>{error("instanceName")}</FieldError>}
        </Field>
        <Field data-invalid={error("welcomeLine") ? true : undefined}>
          <FieldLabel htmlFor="welcome-line">{t("welcomeLine")}</FieldLabel>
          <Input
            id="welcome-line"
            name="welcomeLine"
            value={line}
            onChange={(event) => setLine(event.target.value)}
            autoComplete="off"
            aria-invalid={error("welcomeLine") ? true : undefined}
          />
          <FieldDescription>{t("welcomeLineHint")}</FieldDescription>
          {error("welcomeLine") && <FieldError>{error("welcomeLine")}</FieldError>}
        </Field>

        <div className="flex flex-col gap-4">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="home-page-more"
            onClick={() => setOpen(!open)}
            className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-md text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ChevronDown className={open ? "size-4" : "size-4 -rotate-90"} aria-hidden />
            {t("more")}
          </button>
          {/* Hidden, not unmounted, so that a closed disclosure still posts what it holds. */}
          <div id="home-page-more" hidden={!open} className="flex flex-col gap-6">
            <FieldSet>
              <FieldLegend variant="label">{t("posters")}</FieldLegend>
              {HOME_POSTER_MODES.map((mode) => (
                <Field key={mode} orientation="horizontal">
                  <input
                    type="radio"
                    id={`home-posters-${mode}`}
                    name="posters"
                    value={mode}
                    checked={posters === mode}
                    onChange={() => choosePosters(mode)}
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                  />
                  <FieldLabel htmlFor={`home-posters-${mode}`}>{t(`postersMode.${mode}`)}</FieldLabel>
                </Field>
              ))}
              {posters !== "all" && (
                <PosterChoices mode={posters} ids={ids} onToggle={toggle} onPick={(id) => setIds([id])} />
              )}
              {error("posters") && <FieldError>{error("posters")}</FieldError>}
            </FieldSet>
            <Field orientation="horizontal">
              <Checkbox id="show-operator" name="showOperator" checked={showOperator} onCheckedChange={(checked) => setShowOperator(checked === true)} />
              <FieldContent>
                <FieldLabel htmlFor="show-operator">{t("showOperator")}</FieldLabel>
                <FieldDescription>{t("showOperatorHint")}</FieldDescription>
              </FieldContent>
            </Field>
          </div>
        </div>

        {state?.success && <FormOutcome state={state} />}
        {state?.error && !state.field && <FormOutcome state={state} />}
        <Button type="submit" disabled={pending} className="self-start">
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}

// The gallery as thumbnails, grouped by occasion as the editor's Poster sheet groups it: checkboxes
// to pick several, radios to pick the one.
function PosterChoices({
  mode,
  ids,
  onToggle,
  onPick,
}: {
  mode: "picked" | "one";
  ids: GalleryPosterId[];
  onToggle: (id: GalleryPosterId, on: boolean) => void;
  onPick: (id: GalleryPosterId) => void;
}) {
  const names = useTranslations("Posters");
  return (
    <div className="flex flex-col gap-4">
      {OCCASIONS.map((occasion) => (
        <section key={occasion} aria-labelledby={`home-occasion-${occasion}`} className="flex flex-col gap-2">
          <h3 id={`home-occasion-${occasion}`} className="text-xs font-medium text-muted-foreground">
            {names(`occasions.${occasion}`)}
          </h3>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {GALLERY_POSTERS.filter((poster) => poster.occasion === occasion).map((poster) => {
              const checked = ids.includes(poster.id);
              const label = names(`names.${poster.id}`);
              return (
                <li key={poster.id}>
                  <label className="relative block cursor-pointer overflow-hidden rounded-lg ring-1 ring-foreground/10 has-[:checked]:ring-2 has-[:checked]:ring-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring">
                    <input
                      type={mode === "one" ? "radio" : "checkbox"}
                      name="posterIds"
                      value={poster.id}
                      checked={checked}
                      onChange={(event) => (mode === "one" ? onPick(poster.id) : onToggle(poster.id, event.target.checked))}
                      aria-label={label}
                      className="peer sr-only"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element -- the card is already made to size */}
                    <img src={poster.card} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
                    <span className="block truncate px-1.5 py-1 text-xs">{label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function RegistrationForm({ mode }: { mode: RegistrationMode }) {
  const t = useTranslations("Instance.registration");
  const [state, action, pending] = useActionState(setRegistrationModeAction, undefined);
  return (
    <form action={action}>
      <FieldGroup>
        <FieldSet>
          <FieldLegend className="sr-only">{t("title")}</FieldLegend>
          {REGISTRATION_MODES.map((value) => (
            <Field key={value} orientation="horizontal">
              <input
                type="radio"
                id={`mode-${value}`}
                name="mode"
                value={value}
                defaultChecked={mode === value}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <FieldContent>
                <FieldLabel htmlFor={`mode-${value}`}>{t(value)}</FieldLabel>
                <FieldDescription>{t(`${value}Hint`)}</FieldDescription>
              </FieldContent>
            </Field>
          ))}
        </FieldSet>
        <FormOutcome state={state} />
        <Button type="submit" disabled={pending} className="self-start">
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}

// The storage limits are kept in whole megabytes and typed in gigabytes, to two decimals.
const gigabytes = (megabytes: number) => Number((megabytes / 1024).toFixed(2));

export function LimitsForm({ limits }: { limits: Limits }) {
  const t = useTranslations("Instance.limits");
  const [state, action, pending] = useActionState(setInstanceLimitsAction, undefined);
  // Keep forever turns the days off: the field then sends nothing and asks for nothing, and keeps
  // what it showed for when the box is unticked. Never does the same for the album reminder.
  const [forever, setForever] = useState(limits.retentionDays === null);
  const [never, setNever] = useState(limits.albumReminderDefaultDays === null);
  // The card's numbers, in its order (M7 ticket 01): the three counts, then the upload and storage
  // limits with their unit in the label, each within the range instance/limits.ts sets.
  const numbers = [
    { name: "maxEventsPerHost", min: LIMIT_MIN, max: LIMIT_MAX, step: 1, value: limits.maxEventsPerHost },
    { name: "maxRsvpsPerEvent", min: LIMIT_MIN, max: LIMIT_MAX, step: 1, value: limits.maxRsvpsPerEvent },
    { name: "maxPhotosPerEvent", min: LIMIT_MIN, max: LIMIT_MAX, step: 1, value: limits.maxPhotosPerEvent },
    { name: "maxPhotoMb", min: PHOTO_MB.min, max: PHOTO_MB.max, step: 1, value: limits.maxPhotoMb },
    { name: "maxVideoMb", min: VIDEO_MB.min, max: VIDEO_MB.max, step: 1, value: limits.maxVideoMb },
    { name: "maxVideoMinutes", min: VIDEO_MINUTES.min, max: VIDEO_MINUTES.max, step: 1, value: limits.maxVideoMinutes },
    { name: "maxEventStorageGb", min: STORAGE_GB.min, max: STORAGE_GB.max, step: 0.01, value: gigabytes(limits.maxEventStorageMb) },
    { name: "maxSiteStorageGb", min: STORAGE_GB.min, max: STORAGE_GB.max, step: 0.01, value: gigabytes(limits.maxSiteStorageMb) },
  ] as const;
  return (
    <form action={action}>
      <FieldGroup>
        {numbers.map(({ name, min, max, step, value }) => (
          <Field key={name}>
            <FieldLabel htmlFor={name}>{t(name)}</FieldLabel>
            <Input id={name} name={name} type="number" inputMode={step === 1 ? "numeric" : "decimal"} min={min} max={max} step={step} defaultValue={value} required />
            <FieldDescription>{t(`${name}Hint`)}</FieldDescription>
          </Field>
        ))}
        <Field>
          <FieldLabel htmlFor="retentionDays">{t("retentionDays")}</FieldLabel>
          <Input
            id="retentionDays"
            name="retentionDays"
            type="number"
            inputMode="numeric"
            min={RETENTION_MIN_DAYS}
            max={RETENTION_MAX_DAYS}
            step={1}
            defaultValue={limits.retentionDays ?? DEFAULT_RETENTION_DAYS}
            disabled={forever}
            required={!forever}
          />
          <FieldDescription>{t("retentionDaysHint")}</FieldDescription>
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="keepForever" name="keepForever" checked={forever} onCheckedChange={(checked) => setForever(checked === true)} />
          <FieldLabel htmlFor="keepForever">{t("keepForever")}</FieldLabel>
        </Field>
        <Field>
          <FieldLabel htmlFor="albumReminderDefaultDays">{t("albumReminderDefaultDays")}</FieldLabel>
          <Input
            id="albumReminderDefaultDays"
            name="albumReminderDefaultDays"
            type="number"
            inputMode="numeric"
            min={REMINDER_DAYS.min}
            max={REMINDER_DAYS.max}
            step={1}
            defaultValue={limits.albumReminderDefaultDays ?? DEFAULT_LIMITS.albumReminderDefaultDays ?? 60}
            disabled={never}
            required={!never}
          />
          <FieldDescription>{t("albumReminderDefaultDaysHint")}</FieldDescription>
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="remindNever" name="remindNever" checked={never} onCheckedChange={(checked) => setNever(checked === true)} />
          <FieldLabel htmlFor="remindNever">{t("remindNever")}</FieldLabel>
        </Field>
        <FormOutcome state={state} />
        <Button type="submit" disabled={pending} className="self-start">
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}

// The Features card (M8 ticket 01): one switch per feature, each saying what it does, what
// switching it off means, and what it needs, each on a line of its own. The switches arrive as
// props: the feature list's values are for server code alone.
export function FeaturesForm({ switches, videosAvailable }: { switches: FeatureSwitches; videosAvailable: boolean }) {
  const t = useTranslations("Instance.features");
  const [state, action, pending] = useActionState(setFeaturesAction, undefined);
  return (
    <form action={action}>
      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox id="feature-album" name="album" defaultChecked={switches.album} aria-describedby="feature-album-hint" />
          <FieldContent>
            <FieldLabel htmlFor="feature-album">{t("album")}</FieldLabel>
            <FieldDescription id="feature-album-hint">{t("albumHint")}</FieldDescription>
          </FieldContent>
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="feature-videos" name="videos" defaultChecked={switches.videos} aria-describedby="feature-videos-hint" />
          <FieldContent>
            <FieldLabel htmlFor="feature-videos">{t("videos")}</FieldLabel>
            <FieldDescription id="feature-videos-hint">
              <span className="block">{t("videosHint")}</span>
              <span className="block">{t("needsAlbum")}</span>
              {!videosAvailable && <span className="block">{t("videosNoFfmpeg")}</span>}
            </FieldDescription>
          </FieldContent>
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="feature-voting" name="voting" defaultChecked={switches.voting} aria-describedby="feature-voting-hint" />
          <FieldContent>
            <FieldLabel htmlFor="feature-voting">{t("voting")}</FieldLabel>
            <FieldDescription id="feature-voting-hint">
              <span className="block">{t("votingHint")}</span>
              <span className="block">{t("needsAlbum")}</span>
            </FieldDescription>
          </FieldContent>
        </Field>
        <FormOutcome state={state} />
        <Button type="submit" disabled={pending} className="self-start">
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}

// The Storage card's one switch (M7 ticket 03): whether videos get a lighter copy for playback.
export function StorageForm({ processing }: { processing: boolean }) {
  const t = useTranslations("Instance.storage");
  const [state, action, pending] = useActionState(setVideoProcessingAction, undefined);
  return (
    <form action={action}>
      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox id="videoProcessing" name="videoProcessing" defaultChecked={processing} aria-describedby="videoProcessing-hint" />
          <FieldContent>
            <FieldLabel htmlFor="videoProcessing">{t("processVideos")}</FieldLabel>
            <FieldDescription id="videoProcessing-hint">{t("processVideosHint")}</FieldDescription>
          </FieldContent>
        </Field>
        <FormOutcome state={state} />
        <Button type="submit" disabled={pending} className="self-start">
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}

// Without mail there is no way to send the link from here, so the box to do so is not offered.
export function HostInvitationForm({ canSend }: { canSend: boolean }) {
  const t = useTranslations("Instance.invitations");
  const [state, action, pending] = useActionState(createHostInvitationAction, undefined);
  return (
    <div className="flex flex-col gap-4">
      <form action={action}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="invitation-email">{t("email")}</FieldLabel>
            <Input id="invitation-email" name="email" type="email" autoComplete="off" />
            <FieldDescription>{t("emailHint")}</FieldDescription>
          </Field>
          {canSend && (
            <Field orientation="horizontal">
              <Checkbox id="invitation-send" name="send" />
              <FieldLabel htmlFor="invitation-send">{t("send")}</FieldLabel>
            </Field>
          )}
          {!state?.link && state?.error && <FieldError>{state.error}</FieldError>}
          <Button type="submit" disabled={pending} className="self-start">
            {t("submit")}
          </Button>
        </FieldGroup>
      </form>
      {state?.link && <NewHostInvitation link={state.link} sentTo={state.sentTo} notSent={state.error} />}
    </div>
  );
}

function NewHostInvitation({ link, sentTo, notSent }: { link: string; sentTo?: string; notSent?: string }) {
  const t = useTranslations("Instance.invitations");
  const [copied, setCopied] = useState(false);

  // As on the share page: a browser that refuses the clipboard leaves the link on the page to
  // select by hand, and "Copied" is said for a moment rather than forever.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-4">
      <p role="status" className="text-sm">
        {t("created")}
      </p>
      <Field>
        <FieldLabel htmlFor="invitation-link">{t("link")}</FieldLabel>
        <Input id="invitation-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} className="font-mono" />
      </Field>
      <Button type="button" onClick={copy} className="self-start" aria-live="polite">
        {copied ? <Check /> : <Copy />}
        {copied ? t("copied") : t("copy")}
      </Button>
      {sentTo && (
        <p role="status" className="text-sm">
          {t("sent", { email: sentTo })}
        </p>
      )}
      {notSent && <FieldError>{notSent}</FieldError>}
    </div>
  );
}
