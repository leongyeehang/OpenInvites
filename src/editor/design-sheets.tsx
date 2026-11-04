"use client";

import { Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { BACKGROUNDS } from "@/themes/backgrounds";
import { changeThemeAction } from "@/themes/actions";
import { changedLook, type ThemeChange } from "@/themes/changes";
import { Confetti } from "@/themes/effects/confetti";
import { TITLE_FONTS } from "@/themes/fonts";
import { GALLERY_POSTERS, OCCASIONS, type GalleryPosterId, type Occasion } from "@/themes/posters";
import { resolveTheme } from "@/themes/resolve";
import { SWATCHES } from "@/themes/swatches";
import { BUTTON_STYLES, EFFECTS, FONTS, OFFERED_LAYOUTS, TITLE_PLACEMENTS, type Poster, type TextTone } from "@/themes/theme";
import { useTheme } from "@/themes/themed-page";
import { TITLE_FONT_CLASSES } from "@/themes/title-fonts";
import { describeUploadAction } from "@/uploads/actions";
import { EMOJI_BACKGROUNDS, EMOJI_PALETTE, emojiIn, MAX_EMOJI, type EmojiBackground } from "@/uploads/emoji";
import { UPLOAD_PROBLEMS, type UploadProblem } from "@/uploads/validate";
import { AltText, Choice, Choices, fillWith, LayoutSketch, MEGABYTE, PictureInput, Segmented, Tick, TileName } from "./choices";
import { EditorSheet } from "./sheet";
import { useEditor } from "./status";

// The editor's design sheets (M4 spec, "The toolbar"): Poster, Title, Theme and Effect, each a
// sheet of large swatches over a live copy of the invitation, which shrinks above it on a phone.
// Every choice shows on the invitation at once and is saved as it is made, through the action the
// Design drawer of 0.4 used; the top bar says how the save went.

// The page's tone as a host thinks of it: the page Dark carries light text, Light dark text.
const PAGES: { page: "auto" | "dark" | "light"; tone: TextTone }[] = [
  { page: "auto", tone: "auto" },
  { page: "dark", tone: "light" },
  { page: "light", tone: "dark" },
];

// A change shown at once and saved, through the editor's status.
function useChoose(eventId: string) {
  const t = useTranslations("Editor");
  const { change } = useTheme();
  const { save } = useEditor();
  const [, startSaving] = useTransition();
  return (next: ThemeChange) =>
    startSaving(async () => {
      change(next);
      await save(async () => {
        const { saved } = await changeThemeAction(eventId, next);
        return saved ? { saved: true } : { saved: false, error: t("failed") };
      });
    });
}

export function DesignSheets({ eventId, title, maxUploadBytes }: { eventId: string; title: string; maxUploadBytes: number }) {
  const t = useTranslations("Design");
  const { sheet, openSheet } = useEditor();
  const toggle = (name: "poster" | "title" | "theme" | "effect") => (open: boolean) => openSheet(open ? name : null);
  return (
    <>
      <EditorSheet design open={sheet === "poster"} onOpenChange={toggle("poster")} title={t("sheets.poster")}>
        <PosterSheet eventId={eventId} maxUploadBytes={maxUploadBytes} />
      </EditorSheet>
      <EditorSheet design open={sheet === "title"} onOpenChange={toggle("title")} title={t("sheets.title")}>
        <TitleSheet eventId={eventId} title={title} />
      </EditorSheet>
      <EditorSheet design open={sheet === "theme"} onOpenChange={toggle("theme")} title={t("sheets.theme")}>
        <ThemeSheet eventId={eventId} />
      </EditorSheet>
      <EditorSheet design open={sheet === "effect"} onOpenChange={toggle("effect")} title={t("sheets.effect")}>
        <EffectSheet eventId={eventId} />
      </EditorSheet>
    </>
  );
}

type Tab = "gallery" | "emoji" | "colour" | "upload";
const TABS: Tab[] = ["gallery", "emoji", "colour", "upload"];

// Poster: the gallery by occasion, an emoji pattern, a colour, or the host's own picture.
function PosterSheet({ eventId, maxUploadBytes }: { eventId: string; maxUploadBytes: number }) {
  const t = useTranslations("Design");
  const names = useTranslations("Posters");
  const { theme, upload } = useTheme();
  const choose = useChoose(eventId);
  const id = useId();
  const [tab, setTab] = useState<Tab>(theme.poster.kind === "gallery" ? "gallery" : theme.poster.kind === "colour" ? "colour" : upload?.emoji ? "emoji" : "upload");
  const [occasion, setOccasion] = useState<Occasion | "all">("all");
  const isPoster = (poster: Poster) => theme.poster.kind === poster.kind && (poster.kind === "upload" || (theme.poster as { id: string }).id === poster.id);
  const restorable = changedLook(theme);
  const shown = GALLERY_POSTERS.filter((poster) => occasion === "all" || poster.occasion === occasion);

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label={t("poster")} className="grid grid-cols-4 gap-1 rounded-full bg-accent/60 p-1">
        {TABS.map((each) => (
          <button
            key={each}
            type="button"
            role="tab"
            id={`${id}-${each}`}
            aria-selected={tab === each}
            aria-controls={`${id}-${each}-panel`}
            onClick={() => setTab(each)}
            className={cn(
              "h-9 cursor-pointer rounded-full text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              tab === each ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`tabs.${each}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${id}-${tab}-panel`} aria-labelledby={`${id}-${tab}`}>
        {tab === "gallery" && (
          <div className="space-y-4">
            <Segmented
              legend={t("occasion")}
              name="occasion"
              value={occasion}
              options={[{ value: "all" as const, label: t("allOccasions") }, ...OCCASIONS.map((each) => ({ value: each, label: names(`occasions.${each}`) }))]}
              onSelect={setOccasion}
            />
            <Choices legend={t("poster")} hint={t("posterHint")}>
              <div className="grid grid-cols-3 gap-2">
                {shown.map((poster) => {
                  const value: Poster = { kind: "gallery", id: poster.id };
                  return (
                    <Choice key={poster.id} name="poster" checked={isPoster(value)} onSelect={() => choose({ knob: "poster", value })} className="aspect-[4/5]" style={fillWith(poster.src)}>
                      {isPoster(value) && <Tick />}
                      <TileName>{names(`names.${poster.id}`)}</TileName>
                    </Choice>
                  );
                })}
              </div>
            </Choices>
            {restorable && (
              <button
                type="button"
                onClick={(event) => {
                  // The button goes as the look comes back: the focus stays in the sheet, on its heading.
                  event.currentTarget.closest('[role="dialog"]')?.querySelector<HTMLElement>("[data-sheet-heading]")?.focus();
                  choose({ knob: "poster", value: { kind: "gallery", id: restorable } });
                }}
                className="inline-flex h-9 cursor-pointer items-center rounded-full bg-accent/60 px-3.5 text-xs font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {t("restoreLook", { poster: names(`names.${restorable as GalleryPosterId}`) })}
              </button>
            )}
          </div>
        )}

        {tab === "colour" && (
          <Choices legend={t("colours")}>
            <div className="grid grid-cols-3 gap-2">
              {BACKGROUNDS.map((background) => {
                const value: Poster = { kind: "colour", id: background.id };
                return (
                  <Choice key={background.id} name="poster" checked={isPoster(value)} onSelect={() => choose({ knob: "poster", value })} className="aspect-[4/5]" style={{ background: background.css }}>
                    {isPoster(value) && <Tick />}
                    <TileName>{t(`colourNames.${background.id}`)}</TileName>
                  </Choice>
                );
              })}
            </div>
          </Choices>
        )}

        {tab === "upload" && <UploadTab eventId={eventId} maxUploadBytes={maxUploadBytes} onShow={() => choose({ knob: "poster", value: { kind: "upload" } })} />}

        {tab === "emoji" && <EmojiTab eventId={eventId} />}
      </div>
    </div>
  );
}

// Upload: the host's photo or flyer, as in 0.4, with what it shows for a screen reader.
function UploadTab({ eventId, maxUploadBytes, onShow }: { eventId: string; maxUploadBytes: number; onShow: () => void }) {
  const t = useTranslations("Design");
  const { upload, resolved } = useTheme();
  const { save } = useEditor();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<UploadProblem | "failed" | "tooFast">();
  const [, startRefresh] = useTransition();
  const id = useId();
  const max = maxUploadBytes / MEGABYTE;
  // A photo, not an emoji pattern, which has a tab of its own.
  const photo = upload && !upload.emoji ? upload : null;
  const shown = resolved.upload !== null;

  const send = async (file: File) => {
    setProblem(undefined);
    if (file.size > maxUploadBytes) return setProblem("tooLarge");
    setUploading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/upload`, { method: "POST", body: file });
      if (response.status === 429) return setProblem("tooFast");
      if (!response.ok) {
        const { problem: refused } = (await response.json().catch(() => ({}))) as { problem?: UploadProblem };
        return setProblem(refused && UPLOAD_PROBLEMS.includes(refused) ? refused : "failed");
      }
      startRefresh(() => router.refresh());
    } catch {
      setProblem("failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {photo && (
        <div className="flex gap-3">
          <span aria-hidden className="h-28 w-22 shrink-0 rounded-xl ring-1 ring-border" style={fillWith(photo.thumbnailSrc)} />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            {!shown && (
              <button type="button" onClick={onShow} className="inline-flex h-9 cursor-pointer items-center rounded-full bg-foreground px-3.5 text-xs font-medium text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                {t("showPicture")}
              </button>
            )}
            <label
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full bg-accent/60 px-3.5 text-xs font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                uploading ? "cursor-wait text-muted-foreground" : "cursor-pointer hover:bg-accent",
              )}
            >
              <Upload className="size-4" aria-hidden />
              {uploading ? t("uploading") : t("replace")}
              <PictureInput disabled={uploading} onPick={send} describedBy={`${id}-hint`} />
            </label>
          </div>
        </div>
      )}
      {!photo && (
        <label
          className={cn(
            "flex h-24 w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-ring",
            uploading ? "cursor-wait text-muted-foreground" : "cursor-pointer hover:bg-accent/40",
          )}
        >
          <Upload className="size-5" aria-hidden />
          {uploading ? t("uploading") : t("upload")}
          <PictureInput disabled={uploading} onPick={send} describedBy={`${id}-hint`} />
        </label>
      )}
      {problem ? (
        <p id={`${id}-hint`} role="alert" className="text-sm text-destructive">
          {t(`uploadProblems.${problem}`, { max })}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {t("uploadHint", { max })}
        </p>
      )}
      {photo && (
        <AltText
          key={photo.id}
          upload={photo}
          onSave={(altText) =>
            void save(async () => {
              const { saved } = await describeUploadAction(eventId, altText);
              return saved ? { saved: true } : { saved: false, error: t("uploadProblems.failed") };
            })
          }
        />
      )}
    </div>
  );
}

// The emoji pattern's size, the gallery's, and how large each emoji is drawn on it.
const PATTERN = { width: 1200, height: 1500 };
const EMOJI_SIZE = 170;
// A change to the pattern is drawn and sent this long after the host's last one.
const DRAW_AFTER = 900;

// Draws the pattern: the colour, and the emoji in staggered rows, each a little turned, in turn.
function drawPattern(canvas: HTMLCanvasElement, emoji: string[], background: string) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const scale = canvas.width / PATTERN.width;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.fillStyle = background;
  context.fillRect(0, 0, PATTERN.width, PATTERN.height);
  if (emoji.length === 0) return;
  context.font = `${EMOJI_SIZE}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const step = { x: 300, y: 260 };
  let at = 0;
  for (let row = -1, y = step.y / 2; y < PATTERN.height + step.y; row++, y += step.y) {
    const offset = row % 2 === 0 ? 0 : step.x / 2;
    for (let x = offset - step.x / 2; x < PATTERN.width + step.x; x += step.x) {
      context.save();
      context.translate(x, y);
      context.rotate((((at * 37) % 30) - 15) * (Math.PI / 180));
      context.fillText(emoji[at % emoji.length], 0, 0);
      context.restore();
      at++;
    }
  }
}

// Emoji: up to three emoji on one of seven colours, drawn here, in the browser, and uploaded as
// the event's picture (M4 spec, "Emoji posters"), redrawn and replaced as the host changes it.
function EmojiTab({ eventId }: { eventId: string }) {
  const t = useTranslations("Design");
  const { upload } = useTheme();
  const { save } = useEditor();
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const id = useId();
  const [emoji, setEmoji] = useState<string[]>(upload?.emoji?.emoji ?? []);
  const [background, setBackground] = useState<EmojiBackground>((upload?.emoji?.background as EmojiBackground | undefined) ?? EMOJI_BACKGROUNDS[0]);
  const [typed, setTyped] = useState("");
  const preview = useRef<HTMLCanvasElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const changed = useRef(false);

  useEffect(() => {
    if (preview.current) drawPattern(preview.current, emoji, background);
  }, [emoji, background]);

  // Drawn at the gallery's size and sent once the host stops changing it.
  useEffect(() => {
    if (!changed.current || emoji.length === 0) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const canvas = document.createElement("canvas");
      canvas.width = PATTERN.width;
      canvas.height = PATTERN.height;
      drawPattern(canvas, emoji, background);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          void save(async () => {
            const query = new URLSearchParams({ emoji: JSON.stringify(emoji), background });
            const response = await fetch(`/api/events/${eventId}/upload?${query}`, { method: "POST", body: blob });
            if (!response.ok) return { saved: false, error: t(response.status === 429 ? "uploadProblems.tooFast" : "uploadProblems.failed", { max: 0 }) };
            startRefresh(() => router.refresh());
            return { saved: true };
          });
        },
        "image/jpeg",
        0.9,
      );
    }, DRAW_AFTER);
    return () => clearTimeout(timer.current);
  }, [emoji, background, eventId, router, save, t]);

  const update = (next: string[]) => {
    changed.current = true;
    setEmoji(next.slice(0, MAX_EMOJI));
  };
  const toggle = (each: string) => update(emoji.includes(each) ? emoji.filter((one) => one !== each) : emoji.length < MAX_EMOJI ? [...emoji, each] : emoji);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <canvas ref={preview} width={96} height={120} aria-hidden className="shrink-0 rounded-xl ring-1 ring-border" />
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("emoji.chosen")}</p>
          {emoji.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("emoji.none")}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {emoji.map((each) => (
                <li key={each}>
                  <button
                    type="button"
                    onClick={() => toggle(each)}
                    aria-label={t("emoji.remove", { emoji: each })}
                    className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-full bg-accent/60 pr-2.5 pl-3 text-xl hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {each}
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-muted-foreground">{t("emoji.palette")}</legend>
        <div className="grid grid-cols-8 gap-1">
          {EMOJI_PALETTE.map((each) => (
            <button
              key={each}
              type="button"
              aria-pressed={emoji.includes(each)}
              onClick={() => toggle(each)}
              className={cn(
                "grid aspect-square cursor-pointer place-items-center rounded-xl text-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                emoji.includes(each) ? "bg-foreground/20 ring-2 ring-foreground" : "hover:bg-accent",
              )}
            >
              {each}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${id}-typed`} className="mb-2 block text-xs font-medium text-muted-foreground">
          {t("emoji.typed")}
        </label>
        <input
          id={`${id}-typed`}
          value={typed}
          aria-describedby={`${id}-typed-hint`}
          onChange={(event) => {
            setTyped(event.target.value);
            const found = emojiIn(event.target.value);
            if (found.length > 0) update(found);
          }}
          className="h-10 w-full rounded-xl border border-input bg-transparent px-3 text-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p id={`${id}-typed-hint`} className="mt-1 text-xs text-muted-foreground">
          {t("emoji.typedHint")}
        </p>
      </div>

      <Choices legend={t("emoji.colour")}>
        <div className="flex flex-wrap gap-2">
          {EMOJI_BACKGROUNDS.map((colour) => (
            <Choice
              key={colour}
              name="emoji-background"
              checked={background === colour}
              onSelect={() => {
                changed.current = true;
                setBackground(colour);
              }}
              className="size-10 rounded-full"
              style={{ background: colour }}
            >
              <span className="sr-only">{t(`emoji.colours.${colour}`)}</span>
            </Choice>
          ))}
        </div>
      </Choices>
    </div>
  );
}

// Title: the four faces, each showing the event's own title, and whether it sits on the poster.
function TitleSheet({ eventId, title }: { eventId: string; title: string }) {
  const t = useTranslations("Design");
  const editor = useTranslations("Editor");
  const { theme, resolved } = useTheme();
  const choose = useChoose(eventId);
  return (
    <div className="space-y-6">
      <Choices legend={t("font")}>
        <div className="grid grid-cols-2 gap-2">
          {FONTS.map((key) => {
            const font = TITLE_FONTS[key];
            return (
              <Choice key={key} name="font" checked={theme.font === key} onSelect={() => choose({ knob: "font", value: key })} className="h-24 flex-col justify-between bg-accent/40 p-3">
                <span aria-hidden className={cn("font-title line-clamp-2 text-2xl leading-none break-words", TITLE_FONT_CLASSES[key], font.className)}>
                  {title || editor("titlePlaceholder")}
                </span>
                <span className="text-[11px] text-muted-foreground">{t(`fontNames.${key}`)}</span>
              </Choice>
            );
          })}
        </div>
      </Choices>
      {/* Only a picture has a title placement; on a colour the title is always on the poster. */}
      {resolved.poster && (
        <Segmented
          legend={t("titlePlacement")}
          hint={t(`titlePlacementHints.${theme.titlePlacement}`)}
          name="titlePlacement"
          value={theme.titlePlacement}
          options={TITLE_PLACEMENTS.map((placement) => ({ value: placement, label: t(`titlePlacements.${placement}`) }))}
          onSelect={(value) => choose({ knob: "titlePlacement", value })}
        />
      )}
    </div>
  );
}

// Theme: the accent, the page dark or light, the RSVP buttons and the layout.
function ThemeSheet({ eventId }: { eventId: string }) {
  const t = useTranslations("Design");
  const { theme, resolved, upload } = useTheme();
  const choose = useChoose(eventId);
  // What Auto would pick, shown in its swatch whatever is chosen now.
  const autoAccent = resolveTheme({ ...theme, accentOverride: null }, upload).accent;
  const page = PAGES.find((each) => each.tone === theme.textTone)?.page ?? "auto";
  return (
    <div className="space-y-6">
      <Choices legend={t("accent")} hint={t("accentHint")}>
        <div className="flex flex-wrap items-center gap-1.5">
          <Choice
            name="accent"
            checked={theme.accentOverride === null}
            onSelect={() => choose({ knob: "accentOverride", value: null })}
            className="h-10 items-center gap-2 rounded-full bg-accent/40 pr-3 pl-1 text-xs font-medium"
          >
            <span aria-hidden className="size-8 rounded-full ring-1 ring-foreground/20" style={{ background: autoAccent }} />
            {t("auto")}
          </Choice>
          {SWATCHES.map((swatch) => (
            <Choice
              key={swatch.id}
              name="accent"
              checked={theme.accentOverride === swatch.hex}
              onSelect={() => choose({ knob: "accentOverride", value: swatch.hex })}
              className="size-10 rounded-full"
              style={{ background: swatch.hex }}
            >
              <span className="sr-only">{t(`swatches.${swatch.id}`)}</span>
            </Choice>
          ))}
        </div>
      </Choices>
      <Segmented
        legend={t("page")}
        hint={t("pageHint")}
        name="page"
        value={page}
        options={PAGES.map((each) => ({ value: each.page, label: t(`pages.${each.page}`) }))}
        onSelect={(value) => choose({ knob: "textTone", value: PAGES.find((each) => each.page === value)!.tone })}
      />
      <Segmented
        legend={t("buttons")}
        name="buttonStyle"
        value={theme.buttonStyle}
        options={BUTTON_STYLES.map((style) => ({ value: style, label: t(`buttonStyles.${style}`) }))}
        onSelect={(value) => choose({ knob: "buttonStyle", value })}
      />
      <Choices legend={t("layout")}>
        <div className="grid grid-cols-3 gap-2">
          {OFFERED_LAYOUTS.map((layout) => (
            <Choice
              key={layout}
              name="layout"
              checked={resolved.layout === layout}
              onSelect={() => choose({ knob: "layout", value: layout })}
              className="flex-col items-start gap-2 bg-accent/40 p-2.5"
            >
              <LayoutSketch layout={layout} />
              <span className="text-sm font-medium">{t(`layouts.${layout}.name`)}</span>
              <span className="text-[11px] leading-snug text-muted-foreground">{t(`layouts.${layout}.note`)}</span>
            </Choice>
          ))}
        </div>
      </Choices>
    </div>
  );
}

// Effect: none, sparkles, confetti or doodles. Choosing confetti lets it fall once, to show it,
// unless the host's device asks for reduced motion, where none falls for anyone.
function EffectSheet({ eventId }: { eventId: string }) {
  const t = useTranslations("Design");
  const { theme } = useTheme();
  const choose = useChoose(eventId);
  const [falls, setFalls] = useState(0);
  return (
    <>
      {falls > 0 && <Confetti key={falls} />}
      <Choices legend={t("effect")} hint={t("effectHint")}>
        <div className="grid grid-cols-2 gap-2">
          {EFFECTS.map((effect) => (
            <Choice
              key={effect}
              name="effect"
              checked={theme.effect === effect}
              onSelect={() => {
                choose({ knob: "effect", value: effect });
                if (effect === "confetti") setFalls((count) => count + 1);
              }}
              className="flex-col items-start gap-1 bg-accent/40 p-3"
            >
              <span className="text-sm font-medium">{t(`effects.${effect}.name`)}</span>
              <span className="text-[11px] leading-snug text-muted-foreground">{t(`effects.${effect}.note`)}</span>
            </Choice>
          ))}
        </div>
      </Choices>
    </>
  );
}
