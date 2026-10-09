import { useState, type RefObject } from "react";

// Copying the guest's edit link, as every layout's confirmation offers it beside the link itself
// (`shown`). The clipboard is missing outside a secure context, and many in-app browsers, where a
// guest arrives from a chat app, refuse to write to it. Then the link is written out whole rather
// than cut short (`failed`), and selected, so the guest can copy it by hand.
export function useCopyLink(link: string, shown: RefObject<HTMLElement | null>) {
  const [outcome, setOutcome] = useState<"copied" | "failed">();
  const copy = () =>
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(link))
      .then(
        () => setOutcome("copied"),
        () => {
          setOutcome("failed");
          if (shown.current) getSelection()?.selectAllChildren(shown.current);
        },
      );
  return { copy, copied: outcome === "copied", failed: outcome === "failed" };
}
