"use client";

import { Bold, Italic, Link2, List } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { richTextToHtml } from "@/rich-text/html";
import { readRichText } from "@/rich-text/read-dom";
import type { RichText } from "@/rich-text/rich-text";

// The host writes the invitation here. The editable area is the browser's own, seeded once and
// never re-rendered, so the cursor stays where the host put it; every keystroke is read back
// into the document model and travels in the hidden field beside it. The server reads only the
// model, so nothing pasted in can arrive as markup.
export function DescriptionEditor({ doc }: { doc: RichText }) {
  const t = useTranslations("Events.form");
  const labelId = useId();
  const editable = useRef<HTMLDivElement>(null);
  const [seeded] = useState(() => richTextToHtml(doc));
  const [value, setValue] = useState(() => JSON.stringify(doc));
  // Which of the toggles are on where the cursor is, so each says whether it is pressed.
  const [on, setOn] = useState<Record<Toggle, boolean>>({ bold: false, italic: false, insertUnorderedList: false });

  const read = () => {
    if (editable.current) setValue(JSON.stringify(readRichText(editable.current)));
  };

  const readToggles = useCallback(() => {
    const anchor = document.getSelection()?.anchorNode;
    const inside = !!anchor && !!editable.current?.contains(anchor);
    setOn({
      bold: inside && document.queryCommandState("bold"),
      italic: inside && document.queryCommandState("italic"),
      insertUnorderedList: inside && document.queryCommandState("insertUnorderedList"),
    });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", readToggles);
    return () => document.removeEventListener("selectionchange", readToggles);
  }, [readToggles]);

  // The browser's own editing commands. Deprecated, and still the only thing every phone and
  // laptop implements; what they leave behind is read back through the model either way.
  const command = (name: string, argument?: string) => {
    editable.current?.focus();
    document.execCommand(name, false, argument);
    read();
    readToggles();
  };

  // Asking for the address takes the selection away with it, so the words the host had chosen
  // are put back before the link is made.
  const link = () => {
    const selection = window.getSelection();
    const chosen = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
    const typed = window.prompt(t("descriptionLinkPrompt"))?.trim();
    if (!typed) return;
    // A host who types example.com means https://example.com, and a link with no scheme would
    // be dropped on save without a word.
    const href = /^[a-z][a-z0-9+.-]*:/i.test(typed) ? typed : `https://${typed}`;

    // Focus first and put the range back second: focusing afterwards would move the caret and
    // there would be nothing selected to turn into a link.
    editable.current?.focus();
    if (chosen) {
      selection?.removeAllRanges();
      selection?.addRange(chosen);
    }
    document.execCommand("createLink", false, href);
    read();
  };

  return (
    <Field>
      {/* The editable area is not a form field, so the label names it and focuses it by hand. */}
      <FieldLabel id={labelId} onClick={() => editable.current?.focus()}>
        {t("description")}
      </FieldLabel>
      <div className="flex flex-wrap gap-1" onMouseDown={(pressed) => pressed.preventDefault()}>
        <Button type="button" variant="ghost" size="icon" aria-label={t("descriptionBold")} aria-pressed={on.bold} className="aria-pressed:bg-muted" onClick={() => command("bold")}>
          <Bold />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label={t("descriptionItalic")} aria-pressed={on.italic} className="aria-pressed:bg-muted" onClick={() => command("italic")}>
          <Italic />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label={t("descriptionLink")} onClick={link}>
          <Link2 />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("descriptionBullets")}
          aria-pressed={on.insertUnorderedList}
          className="aria-pressed:bg-muted"
          onClick={() => command("insertUnorderedList")}
        >
          <List />
        </Button>
      </div>
      <div
        id="description"
        ref={editable}
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelId}
        contentEditable
        suppressContentEditableWarning
        onInput={read}
        onBlur={read}
        // Paste arrives as plain words. Anything else would run in the host's own session
        // before the model ever saw it, and would vanish on save regardless.
        onPaste={(pasted) => {
          pasted.preventDefault();
          document.execCommand("insertText", false, pasted.clipboardData.getData("text/plain"));
          read();
        }}
        className="min-h-32 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base whitespace-pre-line outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: seeded }}
      />
      <input type="hidden" name="description" value={value} />
      <FieldDescription>{t("descriptionHint")}</FieldDescription>
    </Field>
  );
}

type Toggle = "bold" | "italic" | "insertUnorderedList";
