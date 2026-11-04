"use client";

import { createContext, use, useCallback, useRef, useState, type ReactNode } from "react";
import type { SaveResult } from "@/events/editor-actions";

// The editor's one save status (M4 spec, "The editor"): every piece the host changes is saved as
// they make it, and the top bar says how the last save went, "Saving…", "Saved", or what went
// wrong, with Try again, which sends that save again. The details' sheets open from here too, so
// that Publish can open the one whose piece is missing.

export type SheetName = "poster" | "title" | "theme" | "effect" | "when" | "where" | "about" | "settings" | "more";

type EditorState = {
  status: "idle" | "saving" | "saved" | "failed";
  // How many saves have come back saved, which the top bar carries for the browser tests.
  saves: number;
  error?: string;
  save: (task: () => Promise<SaveResult>) => Promise<boolean>;
  retry: () => void;
  sheet: SheetName | null;
  openSheet: (name: SheetName | null) => void;
};

const EditorContext = createContext<EditorState | null>(null);

export function useEditor(): EditorState {
  const state = use(EditorContext);
  if (!state) throw new Error("useEditor outside an EditorProvider");
  return state;
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<EditorState["status"]>("idle");
  const [error, setError] = useState<string>();
  const [saves, setSaves] = useState(0);
  const [sheet, openSheet] = useState<SheetName | null>(null);
  const last = useRef<() => Promise<SaveResult>>(undefined);
  // Saves answer in the order they were sent; only the latest one's outcome is shown.
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

  return <EditorContext value={{ status, saves, error, save, retry, sheet, openSheet }}>{children}</EditorContext>;
}

// The editor is optional around the invitation: the guest page has none.
export function useOptionalEditor(): EditorState | null {
  return use(EditorContext);
}
