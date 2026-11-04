"use client";

import { Palette } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/themes/themed-page";

// The panel is the host's alone and the heaviest thing on the page, so it is fetched the first
// time the host opens it, and never with the page a guest loads.
const DesignPanel = dynamic(() => import("./design-panel").then((loaded) => loaded.DesignPanel));

// The host's Design drawer (spec, "Host: the look"): a Design button on their own event page,
// which opens the panel beside the invitation. In the editor's toolbar (`inToolbar`) the button
// sits among the toolbar's, rather than in a corner of its own.
export function DesignDrawer({ eventId, maxUploadBytes, inToolbar = false }: { eventId: string; maxUploadBytes: number; inToolbar?: boolean }) {
  const t = useTranslations("DesignDrawer");
  const { accent } = useTheme().resolved;
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Closing the panel hands focus back to the Design button.
  useEffect(() => {
    if (!open && wasOpen.current) opener.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return open ? (
    <DesignPanel eventId={eventId} maxUploadBytes={maxUploadBytes} onClose={() => setOpen(false)} />
  ) : (
    <button
      ref={opener}
      type="button"
      onClick={() => setOpen(true)}
      aria-expanded={false}
      // It sits bottom right, and moves to the top while a guest's RSVP sheet is open there. Where
      // the Thread's composer spans the foot of a narrow screen, it sits above two rows of its
      // chips, and above the Poster's reply bar. It sits on the invitation's backdrop, which can be
      // any colour, so focus rings it inside, in its own label's colour.
      className={cn(
        "dark z-40 inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border bg-popover/90 pr-4 pl-3 text-sm font-medium text-popover-foreground shadow-xl backdrop-blur-xl transition-colors hover:bg-popover focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-current",
        !inToolbar &&
          "fixed right-4 bottom-[max(env(safe-area-inset-bottom),1rem)] rsvp-sheet-open:top-[max(env(safe-area-inset-top),1rem)] rsvp-sheet-open:bottom-auto thread-page:max-md:bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+9rem)] poster-page:bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+5.5rem)]",
      )}
    >
      <span aria-hidden className="size-3 rounded-full ring-2 ring-foreground/40" style={{ background: accent }} />
      <Palette className="size-4" aria-hidden />
      {t("open")}
    </button>
  );
}
