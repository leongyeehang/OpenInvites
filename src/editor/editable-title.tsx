"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { saveTitleAction } from "@/events/editor-actions";
import { cn } from "@/lib/utils";
import { useTheme } from "@/themes/themed-page";
import { LONG_TITLE } from "@/themes/title-fonts";
import { useEditor } from "./status";

// Typing is saved this long after the host stops (M4 spec, "The editor").
const DEBOUNCE = 600;

export const TITLE_ID = "event-title";

// The title, typed on the invitation itself (M4 spec, "The editor"): the heading the guest sees, in
// the theme's font and place, editable as plain text. It is a text box named "Event title" while
// it is edited, with "Untitled event" in it while it is empty. Enter finishes it; what is pasted
// arrives as plain text; it is saved as the host stops typing, and when they leave it.
export function EditableTitle({ eventId, title, compact }: { eventId: string; title: string; compact: boolean }) {
  const t = useTranslations("Editor");
  const { font } = useTheme().resolved;
  const { save } = useEditor();
  const heading = useRef<HTMLHeadingElement>(null);
  const saved = useRef(title);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // How long the typed title is, which decides its size as the guest's page decides it.
  const [length, setLength] = useState(title.length);

  // Seeded once: the browser owns what is typed, so the caret stays where the host put it.
  useEffect(() => {
    const element = heading.current;
    if (!element) return;
    element.textContent = title;
    try {
      element.contentEditable = "plaintext-only";
    } catch {
      element.contentEditable = "true";
    }
    if (element.contentEditable !== "plaintext-only") element.contentEditable = "true";
    // Seeded once only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = () => {
    clearTimeout(timer.current);
    const typed = (heading.current?.textContent ?? "").replace(/\s+/g, " ").trim();
    if (typed === saved.current) return;
    saved.current = typed;
    void save(() => saveTitleAction(eventId, typed));
  };

  return (
    <h1
      ref={heading}
      id={TITLE_ID}
      role="textbox"
      aria-label={t("titleLabel")}
      aria-multiline={false}
      data-placeholder={t("titlePlaceholder")}
      suppressContentEditableWarning
      onInput={(event) => {
        setLength(event.currentTarget.textContent?.length ?? 0);
        clearTimeout(timer.current);
        timer.current = setTimeout(flush, DEBOUNCE);
      }}
      onBlur={flush}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          heading.current?.blur();
        }
      }}
      onPaste={(event) => {
        // Where the browser cannot keep a paste plain itself, the text alone goes in.
        if (event.currentTarget.contentEditable === "plaintext-only") return;
        event.preventDefault();
        document.execCommand("insertText", false, event.clipboardData.getData("text/plain").replace(/\s+/g, " "));
      }}
      className={cn(
        "font-title -mx-2 cursor-text rounded-2xl px-2 text-balance break-words outline-none drop-shadow-title transition-colors hover:bg-theme-glass focus:bg-theme-glass focus:ring-2 focus:ring-theme-accent motion-reduce:transition-none",
        "empty:before:text-theme-text-faint empty:before:content-[attr(data-placeholder)]",
        font.className,
        compact ? font.sizes.compact : length > LONG_TITLE ? font.sizes.long : font.sizes.short,
      )}
    />
  );
}
