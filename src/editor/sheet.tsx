"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// A sheet of the editor (M4 spec, "The editor"): from the foot of the screen below lg, as a panel
// down the right from lg (ticket 10), in a dark frosted look, so it reads over any poster. It is a
// dialog: its heading has the focus as it opens, Escape closes it, and the focus goes back to
// whatever opened it. A design sheet (Poster, Title, Theme, Effect) takes half a small screen, and
// the invitation shrinks above it to a live copy (globals.css, design-sheet), which a tap closes it
// from: nothing dims it. Beside a panel, the invitation keeps its size and slides clear of it
// (editor-sheet-open).
export function EditorSheet({
  open,
  onOpenChange,
  title,
  description,
  tall = false,
  design = false,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  // Settings and the More menu take most of a phone's screen; the details' sheets, what they need.
  tall?: boolean;
  design?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const t = useTranslations("Editor");
  // What had the focus as the sheet opened (a toolbar button, a detail's row), which has it again
  // as the sheet closes: Radix gives it back only to a Dialog.Trigger, and these open from state.
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={cn("fixed inset-0 z-50", !design && "bg-black/30 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in")} />
        <Dialog.Content
          data-slot={design ? "design-sheet" : "editor-sheet"}
          onCloseAutoFocus={(event) => {
            if (!opener.current?.isConnected) return;
            event.preventDefault();
            opener.current.focus();
            opener.current = null;
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
            (event.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-sheet-heading]")?.focus();
          }}
          className={cn(
            "dark fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-3xl border-t bg-popover/95 text-popover-foreground shadow-2xl backdrop-blur-2xl outline-none",
            design ? "h-[52dvh]" : tall ? "max-h-[88dvh]" : "max-h-[75dvh]",
            "lg:inset-y-3 lg:right-3 lg:h-auto lg:left-auto lg:max-h-none lg:w-96 lg:rounded-3xl lg:border",
            "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-bottom motion-safe:lg:data-[state=open]:slide-in-from-bottom-0 motion-safe:lg:data-[state=open]:slide-in-from-right",
          )}
        >
          <header className="flex items-start justify-between gap-3 border-b px-5 py-3.5">
            <div className="min-w-0">
              <Dialog.Title data-sheet-heading tabIndex={-1} className="font-medium outline-none">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label={t("closeSheet")}
              className="-mr-2 grid size-10 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </header>
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">{children}</div>
          {footer && <div className="border-t px-5 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
