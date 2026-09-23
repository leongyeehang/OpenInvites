"use client";

import { Check, ChevronDown, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { changeThemeAction } from "@/themes/actions";
import { BACKGROUNDS, type Background } from "@/themes/backgrounds";
import { themeReadout, type ThemeChange } from "@/themes/changes";
import { TITLE_FONTS } from "@/themes/fonts";
import { resolveTheme, themeVariables } from "@/themes/resolve";
import { SWATCHES } from "@/themes/swatches";
import { TEMPLATES } from "@/themes/templates";
import { applyTemplate, BUTTON_STYLES, FONTS, LAYOUTS, OFFERED_LAYOUTS, TEXT_TONES, type Layout } from "@/themes/theme";
import { useTheme } from "@/themes/themed-page";
import { TITLE_FONT_CLASSES } from "@/themes/title-fonts";

// Each template as it would look, for its thumbnail. Templates are fixed data, so once is enough.
const TEMPLATE_LOOKS = new Map(TEMPLATES.map((template) => [template.id, resolveTheme(applyTemplate(null, template))]));

// The Design drawer's panel (spec, "Host: the look"): a plain panel beside the invitation, which
// keeps changing as the host chooses. Top to bottom: upload (ticket 12), templates, layout,
// background, and the finer knobs under Details. Every choice shows at once and is saved as it
// is made; guests see what was saved. Ticket 11 turns it into a bottom sheet on phones and a side
// panel on desktop.
export function DesignPanel({ eventId, title, onClose }: { eventId: string; title: string; onClose: () => void }) {
  const t = useTranslations("DesignDrawer");
  const { theme, resolved, change } = useTheme();
  const [details, setDetails] = useState(false);
  const [saving, startSaving] = useTransition();
  const [outcome, setOutcome] = useState<"saved" | "failed">();
  const panel = useRef<HTMLElement>(null);
  const id = useId();

  // Opening moves focus into the panel, so the keyboard and a screen reader land in it.
  useEffect(() => {
    panel.current?.focus();
  }, []);

  const choose = (next: ThemeChange) =>
    startSaving(async () => {
      change(next);
      const { saved } = await changeThemeAction(eventId, next);
      setOutcome(saved ? "saved" : "failed");
    });

  const readout = themeReadout(theme);
  const themeName = !readout.custom ? readout.template : readout.template ? t("customFrom", { template: readout.template }) : t("custom");
  // What Auto would pick, shown in its swatch whatever is chosen now.
  const autoAccent = resolveTheme({ ...theme, accentOverride: null }).accent;

  return (
    <section
      ref={panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      onKeyDown={(event) => event.key === "Escape" && onClose()}
      className="dark fixed inset-x-2 bottom-2 z-50 flex max-h-[62dvh] flex-col overflow-hidden rounded-3xl border bg-popover/95 text-popover-foreground shadow-2xl backdrop-blur-2xl outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-200 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-h-[min(82dvh,760px)] sm:w-[380px]"
    >
      <header className="flex items-start justify-between gap-3 border-b px-5 py-3.5">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="font-medium">
            {t("title")}
          </h2>
          <p aria-live="polite" className={cn("text-xs", outcome === "failed" && !saving ? "text-destructive" : "text-muted-foreground")}>
            {saving ? t("saving") : outcome === "failed" ? t("failed") : outcome === "saved" ? t("saved") : t("autosave")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="-mr-2 grid size-10 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 pt-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        {/* Uploads arrive with ticket 12; the button holds their place at the top. */}
        <button
          type="button"
          disabled
          className="flex h-16 w-full cursor-not-allowed items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-sm font-medium text-muted-foreground"
        >
          <Upload className="size-5" aria-hidden />
          {t("upload")}
          <Badge>{t("comingSoon")}</Badge>
        </button>

        <section aria-labelledby={`${id}-templates`}>
          <Heading id={`${id}-templates`} hint={t("templatesHint")}>
            {t("templates")}
          </Heading>
          <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pt-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TEMPLATES.map((template) => {
              const current = theme.template?.id === template.id;
              const clean = current && !theme.template!.dirty;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => choose({ template: template.id })}
                  aria-pressed={clean}
                  title={template.blurb}
                  className="group w-[84px] shrink-0 cursor-pointer rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                >
                  <TemplateThumb templateId={template.id} title={title} state={clean ? "on" : current ? "edited" : "off"} />
                  <span className="mt-1.5 block truncate text-xs font-medium">{template.name}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-sm">{t("theme", { name: themeName })}</p>
        </section>

        <Choices legend={t("layout")}>
          <div className="grid grid-cols-3 gap-2">
            {LAYOUTS.map((layout) => {
              const offered = OFFERED_LAYOUTS.includes(layout);
              return (
                <Choice
                  key={layout}
                  name="layout"
                  checked={resolved.layout === layout}
                  disabled={!offered}
                  // Poster is the only layout offered, so there is nothing to change to yet.
                  onSelect={() => undefined}
                  className="flex-col items-start gap-2 bg-accent/40 p-2.5"
                >
                  <LayoutSketch layout={layout} />
                  <span className="text-sm font-medium">{t(`layouts.${layout}.name`)}</span>
                  {offered ? (
                    <span className="text-[11px] leading-snug text-muted-foreground">{t(`layouts.${layout}.note`)}</span>
                  ) : (
                    <Badge>{t("comingSoon")}</Badge>
                  )}
                </Choice>
              );
            })}
          </div>
        </Choices>

        <Choices legend={t("background")}>
          <div className="grid grid-cols-5 gap-2">
            {BACKGROUNDS.map((background) => {
              const checked = theme.backgroundId === background.id;
              return (
                <Choice
                  key={background.id}
                  name="background"
                  checked={checked}
                  onSelect={() => choose({ knob: "backgroundId", value: background.id })}
                  className="aspect-[3/4]"
                  style={fill(background)}
                >
                  {checked && <Tick />}
                  <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-1.5 pt-4 pb-1 text-[10px] leading-tight font-medium text-white">
                    {background.name}
                  </span>
                </Choice>
              );
            })}
          </div>
        </Choices>

        <section>
          <button
            type="button"
            onClick={() => setDetails((shown) => !shown)}
            aria-expanded={details}
            aria-controls={`${id}-details`}
            className="flex w-full cursor-pointer items-center justify-between rounded-xl border-t pt-4 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {t("details")}
            <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", details && "rotate-180")} aria-hidden />
          </button>
          <div id={`${id}-details`} hidden={!details} className="mt-5 space-y-7">
            <Choices legend={t("font")}>
              <div className="grid grid-cols-4 gap-2">
                {FONTS.map((key) => {
                  const font = TITLE_FONTS[key];
                  return (
                    <Choice
                      key={key}
                      name="font"
                      checked={theme.font === key}
                      onSelect={() => choose({ knob: "font", value: key })}
                      className="aspect-square flex-col items-center justify-center gap-1 bg-accent/40"
                    >
                      <span aria-hidden className={cn("font-title text-3xl leading-none", TITLE_FONT_CLASSES[key], font.className)}>
                        Aa
                      </span>
                      <span className="px-1 text-center text-[10px] leading-tight text-muted-foreground">{font.name}</span>
                    </Choice>
                  );
                })}
              </div>
            </Choices>

            <Choices legend={t("accent")} hint={t("accentHint")}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Choice
                  name="accent"
                  checked={theme.accentOverride === null}
                  onSelect={() => choose({ knob: "accentOverride", value: null })}
                  className="h-9 items-center gap-2 rounded-full bg-accent/40 pr-3 pl-1 text-xs font-medium"
                >
                  <span aria-hidden className="size-7 rounded-full ring-1 ring-foreground/20" style={{ background: autoAccent }} />
                  {t("auto")}
                </Choice>
                {SWATCHES.map((swatch) => (
                  <Choice
                    key={swatch.id}
                    name="accent"
                    checked={theme.accentOverride === swatch.hex}
                    onSelect={() => choose({ knob: "accentOverride", value: swatch.hex })}
                    className="size-9 rounded-full"
                    style={{ background: swatch.hex }}
                  >
                    <span className="sr-only">{t(`swatches.${swatch.id}`)}</span>
                  </Choice>
                ))}
              </div>
            </Choices>

            <Segmented
              legend={t("textTone")}
              hint={t("textToneHint")}
              name="textTone"
              value={theme.textTone}
              options={TEXT_TONES.map((tone) => ({ value: tone, label: t(`tones.${tone}`) }))}
              onSelect={(value) => choose({ knob: "textTone", value })}
            />

            <Segmented
              legend={t("buttons")}
              name="buttonStyle"
              value={theme.buttonStyle}
              options={BUTTON_STYLES.map((style) => ({ value: style, label: t(`buttonStyles.${style}`) }))}
              onSelect={(value) => choose({ knob: "buttonStyle", value })}
            />
          </div>
        </section>
      </div>
    </section>
  );
}

function fill(background: Background): CSSProperties {
  return background.kind === "gradient"
    ? { background: background.css }
    : { backgroundImage: `url(${background.src})`, backgroundSize: "cover", backgroundPosition: "center" };
}

// A tiny poster in the template's own theme: its background, a pane of its glass, the event's
// title in its font, and a stroke of its accent.
function TemplateThumb({ templateId, title, state }: { templateId: string; title: string; state: "on" | "edited" | "off" }) {
  const look = TEMPLATE_LOOKS.get(templateId)!;
  const { background, font } = look;
  return (
    <span
      aria-hidden
      className={cn(
        "relative block aspect-[3/4] overflow-hidden rounded-xl ring-offset-2 ring-offset-popover transition-transform group-hover:scale-[1.03] motion-reduce:transition-none",
        state === "on" ? "ring-2 ring-foreground" : state === "edited" ? "outline-2 outline-offset-2 outline-foreground/60 outline-dashed" : "ring-1 ring-border",
      )}
      style={{ ...fill(background), ...(themeVariables(look) as CSSProperties) }}
    >
      {background.kind === "photo" && <span className="absolute inset-0 bg-theme-scrim" />}
      <span className="absolute inset-1.5 top-5 rounded-lg border border-theme-glass-border bg-theme-glass p-1.5 text-theme-text backdrop-blur-sm">
        <span className={cn("font-title line-clamp-3 block leading-[0.95] break-words", TITLE_FONT_CLASSES[font.key], font.className, font.key === "serif" ? "text-[13px]" : "text-[11px]")}>
          {title}
        </span>
        <span className="mt-1.5 block h-1.5 w-8 rounded-full bg-theme-accent" />
      </span>
      {state === "on" && <Tick />}
    </span>
  );
}

// A wireframe of each layout.
function LayoutSketch({ layout }: { layout: Layout }) {
  const bar = "rounded-[2px] bg-foreground/35";
  return (
    <span aria-hidden className="flex h-14 w-full flex-col gap-1 rounded-md bg-foreground/5 p-1.5">
      {layout === "poster" && (
        <>
          <span className={cn(bar, "h-5 w-full rounded-[4px] bg-foreground/45")} />
          <span className="flex gap-1">
            <span className={cn(bar, "h-2 flex-1")} />
            <span className={cn(bar, "h-2 flex-1")} />
            <span className={cn(bar, "h-2 flex-1")} />
          </span>
          <span className={cn(bar, "h-1.5 w-3/4")} />
        </>
      )}
      {layout === "broadsheet" && (
        <>
          <span className={cn(bar, "h-px w-full bg-foreground/60")} />
          <span className="flex flex-1 gap-1.5">
            <span className="flex flex-1 flex-col gap-1">
              <span className={cn(bar, "h-3 w-full bg-foreground/60")} />
              <span className={cn(bar, "h-1.5 w-full")} />
              <span className={cn(bar, "h-1.5 w-2/3")} />
            </span>
            <span className={cn(bar, "w-1/3 bg-foreground/25")} />
          </span>
        </>
      )}
      {layout === "thread" && (
        <>
          <span className={cn(bar, "h-2.5 w-3/5 rounded-md")} />
          <span className={cn(bar, "h-2.5 w-4/5 rounded-md")} />
          <span className={cn(bar, "h-2.5 w-2/5 self-end rounded-md bg-foreground/60")} />
        </>
      )}
    </span>
  );
}

const HEADING = "text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase";
const HINT = "-mt-1.5 mb-2.5 text-xs text-muted-foreground";

function Heading({ id, hint, children }: { id?: string; hint?: string; children: ReactNode }) {
  return (
    <>
      <h3 id={id} className={cn(HEADING, "mb-2.5")}>
        {children}
      </h3>
      {hint && <p className={HINT}>{hint}</p>}
    </>
  );
}

// A group of choices, one of which is on: a fieldset whose legend reads like the other headings,
// with its hint under it as a description rather than part of its name.
function Choices({ legend, hint, children }: { legend: string; hint?: string; children: ReactNode }) {
  const hintId = useId();
  return (
    <fieldset aria-describedby={hint && hintId}>
      <legend className={cn(HEADING, "mb-2.5")}>{legend}</legend>
      {hint && (
        <p id={hintId} className={HINT}>
          {hint}
        </p>
      )}
      {children}
    </fieldset>
  );
}

// One choice: a radio button laid invisibly over its tile, so the tile is what the host taps and
// the radio is what the keyboard and a screen reader meet.
function Choice({
  name,
  checked,
  disabled = false,
  onSelect,
  className,
  style,
  children,
}: {
  name: string;
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "relative flex overflow-hidden rounded-xl ring-offset-2 ring-offset-popover has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-ring",
        checked ? "ring-2 ring-foreground" : "ring-1 ring-border",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:ring-foreground/50",
        className,
      )}
      style={style}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="absolute inset-0 z-10 m-0 cursor-[inherit] appearance-none opacity-0"
      />
      {children}
    </label>
  );
}

function Segmented<T extends string>({
  legend,
  hint,
  name,
  value,
  options,
  onSelect,
}: {
  legend: string;
  hint?: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onSelect: (value: T) => void;
}) {
  return (
    <Choices legend={legend} hint={hint}>
      <div className="inline-flex flex-wrap gap-1 rounded-full bg-accent/60 p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "relative inline-flex h-9 cursor-pointer items-center rounded-full px-3.5 text-xs font-medium transition-colors motion-reduce:transition-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
              value === option.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name={name}
              checked={value === option.value}
              onChange={() => onSelect(option.value)}
              className="absolute inset-0 m-0 cursor-pointer appearance-none opacity-0"
            />
            {option.label}
          </label>
        ))}
      </div>
    </Choices>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{children}</span>;
}

// The mark on a chosen tile, so the choice never rests on colour alone.
function Tick() {
  return (
    <span aria-hidden className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-foreground text-background">
      <Check className="size-3" />
    </span>
  );
}
