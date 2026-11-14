"use client";

import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { arrangeAction } from "@/events/editor-actions";
import { cn } from "@/lib/utils";
import { applyArrangementChange, REGISTRY, sheetRows, type Arrangement, type ArrangementChange, type SheetRow, type Switches } from "@/sections";
import type { Layout } from "@/themes/theme";
import { EditorSheet } from "./sheet";
import { useEditor } from "./status";

// The Arrange sheet (M8 spec, "Arrange sheet"; ticket 25): a design sheet over a live copy of the
// invitation, one row per section of the page in its order, each with Move up and Move down,
// which name the section and say where it went, and an On switch where the switch is the
// arrangement's own (the Schedule, the Announcements; ticket 26 adds the sections whose switch is
// a column). Every press shows here at once and is saved through one action, which applies it
// under the event's row lock; a refusal puts the list back as it was. The poster, title, host line
// and reply buttons are fixed and are not rows. The countdown's row comes with ticket 28.

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
  // What the host sees: the arrangement as saved, with the presses still being saved on top.
  const [shown, show] = useOptimistic(arrangement, (_saved: Arrangement, next: Arrangement) => next);
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
  const listId = useId();

  const rows = rowsOf(shown, layout, switches, offered);
  const nameOf = (row: SheetRow) => row.heading ?? t(`kinds.${row.kind}`);

  const send = (change: ArrangementChange) => {
    const applied = applyArrangementChange(latest.current, layout, change);
    if (applied.ok) latest.current = applied.arrangement;
    startSaving(async () => {
      if (applied.ok) show(applied.arrangement);
      await save(async () => {
        const result = await arrangeAction(eventId, change);
        setError(result.saved ? undefined : result.error);
        return result;
      });
    });
    return applied;
  };

  const move = (row: SheetRow, by: -1 | 1) => {
    const current = rowsOf(latest.current, layout, switches, offered);
    const at = current.findIndex((each) => each.key === row.key);
    const neighbour = current[at + by];
    // At an end the button stays where it is, focusable, and does nothing.
    if (at < 0 || !neighbour) return;
    const applied = send({ type: "move", key: row.key, past: neighbour.key });
    if (!applied.ok) return;
    refocus.current = `${row.key}:${by}`;
    const after = rowsOf(applied.arrangement, layout, switches, offered);
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
              return (
                <li key={row.key} className="flex items-center gap-3 rounded-2xl border bg-accent/40 py-2 pr-2 pl-3">
                  <Icon aria-hidden className="size-4.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p id={nameId} className="truncate text-sm font-medium">
                      {name}
                    </p>
                    {entry.switch === "none" && <p className="text-xs text-muted-foreground">{t("alwaysOn")}</p>}
                  </div>
                  {entry.switch === "stored" && <Switch aria-labelledby={nameId} checked={row.on} onCheckedChange={(on) => send({ type: "toggle", key: row.key, on })} />}
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
