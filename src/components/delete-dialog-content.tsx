"use client";

import { useRef, type ComponentProps } from "react";
import { AlertDialogContent } from "@/components/ui/alert-dialog";

// The confirmation for taking something off a page. Once confirmed, the thing goes, and the button
// that opened the dialog goes with it, so the focus, which returns to that button when the dialog
// closes, would fall to the document and a screen reader would start again from the top. When
// that button is no longer on the page, the focus goes to the element `focusAfter` names instead:
// the heading of the section the thing was in. Cancelled, the dialog returns the focus to the
// button as any dialog does.
export function DeleteDialogContent({ focusAfter, ...props }: ComponentProps<typeof AlertDialogContent> & { focusAfter: string }) {
  const opener = useRef<Element | null>(null);
  return (
    <AlertDialogContent
      {...props}
      onOpenAutoFocus={(event) => {
        // While the dialog is open, the button that opened it names it as the content it controls.
        opener.current = document.querySelector(`[aria-controls="${CSS.escape((event.target as HTMLElement).id)}"]`);
      }}
      onCloseAutoFocus={(event) => {
        if (opener.current?.isConnected) return;
        event.preventDefault();
        document.getElementById(focusAfter)?.focus();
      }}
    />
  );
}
