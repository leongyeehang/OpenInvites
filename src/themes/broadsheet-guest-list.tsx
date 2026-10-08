import { Lock } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import type { RsvpCounts } from "@/rsvps/counts";
import type { PublicGuest } from "@/rsvps/repository";

// The guest list as the event page may show it to this viewer (rsvps/visibility.ts): the names,
// or, under "after you reply", a blurred promise of them, of which nothing reaches the browser.
// Hidden, there is no list at all, so no value. `you` is the viewer's own RSVP, when they have one.
export type BroadsheetGuests = { view: "open" | "locked"; guests: PublicGuest[]; counts: RsvpCounts; you?: string };

// The Broadsheet's guest list, typeset (spec, "Broadsheet"): who is going as a numbered list, each
// with the people they bring as "+N" and the viewer's own line marked, then the maybes on one line
// beneath. Nobody who can't go is listed; the headcount is the Host fact's. The numbers are for
// the eye; the list numbers itself for a screen reader.
export async function BroadsheetGuestList({ view, guests, you }: BroadsheetGuests) {
  const [t, format] = await Promise.all([getTranslations("EventPage"), getFormatter()]);

  if (view === "locked") {
    return (
      <>
        <ol aria-hidden className="grid gap-x-8 gap-y-1.5 blur-[6px] sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <li key={index} className="flex items-baseline gap-3 border-b border-theme-text/20 pb-1.5">
              <span className="font-mono text-xs text-theme-text-faint">{String(index + 1).padStart(2, "0")}</span>
              <span className="my-1.5 h-3 flex-1 rounded-full bg-theme-text/30" />
            </li>
          ))}
        </ol>
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-theme-text-faint">
          <Lock className="size-3.5" aria-hidden /> {t("locked")}
        </p>
      </>
    );
  }

  if (guests.length === 0) return <p className="text-theme-text-muted">{t("nobodyYet")}</p>;

  const going = guests.filter((guest) => guest.status === "going");
  const maybe = guests.filter((guest) => guest.status === "maybe");
  return (
    <>
      {going.length > 0 && (
        <ol className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
          {going.map((guest, index) => (
            <li key={guest.id} className="flex items-baseline gap-3 border-b border-theme-text/20 pb-1.5">
              <span aria-hidden className="font-mono text-xs text-theme-text-faint tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 text-lg break-words">{guest.name}</span>
              {guest.plusOnes > 0 && <span className="font-mono text-xs text-theme-text-muted">+{guest.plusOnes}</span>}
              {guest.id === you && (
                <span className="rounded-full bg-theme-accent px-1.5 font-mono text-[10px] tracking-wider text-theme-on-accent uppercase">{t("broadsheet.you")}</span>
              )}
            </li>
          ))}
        </ol>
      )}
      {maybe.length > 0 && (
        <p className="mt-4 text-sm text-theme-text-muted">
          <span className="label-mono">{t("status.maybe")}</span> · {format.list(maybe.map((guest) => guest.name))}
        </p>
      )}
    </>
  );
}
