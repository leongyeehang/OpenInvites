"use client";

import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useMemo, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { arrangeAction } from "@/events/editor-actions";
import { cn } from "@/lib/utils";
import { applyArrangementChange, REGISTRY, sheetRows, switchesAfter, type Arrangement, type ArrangementChange, type SheetRow, type Switches } from "@/sections";
import type { GuestListVisibility } from "@/rsvps/visibility";
import type { Layout } from "@/themes/theme";
import { EditorSheet } from "./sheet";
import { useEditor } from "./status";

// The Arrange sheet (M8 spec, "Arrange sheet"; ticket 25): a design sheet over a live copy of the
// invitation, one row per section of the page in its order, each with Move up and Move down,
// which name the section and say where it went, and an On switch for each section that has one:
// the arrangement's own (the Schedule, the Announcements) or, for the Letter, Who's coming, the
// Comments and the Album, the event's column, the one truth the server checks (ticket 26). A row
// with more to it opens in place, one at a time: Who's coming's, while it is on, for who sees it.
// Every press shows here at once and is saved through one action, which applies it under the
// event's row lock; a refusal puts the list and the switches back as they were. The poster, title,
// host line and reply buttons are fixed and are not rows. The countdown's row comes with ticket 28.

// What the sheet shows: the order, and the switches that are columns.
type Arranged = { arrangement: Arrangement; switches: Switches };

// The hint under a row's name, which also describes its switch.
const HINTS = { letter: "letterHint", comments: "commentsHint", album: "albumHint" } as const;

// Whether a row opens, and so has a disclosure on its name: only Who's coming, and only while it is
// on, since choosing who sees it switches it on (ticket 24). Ticket 28 opens every row for its
// heading and Collapsed.
const opens = (row: SheetRow) => row.kind === "guests" && row.on;

const rowsOf = (arrangement: Arrangement, layout: Layout, switches: Switches, offered: { album: boolean }) =>
  sheetRows(arrangement, layout, switches, offered).filter((row) => row.kind !== "countdown");

export function ArrangeSheet({
  eventId,
  layout,
  arrangement,
  switches,
  offered,
}: {
  eventId: string;
  // The layout whose order a page never arranged starts from.
  layout: Layout;
  arrangement: Arrangement;
  switches: Switches;
  // Whether the site offers the album at all (src/features): where it does not, there is no row.
  offered: { album: boolean };
}) {
  const t = useTranslations("Editor.arrange");
  const design = useTranslations("Design");
  const { sheet, openSheet, save } = useEditor();
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
  // The Move button pressed, which has the focus back once its row has moved: a row React moves in
  // the list loses it.
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const refocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!refocus.current) return;
    const button = buttons.current.get(refocus.current);
    refocus.current = null;
    if (button && document.activeElement !== button) button.focus();
  });
  // The row open in place, by key.
  const [openRow, setOpenRow] = useState<string | null>(null);
  const listId = useId();

  const rows = rowsOf(shown.arrangement, layout, shown.switches, offered);
  const nameOf = (row: SheetRow) => row.heading ?? t(`kinds.${row.kind}`);

  const send = (change: ArrangementChange) => {
    const before = latest.current;
    const applied = applyArrangementChange(before.arrangement, layout, change);
    const next = applied.ok ? { arrangement: applied.arrangement, switches: switchesAfter(before.switches, change) } : undefined;
    if (next) latest.current = next;
    startSaving(async () => {
      if (next) show(next);
      await save(async () => {
        const result = await arrangeAction(eventId, change);
        setError(result.saved ? undefined : result.error);
        return result;
      });
    });
    return applied;
  };

  const move = (row: SheetRow, by: -1 | 1) => {
    const { arrangement: from, switches: switched } = latest.current;
    const current = rowsOf(from, layout, switched, offered);
    const at = current.findIndex((each) => each.key === row.key);
    const neighbour = current[at + by];
    // At an end the button stays where it is, focusable, and does nothing.
    if (at < 0 || !neighbour) return;
    const applied = send({ type: "move", key: row.key, past: neighbour.key });
    if (!applied.ok) return;
    refocus.current = `${row.key}:${by}`;
    const after = rowsOf(applied.arrangement, layout, switched, offered);
    say(t("position", { name: nameOf(row), position: after.findIndex((each) => each.key === row.key) + 1, count: after.length }));
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
              const expanded = opens(row) && openRow === row.key;
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
                          onClick={() => setOpenRow(expanded ? null : row.key)}
                          className="-mx-1 flex max-w-full cursor-pointer items-center gap-1 rounded-md px-1 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
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
                        checked={row.on}
                        onCheckedChange={(on) => {
                          if (!on && openRow === row.key) setOpenRow(null);
                          send({ type: "toggle", key: row.key, on });
                        }}
                      />
                    )}
                    <MoveButton
                      label={t("moveUp", { name })}
                      end={index === 0}
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
                      end={index === rows.length - 1}
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
                    <div id={panelId} className="border-t px-3 py-3">
                      {row.kind === "guests" && <Audience name={`${listId}-audience`} visibility={shown.switches.guestListVisibility} onSelect={(visibility) => send({ type: "audience", visibility })} />}
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
      </div>
    </EditorSheet>
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

// A Move button. At an end of the list it says it is unavailable, keeps its place in the Tab
// order, so the focus is not lost from under a keyboard, and does nothing.
function MoveButton({ label, end, onPress, ref, children }: { label: string; end: boolean; onPress: () => void; ref: (button: HTMLButtonElement | null) => void; children: ReactNode }) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-disabled={end || undefined}
      onClick={() => {
        if (!end) onPress();
      }}
      className={cn(
        "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
        end && "cursor-default opacity-40 hover:bg-transparent",
      )}
    >
      {children}
    </button>
  );
}

// A placeholder section on the editor's invitation (editor/section-previews.tsx): what guests will
// see there, as a button that opens Arrange, which its description says.
export function OpenArrange({ children }: { children: ReactNode }) {
  const t = useTranslations("Editor.arrange");
  const { openSheet } = useEditor();
  const hint = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => openSheet("arrange")}
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
