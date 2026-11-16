"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { DescriptionEditor } from "@/app/(host)/events/description-editor";
import { arrangeAction } from "@/events/editor-actions";
import type { RichText } from "@/rich-text/rich-text";
import { sectionKey, type Section } from "@/sections";
import { EditorSheet } from "./sheet";
import { useEditor } from "./status";

// A Note's own sheet (M8 spec, "Sections"; ticket 29): a tall sheet, as About's is, headed by the
// Note's heading, with the About editor in it. What the host writes is saved once they have
// stopped typing, as a heading in Arrange is, and closing the sheet sends what is waiting. The
// server holds a Note to its limit (SECTION_LIMITS.note) and says so here when it is past it.
// Opened from the Note's row in Arrange, or from the Note on the invitation (`editSection`).

// A Note is sent this long after the host's last change, as a heading is.
const DEBOUNCE = 600;

export function NoteSheet({ eventId, section }: { eventId: string; section: Section & { kind: "note" } }) {
  const t = useTranslations("Editor.arrange");
  const { sheet, openRow, closeSection } = useEditor();
  const key = sectionKey(section);
  return (
    <EditorSheet
      open={sheet === "note" && openRow === key}
      onOpenChange={(open) => {
        if (!open) closeSection();
      }}
      title={section.heading ?? t("kinds.note")}
      tall
    >
      <NoteForm eventId={eventId} sectionKey={key} body={section.body} />
    </EditorSheet>
  );
}

// The sheet's form, made afresh each time the sheet opens, so it starts from the Note as saved.
function NoteForm({ eventId, sectionKey: key, body }: { eventId: string; sectionKey: string; body: RichText }) {
  const t = useTranslations("Editor.arrange");
  const { save } = useEditor();
  const [error, setError] = useState<string>();
  // What was typed last, and what was last sent (the Note as saved, to begin with), so that
  // leaving the editor without a change sends nothing.
  const latest = useRef(body);
  const sent = useRef(JSON.stringify(body));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sends the Note as typed, if it has changed since it was last sent.
  const send = useRef(() => {
    clearTimeout(timer.current);
    const posted = JSON.stringify(latest.current);
    if (posted === sent.current) return;
    sent.current = posted;
    const change = { type: "editNote", key, body: latest.current } as const;
    void save(async () => {
      const result = await arrangeAction(eventId, change);
      setError(result.saved ? undefined : result.error);
      return result;
    });
  });
  // Closing the sheet sends what is waiting.
  useEffect(() => {
    const flush = send.current;
    return () => flush();
  }, []);

  return (
    <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/15 px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <DescriptionEditor
        doc={body}
        label={t("kinds.note")}
        onChange={(doc) => {
          latest.current = doc;
          clearTimeout(timer.current);
          timer.current = setTimeout(send.current, DEBOUNCE);
        }}
      />
    </form>
  );
}
