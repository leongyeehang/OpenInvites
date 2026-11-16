"use client";

import { ChevronDown, ChevronRight, ChevronUp, Link2, Plus, StickyNote } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useMemo, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { arrangeAction, type ArrangeResult } from "@/events/editor-actions";
import { cn } from "@/lib/utils";
import {
  applyArrangementChange,
  REGISTRY,
  SECTION_LIMITS,
  sectionId,
  sheetRows,
  switchesAfter,
  tidyHeading,
  type Arrangement,
  type ArrangementChange,
  type OfferedFeatures,
  type SectionKind,
  type SectionStyle,
  type SheetRow,
  type Switches,
} from "@/sections";
import type { GuestListVisibility } from "@/rsvps/visibility";
import type { Layout } from "@/themes/theme";
import { ClippedInput } from "./clipped-input";
import { EditorSheet } from "./sheet";
import { useEditor } from "./status";
import { StyleGlyph } from "./style-glyphs";

// The Arrange sheet (M8 spec, "Arrange sheet"; ticket 25): a design sheet over a live copy of the
// invitation, one row per section of the page in its order, each with Move up and Move down,
// which name the section and say where it went, and an On switch for each section that has one:
// the arrangement's own (the Schedule, the Announcements) or, for the Letter, Who's coming, the
// Comments and the Album, the event's column, the one truth the server checks (ticket 26). A row
// with more to it opens in place, one at a time, while it is on: to its heading and, where the
// section offers it, Collapsed (ticket 28); Who's coming's also to who sees it. A placeholder on
// the invitation opens the sheet at its own row (`openSection`, editor/status.tsx). Every press
// shows here at once and is saved through one action, which applies it under the event's row lock;
// a refusal puts the list and the switches back as they were. A heading is sent once the host has
// stopped typing, as the Settings sheet sends a capacity. The poster, title, host line and reply
// buttons are fixed and are not rows; the Countdown is a row like the rest (ticket 28). At the foot,
// Add a section adds a Note or Links, plain or headed by a suggestion, after the open row or at
// the end, and opens its own sheet; a Note's or Links' open row edits it there, or removes it once
// the host has confirmed (ticket 29).

// What the sheet shows: the order, and the switches that are columns.
type Arranged = { arrangement: Arrangement; switches: Switches };

// The hint under a row's name, which also describes its switch.
const HINTS = { letter: "letterHint", comments: "commentsHint", album: "albumHint", countdown: "countdownHint" } as const;

// A heading is sent this long after the host's last key, as the Settings sheet sends a capacity.
const DEBOUNCE = 600;

// The host's own sections, which they write, edit and remove.
const written = (kind: SectionKind) => kind === "note" || kind === "links";

// Whether a row opens, and so has a disclosure on its name: one that may be renamed, collapsed or
// drawn in another style, and only while it is on (tickets 28 and 30). Off, Who's coming has no
// choice of who sees it, since choosing would switch it on (ticket 24). A Note's or Links' always
// opens, to Edit and Remove.
const opens = (row: SheetRow) => {
  const entry = REGISTRY[row.kind];
  return written(row.kind) || (row.on && (entry.rename || entry.collapse || entry.styles.length > 0));
};

// The headings Add a section suggests, by the kind each adds (ticket 29).
const SUGGESTIONS = { addNote: ["dressCode", "gettingThere", "gifts"], addLinks: ["registry", "playlist"] } as const;

export function ArrangeSheet({
  eventId,
  layout,
  arrangement,
  switches,
  offered,
  headings,
}: {
  eventId: string;
  // The layout whose order a page never arranged starts from.
  layout: Layout;
  arrangement: Arrangement;
  switches: Switches;
  // The site's features that are on (src/features): a section that belongs to one that is off,
  // the album, has no row (kindOffered).
  offered: OfferedFeatures;
  // Each section's heading in the event's layout until the host renames it (section-previews.tsx).
  headings: Partial<Record<SectionKind, string>>;
}) {
  const t = useTranslations("Editor.arrange");
  const design = useTranslations("Design");
  const editor = useTranslations("Editor");
  const { sheet, openSheet, save, openRow, setOpenRow, editSection } = useEditor();
  const [, startSaving] = useTransition();
  // What the host sees: the arrangement and switches as saved, with the presses still being saved
  // on top.
  const saved = useMemo(() => ({ arrangement, switches }), [arrangement, switches]);
  const [shown, show] = useOptimistic(saved, (_saved: Arranged, next: Arranged) => next);
  // The newest of them, which a press works from: two presses can come before the list is drawn
  // again, and the second must move from where the first left it.
  const latest = useRef(shown);
  useEffect(() => {
    latest.current = shown;
  }, [shown]);
  const [said, say] = useState("");
  const [error, setError] = useState<string>();
  // How many presses have been sent, so that a change saved by the top bar's Try again clears what
  // the sheet says of it only while no press has come since.
  const presses = useRef(0);
  // The Move button pressed, which has the focus back once its row has moved: a row React moves in
  // the list loses it.
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const refocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!refocus.current) return;
    // A removed row takes its buttons with it: the focus goes to the sheet's heading rather than to
    // nothing.
    const button = refocus.current === "heading" ? document.querySelector<HTMLElement>('[data-slot="design-sheet"] [data-sheet-heading]') : buttons.current.get(refocus.current);
    refocus.current = null;
    if (button && document.activeElement !== button) button.focus();
  });
  const listId = useId();
  // A heading as typed, by row, until it is sent: the row's name follows each key at once.
  const [typed, setTyped] = useState<Record<string, string | null>>({});
  const pending = useRef<{ key: string; heading: string | null } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const rows = sheetRows(shown.arrangement, layout, shown.switches, offered);
  // The rows the server has saved. A Note or Links just added is shown at once under the sheet's
  // own key, which the server does not know: until it comes back under the server's, its controls
  // wait, and a press on them sends nothing (ticket 29's review).
  const savedKeys = new Set(sheetRows(arrangement, layout, switches, offered).map((row) => row.key));
  const waiting = (row: SheetRow) => !savedKeys.has(row.key);
  const headingOf = (row: SheetRow) => (row.key in typed ? typed[row.key] : row.heading);
  const nameOf = (row: SheetRow) => headingOf(row) ?? t(`kinds.${row.kind}`);

  // `saved` hears the server's answer once it is saved: a new section's key. Each change stands
  // alone, so what one that failed says stays above the list until the host's next press, however
  // the changes sent after it fare; the top bar shows only the last save's outcome (the part
  // review's finding 4). A change that failed and is sent again by the top bar's Try again, which
  // runs the same task, and is then saved, takes what the sheet says of it away, unless the host has
  // pressed since (the re-review of the sections fix pass); a refusal sent again is refused again.
  const send = (change: ArrangementChange, saved?: (result: ArrangeResult & { saved: true }) => void) => {
    setError(undefined);
    const press = ++presses.current;
    let runs = 0;
    const before = latest.current;
    const applied = applyArrangementChange(before.arrangement, layout, change);
    const next = applied.ok ? { arrangement: applied.arrangement, switches: switchesAfter(before.switches, change) } : undefined;
    if (next) latest.current = next;
    startSaving(async () => {
      if (next) show(next);
      let answer: ArrangeResult | undefined;
      const ok = await save(async () => {
        runs += 1;
        answer = await arrangeAction(eventId, change);
        if (runs > 1 && answer.saved && press === presses.current) setError(undefined);
        return answer;
      });
      if (!ok) setError(answer && !answer.saved && answer.error ? answer.error : editor("failed"));
      else if (answer?.saved) saved?.(answer);
    });
    return applied;
  };

  // Sends the heading waiting to be sent, if there is one.
  const flush = () => {
    clearTimeout(timer.current);
    const waiting = pending.current;
    if (!waiting) return;
    pending.current = null;
    setTyped((each) => {
      const rest = { ...each };
      delete rest[waiting.key];
      return rest;
    });
    send({ type: "rename", key: waiting.key, heading: waiting.heading });
  };
  const rename = (key: string, text: string) => {
    if (pending.current && pending.current.key !== key) flush();
    const heading = tidyHeading(text);
    pending.current = { key, heading };
    setTyped((each) => ({ ...each, [key]: heading }));
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, DEBOUNCE);
  };
  // Closing the sheet sends what is waiting.
  useEffect(() => {
    if (sheet !== "arrange") flush();
    // Only on closing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);
  // A row opened from a placeholder is brought into view.
  useEffect(() => {
    if (sheet === "arrange" && openRow) document.getElementById(`${listId}-${openRow}-panel`)?.scrollIntoView({ block: "nearest" });
  }, [sheet, openRow, listId]);

  const move = (row: SheetRow, by: -1 | 1) => {
    const { arrangement: from, switches: switched } = latest.current;
    const current = sheetRows(from, layout, switched, offered);
    const at = current.findIndex((each) => each.key === row.key);
    const neighbour = current[at + by];
    // At an end the button stays where it is, focusable, and does nothing. A neighbour still
    // waiting for its add is an end too: the server does not know it yet by the key the sheet
    // shows it under (the part review's finding 6).
    if (at < 0 || !neighbour || waiting(neighbour)) return;
    const applied = send({ type: "move", key: row.key, past: neighbour.key });
    if (!applied.ok) return;
    refocus.current = `${row.key}:${by}`;
    const after = sheetRows(applied.arrangement, layout, switched, offered);
    say(t("position", { name: nameOf(row), position: after.findIndex((each) => each.key === row.key) + 1, count: after.length }));
  };

  // A switch pressed. The Countdown switched on while it is last moves itself to just after the
  // Details (ticket 28), which the live line says as a move's is said (ticket 28's review).
  const toggle = (row: SheetRow, on: boolean) => {
    if (!on && openRow === row.key) setOpenRow(null);
    const before = sheetRows(latest.current.arrangement, layout, latest.current.switches, offered).findIndex((each) => each.key === row.key);
    const applied = send({ type: "toggle", key: row.key, on });
    if (!applied.ok) return;
    const after = sheetRows(applied.arrangement, layout, latest.current.switches, offered);
    const position = after.findIndex((each) => each.key === row.key);
    if (position !== before) say(t("position", { name: nameOf(row), position: position + 1, count: after.length }));
  };

  // A new Note or Links, after the open row or at the end, whose own sheet opens once it is saved
  // under the key the server gave it. The id it is shown under meanwhile is the sheet's own.
  const full = rows.filter((row) => written(row.kind)).length >= SECTION_LIMITS.custom;
  const add = (type: "addNote" | "addLinks", heading: string | null) => {
    // Only a row that is open: the Letter's placeholder names its row, which has nothing to open
    // (the part review's finding 9).
    const after = rows.some((row) => row.key === openRow && opens(row) && !waiting(row)) ? openRow : null;
    send({ type, id: sectionId(), after, heading }, (result) => {
      if (result.key) editSection(result.key, true);
    });
  };
  const remove = (row: SheetRow) => {
    refocus.current = "heading";
    setOpenRow(null);
    send({ type: "remove", key: row.key });
  };

  return (
    <EditorSheet design open={sheet === "arrange"} onOpenChange={(open) => openSheet(open ? "arrange" : null)} title={design("sheets.arrange")} description={t("intro")}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("fixed")}</p>
        {error && (
          <p role="alert" className="rounded-xl bg-destructive/15 px-3 py-2 text-sm">
            {error}
          </p>
        )}
        <div>
          <h3 id={listId} className="mb-2 text-xs font-medium tracking-label text-muted-foreground uppercase">
            {t("list")}
          </h3>
          <ol aria-labelledby={listId} className="flex flex-col gap-2">
            {rows.map((row, index) => {
              const entry = REGISTRY[row.kind];
              const Icon = entry.icon;
              const name = nameOf(row);
              const nameId = `${listId}-${row.key}`;
              const hintId = `${nameId}-hint`;
              const panelId = `${nameId}-panel`;
              const hint = entry.switch === "none" ? t("alwaysOn") : row.kind in HINTS ? t(HINTS[row.kind as keyof typeof HINTS]) : undefined;
              const pending = waiting(row);
              const expanded = opens(row) && !pending && openRow === row.key;
              return (
                <li key={row.key} className="rounded-2xl border bg-accent/40">
                  <div className="flex items-center gap-3 py-2 pr-2 pl-3">
                    <Icon aria-hidden className="size-4.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      {opens(row) ? (
                        <button
                          type="button"
                          aria-label={t("open", { name })}
                          aria-expanded={expanded}
                          aria-controls={expanded ? panelId : undefined}
                          aria-disabled={pending || undefined}
                          onClick={() => {
                            if (!pending) setOpenRow(expanded ? null : row.key);
                          }}
                          // Dimmed while its row waits for its add, as its Move buttons are.
                          className="-mx-1 flex max-w-full cursor-pointer items-center gap-1 rounded-md px-1 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent"
                        >
                          <span id={nameId} className="truncate text-sm font-medium">
                            {name}
                          </span>
                          <ChevronRight aria-hidden className={cn("size-4 shrink-0 text-muted-foreground", expanded && "rotate-90")} />
                        </button>
                      ) : (
                        <p id={nameId} className="truncate text-sm font-medium">
                          {name}
                        </p>
                      )}
                      {hint && (
                        <p id={hintId} className="text-xs text-muted-foreground">
                          {hint}
                        </p>
                      )}
                    </div>
                    {entry.switch !== "none" && (
                      <Switch
                        aria-labelledby={nameId}
                        aria-describedby={hint ? hintId : undefined}
                        aria-disabled={pending || undefined}
                        className="aria-disabled:cursor-default aria-disabled:opacity-40"
                        checked={row.on}
                        onCheckedChange={(on) => {
                          if (!pending) toggle(row, on);
                        }}
                      />
                    )}
                    <MoveButton
                      label={t("moveUp", { name })}
                      end={index === 0 || waiting(rows[index - 1])}
                      waiting={pending}
                      onPress={() => move(row, -1)}
                      ref={(button) => {
                        if (button) buttons.current.set(`${row.key}:-1`, button);
                        else buttons.current.delete(`${row.key}:-1`);
                      }}
                    >
                      <ChevronUp aria-hidden className="size-4.5" />
                    </MoveButton>
                    <MoveButton
                      label={t("moveDown", { name })}
                      end={index === rows.length - 1 || waiting(rows[index + 1])}
                      waiting={pending}
                      onPress={() => move(row, 1)}
                      ref={(button) => {
                        if (button) buttons.current.set(`${row.key}:1`, button);
                        else buttons.current.delete(`${row.key}:1`);
                      }}
                    >
                      <ChevronDown aria-hidden className="size-4.5" />
                    </MoveButton>
                  </div>
                  {expanded && (
                    <div id={panelId} className="flex flex-col gap-4 border-t px-3 py-3">
                      {entry.rename && (
                        <HeadingField
                          initial={headingOf(row) ?? ""}
                          placeholder={headings[row.kind] ?? t(`kinds.${row.kind}`)}
                          onType={(text) => rename(row.key, text)}
                        />
                      )}
                      {entry.collapse && <Collapsed collapsed={row.collapsed} onChange={(collapsed) => send({ type: "collapse", key: row.key, collapsed })} />}
                      {row.style && entry.styles.length > 0 && (
                        <Styles styles={entry.styles} chosen={row.style} waiting={pending} onChoose={(style) => send({ type: "style", key: row.key, style })} />
                      )}
                      {row.kind === "guests" && <Audience name={`${listId}-audience`} visibility={shown.switches.guestListVisibility} onSelect={(visibility) => send({ type: "audience", visibility })} />}
                      {written(row.kind) && (
                        <div className="flex gap-2">
                          <Button type="button" variant="secondary" size="sm" onClick={() => editSection(row.key, true)}>
                            {t("edit")}
                          </Button>
                          <RemoveSection name={name} onRemove={() => remove(row)} />
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <p aria-live="polite" className="sr-only">
            {said}
          </p>
        </div>
        <AddSection full={full} onAdd={add} />
      </div>
    </EditorSheet>
  );
}

// A section's heading, typed in its open row: empty, it keeps the default, which is its
// placeholder. Up to 40 characters, counted as the server counts them (ClippedInput).
function HeadingField({ initial, placeholder, onType }: { initial: string; placeholder: string; onType: (text: string) => void }) {
  const t = useTranslations("Editor.arrange");
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("heading")}</FieldLabel>
      <ClippedInput id={id} initial={initial} max={SECTION_LIMITS.heading} placeholder={placeholder} autoComplete="off" aria-describedby={`${id}-hint`} onType={onType} />
      <FieldDescription id={`${id}-hint`}>{t("headingHint", { name: placeholder })}</FieldDescription>
    </Field>
  );
}

// Whether guests see the section folded away under its heading, in its open row.
function Collapsed({ collapsed, onChange }: { collapsed: boolean; onChange: (collapsed: boolean) => void }) {
  const t = useTranslations("Editor.arrange");
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p id={`${id}-label`} className="text-sm font-medium">
          {t("collapsed")}
        </p>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {t("collapsedHint")}
        </p>
      </div>
      <Switch aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`} checked={collapsed} onCheckedChange={onChange} />
    </div>
  );
}

// The styles a section may be drawn in, in its open row (ticket 30): a radio group of large
// swatches, each a small drawing of the style over its name. Tab reaches the style chosen, and an
// arrow moves to the next and chooses it, as the video player's sizes do (video-player.tsx). Each
// choice is sent at once. While the row waits for its add, a press does nothing.
function Styles({ styles, chosen, waiting, onChoose }: { styles: readonly SectionStyle[]; chosen: SectionStyle; waiting: boolean; onChoose: (style: SectionStyle) => void }) {
  const t = useTranslations("Editor.arrange");
  const id = useId();
  const choose = (style: SectionStyle) => {
    if (!waiting && style !== chosen) onChoose(style);
  };
  const move = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const radios = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const at = radios.findIndex((radio) => radio === document.activeElement);
    const next = radios[(at + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + radios.length) % radios.length];
    if (!next) return;
    next.focus();
    choose(styles[radios.indexOf(next)]);
  };
  return (
    <div role="radiogroup" aria-labelledby={`${id}-label`} onKeyDown={move} className="flex flex-col gap-2">
      <p id={`${id}-label`} className="text-xs font-medium tracking-label text-muted-foreground uppercase">
        {t("style")}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {styles.map((style) => (
          <button
            key={style}
            type="button"
            role="radio"
            aria-checked={style === chosen}
            aria-disabled={waiting || undefined}
            tabIndex={style === chosen ? 0 : -1}
            onClick={() => choose(style)}
            className="group/swatch flex cursor-pointer flex-col items-center gap-2 rounded-xl border bg-background/60 px-2 pt-3 pb-2 text-xs font-medium text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-checked:border-primary aria-checked:text-foreground aria-checked:ring-1 aria-checked:ring-primary"
          >
            <StyleGlyph style={style} className="h-10 w-16 group-aria-checked/swatch:text-primary" />
            {t(`styles.${style}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

// Who sees Who's coming, in its open row, which is drawn only while the list is on: choosing here
// would switch it on (ticket 24's switchesAfter). Hidden is the row's switch, not a choice here.
function Audience({ name, visibility, onSelect }: { name: string; visibility: GuestListVisibility; onSelect: (visibility: "always" | "afterReply") => void }) {
  const t = useTranslations("Editor.arrange");
  const id = useId();
  return (
    <div role="radiogroup" aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`} className="flex flex-col gap-2">
      <p id={`${id}-label`} className="text-xs font-medium tracking-label text-muted-foreground uppercase">
        {t("audience")}
      </p>
      {(["always", "afterReply"] as const).map((each) => (
        <label key={each} className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="radio"
            name={name}
            checked={visibility === each}
            onChange={() => onSelect(each)}
            className="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          {t(each === "always" ? "audienceAlways" : "audienceAfterReply")}
        </label>
      ))}
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {t("audienceHint")}
      </p>
    </div>
  );
}

// Add a section, at the sheet's foot (ticket 29): a Note or Links, plain or headed by one of the
// suggestions, until the page holds ten of them, when it says so and offers neither.
function AddSection({ full, onAdd }: { full: boolean; onAdd: (type: "addNote" | "addLinks", heading: string | null) => void }) {
  const t = useTranslations("Editor.arrange");
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-dashed p-3">
      <h3 id={id} className="flex items-center gap-1.5 text-sm font-medium">
        <Plus aria-hidden className="size-4" />
        {t("add")}
      </h3>
      {full ? (
        <p className="mt-1 text-sm text-muted-foreground">{t("full")}</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">{t("addHint")}</p>
          {(["addNote", "addLinks"] as const).map((type) => {
            const Icon = type === "addNote" ? StickyNote : Link2;
            return (
              <div key={type} className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" className="rounded-full" onClick={() => onAdd(type, null)}>
                  <Icon aria-hidden />
                  {t(type)}
                </Button>
                {SUGGESTIONS[type].map((suggestion) => (
                  <Button key={suggestion} type="button" size="sm" variant="outline" className="rounded-full" onClick={() => onAdd(type, t(`suggestions.${suggestion}`))}>
                    {t(`suggestions.${suggestion}`)}
                  </Button>
                ))}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

// Remove, in a Note's or Links' open row, once the host has confirmed it: what it says is deleted.
function RemoveSection({ name, onRemove }: { name: string; onRemove: () => void }) {
  const t = useTranslations("Editor.arrange");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          {t("remove")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("removeTitle", { name })}</AlertDialogTitle>
          <AlertDialogDescription>{t("removeText")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="pt-4">
          <AlertDialogCancel type="button">{t("removeKeep")}</AlertDialogCancel>
          <AlertDialogAction type="button" onClick={onRemove}>
            {t("remove")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// A Move button. At an end of the list, or while its row waits, it says it is unavailable, keeps
// its place in the Tab order, so the focus is not lost from under a keyboard, and does nothing.
export function MoveButton({
  label,
  end,
  waiting = false,
  onPress,
  ref,
  control,
  children,
}: {
  label: string;
  end: boolean;
  // While its row waits for its add (ticket 29's review), it is unavailable in the same way.
  waiting?: boolean;
  onPress: () => void;
  ref?: (button: HTMLButtonElement | null) => void;
  // What a sheet finds it by to give it the focus back (links-sheet.tsx).
  control?: string;
  children: ReactNode;
}) {
  return (
    <button
      ref={ref}
      data-control={control}
      type="button"
      aria-label={label}
      aria-disabled={end || waiting || undefined}
      onClick={() => {
        if (!end && !waiting) onPress();
      }}
      className={cn(
        "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
        (end || waiting) && "cursor-default opacity-40 hover:bg-transparent",
      )}
    >
      {children}
    </button>
  );
}

// A placeholder section on the editor's invitation (editor/section-previews.tsx): what guests will
// see there, as a button that opens Arrange at the section's own row, which its description says.
export function OpenArrange({ sectionKey, children }: { sectionKey: string; children: ReactNode }) {
  const t = useTranslations("Editor.arrange");
  const { openSection } = useEditor();
  const hint = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => openSection(sectionKey)}
        aria-describedby={hint}
        className="-m-2 flex w-[calc(100%+1rem)] cursor-pointer items-center justify-between gap-3 rounded-xl p-2 text-left text-sm text-theme-text-muted transition-colors hover:bg-theme-glass-strong focus-visible:outline-2 focus-visible:outline-theme-focus-ring motion-reduce:transition-none"
      >
        {children}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-theme-text-faint" />
      </button>
      {/* Outside the button, so that it describes it without being read as its name. */}
      <span id={hint} className="sr-only">
        {t("openHint")}
      </span>
    </>
  );
}

// A Note or Links on the editor's invitation (editor/section-previews.tsx; ticket 29), drawn in
// full as guests will see it, or saying what to tap while it is empty, under a button the size of
// it that opens its own sheet. The button is named "Edit" and the section's heading, which
// `headingId` is the id of.
export function EditSection({ sectionKey, headingId, children }: { sectionKey: string; headingId: string; children: ReactNode }) {
  const t = useTranslations("Editor.arrange");
  const { editSection } = useEditor();
  const edit = useId();
  return (
    <div className="relative">
      {children}
      <button
        type="button"
        aria-labelledby={`${edit} ${headingId}`}
        onClick={() => editSection(sectionKey, false)}
        className="absolute -inset-2 cursor-pointer rounded-xl transition-colors hover:bg-theme-glass-strong/40 focus-visible:outline-2 focus-visible:outline-theme-focus-ring motion-reduce:transition-none"
      />
      <span id={edit} hidden>
        {t("edit")}
      </span>
    </div>
  );
}
