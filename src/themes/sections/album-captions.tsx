"use client";

import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { Openable } from "./album";

// The album's captions (M8 ticket 09), apart from album.tsx: the one under an item in the viewer,
// and the one written for a file just added. The album hands them its action, which saves a
// caption and answers with the refusal or the caption as stored, and the longest a caption may be.
export type SaveCaption = (id: string, draft: string) => Promise<{ error: "tooFast" | "captionTooLong" | "closed" } | { caption: string | null }>;

// A caption's length as the server and the database count it (album.ts, parseCaption): in code
// points, so an emoji is one.
const length = (text: string) => [...text].length;

// An item's caption under it in the viewer (M8 ticket 09), drawn as text, and for whoever may write
// it Add a caption or Edit caption, which opens a field in its place, filled with the caption as it
// is each time it opens: Enter saves, Escape (the viewer's, while writing) and Cancel leave it, and
// either way the focus is back on the button. A refusal is said under the field. Saved, the caption
// shows at once and the page is drawn again. Whether it is being written is the viewer's, which
// ends it whenever another item is shown or the viewer closes (media part review).
export function Caption({ photo, editing, onEditing, save, max }: { photo: Openable; editing: boolean; onEditing: (on: boolean) => void; save: SaveCaption; max: number }) {
  const t = useTranslations("EventPage.album");
  const router = useRouter();
  // What was saved here, shown in place of the caption it replaced until the page drawn again
  // brings it.
  const [saved, setSaved] = useState<{ over: string | null; caption: string | null }>();
  // Set when writing begins, so the button has the focus back when it returns.
  const refocus = useRef(false);
  const caption = saved && saved.over === photo.caption ? saved.caption : photo.caption;
  if (!caption && !photo.captionEditable) return null;

  return (
    <div className="flex flex-col items-center gap-1 px-4 pt-1 pb-2 text-center">
      {editing ? (
        <CaptionField
          id={photo.id}
          initial={caption ?? ""}
          save={save}
          max={max}
          onSaved={(stored) => {
            setSaved({ over: photo.caption, caption: stored });
            onEditing(false);
            router.refresh();
          }}
          onCancel={() => onEditing(false)}
        />
      ) : (
        <>
          {caption && (
            <p data-slot="caption" className="max-w-prose text-sm break-words text-white">
              {caption}
            </p>
          )}
          {photo.captionEditable && (
            <button
              ref={(button) => {
                if (!button || !refocus.current) return;
                refocus.current = false;
                button.focus();
              }}
              type="button"
              onClick={() => {
                refocus.current = true;
                onEditing(true);
              }}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white/80 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
            >
              {caption ? <Pencil className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
              {t(caption ? "editCaption" : "addCaption")}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// The viewer's field, mounted only while writing, so it starts from the caption as it is whenever
// it opens. Its count is in code points, as the server counts.
function CaptionField({ id, initial, save, max, onSaved, onCancel }: { id: string; initial: string; save: SaveCaption; max: number; onSaved: (caption: string | null) => void; onCancel: () => void }) {
  const t = useTranslations("EventPage.album");
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startSaving(async () => {
          const answer = await save(id, draft);
          if ("error" in answer) return setError(t(`errors.${answer.error}`));
          onSaved(answer.caption);
        });
      }}
      className="flex w-full max-w-md flex-col gap-1.5 text-left"
    >
      <div className="flex items-baseline justify-between gap-2 text-xs text-white/70">
        <label htmlFor="caption-field">{t("caption")}</label>
        <span id="caption-count">
          {length(draft)}/{max}
        </span>
      </div>
      <input
        id="caption-field"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={max}
        autoComplete="off"
        autoFocus
        aria-describedby={error ? "caption-count caption-error" : "caption-count"}
        aria-invalid={error ? true : undefined}
        className="h-10 w-full rounded-full bg-white/10 px-4 text-sm text-white focus-visible:outline-2 focus-visible:outline-white"
      />
      {error && (
        <p id="caption-error" role="alert" className="text-sm font-medium">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 cursor-pointer items-center rounded-full px-4 text-sm font-medium hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
        >
          {t("cancelCaption")}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 cursor-pointer items-center rounded-full bg-white px-4 text-sm font-medium text-black hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
        >
          {t("saveCaption")}
        </button>
      </div>
    </form>
  );
}

// A caption written for a file just added (M8 ticket 09), under the status lines, with the same
// action as the viewer's: the picker sends files as soon as they are picked, so this is where one
// is written while adding. Saved, the file's status line says so.
export function CaptionWhileAdding({ id, name, save, max, onSaved }: { id: string; name: string; save: SaveCaption; max: number; onSaved: () => void }) {
  const t = useTranslations("EventPage.album");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();
  const field = `caption-${id}`;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startSaving(async () => {
          const answer = await save(id, draft);
          if ("error" in answer) return setError(t(`errors.${answer.error}`));
          onSaved();
        });
      }}
      className="flex flex-col gap-1"
    >
      <label htmlFor={field} className="text-xs text-theme-text-muted">
        {t("captionFor", { name })}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          id={field}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={max}
          autoComplete="off"
          aria-describedby={error ? `${field}-error` : undefined}
          aria-invalid={error ? true : undefined}
          className="h-9 min-w-0 flex-1 rounded-full bg-theme-glass-strong px-3 text-sm text-theme-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-text"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full bg-theme-glass-strong px-3 text-xs font-medium text-theme-text hover:bg-theme-glass focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-text disabled:cursor-wait"
        >
          {t("saveCaption")}
        </button>
      </div>
      {error && (
        <p id={`${field}-error`} role="alert" className="text-sm font-medium text-theme-text">
          {error}
        </p>
      )}
    </form>
  );
}
