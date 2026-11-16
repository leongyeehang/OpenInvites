"use client";

import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { arrangeAction } from "@/events/editor-actions";
import { linkHost, safeLinkUrl, SECTION_LIMITS, sectionKey, type Section, type SectionLink } from "@/sections";
import { MoveButton } from "./arrange-sheet";
import { ClippedInput } from "./clipped-input";
import { EditorSheet } from "./sheet";
import { useEditor } from "./status";

// A Links section's own sheet (M8 spec, "Links"; ticket 29): its links as rows of a label and an
// address, added, removed and moved by buttons, at most six. The list is not a form: a label is
// saved once the host has stopped typing, as a heading in Arrange is, an address once its field is
// left or the sheet closes, never half-typed on a pause (ticket 29's review), and a move or a
// removal at once; a row with no address yet is not sent. An address is checked as its field is
// left, by the rule the server holds it to (http and https only, `safeLinkUrl`): one that would be
// refused is marked, says why under its field, and is left out of what is sent, so the other rows
// still save (the Sections part's review, finding 3). The server checks every address again and
// refuses the whole list over one it would not follow, which is said above it.
// On the keyboard a moved row's button keeps the focus; a removal leaves it on the same button,
// which then removes the row that took its place, or on "Add a link" after the last one; a new row
// takes it at its label.

// A label is sent this long after the host's last key, as a heading is.
const DEBOUNCE = 600;

export function LinksSheet({ eventId, section }: { eventId: string; section: Section & { kind: "links" } }) {
  const t = useTranslations("Editor.arrange");
  const { sheet, openRow, closeSection } = useEditor();
  const key = sectionKey(section);
  return (
    <EditorSheet
      open={sheet === "links" && openRow === key}
      onOpenChange={(open) => {
        if (!open) closeSection();
      }}
      title={section.heading ?? t("kinds.links")}
      tall
    >
      <LinksForm eventId={eventId} sectionKey={key} links={section.links} />
    </EditorSheet>
  );
}

// A row as the sheet holds it: `id` keeps a row's fields with it as it moves. `url` is its address
// as last left, which is what is sent; `draft` as typed.
type Row = SectionLink & { id: number; draft: string };

// Whether a row's address, as last left, is one the server would refuse.
const refused = (row: Row) => row.url.trim() !== "" && safeLinkUrl(row.url) === undefined;

// What is sent: the rows with an address the server would take, in order.
const posted = (rows: Row[]): SectionLink[] => rows.filter((row) => row.url.trim() !== "" && !refused(row)).map(({ label, url }) => ({ label, url }));

// The sheet's list, made afresh each time the sheet opens, so it starts from the links as saved.
function LinksForm({ eventId, sectionKey: key, links }: { eventId: string; sectionKey: string; links: SectionLink[] }) {
  const t = useTranslations("Editor.arrange.links");
  const arrange = useTranslations("Editor.arrange");
  const { save } = useEditor();
  const id = useId();
  const [rows, setRows] = useState<Row[]>(() => links.map((link, index) => ({ ...link, id: index, draft: link.url })));
  const [error, setError] = useState<string>();
  const [said, say] = useState("");
  const made = useRef(links.length);
  // The rows as last changed, and the links last sent (as saved, to begin with).
  const latest = useRef(rows);
  const sent = useRef(JSON.stringify(posted(rows)));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The control that has the focus once the list is drawn again, by its `data-control`: its row
  // and part. A row React moves in the list loses it.
  const sheet = useRef<HTMLDivElement>(null);
  const refocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!refocus.current) return;
    const control = sheet.current?.querySelector<HTMLElement>(`[data-control="${refocus.current}"]`);
    refocus.current = null;
    if (control && document.activeElement !== control) control.focus();
  });

  // Sends the links as typed, if they have changed since they were last sent.
  const send = useRef(() => {
    clearTimeout(timer.current);
    const links = posted(latest.current);
    const body = JSON.stringify(links);
    if (body === sent.current) return;
    sent.current = body;
    void save(async () => {
      const result = await arrangeAction(eventId, { type: "editLinks", key, links });
      setError(result.saved ? undefined : result.error);
      return result;
    });
  });
  // Closing the sheet sends what is waiting, an address being typed with it.
  useEffect(() => {
    const flush = send.current;
    return () => {
      latest.current = latest.current.map((row) => ({ ...row, url: row.draft }));
      flush();
    };
  }, []);

  // A change to the rows, sent once the typing stops, or at once.
  const change = (next: Row[], now = false) => {
    latest.current = next;
    setRows(next);
    clearTimeout(timer.current);
    if (now) send.current();
    else timer.current = setTimeout(send.current, DEBOUNCE);
  };
  const label = (row: Row, text: string) => change(latest.current.map((each) => (each.id === row.id ? { ...each, label: text } : each)));
  // An address as typed is only kept; it is sent once its field is left.
  const draft = (row: Row, text: string) => {
    latest.current = latest.current.map((each) => (each.id === row.id ? { ...each, draft: text } : each));
    setRows(latest.current);
  };
  const leave = (row: Row) => change(latest.current.map((each) => (each.id === row.id ? { ...each, url: each.draft } : each)), true);
  // A row is named by its label, or the site its address goes to, or its place.
  const nameOf = (row: Row, index: number) => row.label.trim() || (safeLinkUrl(row.draft) ? linkHost(safeLinkUrl(row.draft)!) : t("labelOf", { n: index + 1 }));

  const move = (row: Row, by: -1 | 1) => {
    const current = latest.current;
    const at = current.findIndex((each) => each.id === row.id);
    if (at < 0 || !current[at + by]) return;
    const next = [...current];
    [next[at], next[at + by]] = [next[at + by], next[at]];
    refocus.current = `${row.id}:${by}`;
    change(next, true);
    say(arrange("position", { name: nameOf(row, at + by), position: at + by + 1, count: next.length }));
  };
  const remove = (row: Row) => {
    const current = latest.current;
    const at = current.findIndex((each) => each.id === row.id);
    const next = current.filter((each) => each.id !== row.id);
    refocus.current = next[at] ? `${next[at].id}:remove` : "add";
    change(next, true);
  };
  const add = () => {
    const row = { id: made.current++, label: "", url: "", draft: "" };
    refocus.current = `${row.id}:label`;
    // A row with no address is not sent, so nothing is saved yet.
    latest.current = [...latest.current, row];
    setRows(latest.current);
  };

  return (
    <div ref={sheet} className="flex flex-col gap-4">
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {t("hint")}
      </p>
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/15 px-3 py-2 text-sm">
          {error}
        </p>
      )}
      {rows.length > 0 && (
        <ol aria-describedby={`${id}-hint`} className="flex flex-col gap-3">
          {rows.map((row, index) => {
            const n = index + 1;
            const name = nameOf(row, index);
            const field = (part: string) => `${id}-${row.id}-${part}`;
            const wrong = refused(row);
            return (
              <li key={row.id} className="flex items-start gap-2 rounded-2xl border bg-accent/40 p-3">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <label htmlFor={field("label")} className="text-xs font-medium text-muted-foreground">
                    {t("labelOf", { n })}
                  </label>
                  <ClippedInput
                    data-control={`${row.id}:label`}
                    id={field("label")}
                    initial={row.label}
                    max={SECTION_LIMITS.label}
                    autoComplete="off"
                    onType={(text) => label(row, text)}
                  />
                  <label htmlFor={field("url")} className="text-xs font-medium text-muted-foreground">
                    {t("urlOf", { n })}
                  </label>
                  <ClippedInput
                    id={field("url")}
                    initial={row.draft}
                    max={SECTION_LIMITS.url}
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={wrong || undefined}
                    aria-describedby={wrong ? field("url-error") : undefined}
                    onType={(text) => draft(row, text)}
                    onBlur={() => leave(row)}
                  />
                  {wrong && (
                    <p id={field("url-error")} className="text-xs text-destructive">
                      {arrange("errors.urlInvalid")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-center">
                  <MoveButton label={t("moveUp", { label: name })} end={index === 0} onPress={() => move(row, -1)} control={`${row.id}:-1`}>
                    <ChevronUp aria-hidden className="size-4.5" />
                  </MoveButton>
                  <MoveButton label={t("moveDown", { label: name })} end={index === rows.length - 1} onPress={() => move(row, 1)} control={`${row.id}:1`}>
                    <ChevronDown aria-hidden className="size-4.5" />
                  </MoveButton>
                  <button
                    data-control={`${row.id}:remove`}
                    type="button"
                    aria-label={t("remove", { label: name })}
                    onClick={() => remove(row)}
                    className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <X aria-hidden className="size-4.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {rows.length < SECTION_LIMITS.links && (
        <Button data-control="add" type="button" variant="outline" className="self-start" onClick={add}>
          <Plus /> {t("add")}
        </Button>
      )}
      <p aria-live="polite" className="sr-only">
        {said}
      </p>
    </div>
  );
}
