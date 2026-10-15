"use client";

import type { ReactNode } from "react";

// Revoking a co-host link takes it off the list, and its Revoke button with it, so the focus,
// which was on that button, would fall to the document and a screen reader would start again from
// the top. It goes to `focusAfter`, the links' heading, instead, as it does once a confirmed
// removal has gone (DeleteDialogContent).
export function RevokeLinkForm({ revoke, focusAfter, children }: { revoke: () => Promise<void>; focusAfter: string; children: ReactNode }) {
  return (
    <form
      action={async () => {
        await revoke();
        document.getElementById(focusAfter)?.focus();
      }}
    >
      {children}
    </form>
  );
}
