"use client";

import { createContext, use, useCallback, useRef, useState, type ReactNode } from "react";
import type { SaveResult } from "@/events/editor-actions";

// The editor's one save status (M4 spec, "The editor"): every piece the host changes is saved as
// they make it, and the top bar says how the last save went, "Saving…", "Saved", or what went
// wrong, with Try again, which sends that save again. The details' sheets open from here too, so
// that Publish can open the one whose piece is missing, and the Arrange sheet at one section's row,
// so that a placeholder on the invitation opens its own (M8 ticket 28).

type SheetName = "poster" | "title" | "theme" | "effect" | "arrange" | "note" | "links" | "when" | "where" | "about" | "schedule" | "settings" | "more";

type EditorState = {
  status: "idle" | "saving" | "saved" | "failed";
  // How many saves have come back saved, which the top bar carries for the browser tests.
  saves: number;
  error?: string;
  save: (task: () => Promise<SaveResult>) => Promise<boolean>;
  retry: () => void;
  sheet: SheetName | null;
  // Opening or closing a sheet closes any row open in Arrange.
  openSheet: (name: SheetName | null) => void;
  // The row open in the Arrange sheet, by its section's key: `openSection` opens the sheet at it,
  // and `setOpenRow` opens or closes one from inside the sheet.
  openRow: string | null;
  openSection: (key: string) => void;
  setOpenRow: (key: string | null) => void;
  // A Note's or Links' own sheet (M8 ticket 29), opened by its section's key, which `openRow`
  // holds meanwhile: from Arrange, closing it goes back to Arrange at that row; from the
  // invitation, back to the invitation.
  editSection: (key: string, fromArrange: boolean) => void;
  closeSection: () => void;
};

const EditorContext = createContext<EditorState | null>(null);

export function useEditor(): EditorState {
  const state = use(EditorContext);
  if (!state) throw new Error("useEditor outside an EditorProvider");
  return state;
}

// `sheet` is the sheet open when the editor opens, as a link to the event's settings asks
// (M6 ticket 08); none unless one is named.
export function EditorProvider({ sheet: opened = null, children }: { sheet?: SheetName | null; children: ReactNode }) {
  const [status, setStatus] = useState<EditorState["status"]>("idle");
  const [error, setError] = useState<string>();
  const [saves, setSaves] = useState(0);
  const [sheet, setSheet] = useState<SheetName | null>(opened);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const openSheet = useCallback((name: SheetName | null) => {
    setSheet(name);
    setOpenRow(null);
  }, []);
  const openSection = useCallback((key: string) => {
    setSheet("arrange");
    setOpenRow(key);
  }, []);
  const [backToArrange, setBackToArrange] = useState(false);
  const editSection = useCallback((key: string, fromArrange: boolean) => {
    setSheet(key.startsWith("links:") ? "links" : "note");
    setOpenRow(key);
    setBackToArrange(fromArrange);
  }, []);
  const closeSection = useCallback(() => {
    setSheet(backToArrange ? "arrange" : null);
    if (!backToArrange) setOpenRow(null);
  }, [backToArrange]);
  const last = useRef<() => Promise<SaveResult>>(undefined);
  // Saves answer in the order they were sent; only the latest one's outcome is shown here, which is
  // right where each save carries everything (Settings). Each still answers whether it was saved to
  // whoever sent it, and Arrange, whose changes stand alone, says so of one that was not, even when
  // a later one was (the Sections part's review, finding 4).
  const sent = useRef(0);

  const save = useCallback(async (task: () => Promise<SaveResult>) => {
    last.current = task;
    const mine = ++sent.current;
    setStatus("saving");
    let result: SaveResult;
    try {
      result = await task();
    } catch {
      result = { saved: false, error: "" };
    }
    if (mine !== sent.current) return result.saved;
    setStatus(result.saved ? "saved" : "failed");
    setError(result.saved ? undefined : result.error);
    if (result.saved) setSaves((count) => count + 1);
    return result.saved;
  }, []);

  const retry = useCallback(() => {
    if (last.current) void save(last.current);
  }, [save]);

  return <EditorContext value={{ status, saves, error, save, retry, sheet, openSheet, openRow, openSection, setOpenRow, editSection, closeSection }}>{children}</EditorContext>;
}

// The editor is optional around the invitation: the guest page has none.
export function useOptionalEditor(): EditorState | null {
  return use(EditorContext);
}
